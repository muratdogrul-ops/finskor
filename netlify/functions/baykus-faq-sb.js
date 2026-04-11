'use strict';
/**
 * baykus_faq_entries — service role ile SELECT (RLS bypass).
 */
const https = require('https');
const { sbHost, sbKey } = require('./sb-config');

function kbFeatureEnabled() {
  const v = String(process.env.FINSKOR_AVATAR_KB || '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/**
 * @param {number} maxRows
 * @param {number} timeoutMs
 * @returns {Promise<Array<{keywords:string,answer:string,sort_order:number}>>}
 */
function fetchFaqEntries(maxRows, timeoutMs) {
  return new Promise((resolve) => {
    const key = sbKey();
    if (!key) return resolve([]);

    const limit = Math.min(Math.max(1, Number(maxRows) || 150), 250);
    const path =
      '/rest/v1/baykus_faq_entries?active=eq.true&select=keywords,answer,sort_order&order=sort_order.asc&limit=' +
      limit;

    let timer;
    let settled = false;
    function done(rows) {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(rows);
    }

    const req = https.request(
      {
        hostname: sbHost(),
        path,
        method: 'GET',
        headers: {
          apikey: key,
          Authorization: 'Bearer ' + key,
          Accept: 'application/json',
        },
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => {
          buf += c;
        });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) return done([]);
          try {
            const rows = JSON.parse(buf);
            if (!Array.isArray(rows)) return done([]);
            done(rows);
          } catch (_) {
            done([]);
          }
        });
      }
    );

    timer = setTimeout(() => {
      try {
        req.destroy();
      } catch (_) {
        /* ignore */
      }
      done([]);
    }, Math.min(Math.max(timeoutMs || 3000, 500), 8000));

    req.on('error', () => done([]));
    req.end();
  });
}

module.exports = { fetchFaqEntries, kbFeatureEnabled };
