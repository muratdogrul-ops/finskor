// use-credit.js
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://clmqfckposcaqjmbrmuq.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  let body; try { body = JSON.parse(event.body); } catch(e) { return { statusCode: 400, body: JSON.stringify({ error: 'Geçersiz istek' }) }; }
  const { code_id, code } = body;
  if (!code_id && !code) return { statusCode: 400, body: JSON.stringify({ error: 'Kod bilgisi gerekli' }) };
  if (!SUPABASE_SERVICE_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'Sunucu yapılandırma hatası' }) };
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const query = code_id ? sb.from('access_codes').select('credits,usage_count').eq('id',code_id).single() : sb.from('access_codes').select('credits,usage_count').eq('code',code).single();
    const { data, error } = await query;
    if (error || !data) return { statusCode: 200, body: JSON.stringify({ success: false, error: 'Kod bulunamadı' }) };
    const newCredits = data.credits !== null ? Math.max(0, data.credits - 1) : null;
    const newUsage = (data.usage_count || 0) + 1;
    const updateQ = code_id ? sb.from('access_codes').update({credits:newCredits,usage_count:newUsage}).eq('id',code_id) : sb.from('access_codes').update({credits:newCredits,usage_count:newUsage}).eq('code',code);
    await updateQ;
    return { statusCode: 200, body: JSON.stringify({ success: true, remaining_credits: newCredits }) };
  } catch(e) { return { statusCode: 500, body: JSON.stringify({ error: 'Sunucu hatası' }) }; }
};