/**
 * Karimex mizan diagnostik — aktif/pasif dengesi ve 590/591
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const XLSX_PATH =
  process.argv[2] ||
  'c:\\Users\\murat\\OneDrive\\Masaüstü\\Akmehmet FPR\\Karimex_31.12.2025_Mizan_NORMAL.xlsx';

function loadCore() {
  const prep = readFileSync(join(root, 'js/finskor-mali-import-prep.js'), 'utf8');
  const core = readFileSync(join(root, 'js/finskor-mali-import-core.js'), 'utf8');
  const ctx = {
    console,
    importState: { year: 2025, silentYear: null, parsed: null, _formatLabel: 'test' },
    importLog: () => {},
    document: { getElementById: () => null },
    window: {},
  };
  vm.createContext(ctx);
  vm.runInContext(prep + '\n' + core, ctx);
  return ctx;
}

const buf = readFileSync(XLSX_PATH);
const wb = XLSX.read(buf, { type: 'buffer', raw: true });
const sheetName = wb.SheetNames[0];
const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null, raw: true });

console.log('Dosya:', XLSX_PATH);
console.log('Sayfa:', sheetName, 'satır:', rows.length);
console.log('Başlık (satır 1):', JSON.stringify((rows[0] || []).slice(0, 8)));

const ctx = loadCore();

// Ham mizan toplamları (tüm satırlar borç bak - alacak bak, 100-299 / 300-599)
let sumAktifBb = 0;
let sumAktifAb = 0;
let sumPasifBb = 0;
let sumPasifAb = 0;
const kodOrnek = new Map();
const kod590 = [];
const kod591 = [];

for (let r = 1; r < rows.length; r++) {
  const row = rows[r] || [];
  const raw = row[0];
  const parsed = ctx.parseMizanHesapKodu(raw);
  if (!parsed) continue;
  const kod = parsed.kod;
  const bb = ctx.parseImportNumber(row[4]) ?? 0;
  const ab = ctx.parseImportNumber(row[5]) ?? 0;
  if (bb === 0 && ab === 0) continue;

  if (kod >= 100 && kod <= 299) {
    sumAktifBb += bb;
    sumAktifAb += ab;
  } else if (kod >= 300 && kod <= 599) {
    sumPasifBb += bb;
    sumPasifAb += ab;
  }

  if (kod === 590 || kod === 591) {
    const katkiEski = kod >= 300 ? ab - bb : bb - ab;
    const katkiYeni = ctx.mizanKatkiFromBakiye(kod, bb, ab, 0, 0);
    kod590.push({ r: r + 1, raw, isAna: parsed.isAna, bb, ab, ad: row[1], katkiEski, katkiYeni });
  }
  if (!kodOrnek.has(kod) && (bb > 1e6 || ab > 1e6)) {
    kodOrnek.set(kod, { r: r + 1, raw, bb, ab, ad: String(row[1] || '').slice(0, 40) });
  }
}

console.log('\n--- Ham bakiye toplamları (tüm alt hesaplar, çift sayım riski) ---');
console.log('Aktif 100-299: borç bak', sumAktifBb.toLocaleString('tr-TR'), 'alacak bak', sumAktifAb.toLocaleString('tr-TR'));
console.log('Pasif 300-599: borç bak', sumPasifBb.toLocaleString('tr-TR'), 'alacak bak', sumPasifAb.toLocaleString('tr-TR'));
console.log('Naif aktif net (bb-ab):', (sumAktifBb - sumAktifAb).toLocaleString('tr-TR'));
console.log('Naif pasif net (ab-bb):', (sumPasifAb - sumPasifBb).toLocaleString('tr-TR'));
console.log('Naif fark:', (sumAktifBb - sumAktifAb - (sumPasifAb - sumPasifBb)).toLocaleString('tr-TR'));

const result = ctx.mizanRowlariIsle(rows);
ctx.hesapToplamlarOnObject(result, 2025);

const a = result.aktifToplam || 0;
const p = result.pasifToplam || 0;
const fark = a - p;

console.log('\n--- FinSkor mizanRowlariIsle + hesapToplamlar ---');
console.log('aktifToplam:', a.toLocaleString('tr-TR'));
console.log('pasifToplam:', p.toLocaleString('tr-TR'));
console.log('fark (A-P):', fark.toLocaleString('tr-TR'));
console.log('donemNetKar:', (result.donemNetKar || 0).toLocaleString('tr-TR'));
console.log('donemNetKarGelir:', (result.donemNetKarGelir || 0).toLocaleString('tr-TR'));
console.log('gecmisKar:', (result.gecmisKar || 0).toLocaleString('tr-TR'));
console.log('gecmisZarar:', (result.gecmisZarar || 0).toLocaleString('tr-TR'));
console.log('ozKaynak:', (result.ozKaynak || 0).toLocaleString('tr-TR'));
console.log('Kalem sayısı:', Object.keys(result).filter((k) => !k.startsWith('_') && result[k]).length);

console.log('\n--- 590/591 satırları ---');
for (const x of kod590) console.log(JSON.stringify(x));

console.log('\n--- İlk 15 büyük hesap örneği (sütun A) ---');
[...kodOrnek.entries()]
  .slice(0, 15)
  .forEach(([k, v]) => console.log(k, v));

// Kod format örnekleri satır 2-30
console.log('\n--- A sütunu format örnekleri (satır 2-25) ---');
for (let r = 1; r < Math.min(25, rows.length); r++) {
  const row = rows[r] || [];
  if (!row[0]) continue;
  const p = ctx.parseMizanHesapKodu(row[0]);
  console.log('r' + (r + 1), 'raw=', row[0], typeof row[0], 'parsed=', p);
}
