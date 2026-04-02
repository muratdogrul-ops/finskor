/**
 * MPI TermUrl — ACS POST → VPOS Sale → confirm-payment → HTML sonuç
 */
const {
  VPOS_URL,
  siteBase,
  decryptMpiSession,
  sbRequest,
  buildVposSaleXml,
  parsePares,
  isVposOk,
  postXml,
  xmlTag,
} = require('./vakif-mpi-shared');

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseFormBody(raw) {
  const q = new URLSearchParams(raw || '');
  const out = {};
  for (const [k, v] of q) {
    out[k] = v;
  }
  return out;
}

function getField(form, ...names) {
  for (const n of names) {
    if (form[n] != null && form[n] !== '') return form[n];
    const lower = Object.keys(form).find((k) => k.toLowerCase() === n.toLowerCase());
    if (lower && form[lower] != null) return form[lower];
  }
  return '';
}

function htmlPage(title, bodyInner, ok) {
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
  <style>body{font-family:system-ui,sans-serif;background:#071221;color:#F4F6F9;padding:24px;text-align:center;line-height:1.55}
  .c{max-width:480px;margin:40px auto;padding:28px;background:#0D1E35;border:1px solid rgba(201,168,76,.25);border-radius:14px}
  h1{font-size:1.2rem;color:#C9A84C;margin-bottom:12px}
  .code{font-size:1.5rem;font-weight:800;color:#C9A84C;font-family:monospace;margin:16px 0;padding:14px;background:rgba(201,168,76,.08);border-radius:10px}
  a.btn{display:inline-block;margin-top:14px;padding:12px 22px;background:linear-gradient(135deg,#C9A84C,#a07828);color:#071221;font-weight:700;text-decoration:none;border-radius:8px}
  .err{color:#f87171}</style></head><body><div class="c">${bodyInner}</div></body></html>`;
}

async function callConfirmPayment(payload) {
  const base = siteBase();
  const cr = await fetch(`${base}/.netlify/functions/confirm-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const raw = await cr.text();
  try {
    return { ok: cr.ok, json: JSON.parse(raw), raw };
  } catch {
    return { ok: cr.ok, json: {}, raw };
  }
}

async function loadSessionFromMd(md) {
  if (!md) return null;
  const filter = `notlar=ilike.${encodeURIComponent('%' + 'MPIMD:' + md + '%')}&select=id,notlar,customer_id&limit=1`;
  const found = await sbRequest('GET', `payments?${filter}`, null);
  if (found.status !== 200 || !Array.isArray(found.data) || !found.data.length) return null;
  const row = found.data[0];
  const m = String(row.notlar || '').match(/MPICTX:([^|]+)/);
  if (!m) return null;
  try {
    const sess = decryptMpiSession(m[1]);
    sess.paymentId = sess.paymentId || row.id;
    sess.customerId = sess.customerId || row.customer_id;
    return sess;
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: htmlPage(
        'Ödeme',
        '<h1>Yönlendirme eksik</h1><p>3D Secure tamamlanmadı. <a class="btn" href="/odeme.html">Ödeme sayfası</a></p>',
        false
      ),
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const mid = process.env.VAKIF_HOST_MERCHANT_ID;
  const pwd = process.env.VAKIF_MERCHANT_PASSWORD;
  const term = process.env.VAKIF_HOST_TERMINAL_ID;
  const mode = (process.env.VAKIF_INIT || 'test').toLowerCase() === 'prod' ? 'prod' : 'test';

  const form = parseFormBody(event.body);
  const paRes = getField(form, 'PaRes', 'PARes', 'pares');
  const md = getField(form, 'MD', 'Md');

  const cookieHeader = event.headers.cookie || event.headers.Cookie || '';
  let sess = null;
  const mCookie = cookieHeader.match(/finskor_mpi=([^;]+)/);
  if (mCookie) {
    try {
      sess = decryptMpiSession(decodeURIComponent(mCookie[1].trim()));
    } catch (_) {
      /* cookie yok / ACS sonrası */
    }
  }
  if (!sess) {
    sess = await loadSessionFromMd(md);
  }

  if (!sess || !sess.pan) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: htmlPage(
        'Oturum',
        '<h1 class="err">Oturum bulunamadı</h1><p>Ödeme oturumu süresi dolmuş olabilir. Tekrar deneyin.</p><a class="btn" href="/odeme.html">Ödeme sayfası</a>',
        false
      ),
    };
  }

  if (!paRes) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: htmlPage(
        '3D Secure',
        '<h1 class="err">Banka yanıtı eksik</h1><p>PARes alınamadı.</p><a class="btn" href="/odeme.html">Ödeme sayfası</a>',
        false
      ),
    };
  }

  const parsed = parsePares(paRes);
  const vposXml = buildVposSaleXml({
    merchantId: mid,
    password: pwd,
    terminalNo: term,
    transactionId: sess.transactionId,
    amount: sess.amount,
    pan: sess.pan,
    expiry: sess.expiry,
    cvv: sess.cvv,
    eci: parsed.eci,
    cavv: parsed.cavv,
    verifyEnrollmentRequestId: sess.verifyEnrollmentRequestId,
    xid3ds: parsed.xid,
  });

  let vtxt;
  try {
    const vr = await postXml(VPOS_URL[mode], vposXml);
    vtxt = vr.text;
  } catch (e) {
    console.error('VPOS', e);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: htmlPage(
        'Bağlantı',
        '<h1 class="err">Banka bağlantı hatası</h1><a class="btn" href="/odeme.html">Ödeme sayfası</a>',
        false
      ),
    };
  }

  if (!isVposOk(vtxt)) {
    const msg =
      xmlTag(vtxt, 'ResultDetail') ||
      xmlTag(vtxt, 'ErrorMessage') ||
      xmlTag(vtxt, 'Message') ||
      'Provizyon reddedildi.';
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: htmlPage('Ödeme', `<h1 class="err">Ödeme tamamlanamadı</h1><p>${escapeHtml(msg)}</p><a class="btn" href="/odeme.html">Ödeme sayfası</a>`, false),
    };
  }

  if (!sess.paymentId) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: htmlPage(
        'Kayıt',
        '<h1 class="err">Ödeme kaydı bulunamadı</h1><p>Destek: info@finskor.tr</p>',
        false
      ),
    };
  }

  const cp = await callConfirmPayment({
    paymentId: sess.paymentId,
    customerId: sess.customerId || null,
    email: sess.email,
    firma: sess.firma,
    telefon: sess.telefon,
    credits: sess.credits,
  });

  if (!cp.ok || !cp.json.ok) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: htmlPage(
        'Onay',
        `<h1 class="err">Ödeme alındı, kod üretilemedi</h1><p>${escapeHtml((cp.json.error || cp.raw || '').toString().slice(0, 200))}</p><p>info@finskor.tr</p>`,
        false
      ),
    };
  }

  const code = cp.json.code || '—';
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: htmlPage(
      'Başarılı',
      `<h1>Ödeme talebiniz alındı</h1><p>Kart işleminiz tamamlandı. Erişim kodunuz aşağıdadır ve e-postanıza da gönderildi.</p><div class="code">${escapeHtml(code)}</div><a class="btn" href="https://finskor.tr/app.html">Platforma giriş</a><p style="margin-top:16px"><a href="/" style="color:#C9A84C">Ana sayfa</a></p>`,
      true
    ),
  };
};
