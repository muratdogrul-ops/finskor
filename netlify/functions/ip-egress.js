/**
 * Dışarı çıkan IPv4’ü gösterir.
 * QUOTAGUARDSTATIC_URL tanımlıysa aynı vakif-fetch yolu kullanılır → görünen IP whitelist’e yazdığınız sabit IP olmalı.
 * Tanımlı değilse Netlify’ın ham çıkış IP’si görünür (banka için yeterli değildir).
 *
 * GET /.netlify/functions/ip-egress
 *
 * İsteğe bağlı güvenlik: Netlify env → IP_EGRESS_CHECK_SECRET=uzun-rastgele-dize
 * Sonra: /.netlify/functions/ip-egress?k=uzun-rastgele-dize
 *
 * Vakıfbank IP kaydı bittikten sonra bu dosyayı silebilirsiniz.
 */

const { vakifFetch, getVakifEgressStatus } = require('./vakif-fetch');

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

  const egress = getVakifEgressStatus();
  if (egress.proxyUrlConfigured && !egress.proxyAgentActive) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: false,
        proxyMisconfigured: true,
        proxyAgentError: egress.proxyAgentError,
        proxyHost: egress.proxyHost,
        note:
          'QUOTAGUARDSTATIC_URL / VAKIF_HTTPS_PROXY geçersiz veya ProxyAgent oluşturulamıyor. ' +
          'Düzeltilmeden MPI/VPOS istekleri de başarısız olur (sessiz doğrudan çıkış artık yok).',
      }),
    };
  }

  try {
    const res = egress.proxyAgentActive
      ? await vakifFetch('https://api.ipify.org?format=json', {
          headers: { Accept: 'application/json' },
        })
      : await fetch('https://api.ipify.org?format=json', {
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
        viaQuotaGuardOrVakifProxy: egress.proxyAgentActive,
        note: egress.proxyAgentActive
          ? 'Bu istek QuotaGuard/VAKIF proxy üzerinden; IP Vakıfbank whitelist ile eşleşmeli (52.29… çifti).'
          : 'Proxy kapalı — bu Netlify ham çıkışıdır. Banka için QUOTAGUARDSTATIC_URL ekleyip deploy edin.',
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
