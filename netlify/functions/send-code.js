// FinSkor Erişim Kodu Gönderimi — Zoho SMTP + CallMeBot WhatsApp
// Tetiklenince: müşteriye kod maili + müşteriye WA mesajı

const nodemailer = require('nodemailer');

const ADMIN_MAIL     = 'info@finskor.tr';
const ADMIN_WA       = '905308943775';

function createTransporter() {
  return nodemailer.createTransport({
    host: 'smtppro.zoho.eu',
    port: 465,
    secure: true,
    auth: {
      user: ADMIN_MAIL,
      pass: process.env.ZOHO_SMTP_PASSWORD,
    },
  });
}

async function sendWhatsApp(phone, message) {
  const apiKey = process.env.CALLMEBOT_API_KEY;
  if (!apiKey) return;
  // Telefonu temizle: başındaki 0'ı at, +90 veya 90 ile başla
  const cleaned = phone.replace(/\D/g, '').replace(/^0/, '');
  const fullPhone = cleaned.startsWith('90') ? cleaned : '90' + cleaned;
  const url = `https://api.callmebot.com/whatsapp.php?phone=${fullPhone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;
  try {
    const https = require('https');
    await new Promise((resolve, reject) => {
      https.get(url, (res) => { res.resume(); res.on('end', resolve); }).on('error', reject);
    });
  } catch (e) {
    console.warn('CallMeBot WA hatası:', e.message);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Geçersiz istek.' }; }

  const { code, email, phone, firma, credits } = body;

  if (!code) return { statusCode: 400, body: 'Kod eksik.' };

  const transporter = createTransporter();
  const loginUrl = 'https://finskor.tr/app.html';
  const kontorBilgi = credits ? `${credits} kontör` : '';

  // ── MÜŞTERİYE KOD MAİLİ ──
  const customerHtml = `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0D1E35;color:#F4F6F9;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#132845,#0D1E35);padding:24px 32px;border-bottom:1px solid rgba(201,168,76,0.3)">
      <h2 style="color:#C9A84C;margin:0;font-size:20px">🦉 FinSkor — Erişim Kodunuz Hazır</h2>
    </div>
    <div style="padding:28px 32px">
      <p style="font-size:15px;color:#F4F6F9;margin-bottom:16px">Sayın <strong>${firma || 'Değerli Kullanıcı'}</strong>,</p>
      <p style="color:rgba(244,246,249,0.7);font-size:14px;line-height:1.7;margin-bottom:20px">
        FinSkor Kredi Analiz Platformu erişim kodunuz aşağıda yer almaktadır.
      </p>
      <div style="background:rgba(201,168,76,0.08);border:2px solid rgba(201,168,76,0.4);border-radius:12px;padding:20px 24px;text-align:center;margin-bottom:20px">
        <div style="font-size:12px;color:rgba(244,246,249,0.5);margin-bottom:8px;letter-spacing:1px">ERİŞİM KODUNUZ</div>
        <div style="font-size:28px;font-weight:700;color:#C9A84C;letter-spacing:4px;font-family:monospace">${code}</div>
        ${kontorBilgi ? `<div style="font-size:12px;color:rgba(244,246,249,0.5);margin-top:8px">${kontorBilgi}</div>` : ''}
      </div>
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

  // ── YÖNETİCİYE BİLGİ MAİLİ ──
  const adminHtml = `
  <div style="font-family:Arial,sans-serif;max-width:500px;background:#0D1E35;color:#F4F6F9;border-radius:12px;padding:24px 32px">
    <h3 style="color:#C9A84C;margin:0 0 16px">✅ Erişim Kodu Gönderildi</h3>
    <table style="font-size:14px;width:100%">
      <tr><td style="color:rgba(244,246,249,0.5);padding:6px 0;width:120px">Firma</td><td style="color:#F4F6F9">${firma || '—'}</td></tr>
      <tr><td style="color:rgba(244,246,249,0.5);padding:6px 0">Kod</td><td style="color:#C9A84C;font-family:monospace;font-weight:700">${code}</td></tr>
      <tr><td style="color:rgba(244,246,249,0.5);padding:6px 0">E-posta</td><td style="color:#F4F6F9">${email || '—'}</td></tr>
      <tr><td style="color:rgba(244,246,249,0.5);padding:6px 0">Telefon</td><td style="color:#F4F6F9">${phone || '—'}</td></tr>
      ${kontorBilgi ? `<tr><td style="color:rgba(244,246,249,0.5);padding:6px 0">Kontör</td><td style="color:#F4F6F9">${kontorBilgi}</td></tr>` : ''}
    </table>
  </div>`;

  const errors = [];

  // Müşteriye mail
  if (email) {
    try {
      await transporter.sendMail({
        from: `"FinSkor" <${ADMIN_MAIL}>`,
        to: email,
        subject: 'FinSkor — Erişim Kodunuz Hazır',
        html: customerHtml,
      });
    } catch (e) {
      console.error('Müşteri mail hatası:', e.message);
      errors.push('mail: ' + e.message);
    }
  }

  // Yöneticiye bilgi maili
  try {
    await transporter.sendMail({
      from: `"FinSkor" <${ADMIN_MAIL}>`,
      to: ADMIN_MAIL,
      subject: `[FinSkor] Kod Gönderildi — ${firma || code}`,
      html: adminHtml,
    });
  } catch (e) {
    console.error('Admin mail hatası:', e.message);
  }

  // Müşteriye WhatsApp
  if (phone) {
    const waMsg = `🦉 *FinSkor Erişim Kodunuz*\n\n${firma ? firma + ' için e' : 'E'}rişim kodunuz:\n\n🔑 *${code}*${kontorBilgi ? `\n📊 ${kontorBilgi}` : ''}\n\n🌐 Giriş: ${loginUrl}\n\nSorularınız için: ${ADMIN_MAIL}`;
    await sendWhatsApp(phone, waMsg);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, errors }),
  };
};
