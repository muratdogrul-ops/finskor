// FinSkor İletişim Formu — Admin bildirimi
const nodemailer = require('nodemailer');

const ADMIN_MAIL = 'info@finskor.tr';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Geçersiz istek.' }; }

  const { adSoyad, telefon, konu } = body;
  if (!adSoyad || !telefon) {
    return { statusCode: 400, body: 'Zorunlu alanlar eksik.' };
  }

  const tarih = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });

  const transporter = nodemailer.createTransport({
    host: 'smtppro.zoho.eu',
    port: 465,
    secure: true,
    auth: {
      user: ADMIN_MAIL,
      pass: process.env.ZOHO_SMTP_PASSWORD,
    },
  });

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0D1E35;color:#F4F6F9;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#132845,#0D1E35);padding:20px 28px;border-bottom:1px solid rgba(201,168,76,0.3)">
      <h2 style="color:#C9A84C;margin:0;font-size:18px">FinSkor — Yeni İletişim Talebi</h2>
      <p style="color:rgba(244,246,249,0.5);margin:4px 0 0;font-size:12px">${tarih}</p>
    </div>
    <div style="padding:20px 28px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px 0;color:rgba(244,246,249,0.5);width:120px">Ad Soyad</td><td style="color:#F4F6F9;font-weight:600">${adSoyad}</td></tr>
        <tr><td style="padding:8px 0;color:rgba(244,246,249,0.5)">Telefon</td><td><a href="https://wa.me/90${telefon.replace(/\D/g,'').replace(/^0/,'')}" style="color:#25D366;font-weight:600">${telefon}</a></td></tr>
        <tr><td style="padding:8px 0;color:rgba(244,246,249,0.5)">Konu</td><td style="color:#C9A84C;font-weight:600">${konu || '—'}</td></tr>
      </table>
      <div style="margin-top:16px;padding:12px 16px;background:rgba(46,204,154,0.08);border:1px solid rgba(46,204,154,0.2);border-radius:8px;font-size:13px;color:rgba(244,246,249,0.6)">
        Telefon numarasına tıklayarak WhatsApp'tan ulaşabilirsiniz.
      </div>
    </div>
  </div>`;

  try {
    await transporter.sendMail({
      from: `"FinSkor" <${ADMIN_MAIL}>`,
      to: ADMIN_MAIL,
      subject: `[FinSkor] İletişim Talebi — ${adSoyad} / ${konu}`,
      html,
    });

    // CallMeBot WhatsApp bildirimi (opsiyonel)
    const apiKey = process.env.CALLMEBOT_API_KEY;
    if (apiKey) {
      const msg = `📩 FinSkor İletişim\n${adSoyad}\n📱 ${telefon}\nKonu: ${konu}`;
      const https = require('https');
      const url = `https://api.callmebot.com/whatsapp.php?phone=905308943775&text=${encodeURIComponent(msg)}&apikey=${apiKey}`;
      await new Promise((res, rej) => https.get(url, r => { r.resume(); r.on('end', res); }).on('error', rej)).catch(() => {});
    }
  } catch (err) {
    console.error('contact-form mail hatası:', err.message);
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
