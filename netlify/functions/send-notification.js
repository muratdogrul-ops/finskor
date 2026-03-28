// FinSkor Ödeme Bildirimi — Zoho SMTP + CallMeBot WhatsApp v3
// Tetiklenince: müşteriye onay maili + yöneticiye bildirim maili + yöneticiye WA mesajı + Supabase kayıt

const nodemailer = require('nodemailer');
const https = require('https');

const ADMIN_MAIL      = 'info@finskor.tr';
const ADMIN_WHATSAPP  = '905308943775';
const SB_URL          = 'https://clmqfckposcaqjmbrmuq.supabase.co';
const SB_KEY          = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsbXFmY2twb3NjYXFqbWJybXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjE3MDcsImV4cCI6MjA4ODUzNzcwN30.hbCPb5IMcnNcwUXyDkcUrzFKXPUgJrG1XmLXl_aI8T8';

// Supabase REST API çağrısı
function sbRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const options = {
      hostname: 'clmqfckposcaqjmbrmuq.supabase.co',
      path: '/rest/v1/' + path,
      method,
      headers: {
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
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

// Ödeme formundan gelen müşteriyi Supabase'e kaydet
async function saveToSupabase(adSoyad, email, telefon, firmaAdi, vkn, vd, faturaTipi, odemeYontemi, tarih) {
  try {
    // Müşteri zaten var mı kontrol et (email ile)
    const check = await sbRequest('GET', `customers?email=eq.${encodeURIComponent(email)}&select=id`, null);
    let customerId = null;

    if (check.status === 200 && Array.isArray(check.data) && check.data.length > 0) {
      customerId = check.data[0].id;
    } else {
      // Yeni müşteri oluştur
      const custRes = await sbRequest('POST', 'customers', {
        firma_adi: firmaAdi || adSoyad,
        yetkili_kisi: adSoyad,
        telefon: telefon || null,
        email: email || null,
        vergi_no: vkn || null,
        notlar: vd ? `Vergi Dairesi: ${vd} | Fatura: ${faturaTipi || 'kurumsal'}` : null
      });
      if (custRes.status === 201 && Array.isArray(custRes.data) && custRes.data.length > 0) {
        customerId = custRes.data[0].id;
      }
    }

    // Ödeme kaydı oluştur
    const notlar = [
      vkn ? `VKN: ${vkn}` : '',
      vd ? `Vergi Dairesi: ${vd}` : '',
      faturaTipi ? `Fatura: ${faturaTipi}` : '',
      `E-posta: ${email}`,
      telefon ? `Tel: ${telefon}` : ''
    ].filter(Boolean).join(' | ');

    await sbRequest('POST', 'payments', {
      customer_id: customerId || null,
      tutar: 2490,
      odeme_tarihi: new Date().toISOString().split('T')[0],
      odeme_yontemi: odemeYontemi || 'EFT / Havale',
      notlar: notlar || null
    });
  } catch(e) {
    console.warn('Supabase kayıt hatası:', e.message);
  }
}

// CallMeBot ile yöneticiye WhatsApp bildirimi gönder
async function sendAdminWhatsApp(message) {
  const apiKey = process.env.CALLMEBOT_API_KEY;
  if (!apiKey) return; // env yoksa sessizce atla
  const url = `https://api.callmebot.com/whatsapp.php?phone=${ADMIN_WHATSAPP}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;
  try {
    await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        res.resume();
        res.on('end', resolve);
      }).on('error', reject);
    });
  } catch (e) {
    console.warn('CallMeBot WA hatası:', e.message);
  }
}

// Zoho SMTP transporter
function createTransporter() {
  return nodemailer.createTransport({
    host: 'smtppro.zoho.eu',
    port: 465,
    secure: true,
    auth: {
      user: ADMIN_MAIL,
      pass: process.env.ZOHO_SMTP_PASSWORD, // Netlify env variable
    },
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Geçersiz istek.' };
  }

  const { adSoyad, email, telefon, firmaAdi, vkn, vd, faturaTipi, odemeYontemi } = body;

  if (!adSoyad || !email || !telefon) {
    return { statusCode: 400, body: 'Zorunlu alanlar eksik.' };
  }

  const transporter = createTransporter();
  const tarih = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
  const waLink = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(
    `FinSkor hakkında bilgi almak istiyorum.\nAd Soyad: ${adSoyad}\nE-posta: ${email}`
  )}`;

  // ── 1. YÖNETİCİ BİLDİRİM MAİLİ ──
  const adminHtml = `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0D1E35;color:#F4F6F9;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#132845,#0D1E35);padding:24px 32px;border-bottom:1px solid rgba(201,168,76,0.3)">
      <h2 style="color:#C9A84C;margin:0;font-size:20px">FinSkor — Yeni Ödeme Talebi</h2>
      <p style="color:rgba(244,246,249,0.6);margin:6px 0 0;font-size:13px">${tarih}</p>
    </div>
    <div style="padding:24px 32px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px 0;color:rgba(244,246,249,0.5);width:140px">Ad Soyad</td><td style="color:#F4F6F9;font-weight:600">${adSoyad}</td></tr>
        <tr><td style="padding:8px 0;color:rgba(244,246,249,0.5)">E-posta</td><td style="color:#F4F6F9"><a href="mailto:${email}" style="color:#C9A84C">${email}</a></td></tr>
        <tr><td style="padding:8px 0;color:rgba(244,246,249,0.5)">Telefon</td><td style="color:#F4F6F9"><a href="https://wa.me/90${telefon.replace(/\D/g,'').replace(/^0/,'')}" style="color:#25D366">${telefon} (WhatsApp)</a></td></tr>
        <tr><td style="padding:8px 0;color:rgba(244,246,249,0.5)">Firma</td><td style="color:#F4F6F9">${firmaAdi || '—'}</td></tr>
        <tr><td style="padding:8px 0;color:rgba(244,246,249,0.5)">VKN</td><td style="color:#F4F6F9">${vkn || '—'}</td></tr>
        <tr><td style="padding:8px 0;color:rgba(244,246,249,0.5)">Vergi Dairesi</td><td style="color:#F4F6F9">${vd || '—'}</td></tr>
        <tr><td style="padding:8px 0;color:rgba(244,246,249,0.5)">Fatura Tipi</td><td style="color:#F4F6F9">${faturaTipi || 'kurumsal'}</td></tr>
        <tr><td style="padding:8px 0;color:rgba(244,246,249,0.5)">Ödeme Yöntemi</td><td style="color:#F4F6F9">${odemeYontemi || 'EFT'}</td></tr>
      </table>
      <div style="margin-top:20px;padding:14px 16px;background:rgba(46,204,154,0.08);border:1px solid rgba(46,204,154,0.25);border-radius:8px;font-size:13px;color:rgba(244,246,249,0.7)">
        ⚡ Ödeme doğrulandıktan sonra erişim kodunu oluşturup müşteriye gönderin.
      </div>
    </div>
  </div>`;

  // ── 2. MÜŞTERİ ONAY MAİLİ ──
  const customerHtml = `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0D1E35;color:#F4F6F9;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#132845,#0D1E35);padding:24px 32px;border-bottom:1px solid rgba(201,168,76,0.3)">
      <h2 style="color:#C9A84C;margin:0;font-size:20px">FinSkor — Ödeme Talebiniz Alındı</h2>
    </div>
    <div style="padding:28px 32px">
      <p style="font-size:15px;color:#F4F6F9;margin-bottom:16px">Sayın <strong>${adSoyad}</strong>,</p>
      <p style="color:rgba(244,246,249,0.7);font-size:14px;line-height:1.7;margin-bottom:20px">
        Ödeme talebiniz başarıyla alındı. Ödemeniz teyit edildikten sonra FinSkor erişim kodunuz aşağıdaki kanallardan tarafınıza iletilecektir:
      </p>
      <div style="background:rgba(46,204,154,0.08);border:1px solid rgba(46,204,154,0.25);border-radius:8px;padding:16px 20px;margin-bottom:20px">
        <div style="font-size:13px;color:rgba(244,246,249,0.7);margin-bottom:6px">📧 Bu e-posta adresinize: <strong style="color:#F4F6F9">${email}</strong></div>
        <div style="font-size:13px;color:rgba(244,246,249,0.7)">📱 WhatsApp: <strong style="color:#F4F6F9">${telefon}</strong></div>
      </div>
      <div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);border-radius:8px;padding:14px 18px;margin-bottom:24px;font-size:13px;color:rgba(244,246,249,0.6);line-height:1.7">
        <strong style="color:#C9A84C">Önemli:</strong> Havale/EFT yapıyorsanız açıklama kısmına <strong style="color:#F4F6F9">${email}</strong> adresinizi yazmayı unutmayınız.
        Ödemeniz teyit edildikten sonra erişim kodunuz iletilecektir.
      </div>
      <div style="text-align:center;margin-bottom:24px">
        <a href="${waLink}" style="display:inline-block;padding:12px 28px;background:#25D366;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
          📱 WhatsApp ile İletişime Geçin
        </a>
      </div>
      <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:18px;font-size:12px;color:rgba(244,246,249,0.4);text-align:center">
        FinSkor Kredi Analiz Platformu · <a href="mailto:info@finskor.tr" style="color:#C9A84C">info@finskor.tr</a>
      </div>
    </div>
  </div>`;

  try {
    // Yöneticiye bildirim maili
    await transporter.sendMail({
      from: `"FinSkor" <${ADMIN_MAIL}>`,
      to:   ADMIN_MAIL,
      subject: `[FinSkor] Yeni Ödeme Talebi — ${adSoyad}`,
      html: adminHtml,
    });

    // Müşteriye onay maili
    await transporter.sendMail({
      from: `"FinSkor" <${ADMIN_MAIL}>`,
      to:   email,
      subject: 'FinSkor — Ödeme Talebiniz Alındı',
      html: customerHtml,
    });

    // Yöneticiye WhatsApp bildirimi (CallMeBot)
    const waMsg = `🔔 FinSkor Yeni Ödeme Talebi\n\nAd Soyad: ${adSoyad}\nTelefon: ${telefon}\nE-posta: ${email}\nFirma: ${firmaAdi || '—'}\nYöntem: ${odemeYontemi || 'EFT'}\nTarih: ${tarih}`;
    await sendAdminWhatsApp(waMsg);

    // Supabase'e müşteri + ödeme kaydı
    await saveToSupabase(adSoyad, email, telefon, firmaAdi, vkn, vd, faturaTipi, odemeYontemi, tarih);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error('Mail hatası:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
