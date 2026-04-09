'use strict';

/**
 * KOSGEB + KGF canlı özet (proxy). CORS açık.
 * - KOSGEB: Her çağrıda resmi sayfaya kısa timeout ile yeniden deneme; başarısızsa son blob önbelleği veya gömülü base.
 * - KGF: Upstream en fazla 24 saatte bir (blob); arada önbellek.
 */
const https = require('https');
const { URL } = require('url');

const BASE = require('./destek-bilgi-base.json');

const UA =
  'Mozilla/5.0 (compatible; FinSkor-DestekBilgi/1.0; +https://finskor.tr) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const URL_KOSGEB = 'https://www.kosgeb.gov.tr/site/tr/genel/destekler/3/destekler';
const URL_KGF = 'https://www.kgf.com.tr/';

const FETCH_TIMEOUT_MS = 8000;
const KGF_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const BLOB_KEY = 'destek-snapshot-v1';
const BLOB_STORE = 'destek-bilgi-cache';

function cors() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  };
}

function allowedTarget(href) {
  return href === URL_KOSGEB || href === URL_KGF;
}

function fetchHttpsText(href) {
  if (!allowedTarget(href)) {
    return Promise.reject(new Error('URL not allowed'));
  }
  let u;
  try {
    u = new URL(href);
  } catch {
    return Promise.reject(new Error('bad url'));
  }
  if (u.protocol !== 'https:') return Promise.reject(new Error('https only'));

  return new Promise((resolve, reject) => {
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.5',
      },
      timeout: FETCH_TIMEOUT_MS,
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({ statusCode: res.statusCode || 0, body });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.end();
  });
}

function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePage(html) {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = m ? stripTags(m[1]).slice(0, 200) : '';
  const excerpt = stripTags(html).slice(0, 420);
  return { title, excerpt };
}

function getBlobStore(event) {
  const { connectLambda, getStore } = require('@netlify/blobs');
  const name = (process.env.DESTEK_BILGI_BLOBS_STORE || BLOB_STORE).trim() || BLOB_STORE;
  if (event && typeof event === 'object' && event.blobs) {
    try {
      connectLambda(event);
    } catch (e) {
      console.error('destek-bilgi connectLambda', e && e.message ? e.message : e);
    }
  }
  try {
    return getStore(name);
  } catch (firstErr) {
    const siteID = String(process.env.SITE_ID || process.env.NETLIFY_SITE_ID || '').trim();
    const token = String(process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_BLOBS_TOKEN || '').trim();
    if (siteID && token) {
      return getStore({ name, siteID, token });
    }
    throw firstErr;
  }
}

async function readSnapshot(event) {
  try {
    const store = getBlobStore(event);
    const raw = await store.get(BLOB_KEY, { type: 'json' });
    return raw && typeof raw === 'object' ? raw : null;
  } catch (e) {
    console.warn('destek-bilgi readSnapshot', e && e.message ? e.message : e);
    return null;
  }
}

async function writeSnapshot(event, snap) {
  try {
    const store = getBlobStore(event);
    await store.setJSON(BLOB_KEY, snap);
  } catch (e) {
    console.warn('destek-bilgi writeSnapshot', e && e.message ? e.message : e);
  }
}

function ageMs(iso) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return Date.now() - t;
}

function buildLiveBlock(prev, url, fetchResult, err) {
  if (fetchResult && fetchResult.statusCode === 200 && fetchResult.body) {
    const meta = parsePage(fetchResult.body);
    return {
      source: 'live',
      url,
      status: fetchResult.statusCode,
      fetchedAt: new Date().toISOString(),
      title: meta.title,
      excerpt: meta.excerpt,
    };
  }
  if (prev && prev.fetchedAt) {
    return {
      source: 'cache',
      url,
      status: prev.status || null,
      fetchedAt: prev.fetchedAt,
      title: prev.title || '',
      excerpt: prev.excerpt || '',
      lastError: err ? String(err.message || err).slice(0, 200) : undefined,
    };
  }
  return {
    source: 'base',
    url,
    status: fetchResult ? fetchResult.statusCode : null,
    fetchedAt: null,
    title: '',
    excerpt: '',
    lastError: err ? String(err.message || err).slice(0, 200) : undefined,
  };
}

exports.handler = async (event) => {
  const headers = cors();
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const generatedAt = new Date().toISOString();
  let snap = (await readSnapshot(event)) || { kosgeb: null, kgf: null };

  /* ---- KOSGEB: always try fresh fetch ---- */
  let kosgebFetch = null;
  let kosgebErr = null;
  try {
    kosgebFetch = await fetchHttpsText(URL_KOSGEB);
  } catch (e) {
    kosgebErr = e;
  }
  const kosgebLive = buildLiveBlock(snap.kosgeb, URL_KOSGEB, kosgebFetch, kosgebErr);
  if (kosgebLive.source === 'live') {
    snap = {
      ...snap,
      kosgeb: {
        fetchedAt: kosgebLive.fetchedAt,
        status: kosgebLive.status,
        title: kosgebLive.title,
        excerpt: kosgebLive.excerpt,
      },
    };
    await writeSnapshot(event, snap);
  } else if (kosgebLive.source === 'cache' && snap.kosgeb) {
    /* keep snap as is */
  }

  /* ---- KGF: fetch at most once per 24h (else cache) ---- */
  let kgfFetch = null;
  let kgfErr = null;
  const kgfStale = !snap.kgf || ageMs(snap.kgf.fetchedAt) >= KGF_CACHE_MAX_AGE_MS;
  if (kgfStale) {
    try {
      kgfFetch = await fetchHttpsText(URL_KGF);
    } catch (e) {
      kgfErr = e;
    }
  }
  let kgfLive;
  if (kgfStale) {
    kgfLive = buildLiveBlock(snap.kgf, URL_KGF, kgfFetch, kgfErr);
    if (kgfLive.source === 'live') {
      snap = {
        ...snap,
        kgf: {
          fetchedAt: kgfLive.fetchedAt,
          status: kgfLive.status,
          title: kgfLive.title,
          excerpt: kgfLive.excerpt,
        },
      };
      await writeSnapshot(event, snap);
    } else if (kgfLive.source === 'base') {
      kgfLive = {
        source: 'base',
        url: URL_KGF,
        status: kgfFetch ? kgfFetch.statusCode : null,
        fetchedAt: null,
        title: '',
        excerpt: BASE.kgf && BASE.kgf.summary ? BASE.kgf.summary.slice(0, 400) : '',
        lastError: kgfErr ? String(kgfErr.message || kgfErr).slice(0, 200) : undefined,
      };
    }
  } else {
    kgfLive = {
      source: 'cache',
      url: URL_KGF,
      status: snap.kgf.status || null,
      fetchedAt: snap.kgf.fetchedAt,
      title: snap.kgf.title || '',
      excerpt: snap.kgf.excerpt || '',
    };
  }

  /* KOSGEB fallback text when only base */
  if (kosgebLive.source === 'base') {
    kosgebLive.excerpt =
      (BASE.kosgeb && BASE.kosgeb.summary ? BASE.kosgeb.summary : '') +
      (kosgebLive.excerpt ? ' ' + kosgebLive.excerpt : '');
    kosgebLive.excerpt = kosgebLive.excerpt.trim().slice(0, 500);
  }

  const body = JSON.stringify({
    generatedAt,
    base: BASE,
    kosgeb: kosgebLive,
    kgf: kgfLive,
    notes: [
      'KOSGEB: Her istekte resmi destekler sayfasına yeniden bağlanılır; site yanıt vermezse son başarılı önbellek veya gömülü özet kullanılır.',
      'KGF: Resmi site en fazla 24 saatte bir taranır; ara isteklerde önbellek döner.',
    ],
  });

  return { statusCode: 200, headers, body };
};
