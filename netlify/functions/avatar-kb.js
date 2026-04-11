'use strict';
/**
 * Baykuş bilgi bankası — OpenAI olmadan Supabase’teki hazır cevaplar.
 * Netlify: FINSKOR_AVATAR_KB=1, SUPABASE_SERVICE_KEY
 *
 * Eşleşme: keywords alanı virgül/noktalı virgül ile ayrılmış; kullanıcı sorusu
 * tr-TR küçük harfte normalize edilir; herhangi bir anahtar kelime soruda alt
 * string olarak geçerse (sort_order sırasıyla) ilk eşleşen satırın answer’ı döner.
 */
const { fetchFaqEntries, kbFeatureEnabled } = require('./baykus-faq-sb');

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

function normTr(s) {
  return String(s || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ')
    .trim();
}

function keywordList(keywordsRaw) {
  return String(keywordsRaw || '')
    .split(/[,;\n]+/)
    .map((k) => normTr(k))
    .filter((k) => k.length >= 2);
}

function findMatchingAnswer(normQuestion, rows) {
  for (const row of rows) {
    const keys = keywordList(row.keywords);
    for (const k of keys) {
      if (k.length >= 2 && normQuestion.includes(k)) {
        const a = String(row.answer || '').trim();
        if (a) return a;
      }
    }
  }
  return null;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors() };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
      headers: cors(),
    };
  }

  if (!kbFeatureEnabled()) {
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ hit: false }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Geçersiz JSON' }) };
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question || question.length > 4000) {
    return {
      statusCode: 400,
      headers: cors(),
      body: JSON.stringify({ error: 'Soru boş veya çok uzun' }),
    };
  }

  const rows = await fetchFaqEntries(200, 3500);
  const normQ = normTr(question);
  const reply = findMatchingAnswer(normQ, rows);

  if (reply) {
    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({ hit: true, reply }),
    };
  }
  return { statusCode: 200, headers: cors(), body: JSON.stringify({ hit: false }) };
};
