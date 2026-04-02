#!/usr/bin/env node
/**
 * Vakıfbank MPI Enrollment — yerel test (Netlify deploy gerekmez).
 *
 * Ödeme / satış oluşmaz: yalnızca 3D kayıt (enrollment) isteği gider.
 * ACS ekranında SMS kodunu girmeseniz provizyon tamamlanmaz.
 *
 * Kullanım (proje kökünden):
 *   npm run test:mpi
 * veya PAN/YYMM komut satırından (shell geçmişine düşer — tercih .env):
 *   npm run test:mpi -- 4355084355084358 2512
 *
 * .env: VAKIF_*, SITE_URL, TEST_PAN, TEST_EXPIRY_YYMM
 */
'use strict';

const path = require('path');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {
  /* dotenv yoksa ortam değişkenlerini kullan */
}

const {
  MPI_ENROLL_URL,
  buildEnrollmentXml,
  postXml,
  parseMpiEnrollmentResponse,
  detectBrand,
  siteBase,
} = require('../netlify/functions/vakif-mpi-shared');

function maskPan(p) {
  const d = String(p).replace(/\D/g, '');
  if (d.length < 10) return '****';
  return d.slice(0, 6) + '******' + d.slice(-4);
}

async function main() {
  const mid = process.env.VAKIF_HOST_MERCHANT_ID;
  const pwd = process.env.VAKIF_MERCHANT_PASSWORD;
  const term = process.env.VAKIF_HOST_TERMINAL_ID;
  const mode = (process.env.VAKIF_INIT || 'test').toLowerCase() === 'prod' ? 'prod' : 'test';

  if (!mid || !pwd || !term) {
    console.error('Eksik: VAKIF_HOST_MERCHANT_ID, VAKIF_MERCHANT_PASSWORD, VAKIF_HOST_TERMINAL_ID (.env veya ortam)');
    process.exit(1);
  }

  const panDigits = String(process.env.TEST_PAN || process.argv[2] || '').replace(/\D/g, '');
  const exp = String(process.env.TEST_EXPIRY_YYMM || process.argv[3] || '').replace(/\D/g, '');

  if (panDigits.length < 13 || panDigits.length > 19 || exp.length !== 4) {
    console.error(
      'TEST_PAN (13–19 hane) ve TEST_EXPIRY_YYMM (4 hane, YYMM) gerekli.\n' +
        '  .env içine yazın veya: npm run test:mpi -- <PAN> <YYMM>'
    );
    process.exit(1);
  }

  const amount = process.env.TEST_AMOUNT || '2490.00';
  const verifyId = 'LOCAL' + Date.now();
  const base = siteBase();
  const termUrl = `${base}/.netlify/functions/vakifbank-mpi-term`;
  const failUrl = `${base}/odeme.html?mpi=hata`;

  const xml = buildEnrollmentXml({
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

  const url = MPI_ENROLL_URL[mode];
  console.log('Ortam:', mode);
  console.log('Endpoint:', url);
  console.log('Kart (maskeli):', maskPan(panDigits), 'SKT(YYMM):', exp, 'Tutar:', amount);
  console.log('TermUrl (SuccessUrl):', termUrl);
  console.log('--- İstek gönderiliyor ---\n');

  let res;
  try {
    res = await postXml(url, xml);
  } catch (e) {
    console.error('Bağlantı hatası:', e.message);
    process.exit(1);
  }

  const parsed = parseMpiEnrollmentResponse(res.text, res.status);

  console.log('HTTP:', res.status);
  console.log('Parse ok:', parsed.ok);
  console.log('Status:', parsed.status || '(boş)');
  if (parsed.message) console.log('Mesaj:', parsed.message);
  if (parsed.foundTags) console.log('Etiket özeti:', parsed.foundTags.slice(0, 200) + (parsed.foundTags.length > 200 ? '…' : ''));

  if (parsed.ok) {
    const u = parsed.acsUrl || '';
    console.log('\n✓ Enrollment başarılı (3D yönlendirme verisi geldi).');
    console.log('ACS URL:', u.length > 100 ? u.slice(0, 100) + '…' : u);
    console.log('PaReq uzunluk:', (parsed.paReq || '').length, '(tamamını loglamıyoruz)');
    console.log('\n→ SMS/şifreyi ACS ekranında girmezseniz satış oluşmaz; bu beklenen güvenli davranış.');
  } else {
    console.log('\n✗ Enrollment başarısız veya yanıt ayrıştırılamadı.');
    if (process.env.TEST_MPI_DUMP_RAW === '1') {
      console.log('\n--- Ham yanıt (TEST_MPI_DUMP_RAW=1) ---\n', res.text.slice(0, 8000));
    } else {
      console.log('Ham yanıt için: TEST_MPI_DUMP_RAW=1 npm run test:mpi');
    }
    process.exit(2);
  }
}

main();
