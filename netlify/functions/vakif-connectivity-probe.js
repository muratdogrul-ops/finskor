/**
 * Vakıfbank MPI/VPOS uçlarına Netlify + vakif-fetch (QuotaGuard) ile erişim testi.
 *
 * GET /.netlify/functions/vakif-connectivity-probe
 *   ?ping=1     — anında 200 (modül yok)
 *   (parametre yok) — varsayılan KISA: ~9 sn içinde biter (Netlify ücretsiz ~10s limiti → 502 önlemi)
 *   ?full=1     — yalnız VAKIF_CONNECTIVITY_LONG=1 iken (6 probelar; uzun süre + ücretli plan önerilir)
 *
 * Uzun banka probu: Netlify env VAKIF_CONNECTIVITY_LONG=1 (+ isteğe PROBE_MS / RACE_MS)
 * Statik yardım: /finskor-connectivity-yardim.json
 *
 * İsteğe bağlı: VAKIF_CONNECTIVITY_PROBE_SECRET — varsa ?k=... zorunlu
 */
'use strict';

const dns = require('dns').promises;

function useLongConnectivity() {
  return (process.env.VAKIF_CONNECTIVITY_LONG || '').trim() === '1';
}

function probeMs() {
  const long = useLongConnectivity();
  const def = long ? 12000 : 5500;
  const cap = long ? 55000 : 7000;
  const n = parseInt(process.env.VAKIF_CONNECTIVITY_PROBE_MS || String(def), 10);
  return Math.min(Math.max(Number.isFinite(n) ? n : def, long ? 4000 : 2500), cap);
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
  const long = useLongConnectivity();
  if (full) {
    if (!long) return 0;
    const def = 55000;
    const n = parseInt(process.env.VAKIF_CONNECTIVITY_RACE_MS || String(def), 10);
    return Math.min(Math.max(Number.isFinite(n) ? n : def, 15000), 120000);
  }
  /* Tek prob: ücretsiz planda soğuk başlangıç + iş ≤ ~10 sn olmalı */
  const def = long ? 38000 : 8800;
  const maxCap = long ? 58000 : 9200;
  const n = parseInt(process.env.VAKIF_CONNECTIVITY_RACE_MS || String(def), 10);
  return Math.min(Math.max(Number.isFinite(n) ? n : def, 4000), maxCap);
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
          hint: 'Fonksiyon ayakta. Banka: parametresiz (kısa, 502 riski düşük) veya uzun mod için env VAKIF_CONNECTIVITY_LONG=1 + ?full=1. Statik: /finskor-connectivity-yardim.json',
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

  if (full && hardMs === 0) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(
        {
          error: 'FULL_REQUIRES_LONG',
          message:
            '?full=1 altı paralel prob uzundur; Netlify ücretsiz ~10s’de HTTP 502 üretir.',
          fix: 'Netlify env: VAKIF_CONNECTIVITY_LONG=1 + ücretli planda function timeout ≥26s. Tek prob: parametresiz URL (kısa).',
          yardim: '/finskor-connectivity-yardim.json',
          at: new Date().toISOString(),
        },
        null,
        2
      ),
    };
  }

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
          note: useLongConnectivity()
            ? 'Uzun mod: tek MPI GET daha uzun süre bekler. Kısa mod (varsayılan): Netlify 10s limiti için süre sınırlı; yavaş banka reachable:false dönebilir — env VAKIF_CONNECTIVITY_LONG=1 veya gerçek MPI deneyin.'
            : 'Kısa mod (~9s tavan): 502 yerine JSON dönmek için. Yavaş QuotaGuard/banka için Netlify’da VAKIF_CONNECTIVITY_LONG=1 + Pro. ?ping=1 | yardım: /finskor-connectivity-yardim.json',
          connectivity_mode: useLongConnectivity() ? 'long' : 'short',
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
            'Kısa modda süre dolduysa: Netlify env VAKIF_CONNECTIVITY_LONG=1 ve RACE_MS/PROBE_MS (yardım: /finskor-connectivity-yardim.json). ?full=1 için LONG=1 şart.',
        },
        null,
        2
      ),
    };
  }
};
