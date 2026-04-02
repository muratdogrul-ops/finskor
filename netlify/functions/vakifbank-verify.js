/**
 * Vakıfbank Ortak Ödeme — dönüş (VposTransaction doğrulama) + confirm-payment
 */
const https = require('https');
const { sbHost, sbKey } = require('./sb-config');
const { vakifFetch, vakifFetchErrorResponse } = require('./vakif-fetch');

const TX_URL = {
  test: 'https://cptest.vakifbank.com.tr/CommonPayment/api/VposTransaction',
  prod: 'https://cpweb.vakifbank.com.tr/CommonPayment/api/VposTransaction',
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

function parseNotlar(notlar) {
  const o = {};
  String(notlar || '')
    .split('|')
    .forEach((pair) => {
      const i = pair.indexOf(':');
      if (i > 0) o[pair.slice(0, i)] = pair.slice(i + 1);
    });
  return o;
}

function siteBase() {
  return (process.env.SITE_URL || process.env.URL || 'https://finskor.tr').replace(/\/$/, '');
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function isVposOk(rc) {
  return rc === '0000' || rc === '00' || rc === '0';
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
  const init = (process.env.VAKIF_INIT || 'test').toLowerCase() === 'prod' ? 'prod' : 'test';

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({ ok: false, message: 'Geçersiz istek' }),
    };
  }

  const TransactionId = body.TransactionId || body.transactionId;
  const PaymentToken = body.PaymentToken || body.paymentToken;

  if (!TransactionId || !PaymentToken) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({ ok: false, message: 'Ödeme bilgisi eksik (TransactionId / PaymentToken).' }),
    };
  }

  if (!mid || !pwd) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({ ok: false, code: 'NOT_CONFIGURED', message: 'Sanal POS yapılandırması eksik.' }),
    };
  }

  const form = new URLSearchParams({
    TransactionId: String(TransactionId),
    PaymentToken: String(PaymentToken),
    HostMerchantId: mid,
    Password: pwd,
  });

  let xml;
  try {
    const res = await vakifFetch(TX_URL[init], {
      method: 'POST',
      headers: {
        Accept: 'application/xml',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: form.toString(),
    });
    xml = await res.text();
  } catch (e) {
    console.error('VposTransaction', e);
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
      body: JSON.stringify({ ok: false, message: 'Banka doğrulaması yapılamadı.' }),
    };
  }

  const rc = xmlTag(xml, 'Rc');
  const msg = xmlTag(xml, 'Message') || xmlTag(xml, 'ResponseMessage');

  if (!isVposOk(rc)) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({
        ok: false,
        message: msg || `İşlem onaylanmadı (Rc: ${rc || '—'}).`,
        bankRc: rc,
      }),
    };
  }

  const filter = `notlar=ilike.${encodeURIComponent('%' + TransactionId + '%')}&select=id,notlar,customer_id,durum&limit=1`;
  const found = await sbRequest('GET', `payments?${filter}`, null);

  if (found.status !== 200 || !Array.isArray(found.data) || found.data.length === 0) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({
        ok: false,
        message: 'Sipariş kaydı bulunamadı. Destek: info@finskor.tr',
      }),
    };
  }

  const pay = found.data[0];
  const paymentId = pay.id;

  if (pay.durum === 'onaylandi') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({
        ok: true,
        already: true,
        message: 'Bu ödeme daha önce onaylanmış.',
      }),
    };
  }

  const meta = parseNotlar(pay.notlar);
  const email = meta.Mail || '';
  const credits = parseInt(meta.Kontör, 10) || 4;
  const firma = meta.Firma || meta.Ad || '';
  const telefon = meta.Tel || '';

  if (!email || !paymentId) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({ ok: false, message: 'Kayıtta e-posta bulunamadı.' }),
    };
  }

  const site = siteBase();
  let confirmJson = {};
  try {
    const cr = await fetch(`${site}/.netlify/functions/confirm-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId,
        customerId: pay.customer_id || null,
        email,
        firma,
        telefon,
        credits,
      }),
    });
    const raw = await cr.text();
    try {
      confirmJson = JSON.parse(raw);
    } catch {
      confirmJson = { ok: false, error: raw };
    }
    if (!cr.ok) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        body: JSON.stringify({
          ok: false,
          message: (confirmJson.error || raw || 'Onay servisi hatası').toString().slice(0, 300),
        }),
      };
    }
  } catch (e) {
    console.error('confirm-payment', e);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({
        ok: false,
        message: 'Ödeme onaylandı ancak erişim kodu oluşturulamadı. Lütfen info@finskor.tr ile iletişime geçin.',
      }),
    };
  }

  if (!confirmJson.ok) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({
        ok: false,
        message: (confirmJson.error || confirmJson.body || 'Kod oluşturma hatası').toString().slice(0, 200),
      }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    body: JSON.stringify({
      ok: true,
      code: confirmJson.code,
      email: confirmJson.email,
    }),
  };
};
