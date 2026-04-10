'use strict';
/**
 * Baykuş yanıt geri bildirimi → baykus_events (avatar_feedback).
 * CORS: app.html ile aynı origin veya Netlify üzerinden.
 */
const { insertBaykusEvent } = require('./baykus-events-sb');

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors() };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }), headers: cors() };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Geçersiz JSON' }) };
  }

  const requestId = typeof body.request_id === 'string' ? body.request_id.trim() : '';
  if (!requestId || !UUID_RE.test(requestId)) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Geçersiz request_id' }) };
  }

  const rating = Number(body.rating);
  if (rating !== 1 && rating !== -1) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'rating 1 veya -1 olmalı' }) };
  }

  let comment = typeof body.comment === 'string' ? body.comment.trim() : '';
  if (comment.length > 500) comment = comment.slice(0, 500);

  const payload = { rating, comment: comment || undefined };

  const code = await insertBaykusEvent({
    event_type: 'avatar_feedback',
    request_id: requestId,
    payload,
  });

  if (code < 200 || code >= 300) {
    return {
      statusCode: 503,
      headers: cors(),
      body: JSON.stringify({ error: 'Kayıt başarısız', ok: false }),
    };
  }

  return { statusCode: 200, headers: cors(), body: JSON.stringify({ ok: true }) };
};
