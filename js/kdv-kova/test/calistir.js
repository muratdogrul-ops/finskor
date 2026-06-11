/* calistir.js — tüm testleri tek komutla çalıştırır: node test/calistir.js */
const { execSync } = require("child_process");
const fs = require("fs"), path = require("path");
const dir = __dirname;
const files = fs.readdirSync(dir).filter((f) => f.endsWith("-testi.js")).sort();
let toplamGecti = 0, toplamKaldi = 0, hata = false;
for (const f of files) {
  console.log(`\n=== ${f} ===`);
  try {
    const out = execSync(`node ${path.join(dir, f)}`, { encoding: "utf8" });
    process.stdout.write(out);
    const m = out.match(/(\d+) geçti, (\d+) kaldı/);
    if (m) { toplamGecti += +m[1]; toplamKaldi += +m[2]; }
  } catch (e) {
    hata = true;
    process.stdout.write(e.stdout || "");
    const m = (e.stdout || "").match(/(\d+) geçti, (\d+) kaldı/);
    if (m) { toplamGecti += +m[1]; toplamKaldi += +m[2]; }
  }
}
console.log(`\n========================================`);
console.log(`TOPLAM: ${toplamGecti} geçti, ${toplamKaldi} kaldı  (${files.length} test dosyası)`);
process.exit(hata || toplamKaldi > 0 ? 1 : 0);
