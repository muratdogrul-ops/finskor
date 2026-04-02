'use strict';

const crypto = require('crypto');
const https = require('https');
const { vakifFetch } = require('./vakif-fetch');
const { sbHost, sbKey } = require('./sb-config');

const PAKET = {
  profesyonel: { fiyat: '2490.00', fiyatLabel: '2.490', credits: 4, ad: 'FinSkor Profesyonel Paket' },
  danisan: { fiyat: '36000.00', fiyatLabel: '36.000', credits: 100, ad: 'FinSkor Finansal Danışman Paketi' },
  nakitflow: { fiyat: '4990.00', fiyatLabel: '4.990', credits: 1, ad: 'NakitFlow 60 Aylık Projeksiyon Paketi' },
};

const MPI_ENROLL_URL = {
  test: 'https://inbound.apigatewaytest.vakifbank.com.tr:8443/threeDGateway/Enrollment',
  prod: 'https://inbound.apigateway.vakifbank.com.tr:8443/threeDGateway/Enrollment',
};

const VPOS_URL = {
  test: 'https://apiportalprep.vakifbank.com.tr:8443/virtualPos/Vposreq',
  prod: 'https://apigw.vakifbank.com.tr:8443/virtualPos/Vposreq',
};

function siteBase() {
  return (process.env.SITE_URL || process.env.URL || 'https://finskor.tr').replace(/\/$/, '');
}

function xmlTag(xml, tag) {
  const m = String(xml).match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').trim() : '';
}

/** İsim alanı önekli etiketler: soap:Status, ns1:Status */
function xmlTagFlexible(xml, tag) {
  const plain = xmlTag(xml, tag);
  if (plain) return plain;
  const esc = String(tag).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = String(xml).match(
    new RegExp(`<[a-zA-Z0-9_]+:${esc}[^>]*>([\\s\\S]*?)</[a-zA-Z0-9_]+:${esc}>`, 'i')
  );
  return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').trim() : '';
}

/**
 * MPI Enrollment yanıtını ayrıştırır (Vakıfbank / namespace / ProcReturnCode farkları).
 */
function parseMpiEnrollmentResponse(rawText, httpStatus) {
  const raw = String(rawText || '').trim();
  const snippet = raw.slice(0, 400).replace(/\s+/g, ' ');

  if (httpStatus != null && (httpStatus < 200 || httpStatus >= 300)) {
    return {
      ok: false,
      status: '',
      message: `Banka iletişim hatası (HTTP ${httpStatus}).`,
      acsUrl: '',
      paReq: '',
      md: '',
      logHint: snippet,
    };
  }

  if (!raw.includes('<')) {
    return {
      ok: false,
      status: '',
      message: 'Banka XML yerine düz metin veya boş yanıt döndü. Endpoint ve ortam (test/prod) kontrol edin.',
      acsUrl: '',
      paReq: '',
      md: '',
      logHint: snippet,
    };
  }

  const t = (name) => xmlTagFlexible(raw, name);

  const status = (t('Status') || t('ThreeDSecureStatus') || '').trim().toUpperCase();
  const procReturn = (t('ProcReturnCode') || t('ProcReturn') || '').trim();
  const message =
    t('Message') ||
    t('ErrorMessage') ||
    t('ErrorMsg') ||
    t('ResponseMessage') ||
    t('ErrMsg') ||
    t('VerifyEnrollmentRequestResult') ||
    '';
  const acsUrl = t('ACSUrl') || t('AcsUrl') || t('ACSURL') || t('AcsURL');
  const paReq = t('PaReq') || t('PAREQ') || t('Pareq');
  const md = t('MD') || t('Md');
  const errCode = t('ErrorCode') || t('ResultCode') || '';

  const hasAcs = !!(acsUrl && paReq);
  const procOk = procReturn === '00' || procReturn === '0000' || procReturn === '0';

  if (status === 'N' || status === 'U') {
    return {
      ok: false,
      status,
      message: message || 'Bu kart için 3D Secure kullanılamıyor veya kart doğrulanamadı (Status ' + status + ').',
      acsUrl,
      paReq,
      md,
      logHint: snippet,
    };
  }

  // Y: klasik başarı; A: attempt; bazı kurulumlarda Status boş ama ProcReturnCode 00 + PaReq gelir
  const ok =
    hasAcs &&
    (status === 'Y' ||
      status === 'A' ||
      ((status === '' || !status) && procOk));

  if (!ok) {
    const parts = [
      message,
      errCode && `Kod: ${errCode}`,
      procReturn && `İşlem kodu: ${procReturn}`,
      status ? `3D durumu: ${status}` : '3D durumu okunamadı (boş); banka yanıt etiketleri dokümandan farklı olabilir.',
    ].filter(Boolean);
    return {
      ok: false,
      status,
      message:
        parts.join(' — ') ||
        '3D kayıt başarısız. Banka entegrasyon dokümanındaki yanıt etiketleri ile uyum kontrol edilmeli.',
      acsUrl,
      paReq,
      md,
      logHint: snippet,
    };
  }

  return { ok: true, status, message, acsUrl, paReq, md, logHint: '' };
}

function xmlTagLoose(xml, tag) {
  let v = xmlTag(xml, tag);
  if (v) return v;
  const re = new RegExp(`<${tag}[^>]*/>`, 'i');
  const m = String(xml).match(re);
  return m ? '' : '';
}

function detectBrand(pan) {
  const p = String(pan || '').replace(/\D/g, '');
  if (p.startsWith('4')) return '100';
  if (p.startsWith('5') || p.startsWith('2')) return '200';
  if (p.startsWith('9792') || p.startsWith('9791')) return '300';
  return '100';
}

function sessionKey() {
  const s = process.env.VAKIF_MPI_SESSION_SECRET || process.env.VAKIF_MERCHANT_PASSWORD || 'finskor-mpi';
  return crypto.createHash('sha256').update(String(s)).digest();
}

function encryptMpiSession(obj) {
  const key = sessionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

function decryptMpiSession(b64) {
  const raw = Buffer.from(String(b64 || ''), 'base64url');
  if (raw.length < 28) throw new Error('session');
  const key = sessionKey();
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return JSON.parse(dec.toString('utf8'));
}

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
        Prefer: 'return=representation',
      },
    };
    if (body) options.headers['Content-Length'] = Buffer.byteLength(body);
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (d) => (raw += d));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, data: raw });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function buildEnrollmentXml(opts) {
  const {
    merchantId,
    merchantPassword,
    verifyId,
    pan,
    expiryYYMM,
    amount,
    brandName,
    successUrl,
    failureUrl,
  } = opts;
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<VerifyEnrollmentRequest>' +
    `<MerchantId>${escXml(merchantId)}</MerchantId>` +
    `<MerchantPassword>${escXml(merchantPassword)}</MerchantPassword>` +
    `<VerifyEnrollmentRequestId>${escXml(verifyId)}</VerifyEnrollmentRequestId>` +
    `<Pan>${escXml(pan)}</Pan>` +
    `<ExpiryDate>${escXml(expiryYYMM)}</ExpiryDate>` +
    `<PurchaseAmount>${escXml(amount)}</PurchaseAmount>` +
    `<Currency>949</Currency>` +
    `<BrandName>${escXml(brandName)}</BrandName>` +
    `<SuccessUrl>${escXml(successUrl)}</SuccessUrl>` +
    `<FailureUrl>${escXml(failureUrl)}</FailureUrl>` +
    '</VerifyEnrollmentRequest>'
  );
}

function escXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildVposSaleXml(opts) {
  const {
    merchantId,
    password,
    terminalNo,
    transactionId,
    amount,
    pan,
    expiry,
    cvv,
    eci,
    cavv,
    verifyEnrollmentRequestId,
    xid3ds,
  } = opts;
  let extra = '';
  if (eci) extra += `<ECI>${escXml(eci)}</ECI>`;
  if (cavv) extra += `<CAVV>${escXml(cavv)}</CAVV>`;
  if (verifyEnrollmentRequestId)
    extra += `<VerifyEnrollmentRequestId>${escXml(verifyEnrollmentRequestId)}</VerifyEnrollmentRequestId>`;
  if (xid3ds) extra += `<Xid>${escXml(xid3ds)}</Xid>`;
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<VposRequest>' +
    `<MerchantId>${escXml(merchantId)}</MerchantId>` +
    `<Password>${escXml(password)}</Password>` +
    `<TerminalNo>${escXml(terminalNo)}</TerminalNo>` +
    `<TransactionType>Sale</TransactionType>` +
    `<TransactionId>${escXml(transactionId)}</TransactionId>` +
    `<CurrencyAmount>${escXml(amount)}</CurrencyAmount>` +
    `<CurrencyCode>949</CurrencyCode>` +
    `<Pan>${escXml(pan)}</Pan>` +
    `<Expiry>${escXml(expiry)}</Expiry>` +
    `<Cvv>${escXml(cvv)}</Cvv>` +
    extra +
    '</VposRequest>'
  );
}

function parsePares(paresB64) {
  try {
    const xml = Buffer.from(String(paresB64 || '').replace(/\s/g, ''), 'base64').toString('utf8');
    const eci =
      xml.match(/<eci[^>]*>([^<]+)</i)?.[1]?.trim() ||
      xml.match(/<Eci[^>]*>([^<]+)</i)?.[1]?.trim() ||
      '';
    let cavv =
      xml.match(/<authenticationvalue[^>]*>([^<]+)</i)?.[1]?.trim() ||
      xml.match(/<AuthenticationValue[^>]*>([^<]+)</i)?.[1]?.trim() ||
      xml.match(/<cavv[^>]*>([^<]+)</i)?.[1]?.trim() ||
      xml.match(/<Cavv[^>]*>([^<]+)</i)?.[1]?.trim() ||
      '';
    const xid =
      xml.match(/<xid[^>]*>([^<]+)</i)?.[1]?.trim() ||
      xml.match(/<Xid[^>]*>([^<]+)</i)?.[1]?.trim() ||
      '';
    return { eci, cavv, xid, xml };
  } catch {
    return { eci: '', cavv: '', xid: '', xml: '' };
  }
}

function isVposOk(xml) {
  const rc = xmlTag(xml, 'ResultCode') || xmlTag(xml, 'ResponseCode') || xmlTag(xml, 'Rc');
  return rc === '0000' || rc === '00' || rc === '0';
}

async function postXml(url, xmlBody) {
  const res = await vakifFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      Accept: 'application/xml, text/xml, */*',
    },
    body: xmlBody,
  });
  const text = await res.text();
  return { status: res.status, text };
}

module.exports = {
  PAKET,
  MPI_ENROLL_URL,
  VPOS_URL,
  siteBase,
  xmlTag,
  xmlTagFlexible,
  parseMpiEnrollmentResponse,
  xmlTagLoose,
  detectBrand,
  encryptMpiSession,
  decryptMpiSession,
  sbRequest,
  buildEnrollmentXml,
  buildVposSaleXml,
  parsePares,
  isVposOk,
  postXml,
};
