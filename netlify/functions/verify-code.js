// Netlify Function: verify-code.js
// Erişim kodu doğrulaması sunucu tarafında yapılır
// Tarayıcıya hiçbir zaman Supabase bağlantı bilgisi gitmez

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://clmqfckposcaqjmbrmuq.supabase.co';
// Bu key sadece sunucuda — tarayıcıda görünmez
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  let body; try { body = JSON.parse(event.body); } catch(e) { return { statusCode: 400, body: JSON.stringify({ error: 'Geçersiz istek' }) }; }
  const { code } = body;
  if (!code || typeof code !== 'string') return { statusCode: 400, body: JSON.stringify({ error: 'Kod gerekli' }) };
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode.match(/^KA-/)) return { statusCode: 200, body: JSON.stringify({ valid: false, error: 'Geçersiz erişim kodu' }) };
  if (!SUPABASE_SERVICE_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'Sunucu yapılandırma hatası' }) };
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const { data, error } = await sb.from('access_codes').select('id,code,active,credits,client_name,usage_count,nakit_akis_enabled').eq('code', cleanCode).single();
    if (error || !data) return { statusCode: 200, body: JSON.stringify({ valid: false, error: 'Geçersiz kod' }) };
    if (!data.active) return { statusCode: 200, body: JSON.stringify({ valid: false, error: 'Kod pasif' }) };
    if (data.credits !== null && data.credits <= 0 && !data.nakit_akis_enabled) return { statusCode: 200, body: JSON.stringify({ valid: false, error: 'Kontör tökendi'}) };
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ valid: true, id: data.id, credits: data.credits, client_name: data.client_name || cleanCode, nakit_akis_enabled: data.nakit_akis_enabled || false }) };
  } catch(e) { return { statusCode: 500, body: JSON.stringify({ error: 'Sunucu hatası' }) }; }
};