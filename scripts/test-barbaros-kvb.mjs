/** BARBAROS 2025 KVB.pdf — tam metin parse testi */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const text = readFileSync(join(__dirname, '_barbaros_kvb.txt'), 'utf8');

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

const result = ctx.mizanTextIsle(text, []);
ctx.hesapToplamlarOnObject(result, 2025);

const a = result.aktifToplam || 0;
const p = result.pasifToplam || 0;
const fark = a - p;

console.log('hazirDegerler', result.hazirDegerler);
console.log('ticAlacaklar', result.ticAlacaklar);
console.log('kvTicBorclar', result.kvTicBorclar);
console.log('aktifToplam', a);
console.log('pasifToplam', p);
console.log('fark', fark);
console.log('_hazirBeyanGrupCari', result._hazirBeyanGrupCari);

const CEK = 94637038;
let ok = Math.abs(fark) < 1;
if (!ok && Math.abs(fark - CEK) < 1) {
  console.log('FAIL: fark tam alinan cek tutari — cift sayim devam ediyor');
}
process.exit(ok ? 0 : 1);
