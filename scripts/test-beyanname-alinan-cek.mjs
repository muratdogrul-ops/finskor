/** KVB: . A. Hazır Değerler + . 2. Alınan Çekler — çift sayım olmamalı */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

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

const CEK = 94637038;
const HAZIR_GRUP = 246796187.7;
const TICARI = 50000000;

const sample = `
KURUMlar VERGİSİ BEYANNAMESİ
I. DÖNEN VARLIKLAR
. A. Hazır Değerler 200000000,00 ${HAZIR_GRUP.toFixed(2).replace('.', ',')}
. 2. Alınan Çekler 80000000,00 ${CEK.toFixed(2).replace('.', ',')}
. C. Ticari Alacaklar 40000000,00 ${TICARI.toFixed(2).replace('.', ',')}
II. DURAN VARLIKLAR
. A. Ticari Alacaklar 0,00 0,00
III. KISA VADELİ YABANCI KAYNAKLAR
. A. Mali Borçlar 0,00 0,00
. C. Diğer Borçlar 0,00 0,00
IV. UZUN VADELİ YABANCI KAYNAKLAR
. A. Mali Borçlar 0,00 0,00
V. ÖZ KAYNAKLAR
. A. Ödenmiş Sermaye 100000000,00 100000000,00
. D. Geçmiş Yıl Karları 150000000,00 150000000,00
. F. Dönem Net Karı 0,00 4696150,30
`;

const ctx = loadCore();
const result = ctx.mizanTextIsle(sample, []);
ctx.hesapToplamlarOnObject(result, 2025);

const hazir = result.hazirDegerler || 0;
const tic = result.ticAlacaklar || 0;
const fark = (result.aktifToplam || 0) - (result.pasifToplam || 0);

let ok = true;
function check(label, pass, detail) {
  console.log(`${pass ? 'OK' : 'FAIL'} ${label}: ${detail}`);
  if (!pass) ok = false;
}

check(
  'hazirDegerler = grup A toplamı',
  Math.abs(hazir - HAZIR_GRUP) < 1,
  `got ${hazir} expected ${HAZIR_GRUP}`,
);
check(
  'ticAlacaklar alınan çeki içermez',
  Math.abs(tic - TICARI) < 1,
  `got ${tic} expected ${TICARI} (çift sayım +${CEK} olurdu)`,
);
check(
  'çift sayım yok (tic ≠ ticari+çek)',
  Math.abs(tic - (TICARI + CEK)) > 1000,
  `ticAlacaklar ${tic} — hatalı parserda ${TICARI + CEK} olurdu`,
);

process.exit(ok ? 0 : 1);
