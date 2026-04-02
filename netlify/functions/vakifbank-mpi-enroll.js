/**
 * Vakıfbank MPI Enrollment (işyeri sayfasında kart) → ACS’e yönlendirme
 * Env: VAKIF_INIT, VAKIF_HOST_MERCHANT_ID, VAKIF_MERCHANT_PASSWORD, VAKIF_HOST_TERMINAL_ID, SITE_URL
 * İsteğe bağlı: VAKIF_MPI_SESSION_SECRET (yoksa şifre türevi), QUOTAGUARDSTATIC_URL
 * Test: odeme.html?mpi_test=1 + istekte mpiTest:true — yalnızca VAKIF_MPI_TEST_MODE=1 iken geçerli (canlıda kapatın).
 */
const {
  PAKET,
  MPI_ENROLL_URL,
  siteBase,
  detectBrand,
  encryptMpiSession,
  sbRequest,
  buildEnrollmentXml,
  postXml,
  parseMpiEnrollmentResponse,
} = require('./vakif-mpi-shared');

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
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
  const term = process.env.VAKIF_HOST_TERMINAL_ID;
  const mode = (process.env.VAKIF_INIT || 'test').toLowerCase() === 'prod' ? 'prod' : 'test';

  if (!mid || !pwd || !term) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({
        ok: false,
        code: 'NOT_CONFIGURED',
        message: 'Vakıfbank MPI: VAKIF_HOST_MERCHANT_ID, VAKIF_MERCHANT_PASSWORD, VAKIF_HOST_TERMINAL_ID gerekli.',
      }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }, body: JSON.stringify({ ok: false, message: 'Geçersiz JSON' }) };
  }

  let {
    adSoyad,
    email,
    telefon,
    firmaAdi,
    vkn,
    vd,
    faturaTipi,
    paketKey,
    kartUzerindeIsim,
    pan,
    expiryYYMM,
    cvv,
  } = body;

  const mpiTest = body.mpiTest === true;
  const mpiTestAllowed = (process.env.VAKIF_MPI_TEST_MODE || '').trim() === '1';

  if (mpiTest && !mpiTestAllowed) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({
        ok: false,
        code: 'MPI_TEST_DISABLED',
        message:
          'Minimal MPI test isteği reddedildi. Netlify ortamında VAKIF_MPI_TEST_MODE=1 tanımlayın; iş bitince kaldırın.',
      }),
    };
  }

  if (mpiTest && mpiTestAllowed) {
    adSoyad = String(adSoyad || '').trim() || 'MPI Minimal Test';
    email = String(email || '').trim() || 'mpi-minimal-test@invalid.finskor.tr';
    telefon = String(telefon || '').replace(/\D/g, '');
    if (telefon.length < 10) telefon = '05000000000';
    firmaAdi = String(firmaAdi || '').trim();
    vkn = '';
    vd = '';
    faturaTipi = 'bireysel';
  } else if (!adSoyad || !email || !telefon) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({ ok: false, message: 'Ad, e-posta ve telefon zorunludur.' }),
    };
  }

  const panDigits = String(pan || '').replace(/\D/g, '');
  const exp = String(expiryYYMM || '').replace(/\D/g, '');
  const cvvDigits = String(cvv || '').replace(/\D/g, '');
  const kIsim = String(kartUzerindeIsim || '').trim();

  if (!kIsim || kIsim.length < 2) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({ ok: false, message: 'Kart üzerindeki isim zorunludur.' }),
    };
  }
  if (panDigits.length < 13 || panDigits.length > 19 || exp.length !== 4 || (cvvDigits.length !== 3 && cvvDigits.length !== 4)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({ ok: false, message: 'Kart numarası, son kullanma (YYMM) veya CVV hatalı.' }),
    };
  }

  const pk = PAKET[paketKey] ? paketKey : 'profesyonel';
  const pkg = PAKET[pk];
  const amount = pkg.fiyat;
  const verifyId = 'FS' + Date.now() + Math.random().toString(36).slice(2, 8).toUpperCase();
  const base = siteBase();
  const termUrl = `${base}/.netlify/functions/vakifbank-mpi-term`;
  const failUrl = `${base}/odeme.html?mpi=hata`;

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
    `KartSahibi:${kIsim.slice(0, 80)}`,
    `MPI_REF:${verifyId}`,
    mpiTest && mpiTestAllowed ? 'MPI_TEST:minimal' : '',
    'Talep:KREDI_KARTI',
    'ODEME:mpi_bekliyor',
  ]
    .filter(Boolean)
    .join('|');

  const tutarSayi = parseFloat(amount);
  let customerId = null;
  let paymentId = null;

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

    const payRes = await sbRequest('POST', 'payments', {
      customer_id: customerId || null,
      tutar: tutarSayi,
      odeme_tarihi: new Date().toISOString().split('T')[0],
      odeme_yontemi: 'Kredi Kartı (Vakıfbank MPI)',
      notlar,
    });
    if (payRes.status === 201 && Array.isArray(payRes.data) && payRes.data.length > 0) {
      paymentId = payRes.data[0].id;
    }
  } catch (e) {
    console.warn('Supabase mpi enroll:', e.message);
  }

  if (!paymentId) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({
        ok: false,
        message: 'Ödeme kaydı oluşturulamadı (Supabase). SUPABASE_SERVICE_KEY ve payments tablosunu kontrol edin.',
      }),
    };
  }

  const enrollXml = buildEnrollmentXml({
    merchantId: mid,
    merchantPassword: pwd,
    verifyId,
    pan: panDigits,
    expiryYYMM: exp,
    amount,
    brandName: detectBrand(panDigits),
    successUrl: termUrl,
    failureUrl: failUrl,
  });

  let xmlRes;
  try {
    xmlRes = await postXml(MPI_ENROLL_URL[mode], enrollXml);
  } catch (e) {
    console.error('MPI Enrollment:', e);
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({ ok: false, message: 'MPI bağlantısı kurulamadı.' }),
    };
  }

  const xr = xmlRes.text;
  const parsed = parseMpiEnrollmentResponse(xr, xmlRes.status);

  if (!parsed.ok) {
    console.error('MPI enrollment failed', {
      httpStatus: xmlRes.status,
      mpiStatus: parsed.status,
      message: parsed.message,
      logHint: parsed.logHint,
      rawHead: xr.slice(0, 2800),
    });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({
        ok: false,
        message: parsed.message,
        mpiStatus: parsed.status || null,
      }),
    };
  }

  const acsUrl = parsed.acsUrl;
  const paReq = parsed.paReq;
  const md = parsed.md || verifyId;

  const sessionPayload = {
    paymentId,
    customerId,
    email,
    firma: firmaAdi || adSoyad,
    telefon,
    credits: pkg.credits,
    pan: panDigits,
    cvv: cvvDigits,
    expiry: exp,
    transactionId: verifyId,
    verifyEnrollmentRequestId: verifyId,
    amount,
  };

  let encCtx;
  try {
    encCtx = encryptMpiSession(sessionPayload);
  } catch (e) {
    console.error('encrypt session', e);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({ ok: false, message: 'Oturum şifrelenemedi. VAKIF_MPI_SESSION_SECRET tanımlayın.' }),
    };
  }

  if (paymentId) {
    try {
      const extra = `|MPIMD:${md}|MPICTX:${encCtx}`;
      await sbRequest('PATCH', `payments?id=eq.${paymentId}`, { notlar: notlar + extra });
    } catch (e) {
      console.warn('MPI payment patch:', e.message);
    }
  }

  const cookieVal = encCtx;
  const cookie = `finskor_mpi=${cookieVal}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=900`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
      'Set-Cookie': cookie,
    },
    body: JSON.stringify({
      ok: true,
      acsUrl,
      paReq,
      md,
      termUrl,
    }),
  };
};
