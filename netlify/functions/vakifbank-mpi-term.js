/**
 * MPI TermUrl — ACS POST → VPOS Sale → (gerekirse Supabase ödeme kaydı) → confirm-payment → HTML
 * Ödeme satırı enroll’da değil; VPOS başarısından sonra oluşturulur (Netlify süre limiti).
 */
const {
  resolveVposUrl,
  siteBase,
  decryptMpiSession,
  sbRequest,
  buildVposSaleXml,
  parsePares,
  normalizeVposExpiry,
  resolveVposEci,
  parseThreeDSResultFromPares,
  detectBrand,
  decodeUrlEncodedFormField,
  isVposOk,
  postXml,
  xmlTag,
} = require('./vakif-mpi-shared');
const { vakifFetchErrorResponse } = require('./vakif-fetch');

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

/** Eski oturum: paymentId zaten var. Yeni: billing ile müşteri+ödeme oluşturur */
async function ensureMpiPaymentFromSession(sess) {
  if (sess.paymentId) {
    return { customerId: sess.customerId || null, paymentId: sess.paymentId };
  }
  const b = sess.billing;
  if (!b || !b.email) {
    console.error('MPI term: oturumda billing yok (deploy öncesi çerez veya bozuk oturum)');
    return null;
  }
  let customerId = null;
  try {
    const check = await sbRequest('GET', `customers?email=eq.${encodeURIComponent(b.email)}&select=id`, null);
    if (check.status === 200 && Array.isArray(check.data) && check.data.length > 0) {
      customerId = check.data[0].id;
    } else {
      const custRes = await sbRequest('POST', 'customers', {
        firma_adi: b.firmaAdi || b.adSoyad,
        yetkili_kisi: b.adSoyad,
        telefon: b.telefon || null,
        email: b.email || null,
        vergi_no: b.vkn || null,
        notlar: b.vd ? `Vergi Dairesi: ${b.vd} | Fatura: ${b.faturaTipi || 'kurumsal'}` : null,
      });
      if (custRes.status === 201 && Array.isArray(custRes.data) && custRes.data.length > 0) {
        customerId = custRes.data[0].id;
      }
    }
    const payNotlar = String(b.notlar || '').slice(0, 7800) + '|ODEME:vpos_onaylandi';
    const payRes = await sbRequest('POST', 'payments', {
      customer_id: customerId || null,
      tutar: b.tutarSayi,
      odeme_tarihi: new Date().toISOString().split('T')[0],
      odeme_yontemi: 'Kredi Kartı (Vakıfbank MPI)',
      notlar: payNotlar,
    });
    if (payRes.status === 201 && Array.isArray(payRes.data) && payRes.data.length > 0) {
      return { customerId, paymentId: payRes.data[0].id };
    }
  } catch (e) {
    console.error('ensureMpiPaymentFromSession', e);
  }
  return null;
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
  /* PaRes/MD: ham gövdeden decode — URLSearchParams '+' → boşluk hatası (oturum/VPOS bozulur) */
  const paRes =
    decodeUrlEncodedFormField(event.body, ['PaRes', 'PARes', 'pares']) ||
    getField(form, 'PaRes', 'PARes', 'pares');
  const md = decodeUrlEncodedFormField(event.body, ['MD', 'Md']) || getField(form, 'MD', 'Md');

  {
    const rawBody = String(event.body || '');
    const ctHdr = String(
      event.headers['content-type'] || event.headers['Content-Type'] || ''
    ).split(';')[0].trim();
    const formKeys = Object.keys(form).sort().join(',');
    console.log(
      '[mpi-term] POST',
      JSON.stringify({
        contentType: ctHdr || null,
        bodyBytes: Buffer.byteLength(rawBody, 'utf8'),
        formKeys: formKeys || '(yok — multipart veya boş gövde)',
        hasPaRes: !!(paRes && String(paRes).trim()),
        paResLen: paRes ? String(paRes).length : 0,
        hasMd: !!md,
        mdLen: md ? String(md).length : 0,
      })
    );
  }

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
    const host = event.headers.host || event.headers.Host || '';
    const hasCookie = /finskor_mpi=/.test(String(cookieHeader || ''));
    console.error('MPI term: oturum yok', { host, hasCookie, hasMd: !!md, hasPaRes: !!paRes });
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
  const threeD = parseThreeDSResultFromPares(parsed);
  if (threeD === 'N' || threeD === 'R') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: htmlPage(
        '3D Secure',
        '<h1 class="err">Kart doğrulaması tamamlanamadı</h1><p>3D Secure sonucu banka tarafından onaylanmadı. Farklı bir kart veya yöntem deneyin.</p><a class="btn" href="/odeme.html">Ödeme sayfası</a>',
        false
      ),
    };
  }
  const brand = detectBrand(sess.pan);
  const eci = resolveVposEci(parsed, brand);
  const expiryYYYYMM = (process.env.VAKIF_VPOS_EXPIRY_YYYYMM || '').trim() === '1';
  const expiry = normalizeVposExpiry(sess.expiry, expiryYYYYMM);
  const vposXml = buildVposSaleXml({
    merchantId: mid,
    password: pwd,
    terminalNo: term,
    transactionId: sess.transactionId,
    amount: sess.amount,
    pan: sess.pan,
    expiry,
    cvv: sess.cvv,
    eci,
    cavv: parsed.cavv,
    verifyEnrollmentRequestId: sess.verifyEnrollmentRequestId,
    xid3ds: parsed.xid,
  });

  let vtxt;
  try {
    const vr = await postXml(resolveVposUrl(mode), vposXml);
    vtxt = vr.text;
  } catch (e) {
    console.error('VPOS', e);
    const pe = vakifFetchErrorResponse(e);
    if (pe) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: htmlPage(
          'Proxy ayarı',
          `<h1 class="err">Çıkış proxy hatası</h1><p>${escapeHtml(pe.message)}</p><p style="font-size:0.9rem;opacity:.85">Netlify’da QUOTAGUARDSTATIC_URL değerini kontrol edin.</p><a class="btn" href="/odeme.html">Ödeme sayfası</a>`,
          false
        ),
      };
    }
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

  let paymentId = sess.paymentId;
  let customerId = sess.customerId || null;
  if (!paymentId) {
    const ensured = await ensureMpiPaymentFromSession(sess);
    if (!ensured || !ensured.paymentId) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: htmlPage(
          'Kayıt',
          '<h1 class="err">Ödeme kaydı oluşturulamadı</h1><p>Oturum güncel değil veya Supabase hatası. Ödeme sayfasından tekrar deneyin.</p><p>Destek: info@finskor.tr</p>',
          false
        ),
      };
    }
    paymentId = ensured.paymentId;
    customerId = ensured.customerId ?? customerId;
  }

  const cp = await callConfirmPayment({
    paymentId,
    customerId,
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
