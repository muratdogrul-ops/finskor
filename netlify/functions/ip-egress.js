/**
 * Netlify’ın bankaya (dış API) istek atarken kullandığı çıkış IPv4’ünü görmek için.
 * Tarayıcıda birkaç kez yenileyin; IP hep aynı mı kontrol edin.
 *
 * GET /.netlify/functions/ip-egress
 *
 * İsteğe bağlı güvenlik: Netlify env → IP_EGRESS_CHECK_SECRET=uzun-rastgele-dize
 * Sonra: /.netlify/functions/ip-egress?k=uzun-rastgele-dize
 *
 * Vakıfbank IP kaydı bittikten sonra bu dosyayı silebilirsiniz.
 */

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'GET only' }) };
  }

  const secret = process.env.IP_EGRESS_CHECK_SECRET;
  if (secret) {
    const k = event.queryStringParameters && event.queryStringParameters.k;
    if (k !== secret) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Geçersiz veya eksik k parametresi' }) };
    }
  }

  try {
    const res = await fetch('https://api.ipify.org?format=json', {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    const ip = data && data.ip ? String(data.ip) : null;
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ip,
        ipv4: ip && ip.includes(':') ? null : ip,
        at: new Date().toISOString(),
        hint: secret ? null : 'İsterseniz IP_EGRESS_CHECK_SECRET env + ?k=... ile kapatın; iş bitince bu functionı silin.',
      }),
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'ipify erişilemedi', detail: String(e && e.message) }),
    };
  }
};
