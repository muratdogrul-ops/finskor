/**
 * Vakıfbank'a giden HTTPS istekleri — QuotaGuard Static / HTTP CONNECT proxy
 *
 * Netlify ortam değişkeni (birini kullanın):
 *   QUOTAGUARDSTATIC_URL — QuotaGuard panelindeki tam URL
 *   VAKIF_HTTPS_PROXY    — http://kullanici:sifre@host:port
 *
 * Önceki undici ProxyAgent, Lambda’da CONNECT + bazı proxy’lerle güvenilir değildi;
 * çıkış https-proxy-agent + Node https.request ile yapılır.
 *
 * Proxy URL geçersizse: varsayılan doğrudan fetch + log. Sıkı mod: VAKIF_PROXY_FAIL_CLOSED=1
 */
'use strict';

const dns = require('dns');
const https = require('https');
const hpMod = require('https-proxy-agent');

/** Lambda’da IPv6 önce denenince bankaya CONNECT ~20+ sn gecikme sık görülür */
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

function lookupIpv4(hostname, _opts, cb) {
  dns.lookup(hostname, { family: 4 }, cb);
}
const HttpsProxyAgent = typeof hpMod === 'function' ? hpMod : hpMod.HttpsProxyAgent || hpMod.default;

const REQUEST_MS = Math.min(
  Math.max(parseInt(process.env.VAKIF_HTTPS_TIMEOUT_MS || '55000', 10) || 55000, 5000),
  120000
);

let _resolved = false;
let _proxyUrlForAgent = null;
let _proxyHost = null;
let _proxyError = null;
let _cachedAgent = null;
let _loggedReady = false;

function proxyUrlRaw() {
  return (process.env.QUOTAGUARDSTATIC_URL || process.env.VAKIF_HTTPS_PROXY || '').trim();
}

function normalizeProxyUrl(raw) {
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    const u = new URL(withProto);
    if (!u.hostname) return { error: 'Proxy URL’de hostname yok.' };
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { error: 'Proxy http:// veya https:// ile başlamalı (QuotaGuard genelde http://).' };
    }
    return { href: u.href };
  } catch (e) {
    return { error: e.message || String(e) };
  }
}

function resolveProxyConfig() {
  if (_resolved) return;
  _resolved = true;
  _proxyUrlForAgent = null;
  _proxyHost = null;
  _proxyError = null;
  _cachedAgent = null;

  const raw = proxyUrlRaw();
  if (!raw) return;

  const n = normalizeProxyUrl(raw);
  if (n.error) {
    _proxyError = n.error;
    console.error('[vakif-fetch] Proxy URL geçersiz:', _proxyError);
    return;
  }

  try {
    _cachedAgent = new HttpsProxyAgent(n.href);
    _proxyUrlForAgent = n.href;
    _proxyHost = new URL(n.href).hostname;
  } catch (e) {
    _proxyError = e.message || String(e);
    _cachedAgent = null;
    console.error('[vakif-fetch] HttpsProxyAgent oluşturulamadı:', _proxyError);
  }
}

function getOrCreateAgent() {
  if (_cachedAgent) return _cachedAgent;
  if (!_proxyUrlForAgent) return null;
  _cachedAgent = new HttpsProxyAgent(_proxyUrlForAgent);
  return _cachedAgent;
}

function wrapNodeResponse(statusCode, headersObj, bodyText) {
  const lower = {};
  for (const k of Object.keys(headersObj)) {
    lower[String(k).toLowerCase()] = headersObj[k];
  }
  return {
    ok: statusCode >= 200 && statusCode < 300,
    status: statusCode,
    headers: {
      get(name) {
        return lower[String(name).toLowerCase()] ?? null;
      },
    },
    text: async () => bodyText,
    json: async () => JSON.parse(bodyText),
  };
}

function flattenHeaders(h) {
  if (!h || typeof h !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(h)) {
    if (v != null && v !== '') out[k] = String(v);
  }
  return out;
}

/** QuotaGuard / upstream bazen ekler; Vakıfbank WAF tetiklenebilir — bankaya gönderilmez. */
const PROXY_HOP_HEADER_NAMES = new Set([
  'x-forwarded-for',
  'via',
  'proxy-connection',
  'forwarded',
  'x-real-ip',
]);

function stripProxyHopHeaders(headers) {
  if (!headers || typeof headers !== 'object') return;
  for (const key of Object.keys(headers)) {
    if (PROXY_HOP_HEADER_NAMES.has(String(key).toLowerCase())) delete headers[key];
  }
}

/**
 * HTTPS hedefe, HTTP CONNECT proxy üzerinden istek (Vakıfbank MPI/VPOS).
 */
function requestViaHttpsProxy(targetUrl, options = {}) {
  const agent = getOrCreateAgent();
  if (!agent) {
    return Promise.reject(new Error('Proxy agent yok'));
  }

  let u;
  try {
    u = new URL(targetUrl);
  } catch (e) {
    return Promise.reject(e);
  }

  const method = String(options.method || 'GET').toUpperCase();
  const headers = flattenHeaders(options.headers);
  stripProxyHopHeaders(headers);
  const body = options.body;
  const reqMs = Number.isFinite(options.timeoutMs)
    ? Math.min(REQUEST_MS, Math.max(1000, options.timeoutMs))
    : REQUEST_MS;

  if (body != null && headers['content-length'] == null && headers['Content-Length'] == null) {
    const buf = typeof body === 'string' ? Buffer.from(body, 'utf8') : Buffer.from(body);
    headers['Content-Length'] = String(buf.length);
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method,
        headers,
        agent,
        servername: u.hostname,
        lookup: lookupIpv4,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve(wrapNodeResponse(res.statusCode || 0, res.headers, text));
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(reqMs, () => {
      req.destroy(new Error(`HTTPS istek zaman aşımı (${reqMs} ms)`));
    });

    if (body != null) {
      req.write(typeof body === 'string' ? body : Buffer.from(body));
    }
    req.end();
  });
}

function getVakifEgressStatus() {
  resolveProxyConfig();
  const raw = proxyUrlRaw();
  let proxyHost = _proxyHost;
  if (!proxyHost && raw) {
    const n = normalizeProxyUrl(raw);
    if (!n.error) {
      try {
        proxyHost = new URL(n.href).hostname;
      } catch (_) {
        /* ignore */
      }
    }
  }
  return {
    proxyUrlConfigured: !!raw,
    proxyHost,
    proxyAgentActive: !!_proxyUrlForAgent,
    proxyAgentError: _proxyError,
  };
}

async function vakifFetch(url, options = {}) {
  resolveProxyConfig();
  const rawConfigured = !!proxyUrlRaw();
  const failClosed = (process.env.VAKIF_PROXY_FAIL_CLOSED || '').trim() === '1';

  if (rawConfigured && !_proxyUrlForAgent && failClosed) {
    throw new Error(
      'VAKIF_EGRESS_PROXY_REQUIRED: QuotaGuard/proxy tanımlı ama kullanılamıyor. ' +
        (_proxyError ? `Sebep: ${_proxyError} ` : '') +
        'QUOTAGUARDSTATIC_URL biçimini kontrol edin (http://kullanici:sifre@host:port).'
    );
  }

  if (rawConfigured && !_proxyUrlForAgent && !failClosed) {
    console.error(
      '[vakif-fetch] UYARI: Proxy URL tanımlı ama geçersiz — doğrudan çıkış (WAF / Request Rejected riski).',
      _proxyError || ''
    );
  }

  if (_proxyUrlForAgent) {
    if (!_loggedReady) {
      _loggedReady = true;
      console.log(
        '[vakif-fetch] Sabit çıkış: https-proxy-agent →',
        _proxyHost || '(host)',
        '— MPI/VPOS bu üzerinden.'
      );
    }
    return requestViaHttpsProxy(url, options);
  }

  if (!_loggedReady) {
    _loggedReady = true;
    console.warn(
      '[vakif-fetch] Proxy yok — doğrudan Netlify çıkışı. Vakıfbank HTML/WAF için QUOTAGUARDSTATIC_URL ekleyin.'
    );
  }
  /* Proxy yolunda setTimeout var; düz fetch’te yoktu — takılınca mpi_enroll_jobs running’de kalıyordu. */
  const merged = { ...options };
  if (merged.signal == null && typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    merged.signal = AbortSignal.timeout(REQUEST_MS);
  } else if (merged.signal == null) {
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), REQUEST_MS);
    try {
      return await fetch(url, { ...merged, signal: ac.signal });
    } finally {
      clearTimeout(tid);
    }
  }
  return fetch(url, merged);
}

function vakifFetchErrorResponse(err) {
  const em = String(err && err.message ? err.message : err);
  if (!em.includes('VAKIF_EGRESS_PROXY_REQUIRED')) return null;
  return {
    code: 'PROXY_MISCONFIGURED',
    message: em.replace(/^VAKIF_EGRESS_PROXY_REQUIRED:\s*/, ''),
  };
}

module.exports = { vakifFetch, getVakifEgressStatus, vakifFetchErrorResponse };
