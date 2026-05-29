/** Beyanname gelir tablosu — örnek satır parse testi */
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
    importState: { year: 2024, silentYear: null, parsed: null, _formatLabel: 'test' },
    importLog: () => {},
    document: { getElementById: () => null },
    window: {},
  };
  vm.createContext(ctx);
  vm.runInContext(prep + '\n' + core, ctx);
  return ctx;
}

const sample = `
GELİR TABLOSU
A. Brüt Satışlar 10.000.000,00 12.000.000,00
I. Olağandışı Gelir ve Karlar 0,00 811.634,26
. 2. Diğer Olağandışı Gelir ve Karlar 0,00 811.634,26
Dönem Karı veya Zararı 2.629.362,71 769.955,89
K. Dönem Karı, Vergi ve Diğer Yasal Yükümlülük Karşılıkları (-) 704.151,44 568.336,61
`;

const ctx = loadCore();
const result = ctx.mizanTextIsle(sample, []);
ctx.hesapToplamlarOnObject(result, 2024);

const checks = [
  ['olagandisiGelir', 811634.26],
  ['donemKar', 769955.89],
  ['vergiKarsilik', 568336.61],
  ['donemNetKar', 201619.28],
];

let ok = true;
for (const [k, exp] of checks) {
  const got = result[k];
  const pass = Math.abs((got || 0) - exp) < 0.02;
  console.log(`${pass ? 'OK' : 'FAIL'} ${k}: got ${got} expected ${exp}`);
  if (!pass) ok = false;
}
process.exit(ok ? 0 : 1);
