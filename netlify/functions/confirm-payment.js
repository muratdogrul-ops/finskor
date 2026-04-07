// FinSkor Ödeme Onayı — Erişim kodu üret + müşteriye mail gönder
const nodemailer = require('nodemailer');
const https = require('https');
const { sbHost, sbKey } = require('./sb-config');

const ADMIN_MAIL = 'info@finskor.tr';

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
        Prefer: 'return=representation'
      }
    };
    if (body) options.headers['Content-Length'] = Buffer.byteLength(body);
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function generateCode() {
  const yr = new Date().getFullYear();
  const n = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `KA-${yr}-${n}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Geçersiz istek.' }; }

  const { paymentId, customerId, email, firma, telefon, credits, codeCount: codeCountBody } = body;
  if (!paymentId) return { statusCode: 400, body: 'paymentId eksik.' };

  const creditsNum = Number(credits);
  const creditsForCode =
    credits !== undefined && credits !== null && credits !== '' && Number.isFinite(creditsNum) && creditsNum >= 0
      ? Math.floor(creditsNum)
      : 10;

  const ccNum = Number(codeCountBody);
  const codeCount =
    codeCountBody !== undefined && codeCountBody !== null && codeCountBody !== '' && Number.isFinite(ccNum) && ccNum >= 1
      ? Math.min(50, Math.floor(ccNum))
      : 1;

  async function generateUniqueCode() {
    let c = generateCode();
    for (let i = 0; i < 8; i++) {
      const check = await sbRequest('GET', `access_codes?code=eq.${encodeURIComponent(c)}&select=id`, null);
      if (check.status === 200 && Array.isArray(check.data) && check.data.length === 0) return c;
      c = generateCode();
    }
    return null;
  }

  const codes = [];
  for (let n = 0; n < codeCount; n++) {
    const code = await generateUniqueCode();
    if (!code) {
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Benzersiz kod üretilemedi.' }) };
    }
    const codeRes = await sbRequest('POST', 'access_codes', {
      code,
      customer_id: customerId || null,
      client_name: firma || '',
      email: email || null,
      credits: creditsForCode,
      active: true,
      usage_count: 0,
    });
    if (codeRes.status !== 201) {
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false, error: 'Kod oluşturulamadı: ' + JSON.stringify(codeRes.data) }),
      };
    }
    codes.push(code);
  }

  const code = codes[0];

  // 3. Ödeme durumunu "onaylandi" yap
  await sbRequest('PATCH', `payments?id=eq.${paymentId}`, { durum: 'onaylandi' });

  // 4. Müşteriye mail gönder
  if (email) {
    const loginUrl = 'https://finskor.tr/app.html';
    const transporter = nodemailer.createTransport({
      host: 'smtppro.zoho.eu', port: 465, secure: true,
      auth: { user: ADMIN_MAIL, pass: process.env.ZOHO_SMTP_PASSWORD }
    });

    const codesBlock =
      codes.length > 1
        ? `<p style="color:rgba(244,246,249,0.7);font-size:14px;line-height:1.7;margin-bottom:16px">
          Ödemeniz onaylandı. Aşağıda <strong style="color:#F4F6F9">${codes.length} ayrı erişim kodu</strong> bulunmaktadır; her biri <strong>${creditsForCode} kontör</strong> (analiz hakkı) içerir. Kodları müşterilerinizle paylaşabilirsiniz.
        </p>
        ${codes
          .map(
            (c, idx) =>
              `<div style="background:rgba(201,168,76,0.08);border:2px solid rgba(201,168,76,0.4);border-radius:12px;padding:16px 20px;text-align:center;margin-bottom:12px">
          <div style="font-size:11px;color:rgba(244,246,249,0.5);margin-bottom:6px">KOD ${idx + 1} / ${codes.length}</div>
          <div style="font-size:22px;font-weight:700;color:#C9A84C;letter-spacing:3px;font-family:monospace">${c}</div>
          <div style="font-size:12px;color:rgba(244,246,249,0.5);margin-top:6px">${creditsForCode} kontör</div>
        </div>`
          )
          .join('')}`
        : `<p style="color:rgba(244,246,249,0.7);font-size:14px;line-height:1.7;margin-bottom:20px">
          Ödemeniz onaylandı. FinSkor erişim kodunuz aşağıda yer almaktadır.
        </p>
        <div style="background:rgba(201,168,76,0.08);border:2px solid rgba(201,168,76,0.4);border-radius:12px;padding:20px 24px;text-align:center;margin-bottom:20px">
          <div style="font-size:12px;color:rgba(244,246,249,0.5);margin-bottom:8px;letter-spacing:1px">ERİŞİM KODUNUZ</div>
          <div style="font-size:28px;font-weight:700;color:#C9A84C;letter-spacing:4px;font-family:monospace">${code}</div>
          <div style="font-size:12px;color:rgba(244,246,249,0.5);margin-top:8px">${creditsForCode} kontör</div>
        </div>`;

    const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0D1E35;color:#F4F6F9;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#132845,#0D1E35);padding:24px 32px;border-bottom:1px solid rgba(201,168,76,0.3)">
        <h2 style="color:#C9A84C;margin:0;font-size:20px">🦉 FinSkor — Erişim Kodunuz Hazır</h2>
      </div>
      <div style="padding:28px 32px">
        <p style="font-size:15px;color:#F4F6F9;margin-bottom:16px">Sayın <strong>${firma || 'Değerli Kullanıcı'}</strong>,</p>
        ${codesBlock}
        <div style="text-align:center;margin-bottom:24px">
          <a href="${loginUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#C9A84C,#a8873a);color:#fff;border-radius:8px;text-decoration:none;font-size:15px;font-weight:700">
            🚀 Platforma Giriş Yap
          </a>
        </div>
        <div style="background:rgba(46,204,154,0.08);border:1px solid rgba(46,204,154,0.2);border-radius:8px;padding:14px 18px;font-size:13px;color:rgba(244,246,249,0.6);line-height:1.7">
          Giriş adresi: <a href="${loginUrl}" style="color:#C9A84C">${loginUrl}</a><br>
          Sorularınız için: <a href="mailto:${ADMIN_MAIL}" style="color:#C9A84C">${ADMIN_MAIL}</a>
        </div>
      </div>
    </div>`;

    try {
      await transporter.sendMail({
        from: `"FinSkor" <${ADMIN_MAIL}>`,
        to: email,
        subject: 'FinSkor — Erişim Kodunuz Hazır',
        html
      });
    } catch(e) {
      console.error('Mail hatası:', e.message);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      code,
      codes,
      email: email || null,
      telefon: telefon || null,
      firma: firma || '',
    }),
  };
};
