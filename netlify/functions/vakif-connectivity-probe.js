/**
 * Vakıfbank MPI/VPOS uçlarına Netlify + vakif-fetch (QuotaGuard) ile erişim testi.
 * GET /.netlify/functions/vakif-connectivity-probe
 *
 * İsteğe bağlı: VAKIF_CONNECTIVITY_PROBE_SECRET — varsa ?k=... zorunlu
 * Süre: VAKIF_CONNECTIVITY_PROBE_MS (varsayılan 6000). Tam tarama tek GET/URL. 502: ?lite=1 veya timeout artırın.
 */
'use strict';

const dns = require('dns').promises;
const {
  resolveMpiEnrollUrl,
  resolveVposUrl,
  resolveMpiStartThreeDFlowUrl,
} = require('./vakif-mpi-shared');
const { vakifFetch, getVakifEgressStatus } = require('./vakif-fetch');

function probeMs() {
  const n = parseInt(process.env.VAKIF_CONNECTIVITY_PROBE_MS || '6000', 10);
  return Math.min(Math.max(Number.isFinite(n) ? n : 6000, 2500), 20000);
}

/** Banka 443 / 4443 ayrımı için her iki portu da dene */
function forceHttpsPort(url, port) {
  try {
    const u = new URL(url);
    if (port === 443) {
      u.port = '';
    } else {
      u.port = String(port);
    }
    return u.href;
  } catch {
    return url;
  }
}

async function resolveHostA(hostname) {
  try {
    const r = await Promise.race([
      dns.lookup(hostname, { family: 4 }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('DNS zaman aşımı (2.5s)')), 2500)),
    ]);
    return { hostname, ipv4: r.address };
  } catch (e) {
    return { hostname, ipv4: null, error: String(e.message || e) };
  }
}

async function probeUrl(url, method) {
  const t0 = Date.now();
  const msLimit = probeMs();
  try {
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), msLimit);
    try {
      const res = await vakifFetch(url, {
        method,
        timeoutMs: msLimit,
        headers: {
          Accept: '*/*',
          'User-Agent': 'FinSkor-Connectivity-Probe/1.0',
        },
        signal: ac.signal,
      });
      clearTimeout(tid);
      const elapsed = Date.now() - t0;
      const status = res.status;
      await res.text().catch(() => '');
      return {
        reachable: true,
        httpStatus: status,
        ms: elapsed,
        error: null,
        url,
        method,
      };
    } catch (e) {
      clearTimeout(tid);
      throw e;
    }
  } catch (e) {
    const elapsed = Date.now() - t0;
    const name = e && e.name;
    let msg = String(e && e.message ? e.message : e);
    if (name === 'AbortError') msg = `Zaman aşımı (~${msLimit} ms)`;
    return {
      reachable: false,
      httpStatus: null,
      ms: elapsed,
      error: msg,
      url,
      method,
    };
  }
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
    }
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, headers, body: JSON.stringify({ error: 'GET only' }) };
    }

    const secret = (process.env.VAKIF_CONNECTIVITY_PROBE_SECRET || '').trim();
    if (secret) {
      const k = event.queryStringParameters && event.queryStringParameters.k;
      if (k !== secret) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Geçersiz veya eksik k parametresi' }) };
      }
    }

    const qp = event.queryStringParameters || {};
    const mode = (process.env.VAKIF_INIT || 'test').toLowerCase() === 'prod' ? 'prod' : 'test';

    /* Tek URL — tarayıcı/Netlify 502’den kaçınmak için hızlı kontrol: ?lite=1 */
    if (qp.lite === '1') {
      const url = forceHttpsPort(resolveMpiEnrollUrl(mode), 443);
      const egress = getVakifEgressStatus();
      const probe = await probeUrl(url, 'GET');
      let dnsOne = null;
      try {
        dnsOne = await resolveHostA(new URL(url).hostname);
      } catch (_) {
        dnsOne = null;
      }
      const body = {
        lite: true,
        at: new Date().toISOString(),
        vakif_init_mode: mode,
        probe_timeout_ms: probeMs(),
        url,
        egress: {
          proxyUrlConfigured: egress.proxyUrlConfigured,
          proxyAgentActive: egress.proxyAgentActive,
          proxyHost: egress.proxyHost || null,
        },
        dns_ipv4: dnsOne ? [dnsOne] : [],
        probes: [{ target: 'mpi_enrollment_tcp_443', ...probe }],
        note: 'lite=1 — yalnızca MPI enrollment 443 tek GET. Tam tarama için parametresiz çağırın.',
      };
      return { statusCode: 200, headers, body: JSON.stringify(body, null, 2) };
    }

    const base = [
      { name: 'mpi_enrollment', url: resolveMpiEnrollUrl(mode) },
      { name: 'vpos_sale', url: resolveVposUrl(mode) },
      { name: 'mpi_start_three_d_flow', url: resolveMpiStartThreeDFlowUrl(mode) },
    ];

    const jobs = [];
    for (const row of base) {
      const u443 = forceHttpsPort(row.url, 443);
      const u4443 = forceHttpsPort(row.url, 4443);
      jobs.push({ target: `${row.name}_tcp_443`, url: u443 });
      if (u4443 !== u443) {
        jobs.push({ target: `${row.name}_tcp_4443`, url: u4443 });
      }
    }

    /* Paralel — tek GET (HEAD+GET iki kat süre + 502 riski yaratıyordu) */
    const probes = await Promise.all(
      jobs.map(async ({ target, url }) => ({
        target,
        ...(await probeUrl(url, 'GET')),
      }))
    );

    const hostnames = new Set();
    for (const p of probes) {
      try {
        hostnames.add(new URL(p.url).hostname);
      } catch (_) {
        /* ignore */
      }
    }

    const dnsResults = await Promise.all([...hostnames].map((h) => resolveHostA(h)));

    const egress = getVakifEgressStatus();

    const summary = {
      allReachable: probes.every((p) => p.reachable),
      anyTlsOrNetworkError: probes.some(
        (p) => !p.reachable && /ECONN|TLS|socket|timeout|Zaman|getaddrinfo|ENOTFOUND|certificate/i.test(String(p.error))
      ),
    };

    const body = {
      at: new Date().toISOString(),
      vakif_init_mode: mode,
      probe_timeout_ms: probeMs(),
      egress: {
        proxyUrlConfigured: egress.proxyUrlConfigured,
        proxyAgentActive: egress.proxyAgentActive,
        proxyHost: egress.proxyHost || null,
        proxyMisconfigured: egress.proxyUrlConfigured && !egress.proxyAgentActive,
      },
      dns_ipv4: dnsResults,
      probes,
      summary,
      note:
        'reachable=true → TCP+TLS ile host:port açıldı; httpStatus (401/405/415 vb.) normal olabilir. reachable=false + ECONN/TLS/Zaman aşımı → port/firewall/yol sorunu. dns_ipv4 değerlerini bankanın verdiği 195.142… listesi ile karşılaştırın. Gerçek MPI için XML body gerekir. 502 alırsanız önce ?lite=1 deneyin.',
    };

    return { statusCode: 200, headers, body: JSON.stringify(body, null, 2) };
  } catch (e) {
    console.error('vakif-connectivity-probe fatal', e);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(
        {
          error: 'PROBE_INTERNAL',
          message: String(e && e.message ? e.message : e),
          at: new Date().toISOString(),
          hint: 'Netlify function loglarına bakın. VAKIF_CONNECTIVITY_PROBE_MS çok yüksekse düşürün (ör. 6000).',
        },
        null,
        2
      ),
    };
  }
};
