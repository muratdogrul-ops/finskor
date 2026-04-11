#!/usr/bin/env node
/**
 * Baykuş niyet eşleşmeleri — CI / yerel doğrulama.
 * - Yardım evet/hayır: app.html içindeki fonksiyon gövdesi VM ile yüklenir (kopya sapması olmaz).
 * - Finansal analiz akışı: app.html ~10275–10296 ile aynı mantık (güncellerken iki yeri senkron tutun).
 */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.join(__dirname, '..', 'app.html');
const html = fs.readFileSync(appPath, 'utf8');

const i0 = html.indexOf('function _avYardimMesajiHayirMi');
const i1 = html.indexOf('function _avYardimCevap', i0);
if (i0 < 0 || i1 < 0) {
  console.error('app.html içinde _avYardimMesajiHayirMi / _avYardimCevap bulunamadı');
  process.exit(1);
}
const yardimSrc = html.slice(i0, i1);
const yardimCtx = vm.createContext({});
vm.runInContext(yardimSrc, yardimCtx);
const { _avYardimMesajiHayirMi, _avYardimMesajiEvetMi } = yardimCtx;

function normYardim(t) {
  return String(t).toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();
}

/** sendAvatarMsg ile aynı normalizasyon */
function routeYardim(q) {
  const n = normYardim(q);
  if (_avYardimMesajiHayirMi(n)) return 'hayir';
  if (_avYardimMesajiEvetMi(n)) return 'evet';
  return 'neither';
}

const yardimCases = [
  ['evet', 'evet'],
  ['evet yapalım', 'evet'],
  ['EVET YAPALIM', 'evet'],
  ['hayır yapmayalım', 'hayir'],
  ['hayır', 'hayir'],
  ['tamam', 'evet'],
  ['olur', 'evet'],
  ['peki', 'evet'],
  ['no thanks', 'hayir'],
  ["let's not", 'hayir'],
  ['cari oran nedir', 'neither'],
  ['evet cari oran nedir', 'neither'],
];

for (const [q, want] of yardimCases) {
  const got = routeYardim(q);
  if (got !== want) {
    console.error(`YARDIM FAIL: "${q}" → ${got}, beklenen ${want}`);
    process.exit(1);
  }
}

/** _avMatchTextCore içi finansal analiz + yardım düğmesi dalı — app.html ile senkron */
function finansalAnalizFlowHit(s) {
  const _avFinKök = s.includes('finansal') || s.includes('finans');
  const _avYapBirlikteSözü =
    s.includes('yapalım') ||
    s.includes('yapalim') ||
    s.includes('yapalımız') ||
    s.includes('yapalimiz') ||
    s.includes('yapacağım') ||
    s.includes('yapacagim') ||
    s.includes('yapmak') ||
    s.includes('yapmam') ||
    s.includes('yapabilir') ||
    s.includes('yaparım') ||
    s.includes('yaparim') ||
    s.includes('yapayım') ||
    s.includes('yapayim') ||
    s.includes('yapal');
  if (_avFinKök && s.includes('birlikte') && _avYapBirlikteSözü) return true;
  const _avFinAnalizKonu = s.includes('analiz') && (s.includes('finansal') || s.includes('finans'));
  const _avFinAnalizNasilEarly =
    _avFinAnalizKonu &&
    (s.includes('nasıl') ||
      s.includes('nasil') ||
      s.includes('yapacağım') ||
      s.includes('yapacagim') ||
      s.includes('yaparım') ||
      s.includes('yaparim') ||
      s.includes('yapmam') ||
      s.includes('yapmak') ||
      s.includes('yapılır') ||
      s.includes('yapilir') ||
      s.includes('yapıyorum') ||
      s.includes('yapiyorum') ||
      s.includes('yapalım') ||
      s.includes('yapalim') ||
      s.includes('yapalımız') ||
      s.includes('yapalimiz') ||
      s.includes('yapabilir') ||
      s.includes('yapal') ||
      (_avFinAnalizKonu && s.includes('birlikte')) ||
      (s.includes('tam') && _avFinAnalizKonu && (s.includes('yap') || s.includes('birlikte'))));
  return !!_avFinAnalizNasilEarly;
}

function sCore(q) {
  return String(q == null ? '' : q).toLocaleLowerCase('tr-TR');
}

const finCases = [
  ['tam finansal analizi birlikte yapalım', true],
  ['tamam finansı birlikte yapalım', true],
  ['finansal analizi nasıl yapacağım', true],
  ['finansal analiz nasıl yapılır', true],
  ['kredi notu nedir', false],
];

for (const [q, want] of finCases) {
  const got = finansalAnalizFlowHit(sCore(q));
  if (got !== want) {
    console.error(`FIN FLOW FAIL: "${q}" → ${got}, beklenen ${want}`);
    process.exit(1);
  }
}

console.log(`baykus-intent-selftest: OK (${yardimCases.length} yardım + ${finCases.length} finansal akış)`);
