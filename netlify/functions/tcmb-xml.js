// NakitFlow: TCMB döviz XML — sunucu tarafı (CORS yok); yalnızca tcmb.gov.tr/kurlar/* SSRF korumalı
const https = require('https');
const { URL } = require('url');

const UA = 'FinSkor-NakitFlow/1.0 (+https://finskor.tr)';

function isAllowedTcmbUrl(href) {
  let u;
  try {
    u = new URL(href);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  if (u.hostname !== 'www.tcmb.gov.tr') return false;
  if (!u.pathname.startsWith('/kurlar/')) return false;
  if (u.search && u.search.length > 0) return false;
  return true;
}

function fetchHttpsText(href) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      href,
      {
        headers: { 'User-Agent': UA, Accept: 'application/xml,text/xml,*/*' },
        timeout: 20000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode !== 200) {
            reject(new Error('TCMB HTTP ' + res.statusCode));
            return;
          }
          resolve(body);
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };
  }

  let raw = event.queryStringParameters && (event.queryStringParameters.u || event.queryStringParameters.url);
  if (!raw) {
    return { statusCode: 400, headers: cors, body: 'Eksik parametre: u' };
  }
  try {
    raw = decodeURIComponent(raw);
  } catch {
    return { statusCode: 400, headers: cors, body: 'Geçersiz URL kodlaması' };
  }

  if (!isAllowedTcmbUrl(raw)) {
    return { statusCode: 403, headers: cors, body: 'Yalnızca https://www.tcmb.gov.tr/kurlar/... adresleri' };
  }

  try {
    const xml = await fetchHttpsText(raw);
    return {
      statusCode: 200,
      headers: {
        ...cors,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=120',
      },
      body: xml,
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: cors,
      body: 'TCMB: ' + (e && e.message ? e.message : 'bilinmeyen hata'),
    };
  }
};
