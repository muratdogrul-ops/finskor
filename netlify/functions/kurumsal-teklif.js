// Kurumsal KOBİ teklif talebi — Zoho SMTP (contact-form ile aynı: ZOHO_SMTP_PASSWORD, smtppro.zoho.eu)
const nodemailer = require('nodemailer');
const https = require('https');

const { sbHost, sbKey } = require('./sb-config');
const ADMIN_MAIL = 'info@finskor.tr';

function sbPost(table, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const key = sbKey();
    const req = https.request({
      hostname: sbHost(),
      path: '/rest/v1/' + table,
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      res.resume();
      res.on('end', resolve);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  const jsonHeaders = { 'Content-Type': 'application/json' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: 'method' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: 'json' }) };
  }

  const adSoyad = String(body.adSoyad || '').trim();
  const telefon = String(body.telefon || body.cep || '').trim();
  if (!adSoyad || adSoyad.length < 2) {
    return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: 'ad' }) };
  }
  const digits = telefon.replace(/\D/g, '');
  if (!telefon || digits.length < 10) {
    return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: 'telefon' }) };
  }

  if (!process.env.ZOHO_SMTP_PASSWORD) {
    console.error('kurumsal-teklif: ZOHO_SMTP_PASSWORD tanımlı değil');
    return { statusCode: 503, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: 'smtp_config' }) };
  }

  const tarih = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
  const waDigits = digits.replace(/^0/, '');

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
      <h2 style="color:#C9A84C;margin:0;font-size:18px">FinSkor — Kurumsal / KOBİ teklif talebi</h2>
      <p style="color:rgba(244,246,249,0.5);margin:4px 0 0;font-size:12px">${tarih}</p>
    </div>
    <div style="padding:20px 28px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px 0;color:rgba(244,246,249,0.5);width:120px">Ad Soyad</td><td style="color:#F4F6F9;font-weight:600">${adSoyad.replace(/</g, '&lt;')}</td></tr>
        <tr><td style="padding:8px 0;color:rgba(244,246,249,0.5)">Cep</td><td><a href="https://wa.me/90${waDigits}" style="color:#25D366;font-weight:600">${telefon.replace(/</g, '&lt;')}</a></td></tr>
      </table>
      <p style="margin-top:14px;font-size:12px;color:rgba(244,246,249,0.55)">Kaynak: Uygulama içi paket penceresi (Teklif Al).</p>
    </div>
  </div>`;

  try {
    await transporter.sendMail({
      from: `"FinSkor" <${ADMIN_MAIL}>`,
      to: ADMIN_MAIL,
      subject: `[FinSkor] Kurumsal KOBİ teklif — ${adSoyad}`,
      text: `Kurumsal / KOBİ teklif talebi\nTarih: ${tarih}\nAd Soyad: ${adSoyad}\nCep: ${telefon}\n`,
      html,
    });
  } catch (err) {
    console.error('kurumsal-teklif mail hatası:', err.message);
    return { statusCode: 502, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: 'mail_send' }) };
  }

  const apiKey = process.env.CALLMEBOT_API_KEY;
  if (apiKey) {
    const msg = `📋 FinSkor Kurumsal teklif\n${adSoyad}\n📱 ${telefon}`;
    const url = `https://api.callmebot.com/whatsapp.php?phone=905308943775&text=${encodeURIComponent(msg)}&apikey=${apiKey}`;
    await new Promise((res, rej) =>
      https.get(url, (r) => {
        r.resume();
        r.on('end', res);
      }).on('error', rej)
    ).catch(() => {});
  }

  await sbPost('leads', {
    ad_soyad: adSoyad,
    telefon: telefon || null,
    kaynak: 'Kurumsal KOBİ teklif',
    durum: 'Takipte',
    notlar: 'Uygulama — paket popup (Teklif Al)',
  }).catch((e) => console.warn('kurumsal-teklif Supabase:', e.message));

  return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
};
