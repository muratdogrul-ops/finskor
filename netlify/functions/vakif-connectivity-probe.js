/**
 * Vakıfbank MPI/VPOS uçlarına Netlify + vakif-fetch (QuotaGuard) ile erişim testi.
 *
 * GET /.netlify/functions/vakif-connectivity-probe
 *   ?ping=1     — anında 200 (ağır modül yüklenmez; 502 teşhisi için)
 *   (parametre yok) — varsayılan: yalnızca MPI enrollment 443, kısa süre (Starter ~10s limit)
 *   ?full=1     — 6 probelar paralel (Pro + timeout 60s önerilir)
 *
 * İsteğe bağlı: VAKIF_CONNECTIVITY_PROBE_SECRET — varsa ?k=... zorunlu
 */
'use strict';

const dns = require('dns').promises;

function probeMs() {
  const n = parseInt(process.env.VAKIF_CONNECTIVITY_PROBE_MS || '4500', 10);
  return Math.min(Math.max(Number.isFinite(n) ? n : 4500, 1500), 12000);
}

function forceHttpsPort(url, port) {
  try {
    const u = new URL(url);
    if (port === 443) u.port = '';
    else u.port = String(port);
    return u.href;
  } catch {
    return url;
  }
}

async function resolveHostA(hostname) {
  try {
    const r = await Promise.race([
      dns.lookup(hostname, { family: 4 }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('DNS zaman aşımı (2s)')), 2000)),
    ]);
    return { hostname, ipv4: r.address };
  } catch (e) {
    return { hostname, ipv4: null, error: String(e.message || e) };
  }
}

async function probeUrl(vakifFetch, url, method) {
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

function raceMs(full) {
  const def = full ? 55000 : 8500;
  const n = parseInt(process.env.VAKIF_CONNECTIVITY_RACE_MS || String(def), 10);
  return Math.min(Math.max(Number.isFinite(n) ? n : def, 3000), full ? 120000 : 12000);
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'GET only' }) };
  }

  const qp = event.queryStringParameters || {};

  /* Hiç require yok — Netlify 502 / cold start teşhisi */
  if (qp.ping === '1') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(
        {
          ok: true,
          ping: true,
          at: new Date().toISOString(),
          hint: 'Bu yanıt geliyorsa fonksiyon çalışıyor. Banka probu için parametresiz veya ?full=1 deneyin.',
        },
        null,
        2
      ),
    };
  }

  const secret = (process.env.VAKIF_CONNECTIVITY_PROBE_SECRET || '').trim();
  if (secret && qp.k !== secret) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Geçersiz veya eksik k parametresi' }) };
  }

  let resolveMpiEnrollUrl;
  let resolveVposUrl;
  let resolveMpiStartThreeDFlowUrl;
  let vakifFetch;
  let getVakifEgressStatus;
  try {
    const shared = require('./vakif-mpi-shared');
    resolveMpiEnrollUrl = shared.resolveMpiEnrollUrl;
    resolveVposUrl = shared.resolveVposUrl;
    resolveMpiStartThreeDFlowUrl = shared.resolveMpiStartThreeDFlowUrl;
    const vf = require('./vakif-fetch');
    vakifFetch = vf.vakifFetch;
    getVakifEgressStatus = vf.getVakifEgressStatus;
  } catch (e) {
    console.error('vakif-connectivity-probe require', e);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(
        {
          error: 'MODULE_LOAD',
          message: String(e && e.message ? e.message : e),
          at: new Date().toISOString(),
        },
        null,
        2
      ),
    };
  }

  const mode = (process.env.VAKIF_INIT || 'test').toLowerCase() === 'prod' ? 'prod' : 'test';
  const full = qp.full === '1';
  const hardMs = raceMs(full);

  try {
    const runBody = async () => {
      const egress = getVakifEgressStatus();

      if (!full) {
        const url = forceHttpsPort(resolveMpiEnrollUrl(mode), 443);
        const probe = await probeUrl(vakifFetch, url, 'GET');
        let dnsOne = null;
        try {
          dnsOne = await resolveHostA(new URL(url).hostname);
        } catch (_) {
          dnsOne = null;
        }
        return {
          at: new Date().toISOString(),
          mode: 'default',
          vakif_init_mode: mode,
          probe_timeout_ms: probeMs(),
          hard_cap_ms: hardMs,
          egress: {
            proxyUrlConfigured: egress.proxyUrlConfigured,
            proxyAgentActive: egress.proxyAgentActive,
            proxyHost: egress.proxyHost || null,
            proxyMisconfigured: egress.proxyUrlConfigured && !egress.proxyAgentActive,
          },
          dns_ipv4: dnsOne ? [dnsOne] : [],
          probes: [{ target: 'mpi_enrollment_tcp_443', ...probe }],
          summary: {
            allReachable: probe.reachable,
            anyTlsOrNetworkError:
              !probe.reachable &&
              /ECONN|TLS|socket|timeout|Zaman|getaddrinfo|ENOTFOUND|certificate/i.test(String(probe.error)),
          },
          note:
            'Varsayılan: tek MPI enrollment 443 GET. Tam 6 probelar için ?full=1 (uzun sürebilir). Anında test: ?ping=1',
        };
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

      const probes = await Promise.all(
        jobs.map(async ({ target, url }) => ({
          target,
          ...(await probeUrl(vakifFetch, url, 'GET')),
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

      const summary = {
        allReachable: probes.every((p) => p.reachable),
        anyTlsOrNetworkError: probes.some(
          (p) => !p.reachable && /ECONN|TLS|socket|timeout|Zaman|getaddrinfo|ENOTFOUND|certificate/i.test(String(p.error))
        ),
      };

      return {
        at: new Date().toISOString(),
        mode: 'full',
        vakif_init_mode: mode,
        probe_timeout_ms: probeMs(),
        hard_cap_ms: hardMs,
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
          'reachable=true → TCP+TLS açıldı; httpStatus 401/405 vb. normal olabilir. Gerçek MPI XML POST ister. Hızlı mod: parametresiz URL.',
      };
    };

    const body = await Promise.race([
      runBody(),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error(`Üst süre aşımı (${hardMs} ms) — Netlify limiti veya proxy/banka yanıt vermiyor.`)), hardMs)
      ),
    ]);

    return { statusCode: 200, headers, body: JSON.stringify(body, null, 2) };
  } catch (e) {
    console.error('vakif-connectivity-probe', e);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(
        {
          error: 'PROBE_FAILED',
          message: String(e && e.message ? e.message : e),
          at: new Date().toISOString(),
          vakif_init_mode: mode,
          hint:
            'Önce ?ping=1 açın. Sonra parametresiz (tek prob). Netlify Starter 10s limitinde ?full=1 kullanmayın. VAKIF_CONNECTIVITY_PROBE_MS düşürün.',
        },
        null,
        2
      ),
    };
  }
};
