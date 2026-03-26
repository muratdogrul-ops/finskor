// FinSkor Build Script — app.html JS minify/obfuscate
// Orijinal app.html dokunulmaz; dist/app.html olarak çıktı verir
// Netlify bu dist/ klasöründen yayınlar

const fs   = require('fs');
const path = require('path');
const { minify } = require('terser');

const SRC  = path.join(__dirname, 'app.html');
const DIST = path.join(__dirname, 'dist');
const OUT  = path.join(DIST, 'app.html');

(async () => {
  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST);

  // Tüm proje dosyalarını dist'e kopyala (app.html hariç)
  const skipFiles = new Set(['app.html', 'build.js', 'node_modules', 'dist', '.git']);
  for (const item of fs.readdirSync(__dirname)) {
    if (skipFiles.has(item)) continue;
    const src = path.join(__dirname, item);
    const dst = path.join(DIST, item);
    copyRecursive(src, dst);
  }

  // app.html'i oku ve script bloklarını minify et
  let html = fs.readFileSync(SRC, 'utf8');

  // <script> ... </script> bloklarını bul ve minify et
  const scriptRegex = /(<script(?:\s[^>]*)?>)([\s\S]*?)(<\/script>)/gi;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    const [full, openTag, code, closeTag] = match;
    // Dış kaynak script'leri atla (src= içerenler)
    if (/src\s*=/i.test(openTag)) {
      parts.push({ start: match.index, end: match.index + full.length, replacement: full });
      continue;
    }
    // Boş veya çok kısa script'leri atla
    if (code.trim().length < 20) {
      parts.push({ start: match.index, end: match.index + full.length, replacement: full });
      continue;
    }

    try {
      const result = await minify(code, {
        compress: {
          dead_code: true,
          drop_console: false,
          passes: 2,
        },
        mangle: {
          toplevel: false, // global fonksiyonları rename etme — güvenli
        },
        format: {
          comments: false,
        },
      });
      const minified = result.code || code;
      parts.push({ start: match.index, end: match.index + full.length, replacement: openTag + minified + closeTag });
    } catch (e) {
      // Minify hata verirse orijinali koru
      console.warn('Minify hatası (orijinal korundu):', e.message.slice(0, 80));
      parts.push({ start: match.index, end: match.index + full.length, replacement: full });
    }
  }

  // HTML'i yeniden oluştur
  let result = '';
  let cursor = 0;
  for (const p of parts) {
    result += html.slice(cursor, p.start);
    result += p.replacement;
    cursor = p.end;
  }
  result += html.slice(cursor);

  fs.writeFileSync(OUT, result, 'utf8');

  const origSize = (fs.statSync(SRC).size / 1024).toFixed(1);
  const newSize  = (fs.statSync(OUT).size / 1024).toFixed(1);
  console.log(`Build tamamlandi: ${origSize}KB → ${newSize}KB`);
  console.log(`Cikti: dist/app.html`);
})();

function copyRecursive(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dst, child));
    }
  } else {
    fs.copyFileSync(src, dst);
  }
}
