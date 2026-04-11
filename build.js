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

  const linkedInPid = String(process.env.LINKEDIN_PARTNER_ID || '').trim();
  const liPlaceholder = /<!--\s*LINKEDIN_INSIGHT_TAG[^>]*-->/;
  if (linkedInPid && /^\d{5,12}$/.test(linkedInPid)) {
    const liTag =
      '<script type="text/javascript">_linkedin_partner_id="' + linkedInPid + '";window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push(_linkedin_partner_id);</script>'
      + '<script type="text/javascript">(function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}'
      + 'var s=document.getElementsByTagName("script")[0];var b=document.createElement("script");b.type="text/javascript";b.async=true;'
      + 'b.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";s.parentNode.insertBefore(b,s);})(window.lintrk);</script>'
      + '<noscript><img height="1" width="1" style="display:none;" alt="" src="https://px.ads.linkedin.com/collect/?pid=' + linkedInPid + '&fmt=gif" /></noscript>';
    result = result.replace(liPlaceholder, liTag);
  } else {
    result = result.replace(
      liPlaceholder,
      '<!-- LinkedIn Insight Tag: Netlify ortam degiskeni LINKEDIN_PARTNER_ID (rakam) tanimlayin; yeniden deploy -->'
    );
  }

  fs.writeFileSync(OUT, result, 'utf8');

  writeFaviconIco(path.join(DIST, 'favicon.ico'));

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

/** 16×16 ICO (navy + basit altın F) — tarayıcı GET /favicon.ico için gerçek dosya */
function writeFaviconIco(outPath) {
  const w = 16;
  const h = 16;
  const navy = Buffer.from([0x21, 0x12, 0x07, 0xff]);
  const gold = Buffer.from([0x4c, 0xa8, 0xc9, 0xff]);
  const xor = Buffer.alloc(w * h * 4, 0);
  for (let i = 0; i < w * h; i++) navy.copy(xor, i * 4);

  function setPixel(vx, vy, c) {
    if (vx < 0 || vx >= w || vy < 0 || vy >= h) return;
    const row = h - 1 - vy;
    c.copy(xor, row * w * 4 + vx * 4);
  }

  for (let vy = 1; vy <= 14; vy++) {
    setPixel(2, vy, gold);
    setPixel(3, vy, gold);
  }
  for (let vx = 2; vx <= 10; vx++) {
    setPixel(vx, 1, gold);
    setPixel(vx, 2, gold);
  }
  for (let vx = 2; vx <= 7; vx++) {
    setPixel(vx, 7, gold);
    setPixel(vx, 8, gold);
  }

  const bih = Buffer.alloc(40);
  bih.writeUInt32LE(40, 0);
  bih.writeInt32LE(w, 4);
  bih.writeInt32LE(h * 2, 8);
  bih.writeUInt16LE(1, 12);
  bih.writeUInt16LE(32, 14);
  bih.writeUInt32LE(0, 16);
  bih.writeUInt32LE(w * h * 4, 20);

  const andMask = Buffer.alloc(64, 0);
  const img = Buffer.concat([bih, xor, andMask]);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(w === 256 ? 0 : w, 0);
  entry.writeUInt8(h === 256 ? 0 : h, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(img.length, 8);
  entry.writeUInt32LE(6 + 16, 12);

  const header = Buffer.from([0, 0, 1, 0, 1, 0]);
  fs.writeFileSync(outPath, Buffer.concat([header, entry, img]));
}
