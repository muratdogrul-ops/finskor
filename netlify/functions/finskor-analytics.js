'use strict';

/**
 * FinSkor ürün içi ölçüm olayları — Supabase'e append-only kayıt.
 * Tarayıcıdan anon POST kabul eder; payload küçük tutulur.
 */
const https = require('https');
const { sbHost, sbKey } = require('./sb-config');

function sbPost(table, row) {
  return new Promise((resolve) => {
    const body = JSON.stringify(row);
    const key = sbKey();
    const req = https.request(
      {
        hostname: sbHost(),
        path: '/rest/v1/' + table,
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: 'Bearer ' + key,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode || 0));
      }
    );
    req.on('error', () => resolve(0));
    req.write(body);
    req.end();
  });
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(obj),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, { ok: true });
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_) {
    return json(400, { ok: false, error: 'json' });
  }

  const eventName = String(body.event || body.name || '').trim();
  if (!eventName || eventName.length > 80) return json(400, { ok: false, error: 'event' });

  const props = body.props && typeof body.props === 'object' ? body.props : {};
  const attribution = body.attribution && typeof body.attribution === 'object' ? body.attribution : {};
  const page = String(body.page || '').slice(0, 512);
  const referrer = String(body.referrer || '').slice(0, 512);
  const userAgent = String(body.userAgent || '').slice(0, 512);

  const row = {
    event: eventName,
    props,
    attribution,
    page: page || null,
    referrer: referrer || null,
    user_agent: userAgent || null,
  };

  const code = await sbPost('finskor_analytics_events', row);
  if (!code || code >= 400) return json(503, { ok: false, error: 'insert' });
  return json(200, { ok: true });
};
