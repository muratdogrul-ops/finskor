/**
 * Sıfır bağımlılık — Netlify fonksiyonları ayakta mı (502 ayrımı).
 * GET /.netlify/functions/vakif-ping
 */
'use strict';

exports.handler = async () => ({
  statusCode: 200,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify({
    ok: true,
    fn: 'vakif-ping',
    at: new Date().toISOString(),
    next: 'Banka probu: /.netlify/functions/vakif-connectivity-probe (varsayılan tek URL, kısa süre)',
  }),
});
