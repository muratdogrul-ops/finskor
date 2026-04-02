/**
 * Vakıfbank Ortak Ödeme — RegisterTransaction
 * Ortam: VAKIF_INIT=test|prod, VAKIF_HOST_MERCHANT_ID, VAKIF_MERCHANT_PASSWORD, VAKIF_HOST_TERMINAL_ID
 * İsteğe bağlı: SITE_URL (callback tabanı, örn. https://finskor.tr)
 * Sabit çıkış IP (QuotaGuard): QUOTAGUARDSTATIC_URL veya VAKIF_HTTPS_PROXY
 * Ortak ödeme: RegisterTransaction kart numarası/CVV kabul etmez; kart bankanın SecurePayment sayfasında girilir.
 */
const https = require('https');
const { sbHost, sbKey } = require('./sb-config');
const { vakifFetch, vakifFetchErrorResponse } = require('./vakif-fetch');

const PAKET = {
  profesyonel: { fiyat: '2490.00', fiyatLabel: '2.490', credits: 4, ad: 'FinSkor Profesyonel Paket' },
  danisan: { fiyat: '36000.00', fiyatLabel: '36.000', credits: 100, ad: 'FinSkor Finansal Danışman Paketi' },
  nakitflow: { fiyat: '4990.00', fiyatLabel: '4.990', credits: 1, ad: 'NakitFlow 60 Aylık Projeksiyon Paketi' },
};

const POST_URL = {
  test: 'https://cptest.vakifbank.com.tr/CommonPayment/api/RegisterTransaction',
  prod: 'https://cpweb.vakifbank.com.tr/CommonPayment/api/RegisterTransaction',
};

const UI_URL = {
  test: 'https://cptest.vakifbank.com.tr/CommonPayment/SecurePayment?Ptkn=',
  prod: 'https://cpweb.vakifbank.com.tr/CommonPayment/SecurePayment?Ptkn=',
};

function sbRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const key = sbKey();
    const options = {
      hostname: sbHost(),
      path: '/rest/v1/' + path,
      method,
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
    };
    if (body) options.headers['Content-Length'] = Buffer.byteLength(body);
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (d) => (raw += d));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, data: raw });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function xmlTag(xml, tag) {
  const m = String(xml).match(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'));
  return m ? m[1].trim() : '';
}

function siteBase() {
  const u = (process.env.SITE_URL || process.env.URL || 'https://finskor.tr').replace(/\/$/, '');
  return u;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(origin), body: 'Method Not Allowed' };
  }

  const mid = process.env.VAKIF_HOST_MERCHANT_ID;
  const pwd = process.env.VAKIF_MERCHANT_PASSWORD;
  const tid = process.env.VAKIF_HOST_TERMINAL_ID;
  const init = (process.env.VAKIF_INIT || 'test').toLowerCase() === 'prod' ? 'prod' : 'test';

  if (!mid || !pwd || !tid) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({
        ok: false,
        code: 'NOT_CONFIGURED',
        message:
          'Vakıfbank sanal POS ortam değişkenleri tanımlı değil. Netlify: VAKIF_HOST_MERCHANT_ID, VAKIF_MERCHANT_PASSWORD, VAKIF_HOST_TERMINAL_ID, VAKIF_INIT (test|prod), SITE_URL',
      }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: corsHeaders(origin), body: JSON.stringify({ ok: false, message: 'Geçersiz JSON' }) };
  }

  const {
    adSoyad,
    email,
    telefon,
    firmaAdi,
    vkn,
    vd,
    faturaTipi,
    paketKey,
    kartUzerindeIsim,
  } = body;

  if (!adSoyad || !email || !telefon) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({ ok: false, message: 'Ad, e-posta ve telefon zorunludur.' }),
    };
  }

  const kIsim = typeof kartUzerindeIsim === 'string' ? kartUzerindeIsim.trim() : '';

  const pk = PAKET[paketKey] ? paketKey : 'profesyonel';
  const pkg = PAKET[pk];
  const amount = pkg.fiyat;
  const amountCode = '949';

  const transactionId = 'FS' + Date.now() + Math.random().toString(36).slice(2, 8).toUpperCase();

  const base = siteBase();

  const notlar = [
    `Paket:${pkg.ad}`,
    `Tutar:${pkg.fiyatLabel}`,
    `Kontör:${pkg.credits}`,
    `Firma:${firmaAdi || ''}`,
    `Ad:${adSoyad}`,
    `Mail:${email}`,
    telefon ? `Tel:${telefon}` : '',
    vkn ? `VKN:${vkn}` : '',
    faturaTipi ? `Fatura:${faturaTipi}` : '',
    vd ? `VD:${vd}` : '',
    kIsim ? `KartSahibi:${kIsim.slice(0, 80)}` : '',
    `KART_REF:${transactionId}`,
    'ODEME:kart_bekliyor',
  ]
    .filter(Boolean)
    .join('|');

  const tutarSayi = parseFloat(amount);

  let customerId = null;
  try {
    const check = await sbRequest('GET', `customers?email=eq.${encodeURIComponent(email)}&select=id`, null);
    if (check.status === 200 && Array.isArray(check.data) && check.data.length > 0) {
      customerId = check.data[0].id;
    } else {
      const custRes = await sbRequest('POST', 'customers', {
        firma_adi: firmaAdi || adSoyad,
        yetkili_kisi: adSoyad,
        telefon: telefon || null,
        email: email || null,
        vergi_no: vkn || null,
        notlar: vd ? `Vergi Dairesi: ${vd} | Fatura: ${faturaTipi || 'kurumsal'}` : null,
      });
      if (custRes.status === 201 && Array.isArray(custRes.data) && custRes.data.length > 0) {
        customerId = custRes.data[0].id;
      }
    }

    await sbRequest('POST', 'payments', {
      customer_id: customerId || null,
      tutar: tutarSayi,
      odeme_tarihi: new Date().toISOString().split('T')[0],
      odeme_yontemi: 'Kredi Kartı (Vakıfbank)',
      notlar,
    });
  } catch (e) {
    console.warn('Supabase init kayıt:', e.message);
  }

  const form = new URLSearchParams({
    HostMerchantId: mid,
    AmountCode: amountCode,
    Amount: amount,
    MerchantPassword: pwd,
    TransactionId: transactionId,
    OrderID: transactionId,
    OrderDescription: `FinSkor ${pkg.ad}`.slice(0, 200),
    InstallmentCount: '0',
    TransactionType: 'Sale',
    IsSecure: 'true',
    AllowNotEnrolledCard: 'true',
    HostTerminalId: tid,
    SuccessURL: `${base}/kart-odeme-sonuc.html`,
    FailURL: `${base}/kart-odeme-sonuc.html`,
  });

  let xml;
  try {
    const res = await vakifFetch(POST_URL[init], {
      method: 'POST',
      headers: {
        Accept: 'application/xml',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: form.toString(),
    });
    xml = await res.text();
  } catch (e) {
    console.error('Vakıfbank RegisterTransaction:', e);
    const pe = vakifFetchErrorResponse(e);
    if (pe) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        body: JSON.stringify({ ok: false, code: pe.code, message: pe.message }),
      };
    }
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({ ok: false, message: 'Banka bağlantısı kurulamadı.' }),
    };
  }

  const token = xmlTag(xml, 'PaymentToken');
  const errCode = xmlTag(xml, 'ErrorCode');
  const errMsg = xmlTag(xml, 'ResponseMessage');

  if (!token) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({
        ok: false,
        message: errCode ? `${errCode}: ${errMsg || 'Banka hatası'}` : 'Ödeme oturumu açılamadı. Yanıt: ' + xml.slice(0, 200),
      }),
    };
  }

  const redirectUrl = UI_URL[init] + encodeURIComponent(token);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    body: JSON.stringify({
      ok: true,
      redirectUrl,
      transactionId,
    }),
  };
};
