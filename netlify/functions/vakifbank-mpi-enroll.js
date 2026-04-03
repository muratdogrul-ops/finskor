/**
 * Vakıfbank MPI Enrollment (işyeri sayfasında kart) → ACS’e yönlendirme
 * Env: VAKIF_INIT, VAKIF_HOST_MERCHANT_ID, VAKIF_MERCHANT_PASSWORD, VAKIF_HOST_TERMINAL_ID, SITE_URL
 * İsteğe bağlı: VAKIF_MPI_SESSION_SECRET (yoksa şifre türevi), QUOTAGUARDSTATIC_URL
 * Test: odeme.html?mpi_test=1 + istekte mpiTest:true — yalnızca VAKIF_MPI_TEST_MODE=1 iken geçerli (canlıda kapatın).
 * Hata ayıklama: VAKIF_MPI_CLIENT_DEBUG=1 → JSON yanıtta bankPreview (PAN/PaReq maskeli); Netlify log’da MPI_FAIL_JSON satırı.
 * İsteğe bağlı: VAKIF_MPI_ENROLL_INCLUDE_TERMINAL=1 → enrollment XML’e TerminalNo ekler (banka PDF’i gerektiriyorsa).
 * İsteğe bağlı: VAKIF_REQUIRE_EGRESS_PROXY=1 → canlıda çalışan QuotaGuard/proxy zorunlu (yoksa istek reddedilir).
 */
const { getVakifEgressStatus, vakifFetchErrorResponse } = require('./vakif-fetch');
const {
  PAKET,
  resolveMpiEnrollUrl,
  resolveMpiStartThreeDFlowUrl,
  siteBase,
  detectBrand,
  encryptMpiSession,
  sbRequest,
  buildEnrollmentXml,
  postXml,
  parseMpiEnrollmentResponse,
} = require('./vakif-mpi-shared');

function isHttpUrl(s) {
  return /^https?:\/\/.+/i.test(String(s || '').trim());
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };
}

/** Banka yanıtını destek e-postasına yapıştırmak için: PAN ve uzun base64 maskelenir */
function sanitizeBankBodyForCopy(text) {
  let s = String(text || '').slice(0, 6000);
  s = s.replace(/\b\d{13,19}\b/g, 'PAN_REDACTED');
  s = s.replace(/[A-Za-z0-9+/]{48,}={0,2}/g, (m) => `B64[len=${m.length}]`);
  return s;
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

  const egressStatus = getVakifEgressStatus();

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

  const requireEgress = (process.env.VAKIF_REQUIRE_EGRESS_PROXY || '').trim() === '1';
  if (requireEgress && mode === 'prod' && !egressStatus.proxyAgentActive) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({
        ok: false,
        code: 'EGRESS_PROXY_REQUIRED',
        message:
          'Canlı ortamda sabit çıkış proxy zorunlu (VAKIF_REQUIRE_EGRESS_PROXY=1). QUOTAGUARDSTATIC_URL tanımlayın veya bu env’i kaldırın.',
        mpiHint:
          'Netlify → Site settings → Environment variables → QUOTAGUARDSTATIC_URL. Ardından ip-egress ile IP’yi doğrulayıp Vakıfbank’a iletin.',
      }),
    };
  }

  const pk = PAKET[paketKey] ? paketKey : 'profesyonel';
  const pkg = PAKET[pk];
  const amount = pkg.fiyat;
  const verifyId = 'FS' + Date.now() + Math.random().toString(36).slice(2, 8).toUpperCase();
  const base = siteBase();
  const merchantReturnUrl = `${base}/.netlify/functions/vakifbank-mpi-term`;
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

  const includeTerminalNo = (process.env.VAKIF_MPI_ENROLL_INCLUDE_TERMINAL || '').trim() === '1';
  const enrollXml = buildEnrollmentXml({
    merchantId: mid,
    merchantPassword: pwd,
    verifyId,
    pan: panDigits,
    expiryYYMM: exp,
    amount,
    brandName: detectBrand(panDigits),
    successUrl: merchantReturnUrl,
    failureUrl: failUrl,
    terminalNo: term,
    includeTerminalNo,
  });
  const enrollUrl = resolveMpiEnrollUrl(mode);

  async function createSupabasePayment() {
    let cid = null;
    let pid = null;
    try {
      const check = await sbRequest('GET', `customers?email=eq.${encodeURIComponent(email)}&select=id`, null);
      if (check.status === 200 && Array.isArray(check.data) && check.data.length > 0) {
        cid = check.data[0].id;
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
          cid = custRes.data[0].id;
        }
      }

      const payRes = await sbRequest('POST', 'payments', {
        customer_id: cid || null,
        tutar: tutarSayi,
        odeme_tarihi: new Date().toISOString().split('T')[0],
        odeme_yontemi: 'Kredi Kartı (Vakıfbank MPI)',
        notlar,
      });
      if (payRes.status === 201 && Array.isArray(payRes.data) && payRes.data.length > 0) {
        pid = payRes.data[0].id;
      }
    } catch (e) {
      console.warn('Supabase mpi enroll:', e.message);
    }
    return { customerId: cid, paymentId: pid };
  }

  const [sbSettled, xmlSettled] = await Promise.allSettled([createSupabasePayment(), postXml(enrollUrl, enrollXml)]);

  const sbResult =
    sbSettled.status === 'fulfilled' ? sbSettled.value : { customerId: null, paymentId: null };
  if (sbSettled.status === 'rejected') {
    console.warn('Supabase mpi enroll:', sbSettled.reason);
  }

  if (!sbResult.paymentId) {
    if (xmlSettled.status === 'fulfilled') {
      console.error(
        'MPI_CRITICAL: Banka enrollment yanıtı geldi ancak Supabase ödeme kaydı oluşmadı. verifyId:',
        verifyId
      );
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({
        ok: false,
        message: 'Ödeme kaydı oluşturulamadı (Supabase). SUPABASE_SERVICE_KEY ve payments tablosunu kontrol edin.',
      }),
    };
  }

  const customerId = sbResult.customerId;
  const paymentId = sbResult.paymentId;

  let xmlRes;
  if (xmlSettled.status === 'rejected') {
    const e = xmlSettled.reason;
    console.error('MPI Enrollment:', e);
    const pe = vakifFetchErrorResponse(e);
    if (pe) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        body: JSON.stringify({
          ok: false,
          code: pe.code,
          message: pe.message,
          mpiHint:
            'QuotaGuard panelindeki proxy URL’sini birebir kopyalayın; şifrede özel karakter varsa URL-encode edin. Düzeltince yeniden deploy edin.',
        }),
      };
    }
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify({ ok: false, message: 'MPI bağlantısı kurulamadı.' }),
    };
  }

  xmlRes = xmlSettled.value;

  const xr = xmlRes.text;
  const parsed = parseMpiEnrollmentResponse(xr, xmlRes.status, xmlRes.contentType);

  if (!parsed.ok) {
    const safePreview = sanitizeBankBodyForCopy(xr);
    const supportLine = {
      enrollUrl,
      http: xmlRes.status,
      contentType: (xmlRes.contentType && String(xmlRes.contentType).split(';')[0].trim()) || null,
      htmlTitle: parsed.htmlPageTitle || null,
      mpiStatus: parsed.status || null,
      message: (parsed.message || '').slice(0, 600),
      tags: (parsed.foundTags || '').slice(0, 400),
      bankBodyPreview: safePreview,
    };
    console.error('MPI enrollment failed', {
      enrollUrl,
      httpStatus: xmlRes.status,
      contentType: xmlRes.contentType || null,
      mpiStatus: parsed.status,
      message: parsed.message,
      logHint: parsed.logHint,
      rawHead: xr.slice(0, 2800),
    });
    console.error('MPI_FAIL_JSON ' + JSON.stringify(supportLine));

    const clientDebug = (process.env.VAKIF_MPI_CLIENT_DEBUG || '').trim() === '1';
    const ctShort = (xmlRes.contentType && String(xmlRes.contentType).split(';')[0].trim()) || '';
    let mpiHint = null;
    if (mode === 'prod' && !egressStatus.proxyAgentActive) {
      mpiHint =
        'Canlıda QUOTAGUARDSTATIC_URL ile sabit çıkış IP kullanın. `/.netlify/functions/ip-egress` çıktısındaki IPv4’ü Vakıfbank’a özellikle MPI enrollment host’u (inbound.apigateway…) için tanımlatın.';
    } else if (mode === 'prod' && egressStatus.proxyAgentActive && /\btext\/html\b/i.test(ctShort)) {
      mpiHint =
        'Sabit IP kullanılıyor; yanıt hâlâ HTML ise bankadan bu enrollment URL’si ve üye işyeri (test/canlı) eşleşmesini doğrulatın; gerekirse MPI için ikinci whitelist kaydı isteyin.';
    }
    const bodyOut = {
      ok: false,
      message: parsed.message || 'Banka 3D kayıt yanıtı reddedildi veya okunamadı.',
      mpiStatus: parsed.status || null,
    };
    if (mpiHint) bodyOut.mpiHint = mpiHint;
    if (clientDebug) {
      bodyOut.supportCopy = {
        talimat:
          'Bu bloğu kopyalayıp Vakıfbank desteğe gönderin (PAN/PaReq maskeli). Sonra VAKIF_MPI_CLIENT_DEBUG kaldırın.',
        enrollUrl,
        httpStatus: xmlRes.status,
        contentType: (xmlRes.contentType && String(xmlRes.contentType).split(';')[0].trim()) || null,
        htmlTitle: parsed.htmlPageTitle || null,
        mpiStatus: parsed.status || null,
        foundTags: parsed.foundTags || null,
        bankBodyPreview: safePreview,
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      body: JSON.stringify(bodyOut),
    };
  }

  const acsUrl = parsed.acsUrl;
  const paReq = parsed.paReq;
  const md = parsed.md || verifyId;
  const acsFormTermUrl = isHttpUrl(parsed.termUrl) ? parsed.termUrl.trim() : resolveMpiStartThreeDFlowUrl(mode);

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
      termUrl: acsFormTermUrl,
    }),
  };
};
