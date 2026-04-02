/**
 * Vakıfbank'a giden HTTPS istekleri — isteğe bağlı sabit çıkış proxy (QuotaGuard Static vb.)
 *
 * Netlify Environment variables (birini kullanın):
 *   QUOTAGUARDSTATIC_URL — QuotaGuard panelinde verilen tam URL
 *   VAKIF_HTTPS_PROXY    — aynı format: http://kullanici:sifre@host:port
 *
 * Boş bırakılırsa doğrudan fetch (Netlify'ın değişken çıkış IP'si).
 *
 * Önemli: QUOTAGUARDSTATIC_URL tanımlıysa ProxyAgent oluşturulamazsa artık sessizce
 * doğrudan fetch yapılmaz — banka whitelist'i yanlışlıkla bypass edilmesin diye hata fırlatılır.
 */
const { fetch: undiciFetch, ProxyAgent } = require('undici');

let _resolved = false;
let _dispatcher = null;
let _proxyError = null;
let _loggedReady = false;

function proxyUrlRaw() {
  return (process.env.QUOTAGUARDSTATIC_URL || process.env.VAKIF_HTTPS_PROXY || '').trim();
}

function resolveDispatcher() {
  if (_resolved) return;
  _resolved = true;
  const raw = proxyUrlRaw();
  if (!raw) {
    _dispatcher = null;
    _proxyError = null;
    return;
  }
  try {
    _dispatcher = new ProxyAgent(raw);
    _proxyError = null;
  } catch (e) {
    _dispatcher = null;
    _proxyError = e.message || String(e);
    console.error('[vakif-fetch] ProxyAgent oluşturulamadı:', _proxyError);
  }
}

/**
 * Sabit çıkış proxy durumu (ip-egress / MPI hata mesajları için).
 */
function getVakifEgressStatus() {
  resolveDispatcher();
  const raw = proxyUrlRaw();
  let proxyHost = null;
  if (raw) {
    try {
      proxyHost = new URL(/^https?:\/\//i.test(raw) ? raw : `http://${raw}`).hostname;
    } catch (_) {
      proxyHost = null;
    }
  }
  return {
    proxyUrlConfigured: !!raw,
    proxyHost,
    proxyAgentActive: !!_dispatcher,
    proxyAgentError: _proxyError,
  };
}

/**
 * Sadece Vakıfbank Ortak Ödeme / MPI / VPOS çağrıları için kullanın.
 */
async function vakifFetch(url, options = {}) {
  resolveDispatcher();
  const rawConfigured = !!proxyUrlRaw();

  if (rawConfigured && !_dispatcher) {
    throw new Error(
      'VAKIF_EGRESS_PROXY_REQUIRED: QuotaGuard/proxy URL tanımlı ama kullanılamıyor. ' +
        (_proxyError ? `Sebep: ${_proxyError}. ` : '') +
        'Netlify’da QUOTAGUARDSTATIC_URL değerini kontrol edin (örn. http://kullanici:sifre@host:port).'
    );
  }

  if (_dispatcher) {
    if (!_loggedReady) {
      _loggedReady = true;
      const st = getVakifEgressStatus();
      console.log(
        '[vakif-fetch] Sabit çıkış proxy aktif → host:',
        st.proxyHost || '(bilinmiyor)',
        '— Vakıfbank istekleri bu üzerinden gider.'
      );
    }
    return undiciFetch(url, { ...options, dispatcher: _dispatcher });
  }

  if (!_loggedReady) {
    _loggedReady = true;
    console.warn(
      '[vakif-fetch] Proxy tanımlı değil — doğrudan çıkış (Netlify IP’si sabit değil). ' +
        'Canlıda Vakıfbank HTML/WAF (“Request Rejected”) alıyorsanız QUOTAGUARDSTATIC_URL ekleyin.'
    );
  }
  return fetch(url, options);
}

/** Diğer function’larda catch: proxy yapılandırma hatası JSON/HTML yanıtına dönsün */
function vakifFetchErrorResponse(err) {
  const em = String(err && err.message ? err.message : err);
  if (!em.includes('VAKIF_EGRESS_PROXY_REQUIRED')) return null;
  return {
    code: 'PROXY_MISCONFIGURED',
    message: em.replace(/^VAKIF_EGRESS_PROXY_REQUIRED:\s*/, ''),
  };
}

module.exports = { vakifFetch, getVakifEgressStatus, vakifFetchErrorResponse };
