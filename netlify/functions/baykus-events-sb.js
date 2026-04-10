'use strict';
/**
 * baykus_events tablosuna service role ile tek satır INSERT (RLS bypass).
 * Başarısızlıkta uygulama akışını bozmamak için sessizce statusCode döner.
 */
const https = require('https');
const { sbHost, sbKey } = require('./sb-config');

function insertBaykusEvent(row) {
  return new Promise((resolve) => {
    const body = JSON.stringify(row);
    const key = sbKey();
    const req = https.request(
      {
        hostname: sbHost(),
        path: '/rest/v1/baykus_events',
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

module.exports = { insertBaykusEvent };
