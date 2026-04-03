/**
 * Dışarı çıkan IPv4’ü gösterir.
 * QUOTAGUARDSTATIC_URL tanımlıysa vakif-fetch (proxy) ile — whitelist’teki sabit IP görünmeli.
 *
 * GET /.netlify/functions/ip-egress
 * İsteğe bağlı: IP_EGRESS_CHECK_SECRET — varsa ?k=... zorunlu
 *
 * Not: Hata durumunda artık HTTP 502 dönülmez (Chrome “sayfa çalışmıyor” göstermesin);
 * 200 + JSON içinde ok: false ve açıklama.
 */
'use strict';

const { vakifFetch, getVakifEgressStatus } = require('./vakif-fetch');

const IPIFY_MS = Math.min(Math.max(parseInt(process.env.IP_EGRESS_TIMEOUT_MS || '8000', 10) || 8000, 3000), 15000);

async function readIpViaProxy(vakifFetchFn) {
  const res = await vakifFetchFn('https://api.ipify.org?format=json', {
    method: 'GET',
    timeoutMs: IPIFY_MS,
    headers: { Accept: 'application/json' },
  });
  const data = await res.json();
  const ip = data && data.ip ? String(data.ip).trim() : null;
  return { ip, source: 'api.ipify.org' };
}

async function readIpDirect() {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), IPIFY_MS);
  try {
    const res = await fetch('https://api.ipify.org?format=json', {
      headers: { Accept: 'application/json' },
      signal: ac.signal,
    });
    if (!res.ok) throw new Error('ipify HTTP ' + res.status);
    const data = await res.json();
    const ip = data && data.ip ? String(data.ip).trim() : null;
    return { ip, source: 'api.ipify.org' };
  } finally {
    clearTimeout(t);
  }
}

/** ipify bloklu / JSON bozuksa düz metin IP */
async function readIpFallbackDirect() {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), IPIFY_MS);
  try {
    const res = await fetch('https://ifconfig.me/ip', {
      headers: { Accept: 'text/plain' },
      signal: ac.signal,
    });
    if (!res.ok) throw new Error('ifconfig.me HTTP ' + res.status);
    const text = (await res.text()).trim();
    const ip = text && /^[\d.]+$/.test(text) ? text : null;
    return { ip, source: 'ifconfig.me' };
  } finally {
    clearTimeout(t);
  }
}

async function readIpFallbackProxy(vakifFetchFn) {
  const res = await vakifFetchFn('https://ifconfig.me/ip', {
    method: 'GET',
    timeoutMs: IPIFY_MS,
    headers: { Accept: 'text/plain' },
  });
  const text = (await res.text()).trim();
  const ip = text && /^[\d.]+$/.test(text) ? text : null;
  return { ip, source: 'ifconfig.me' };
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

  const secret = process.env.IP_EGRESS_CHECK_SECRET;
  if (secret) {
    const k = event.queryStringParameters && event.queryStringParameters.k;
    if (k !== secret) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Geçersiz veya eksik k parametresi' }) };
    }
  }

  const egress = getVakifEgressStatus();
  const proxyBroken = egress.proxyUrlConfigured && !egress.proxyAgentActive;

  const outBase = {
    at: new Date().toISOString(),
    viaQuotaGuardOrVakifProxy: egress.proxyAgentActive,
    proxyMisconfigured: proxyBroken || undefined,
    proxyAgentError: proxyBroken ? egress.proxyAgentError : undefined,
    timeout_ms: IPIFY_MS,
    note: proxyBroken
      ? 'Proxy URL tanımlı ama başlatılamadı — IP doğrudan Netlify çıkışı olabilir.'
      : egress.proxyAgentActive
        ? 'İstek QuotaGuard/proxy üzerinden; IP Vakıfbank whitelist ile eşleşmeli.'
        : 'Proxy kapalı — Netlify ham çıkışı. Banka için QUOTAGUARDSTATIC_URL önerilir.',
    hint: secret ? null : 'İsterseniz IP_EGRESS_CHECK_SECRET env + ?k=... ile kısıtlayın.',
  };

  let lastErr = null;
  try {
    let row;
    if (egress.proxyAgentActive) {
      try {
        row = await readIpViaProxy(vakifFetch);
      } catch (e1) {
        lastErr = e1;
        row = await readIpFallbackProxy(vakifFetch);
      }
    } else {
      try {
        row = await readIpDirect();
      } catch (e1) {
        lastErr = e1;
        row = await readIpFallbackDirect();
      }
    }

    const ip = row.ip;
    const ipv4 = ip && !ip.includes(':') ? ip : null;

    if (!ip) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: false,
          ...outBase,
          error: 'IP okunamadı',
          detail: lastErr ? String(lastErr.message || lastErr) : null,
          source: row.source,
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        ip,
        ipv4,
        ...outBase,
        source: row.source,
      }),
    };
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: false,
        ...outBase,
        error: 'ipify/ifconfig erişilemedi',
        detail: msg,
        hint2:
          'QuotaGuard URL ve şifreyi kontrol edin; proxy çok yavaşsa IP_EGRESS_TIMEOUT_MS artırın (max 15000).',
      }),
    };
  }
};
