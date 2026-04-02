/**
 * Vakıfbank'a giden HTTPS istekleri — isteğe bağlı sabit çıkış proxy (QuotaGuard Static vb.)
 *
 * Netlify Environment variables (birini kullanın):
 *   QUOTAGUARDSTATIC_URL — QuotaGuard panelinde verilen tam URL
 *   VAKIF_HTTPS_PROXY    — aynı format: http://kullanici:sifre@host:port
 *
 * Boş bırakılırsa doğrudan fetch (Netlify'ın değişken çıkış IP'si).
 */
const { fetch: undiciFetch, ProxyAgent } = require('undici');

let _dispatcher;

function getDispatcher() {
  if (_dispatcher !== undefined) return _dispatcher;
  const raw = (process.env.QUOTAGUARDSTATIC_URL || process.env.VAKIF_HTTPS_PROXY || '').trim();
  if (!raw) {
    _dispatcher = null;
    return _dispatcher;
  }
  try {
    _dispatcher = new ProxyAgent(raw);
  } catch (e) {
    console.error('vakif-fetch ProxyAgent:', e.message);
    _dispatcher = null;
  }
  return _dispatcher;
}

/**
 * Sadece Vakıfbank Ortak Ödeme API çağrıları için kullanın.
 */
async function vakifFetch(url, options = {}) {
  const d = getDispatcher();
  if (d) {
    return undiciFetch(url, { ...options, dispatcher: d });
  }
  return fetch(url, options);
}

module.exports = { vakifFetch };
