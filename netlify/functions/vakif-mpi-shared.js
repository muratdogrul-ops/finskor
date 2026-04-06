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

/**
 * MPI Enrollment / startThreeDFlow: banka teyidiyle test ve canlı :8443.
 * VPOS (apigw) ayrı host; canlı varsayılan :8443 — VAKIF_VPOS_URL_* ile override.
 * Farklı port için VAKIF_HTTP_API_PORT veya tam URL env: VAKIF_MPI_*_URL.
 */
const MPI_ENROLL_URL = {
  test: 'https://inbound.apigatewaytest.vakifbank.com.tr:8443/threeDGateway/Enrollment',
  prod: 'https://inbound.apigateway.vakifbank.com.tr:8443/threeDGateway/Enrollment',
};

/** Sabit port URL’lere gömülü. Env override hâlâ çalışır. Tam URL env her zaman baskın. */
function withGatewayPort(url) {
  const port = (process.env.VAKIF_HTTP_API_PORT || '').trim();
  if (!port) return url;
  try {
    const u = new URL(url);
    if (u.port) return url;
    u.port = port;
    return u.href;
  } catch (_) {
    return url;
  }
}

/** Bankanın verdiği tam URL farklıysa kod değiştirmeden override (test / canlı ayrı). */
function resolveMpiEnrollUrl(mode) {
  const key = mode === 'prod' ? 'VAKIF_MPI_ENROLL_URL_PROD' : 'VAKIF_MPI_ENROLL_URL_TEST';
  const o = process.env[key];
  if (o && String(o).trim()) return String(o).trim();
  return withGatewayPort(MPI_ENROLL_URL[mode]);
}

const VPOS_URL = {
  test: 'https://apiportalprep.vakifbank.com.tr:8443/virtualPos/Vposreq',
  prod: 'https://apigw.vakifbank.com.tr:8443/virtualPos/Vposreq',
};

function resolveVposUrl(mode) {
  const key = mode === 'prod' ? 'VAKIF_VPOS_URL_PROD' : 'VAKIF_VPOS_URL_TEST';
  const o = process.env[key];
  if (o && String(o).trim()) return String(o).trim();
  return withGatewayPort(VPOS_URL[mode]);
}

/** ACS, PARes sonucunu buraya POST eder; MPI sonucu ÜİY SuccessUrl’e iletir (kılavuz 5.2.1 / 5.2.2). */
const MPI_START_THREED_FLOW_URL = {
  test: 'https://inbound.apigatewaytest.vakifbank.com.tr:8443/threeDGateway/startThreeDFlow',
  prod: 'https://inbound.apigateway.vakifbank.com.tr:8443/threeDGateway/startThreeDFlow',
};

function resolveMpiStartThreeDFlowUrl(mode) {
  const key = mode === 'prod' ? 'VAKIF_MPI_START_THREED_FLOW_PROD' : 'VAKIF_MPI_START_THREED_FLOW_TEST';
  const o = process.env[key];
  if (o && String(o).trim()) return String(o).trim();
  return withGatewayPort(MPI_START_THREED_FLOW_URL[mode]);
}

function siteBase() {
  return (process.env.SITE_URL || process.env.URL || 'https://finskor.tr').replace(/\/$/, '');
}

/**
 * MPI oturum çerezi. Host-only çerez www ile apex arasında taşınmaz; ACS dönüşünde oturum kaybolur.
 * Özel alan: MPI_SESSION_COOKIE_DOMAIN=finskor.tr (isteğe bağlı; boşsa SITE_URL hostundan türetilir).
 * *.netlify.app önizlemelerde Domain eklenmez (çapraz site sızıntısı olmasın diye).
 */
function buildMpiSessionCookie(encCtx) {
  let domainAttr = '';
  const explicit = (process.env.MPI_SESSION_COOKIE_DOMAIN || '').trim();
  if (explicit) {
    domainAttr = `; Domain=${explicit.replace(/^\./, '')}`;
  } else {
    try {
      const h = new URL(siteBase()).hostname;
      const disallowed = h === 'localhost' || h.endsWith('.netlify.app') || /^(\d{1,3}\.){3}\d{1,3}$/.test(h);
      if (h && !disallowed) {
        const apex = h.startsWith('www.') ? h.slice(4) : h;
        domainAttr = `; Domain=${apex}`;
      }
    } catch (_) {}
  }
  return `finskor_mpi=${String(encCtx || '').trim()}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=900${domainAttr}`;
}

/**
 * ACS → TermUrl POST gövdesinden alan. URLSearchParams kullanma: PaRes base64 içindeki '+'
 * application/x-www-form-urlencoded kurallarıyla boşluğa dönüşür ve imza/base64 bozulur.
 */
function decodeUrlEncodedFormField(rawBody, names) {
  const body = String(rawBody || '');
  for (const name of names) {
    const esc = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?:^|&)${esc}=([^&]*)`);
    const m = body.match(re);
    if (!m) continue;
    try {
      const decoded = decodeURIComponent(m[1]);
      if (decoded !== '') return decoded;
    } catch {
      if (m[1] !== '') return m[1];
    }
  }
  return '';
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

/** Etiket içeriği veya attribute (Vakıfbank varyantları) */
function xmlFirstOf(xml, names, attrNames = []) {
  for (const name of names) {
    const body = xmlTagFlexible(xml, name);
    if (body) return body;
    const esc = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const attr of attrNames.length ? attrNames : ['value', 'Value', 'ValueText']) {
      const attrEsc = String(attr).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(
        `<(?:[a-zA-Z0-9_]+:)?${esc}[^>]*\\b${attrEsc}\\s*=\\s*["']([^"']*)["']`,
        'i'
      );
      const m = String(xml).match(re);
      if (m && m[1].trim()) return m[1].trim();
    }
  }
  return '';
}

function stripCdata(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .trim();
}

function decodeHtmlEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/** CDATA içinde gömülü ikinci XML katmanı */
function expandRawWithInnerXml(raw) {
  const extra = [];
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>/gi;
  let m;
  while ((m = re.exec(raw))) {
    const inner = m[1];
    if (inner.includes('<') && /<[a-zA-Z_][\w:.-]*/.test(inner)) extra.push(inner);
  }
  if (!extra.length) return raw;
  return `${raw}\n${extra.join('\n')}`;
}

function merchantHostHints() {
  const hints = ['netlify.app', 'finskor'];
  const u = (process.env.SITE_URL || process.env.URL || '').trim();
  try {
    if (u) hints.push(new URL(u.startsWith('http') ? u : `https://${u}`).hostname);
  } catch (_) {
    /* ignore */
  }
  return hints.filter(Boolean);
}

/** Metindeki tüm URL’lerden ACS adayı seç (işyeri callback URL’lerini ele) */
function pickAcsUrlFromRaw(raw) {
  const hints = merchantHostHints().map((h) => h.toLowerCase());
  const all = String(raw).match(/https?:\/\/[^\s<"'<>]{10,2500}/gi) || [];
  const uniq = [...new Set(all.map((u) => u.replace(/&amp;/g, '&')))];
  const scored = uniq
    .filter((u) => {
      const l = u.toLowerCase();
      if (hints.some((h) => h && l.includes(h))) return false;
      return true;
    })
    .map((u) => {
      const l = u.toLowerCase();
      let score = 0;
      if (/startThreeDFlow|ProcessEnrollment|\/threeDGateway\/Enrollment/i.test(u)) return { u, score: -100 };
      // "secure" / "gateway" tek başına WAF/HTML içinde çok yanlış pozitif üretiyordu — sıkı ACS sinyali şart
      const strongAcs =
        /threeds|3ds|3-d-secure|secureacs|\/acs|\.acs\.|modirum|cardinal|directory\.|emv3ds|rsa3ds|3dss|mpi\//i.test(
          l
        );
      const medium = /authentication|issuerurl|pareq|emvco/i.test(l) && /pay|card|bank|3d|acs/i.test(l);
      if (strongAcs) score += 32;
      else if (medium) score += 22;
      if (/\.(js|css|png|jpe?g|woff2?|svg)(\?|$)/i.test(u)) score -= 50;
      if (strongAcs && /api\.|\.com|\.net/i.test(u)) score += 2;
      return { u, score };
    })
    .filter((x) => x.score >= 22)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.u || '';
}

/** Etiket listesinde pareq / auth ile eşleşen yerel adlardan içerik çek */
function fuzzyExtractPaReq(xml) {
  const names = listXmlLocalTagNames(xml).split(/,\s*/);
  for (const name of names) {
    const n = name.trim();
    if (!n) continue;
    const nl = n.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (
      !nl.includes('pareq') &&
      !nl.includes('parequest') &&
      !nl.includes('authenticationrequest') &&
      !nl.includes('threedsecure') &&
      nl !== 'encodeddata'
    )
      continue;
    const v = xmlTagFlexible(xml, n);
    const t = stripCdata(v).replace(/\s+/g, '').trim();
    if (t.length >= 4) return t;
  }
  return '';
}

/** Ham metinde PaReq benzeri uzun base64 blok (etiketsiz yanıtlar) */
function extractPaReqLooseFromText(text) {
  const s = String(text);
  const m = s.match(/>([A-Za-z0-9+/=\s]{32,})</);
  if (m) {
    const c = m[1].replace(/\s+/g, '').trim();
    if (c.length >= 32 && /^[A-Za-z0-9+/]+=*$/.test(c)) return c;
  }
  const m2 = s.match(/"PaReq"\s*:\s*"([^"]+)"/i);
  if (m2 && m2[1].length >= 4) return m2[1].replace(/\s+/g, '');
  return '';
}

function isLikelyHttpUrl(s) {
  return /^https?:\/\/.+/i.test(String(s || '').trim());
}

/** Yanıttaki yerel etiket adları (bankaya sorarken kullanılır) */
function listXmlLocalTagNames(xml) {
  const seen = new Set();
  const re = /<([a-zA-Z][a-zA-Z0-9_.:]*)\b/g;
  let m;
  const max = 45;
  while ((m = re.exec(xml)) && seen.size < max) {
    const full = m[1];
    const local = full.includes(':') ? full.split(':').pop() : full;
    if (local && !local.startsWith('?')) seen.add(local);
  }
  return [...seen].join(', ');
}

/** Ham gövde veya etiket listesi MPI XML'i değil, tipik HTML sayfasına benziyorsa true */
function isLikelyHtmlInsteadOfMpiXml(foundTags, raw) {
  const r = String(raw || '').trim();
  if (/^<\s*!DOCTYPE\s+html/i.test(r) || /^<\s*html[\s>]/i.test(r)) return true;
  if (!foundTags) return false;
  const tags = String(foundTags)
    .split(',')
    .map((t) => {
      const s = t.trim();
      return s.includes(':') ? s.split(':').pop().toLowerCase() : s.toLowerCase();
    })
    .filter(Boolean);
  if (!tags.length) return false;
  const mpiHint = /enroll|pareq|acsurl|parequest|mdstatus|verifyenrol|procretur|procstatus|resultcode|responsecode|merchantid|terminalno|gateway/i;
  if (tags.some((t) => mpiHint.test(t))) return false;
  return tags.includes('html') && (tags.includes('head') || tags.includes('body'));
}

function extractRoughHtmlTitle(html) {
  const m = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return '';
  return m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
}

function tryParseMpiJson(raw) {
  const t = raw.trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

/** JSON içinde (iç içe) bilinen alan adlarını ara */
function jsonFindMpiFields(obj) {
  const pick = {};
  const names = {
    status: ['status', 'threedssecurestatus', 'enrollmentstatus', 'mdstatus'],
    procReturn: ['procreturcode', 'procretur', 'processreturncode'],
    message: ['message', 'errormessage', 'errmsg', 'responsemessage', 'resultmessage'],
    acsUrl: ['acsurl', 'acsurl2', 'acs', 'redirecturl', 'gatewayurl', 'authenticationurl', 'acsaddress'],
    paReq: [
      'pareq',
      'pareqmsg',
      'authenticationrequest',
      'parequest',
      'pareqmessage',
      'encodedpareq',
      'pareqdata',
      'encodeddata',
    ],
    md: ['md', 'merchantdata'],
    errCode: ['errorcode', 'resultcode', 'responsecode'],
    termUrl: ['termurl', 'term_url', 'mpitermurl'],
  };
  function walk(o) {
    if (o == null) return;
    if (Array.isArray(o)) {
      o.forEach(walk);
      return;
    }
    if (typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      const kl = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (v != null && typeof v !== 'object' && typeof v !== 'undefined') {
        const s = String(v).trim();
        if (!s) {
          /* skip */
        } else {
          for (const [bucket, keys] of Object.entries(names)) {
            if (pick[bucket]) continue;
            for (const cand of keys) {
              if (kl === cand.replace(/[^a-z0-9]/g, '')) {
                pick[bucket] = s;
                break;
              }
            }
          }
        }
      } else if (v && typeof v === 'object') walk(v);
    }
  }
  walk(obj);
  return {
    status: (pick.status || '').toUpperCase(),
    procReturn: pick.procReturn || '',
    message: pick.message || '',
    acsUrl: pick.acsUrl || '',
    paReq: pick.paReq || '',
    md: pick.md || '',
    errCode: pick.errCode || '',
    termUrl: pick.termUrl || '',
  };
}

/**
 * MPI Enrollment yanıtını ayrıştırır (Vakıfbank / namespace / JSON / attribute varyantları).
 */
function parseMpiEnrollmentResponse(rawText, httpStatus, contentType) {
  let raw = String(rawText || '')
    .replace(/^\ufeff/, '')
    .trim();
  if (/&lt;[a-zA-Z_]/.test(raw) && !/<[a-zA-Z_]/.test(raw)) {
    raw = decodeHtmlEntities(raw);
  }
  const snippet = raw.slice(0, 400).replace(/\s+/g, ' ');
  const foundTagsEarly = raw.includes('<') ? listXmlLocalTagNames(raw) : '';
  const foundTags = foundTagsEarly;
  const xmlSearch = expandRawWithInnerXml(raw);

  if (httpStatus != null && (httpStatus < 200 || httpStatus >= 300)) {
    const ct = String(contentType || '').split(';')[0].trim();
    return {
      ok: false,
      status: '',
      message:
        `Banka iletişim hatası (HTTP ${httpStatus}).` +
        (ct ? ` Yanıt içeriği: ${ct}.` : ''),
      acsUrl: '',
      paReq: '',
      md: '',
      logHint: snippet,
      foundTags,
      responseContentType: ct || null,
    };
  }

  const jsonObj = tryParseMpiJson(raw);
  const looksLikeHtmlResponse = isLikelyHtmlInsteadOfMpiXml(foundTagsEarly, raw) && !jsonObj;

  let status = '';
  let procReturn = '';
  let message = '';
  let acsUrl = '';
  let paReq = '';
  let md = '';
  let errCode = '';
  let bankTermUrl = '';

  if (jsonObj) {
    const j = jsonFindMpiFields(jsonObj);
    status = j.status;
    procReturn = j.procReturn;
    message = j.message;
    acsUrl = j.acsUrl;
    paReq = j.paReq;
    md = j.md;
    errCode = j.errCode;
    bankTermUrl = j.termUrl || '';
  } else if (!raw.includes('<')) {
    return {
      ok: false,
      status: '',
      message: 'Banka XML/JSON yerine düz metin veya boş yanıt döndü. Endpoint ve ortam (test/prod) kontrol edin.',
      acsUrl: '',
      paReq: '',
      md: '',
      logHint: snippet,
      foundTags: '',
    };
  } else {
    const x1 = raw;
    const x2 = xmlSearch;
    status = (
      xmlFirstOf(x2, ['Status', 'ThreeDSecureStatus', 'EnrollmentStatus', 'MdStatus']) ||
      xmlFirstOf(x1, ['Status', 'ThreeDSecureStatus', 'EnrollmentStatus', 'MdStatus']) ||
      ''
    )
      .trim()
      .toUpperCase();
    procReturn =
      xmlFirstOf(x2, ['ProcReturnCode', 'ProcReturn', 'ProcessReturnCode']) ||
      xmlFirstOf(x1, ['ProcReturnCode', 'ProcReturn', 'ProcessReturnCode']) ||
      '';
    message =
      xmlFirstOf(x2, [
        'Message',
        'ErrorMessage',
        'ErrorMsg',
        'ResponseMessage',
        'ErrMsg',
        'ResultMessage',
        'VerifyEnrollmentRequestResult',
        'FaultString',
        'faultstring',
        'Reason',
        'Detail',
      ]) ||
      xmlFirstOf(x1, [
        'Message',
        'ErrorMessage',
        'ErrorMsg',
        'ResponseMessage',
        'ErrMsg',
        'ResultMessage',
        'VerifyEnrollmentRequestResult',
        'FaultString',
        'faultstring',
        'Reason',
        'Detail',
      ]) ||
      '';
    const acsNames = [
      'ACSUrl',
      'AcsUrl',
      'ACSURL',
      'AcsURL',
      'ACS2Url',
      'GatewayUrl',
      'RedirectUrl',
      'AuthenticationUrl',
      'ThreeDSecureUrl',
      'IssuerUrl',
      'DirectoryServerUrl',
      'ACSAddress',
      'Url',
    ];
    acsUrl = xmlFirstOf(x2, acsNames) || xmlFirstOf(x1, acsNames);
    const paNames = [
      'PaReq',
      'PAREQ',
      'Pareq',
      'PAReq',
      'AuthenticationRequest',
      'EncodedPaReq',
      'RequestMessage',
      'AuthenticationData',
    ];
    paReq =
      xmlFirstOf(x2, paNames, ['value', 'Value', 'ValueText', 'text']) ||
      xmlFirstOf(x1, paNames, ['value', 'Value', 'ValueText', 'text']);
    md = xmlFirstOf(x2, ['MD', 'Md', 'MerchantData']) || xmlFirstOf(x1, ['MD', 'Md', 'MerchantData']);
    bankTermUrl =
      xmlFirstOf(x2, ['TermUrl', 'TermURL']) || xmlFirstOf(x1, ['TermUrl', 'TermURL']) || '';
    errCode =
      xmlFirstOf(x2, ['ErrorCode', 'ResultCode', 'ResponseCode']) ||
      xmlFirstOf(x1, ['ErrorCode', 'ResultCode', 'ResponseCode']) ||
      '';
  }

  acsUrl = stripCdata(acsUrl).replace(/&amp;/g, '&').trim();
  paReq = stripCdata(paReq).replace(/\s+/g, '').trim();
  md = stripCdata(md).trim();
  bankTermUrl = stripCdata(bankTermUrl).replace(/&amp;/g, '&').trim();

  if (!isLikelyHttpUrl(acsUrl) && !looksLikeHtmlResponse) {
    const picked = pickAcsUrlFromRaw(xmlSearch) || pickAcsUrlFromRaw(raw);
    if (picked) acsUrl = picked;
  }

  if (!paReq || paReq.length < 4) {
    if (!looksLikeHtmlResponse) {
      paReq =
        fuzzyExtractPaReq(xmlSearch) ||
        fuzzyExtractPaReq(raw) ||
        extractPaReqLooseFromText(xmlSearch) ||
        extractPaReqLooseFromText(raw) ||
        paReq;
    }
    paReq = String(paReq || '')
      .replace(/\s+/g, '')
      .trim();
  }

  const hasAcs = isLikelyHttpUrl(acsUrl) && paReq.length >= 4;
  const procOk = procReturn === '00' || procReturn === '0000' || procReturn === '0' || procReturn === '000';

  if (status === 'N' || status === 'U') {
    return {
      ok: false,
      status,
      message: message || 'Bu kart için 3D Secure kullanılamıyor veya kart doğrulanamadı (Status ' + status + ').',
      acsUrl,
      paReq,
      md,
      logHint: snippet,
      foundTags,
    };
  }

  const explicitFail = status === 'N' || status === 'U';
  const procBlocks =
    procReturn !== '' && procReturn != null && !procOk;

  // Boş Status’ü tek başına başarı saymak HTML/WAF gövdelerinde yanlış pozitif üretiyordu (gevşek URL/PaReq ile).
  const statusNeutral = status === '' || !status;
  const statusAllowsEnroll =
    status === 'Y' || status === 'A' || (statusNeutral && procOk);

  const ok =
    hasAcs &&
    !explicitFail &&
    !procBlocks &&
    statusAllowsEnroll &&
    !looksLikeHtmlResponse;

  if (!ok) {
    const looksHtml = !hasAcs && isLikelyHtmlInsteadOfMpiXml(foundTags, raw);
    const pageTitle = looksHtml ? extractRoughHtmlTitle(raw) : '';
    const ctShort = String(contentType || '').split(';')[0].trim();
    const parts = [
      message,
      errCode && `Kod: ${errCode}`,
      procReturn && `İşlem kodu: ${procReturn}`,
      status ? `3D durumu: ${status}` : null,
      !hasAcs
        ? looksHtml
          ? /request\s*rejected/i.test(pageTitle)
            ? 'Güvenlik duvarı / WAF “Request Rejected” (HTML) döndü; istek çoğu zaman banka MPI uygulamasına ulaşmıyor. QuotaGuard kullanmıyorsanız: QUOTAGUARDSTATIC_URL + `/.netlify/functions/ip-egress` ile sabit çıkışı doğrulayın. QuotaGuard açıkken de aynıysa: canlı enrollment URL (8443), VAKIF_INIT=prod ve üye işyeri (test/canlı) eşleşmesini bankayla teyit edin; Netlify log’da `MPI_FAIL_JSON` (egressProxyHost / egressProxyActive) + enrollUrl + ip-egress IPv4 ile desteğe yazın. İsteğe bağlı: VAKIF_HTTP_USER_AGENT veya VAKIF_POSTXML_FORCE_RAW=1 ile gövde denemesi (banka kılavuzuna göre).'
            : 'Banka MPI/XML yerine bir HTML sayfası döndü (yanlış URL, test–canlı uyumsuzluğu, IP kısıtı veya sunucu hata sayfası olabilir). Endpoint ve üye işyeri ayarlarını Vakıfbank ile doğrulayın; aşağıdaki etiket listesini desteğe iletin.'
          : 'ACS adresi veya PaReq okunamadı. Yanıttaki etiket isimleri farklı olabilir — aşağıdaki listeyi bankaya iletin.'
        : null,
    ].filter(Boolean);
    const tagBits = [];
    if (foundTags) tagBits.push(`Yanıtta görülen etiketler: ${foundTags.slice(0, 350)}`);
    if (looksHtml && pageTitle) tagBits.push(`Sayfa başlığı: ${pageTitle}`);
    if (looksHtml && ctShort && /\btext\/html\b/i.test(ctShort)) tagBits.push(`Content-Type: ${ctShort}`);
    const tagLine = tagBits.length ? ` ${tagBits.join(' · ')}` : '';
    return {
      ok: false,
      status,
      message: (parts.join(' — ') || '3D kayıt başarısız.') + tagLine,
      acsUrl,
      paReq,
      md,
      logHint: snippet,
      foundTags,
      responseContentType: ctShort || null,
      htmlPageTitle: pageTitle || null,
    };
  }

  return { ok: true, status, message, acsUrl, paReq, md, termUrl: bankTermUrl, logHint: '', foundTags };
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

/** Supabase REST — süre sınırı yoksa PATCH takılınca mpi_enroll_jobs satırı running’de kalıyordu */
const SB_HTTPS_MS = Math.min(
  Math.max(parseInt(process.env.SB_HTTPS_TIMEOUT_MS || '25000', 10) || 25000, 5000),
  120000
);

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
    req.setTimeout(SB_HTTPS_MS, () => {
      req.destroy(new Error(`Supabase REST zaman aşımı (${SB_HTTPS_MS} ms)`));
    });
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
    terminalNo,
    includeTerminalNo,
  } = opts;
  const termXml =
    includeTerminalNo && terminalNo != null && String(terminalNo).trim()
      ? `<TerminalNo>${escXml(String(terminalNo).trim())}</TerminalNo>`
      : '';
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<VerifyEnrollmentRequest>' +
    `<MerchantId>${escXml(merchantId)}</MerchantId>` +
    `<MerchantPassword>${escXml(merchantPassword)}</MerchantPassword>` +
    termXml +
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

/** Banka API aracı örneği: multipart/form-data alanları (VerifyEnrollmentReq / FailUrl). */
function buildEnrollmentFormFields(opts) {
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
    terminalNo,
    includeTerminalNo,
  } = opts;
  const fields = {
    MerchantId: String(merchantId || ''),
    MerchantPassword: String(merchantPassword || ''),
    VerifyEnrollmentReq: String(verifyId || ''),
    Pan: String(pan || ''),
    PurchaseAmount: String(amount || ''),
    ExpiryDate: String(expiryYYMM || ''),
    BrandName: String(brandName || ''),
    Currency: '949',
    SuccessUrl: String(successUrl || ''),
    FailUrl: String(failureUrl || ''),
  };
  if (includeTerminalNo && terminalNo != null && String(terminalNo).trim()) {
    fields.TerminalNo = String(terminalNo).trim();
  }
  return fields;
}

function buildEnrollmentMultipartBody(fields) {
  const boundary = '----FinSkorMpi' + crypto.randomBytes(12).toString('hex');
  const CRLF = '\r\n';
  const order = [
    'MerchantId',
    'MerchantPassword',
    'VerifyEnrollmentReq',
    'Pan',
    'PurchaseAmount',
    'ExpiryDate',
    'BrandName',
    'Currency',
    'SuccessUrl',
    'FailUrl',
    'TerminalNo',
  ];
  let body = '';
  for (const k of order) {
    if (!Object.prototype.hasOwnProperty.call(fields, k)) continue;
    const v = fields[k];
    if (v === undefined || v === null) continue;
    body += `--${boundary}${CRLF}Content-Disposition: form-data; name="${k}"${CRLF}${CRLF}${String(v)}${CRLF}`;
  }
  for (const k of Object.keys(fields)) {
    if (order.includes(k)) continue;
    const v = fields[k];
    if (v === undefined || v === null) continue;
    body += `--${boundary}${CRLF}Content-Disposition: form-data; name="${k}"${CRLF}${CRLF}${String(v)}${CRLF}`;
  }
  body += `--${boundary}--${CRLF}`;
  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function escXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** PARes içinden ilk eşleşen etiket (büyük/küçük harf duyarsız). */
function paresXmlText(xml, tagNames) {
  const s = String(xml || '');
  for (const t of tagNames) {
    const re = new RegExp(`<${t}[^>]*>\\s*([^<]+?)\\s*</${t}>`, 'i');
    const m = s.match(re);
    if (m && String(m[1]).trim()) return String(m[1]).trim();
  }
  return '';
}

/**
 * Oturumdaki son kullanma: genelde YYMM. Banka VPOS’ta YYYYMM istiyorsa VAKIF_VPOS_EXPIRY_YYYYMM=1.
 */
function normalizeVposExpiry(expiryDigits, useYYYYMM) {
  const d = String(expiryDigits || '').replace(/\D/g, '');
  if (!d) return '';
  if (useYYYYMM) {
    if (d.length === 6) return d;
    if (d.length === 4) {
      const yy = parseInt(d.slice(0, 2), 10);
      const yyyy = Number.isFinite(yy) ? (yy >= 70 ? 1900 + yy : 2000 + yy) : 2000;
      return String(yyyy) + d.slice(2);
    }
    return d;
  }
  if (d.length === 4) return d;
  if (d.length === 6) return d.slice(2);
  return d;
}

/**
 * ECI: PARes’te ham değer yoksa / güvenilmiyorsa Status (Y/A) + marka (100 Visa, 200 MC, 300 Amex) ile eşleme.
 * VAKIF_VPOS_ECI_STRATEGY: auto | pares_only | map_only
 */
function resolveVposEci(parsed, brandCode) {
  const strat = (process.env.VAKIF_VPOS_ECI_STRATEGY || 'auto').toLowerCase();
  const raw = String(parsed?.eci || '').trim();
  const st = String(parsed?.transStatus || parsed?.status || '')
    .trim()
    .toUpperCase();
  const b = String(brandCode || '100');

  function mapFromStatus() {
    if (st === 'Y') {
      if (b === '200') return '02';
      return '05';
    }
    if (st === 'A') {
      if (b === '200') return '01';
      return '06';
    }
    return '';
  }

  if (strat === 'pares_only') return raw;

  if (strat === 'map_only') {
    const m = mapFromStatus();
    return m || raw;
  }

  /* auto */
  if (/^\d{1,3}$/.test(raw)) {
    if (raw.length === 1) return '0' + raw;
    return raw;
  }
  if (raw) return raw;
  return mapFromStatus() || raw;
}

/** 3DS sonucu: PARes’te genelde Status veya TransStatus (3DS2). */
function parseThreeDSResultFromPares(parsed) {
  const st = String(parsed?.transStatus || parsed?.status || '')
    .trim()
    .toUpperCase();
  return st;
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
  /* Enrollment tekil id → VPOS: MpiTransactionId (kılavuz). Stil: both | mpi_only | verify_only (varsayılan both) */
  if (verifyEnrollmentRequestId) {
    const mpiId = String(verifyEnrollmentRequestId).trim();
    const style = (process.env.VAKIF_VPOS_MPI_XML_STYLE || 'both').toLowerCase();
    if (style === 'verify_only') {
      extra += `<VerifyEnrollmentRequestId>${escXml(mpiId)}</VerifyEnrollmentRequestId>`;
    } else if (style === 'mpi_only') {
      extra += `<MpiTransactionId>${escXml(mpiId)}</MpiTransactionId>`;
    } else {
      extra += `<MpiTransactionId>${escXml(mpiId)}</MpiTransactionId>`;
      extra += `<VerifyEnrollmentRequestId>${escXml(mpiId)}</VerifyEnrollmentRequestId>`;
    }
  }
  if (xid3ds) extra += `<Xid>${escXml(xid3ds)}</Xid>`;
  /* Eksikse 1121 vb. dönüşüm raporlanabiliyor; kılavuzdaki kodu bankadan doğrulayın. Kapatmak: VAKIF_VPOS_OMIT_TRANSACTION_DEVICE_SOURCE=1 */
  const omitDev = (process.env.VAKIF_VPOS_OMIT_TRANSACTION_DEVICE_SOURCE || '').trim() === '1';
  if (!omitDev) {
    const tds = (process.env.VAKIF_VPOS_TRANSACTION_DEVICE_SOURCE || '0').trim();
    if (tds) extra += `<TransactionDeviceSource>${escXml(tds)}</TransactionDeviceSource>`;
  }
  /* 1127: 3D tamamlandıysa bazı kurulumlarda Pan/tutar gönderilmez; yalnızca ECI+CAVV varken ve env açıkken. */
  const omit1127 = (process.env.VAKIF_VPOS_3DS_OMIT_CARD_FIELDS || '').trim() === '1';
  const has3ds = String(eci || '').trim() && String(cavv || '').trim();
  const omitCardAmount = omit1127 && has3ds;
  const amountBlock = omitCardAmount
    ? ''
    : `<CurrencyAmount>${escXml(amount)}</CurrencyAmount>` +
      `<CurrencyCode>949</CurrencyCode>` +
      `<Pan>${escXml(pan)}</Pan>` +
      `<Expiry>${escXml(expiry)}</Expiry>` +
      `<Cvv>${escXml(cvv)}</Cvv>`;
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<VposRequest>' +
    `<MerchantId>${escXml(merchantId)}</MerchantId>` +
    `<Password>${escXml(password)}</Password>` +
    `<TerminalNo>${escXml(terminalNo)}</TerminalNo>` +
    `<TransactionType>Sale</TransactionType>` +
    `<TransactionId>${escXml(transactionId)}</TransactionId>` +
    amountBlock +
    extra +
    '</VposRequest>'
  );
}

function parsePares(paresB64) {
  try {
    const b64 = String(paresB64 || '').replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
    const xml = Buffer.from(b64, 'base64').toString('utf8');
    const eci = paresXmlText(xml, ['eci', 'ECI', 'Eci']);
    let cavv = paresXmlText(xml, [
      'authenticationvalue',
      'AuthenticationValue',
      'cavv',
      'CAVV',
      'Cavv',
      'authenticationValue',
    ]);
    const xid = paresXmlText(xml, ['xid', 'Xid', 'XID']);
    const status =
      paresXmlText(xml, ['Status', 'status']) || xmlTagFlexible(xml, 'Status') || '';
    const transStatus =
      paresXmlText(xml, ['TransStatus', 'transStatus', 'TransactionStatus', 'transactionStatus']) ||
      xmlTagFlexible(xml, 'TransStatus') ||
      '';
    const signature = paresXmlText(xml, ['Signature', 'signature', 'SignatureValue']);
    return { eci, cavv, xid, status, transStatus, signature: signature || '', xml };
  } catch {
    return { eci: '', cavv: '', xid: '', status: '', transStatus: '', signature: '', xml: '' };
  }
}

function isVposOk(xml) {
  const rc = xmlTag(xml, 'ResultCode') || xmlTag(xml, 'ResponseCode') || xmlTag(xml, 'Rc');
  return rc === '0000' || rc === '00' || rc === '0';
}

/**
 * Vakıfbank: XML gövde `prmstr` alanında, application/x-www-form-urlencoded (URL-encoded).
 * Ham application/xml: yalnızca VAKIF_POSTXML_FORCE_RAW=1 (banka / teşhis).
 */
function vakifHttpUserAgent() {
  const ua = (process.env.VAKIF_HTTP_USER_AGENT || '').trim();
  return ua || 'FinSkor-MPI/1.0';
}

async function postXml(url, xmlBody) {
  const forceRaw = (process.env.VAKIF_POSTXML_FORCE_RAW || '').trim() === '1';
  const ua = vakifHttpUserAgent();
  let body;
  let headers;
  if (!forceRaw) {
    body = new URLSearchParams({ prmstr: String(xmlBody || '') }).toString();
    headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Accept: 'application/xml, text/xml, */*',
      'User-Agent': ua,
    };
  } else {
    body = String(xmlBody || '');
    headers = {
      'Content-Type': 'application/xml; charset=utf-8',
      Accept: 'application/xml, text/xml, */*',
      'User-Agent': ua,
    };
  }
  const res = await vakifFetch(url, {
    method: 'POST',
    headers,
    body,
  });
  const text = await res.text();
  const contentType =
    (typeof res.headers?.get === 'function' && res.headers.get('content-type')) ||
    res.headers?.['content-type'] ||
    '';
  return { status: res.status, text, contentType: String(contentType || '') };
}

/**
 * MPI Enrollment (threeDGateway/Enrollment) — banka örneği: multipart/form-data alanları.
 * VAKIF_MPI_ENROLL_FORMAT: multipart (varsayılan) | urlencoded | prmstr | raw_xml
 */
async function postMpiEnrollment(url, enrollOpts) {
  const fmt = (process.env.VAKIF_MPI_ENROLL_FORMAT || 'multipart').toLowerCase().trim();
  const ua = vakifHttpUserAgent();
  let body;
  let headers;

  if (fmt === 'raw_xml' || fmt === 'xml') {
    body = buildEnrollmentXml(enrollOpts);
    headers = {
      'Content-Type': 'application/xml; charset=utf-8',
      Accept: 'application/xml, text/xml, */*',
      'User-Agent': ua,
    };
  } else if (fmt === 'prmstr') {
    const xml = buildEnrollmentXml(enrollOpts);
    body = new URLSearchParams({ prmstr: String(xml || '') }).toString();
    headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Accept: 'application/xml, text/xml, */*',
      'User-Agent': ua,
    };
  } else if (fmt === 'urlencoded' || fmt === 'form') {
    const fields = buildEnrollmentFormFields(enrollOpts);
    const p = new URLSearchParams();
    const keyOrder = [
      'MerchantId',
      'MerchantPassword',
      'VerifyEnrollmentReq',
      'Pan',
      'PurchaseAmount',
      'ExpiryDate',
      'BrandName',
      'Currency',
      'SuccessUrl',
      'FailUrl',
      'TerminalNo',
    ];
    for (const k of keyOrder) {
      if (!Object.prototype.hasOwnProperty.call(fields, k)) continue;
      p.append(k, String(fields[k]));
    }
    for (const k of Object.keys(fields)) {
      if (keyOrder.includes(k)) continue;
      p.append(k, String(fields[k]));
    }
    body = p.toString();
    headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Accept: 'application/xml, text/xml, */*',
      'User-Agent': ua,
    };
  } else {
    const fields = buildEnrollmentFormFields(enrollOpts);
    const m = buildEnrollmentMultipartBody(fields);
    body = m.body;
    headers = {
      'Content-Type': m.contentType,
      Accept: 'application/xml, text/xml, */*',
      'User-Agent': ua,
    };
  }

  const res = await vakifFetch(url, {
    method: 'POST',
    headers,
    body,
  });
  const text = await res.text();
  const contentType =
    (typeof res.headers?.get === 'function' && res.headers.get('content-type')) ||
    res.headers?.['content-type'] ||
    '';
  return { status: res.status, text, contentType: String(contentType || '') };
}

module.exports = {
  PAKET,
  MPI_ENROLL_URL,
  resolveMpiEnrollUrl,
  MPI_START_THREED_FLOW_URL,
  resolveMpiStartThreeDFlowUrl,
  VPOS_URL,
  resolveVposUrl,
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
  buildEnrollmentFormFields,
  buildVposSaleXml,
  parsePares,
  normalizeVposExpiry,
  resolveVposEci,
  parseThreeDSResultFromPares,
  buildMpiSessionCookie,
  decodeUrlEncodedFormField,
  isVposOk,
  postXml,
  postMpiEnrollment,
};
