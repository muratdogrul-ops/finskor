'use strict';

/**
 * Fininsaat ERP — tarayıcı same-origin kalır; gerçek API adresi yalnızca sunucuda (INSAAT_ERP_API_URL).
 * Çağrı: /.netlify/functions/insaat-erp-proxy?p=/auth/login  (p = /api/v1 sonrası yol + isteğe bağlı ?query)
 */
exports.handler = async (event) => {
  const BASE = (process.env.INSAAT_ERP_API_URL || '').trim().replace(/\/+$/, '');
  if (!BASE) {
    return json(503, {
      success: false,
      message:
        'ERP sunucu adresi tanımlı değil. Netlify → Site settings → Environment variables → INSAAT_ERP_API_URL',
    });
  }

  let raw = (event.queryStringParameters && event.queryStringParameters.p) || '';
  try {
    raw = decodeURIComponent(raw);
  } catch (_) {}
  if (!raw.startsWith('/')) raw = '/' + raw;
  if (raw.includes('..') || raw.startsWith('//')) {
    return json(400, { success: false, message: 'Geçersiz istek yolu.' });
  }

  const target = BASE + '/api/v1' + raw;
  const method = (event.httpMethod || 'GET').toUpperCase();

  const headers = {};
  const auth = pickHeader(event.headers, 'authorization');
  if (auth) headers.Authorization = auth;
  const ct = pickHeader(event.headers, 'content-type');
  if (ct && method !== 'GET' && method !== 'HEAD') headers['Content-Type'] = ct;

  const opts = { method, headers };
  if (method !== 'GET' && method !== 'HEAD' && event.body) {
    opts.body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  }

  let res;
  try {
    res = await fetch(target, opts);
  } catch (_e) {
    return json(502, { success: false, message: 'ERP sunucusuna ulaşılamadı.' });
  }

  const text = await res.text();
  const ctOut = res.headers.get('content-type') || 'application/json; charset=utf-8';

  return {
    statusCode: res.status,
    headers: { 'Content-Type': ctOut },
    body: text,
  };
};

function pickHeader(h, name) {
  if (!h) return '';
  const lower = name.toLowerCase();
  for (const k of Object.keys(h)) {
    if (k.toLowerCase() === lower) return h[k];
  }
  return '';
}

function json(code, obj) {
  return {
    statusCode: code,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(obj),
  };
}
