/**
 * Baykuş — lokal / deneme amaçlı LLM köprüsü.
 * Ortam: OPENAI_API_KEY (veya FINSKOR_OPENAI_KEY)
 * Opsiyonel: FINSKOR_AVATAR_MODEL (varsayılan gpt-4o-mini)
 * Supabase: baykus_events (avatar_llm_turn) — SUPABASE_SERVICE_KEY veya ANON + tablo migrasyonu
 *
 * Not: Geçmiş mali veriler “eğitim” olarak modele yüklenmez; yalnızca istekte gönderilen özet JSON kullanılır.
 */

const { randomUUID, createHash } = require('crypto');
const { insertBaykusEvent } = require('./baykus-events-sb');

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

function systemPromptTr() {
  return [
    'Sen FinSkor uygulamasındaki Baykuş adlı kredi ve finansal analiz asistanısın.',
    'Yanıtı her zaman Türkçe ver: kullanıcı soruyu İngilizce veya başka dilde yazsa bile yanıt tamamen Türkçe olmalı; İngilizce kelime veya cümle kullanma.',
    'Kullanıcıya profesyonel ve sade Türkçe ile yanıt ver.',
    'SADECE kullanıcı mesajındaki JSON içindeki sayısal bağlamı kullan; uydurma rakam verme.',
    'Yatırım tavsiyesi, al-sat veya kesin kredi onayı verme. Banka kararı yerine geçmez.',
    'Belirsizlikte tahmin yerine hangi ek bilgi gerektiğini söyle.',
    'Yanıtı kısa tut (tercihen 5–12 cümle); gerekirse maddeler halinde.',
  ].join(' ');
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors() };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }), headers: cors() };
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.FINSKOR_OPENAI_KEY;
  if (!apiKey) {
    return {
      statusCode: 503,
      headers: cors(),
      body: JSON.stringify({
        error: 'no_key',
        message: 'Sunucuda OPENAI_API_KEY tanımlı değil. Netlify env veya .env ile ekleyin.',
      }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Geçersiz JSON' }) };
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question || question.length > 4000) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Soru boş veya çok uzun' }) };
  }

  const requestId = randomUUID();

  const context = body.context && typeof body.context === 'object' ? body.context : {};

  const userContent =
    'Analiz özeti (JSON):\n' +
    JSON.stringify(context, null, 0) +
    '\n\nKullanıcı sorusu:\n' +
    question;

  const model = process.env.FINSKOR_AVATAR_MODEL || 'gpt-4o-mini';

  try {
    const resp = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 900,
        messages: [
          { role: 'system', content: systemPromptTr() },
          { role: 'user', content: userContent },
        ],
      }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const errMsg = (data.error && data.error.message) || resp.statusText || 'OpenAI hatası';
      return {
        statusCode: 502,
        headers: cors(),
        body: JSON.stringify({ error: 'upstream', message: errMsg }),
      };
    }

    const reply = (((data.choices || [])[0] || {}).message || {}).content || '';
    const trimmed = String(reply).trim();
    if (!trimmed) {
      return { statusCode: 502, headers: cors(), body: JSON.stringify({ error: 'empty', message: 'Boş yanıt' }) };
    }

    const disclaimer =
      'Genel bilgilendirme — yatırım veya kredi tavsiyesi değildir; resmi kredi kararı yerine geçmez.';

    const ctxJson = JSON.stringify(context);
    const contextSha256 = createHash('sha256').update(ctxJson).digest('hex');
    const replyExcerpt = trimmed.length > 500 ? trimmed.slice(0, 500) : trimmed;

    void insertBaykusEvent({
      event_type: 'avatar_llm_turn',
      request_id: requestId,
      payload: {
        question,
        model,
        context_sha256: contextSha256,
        reply_excerpt: replyExcerpt,
        reply_chars: trimmed.length,
      },
    });

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({ reply: trimmed, disclaimer, request_id: requestId }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({ error: 'server', message: e.message || 'Sunucu hatası' }),
    };
  }
};
