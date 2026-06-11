/* sektor-denetim-testi.js — 21 sektör denetimi + smoke. node test/sektor-denetim-testi.js */
const fs = require("fs"), path = require("path");
const H = require("../kova-hesaplayici.js");
const kok = path.join(__dirname, "..");
const dir = path.join(kok, "sektorler");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
const pt = (x) => (typeof x.pay === "object" && x.pay ? x.pay.tipik : x.pay);
let g = 0, k = 0;
const ok = (ad, c) => { console.log(`${c ? "✓" : "✗"} ${ad}`); c ? g++ : k++; };

ok(`22 sektör dosyası`, files.length === 22);

for (const f of files) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const id = d.sektorMeta.id;
  // smoke: hesapla çökmez + urunKirilimi dolu
  const r = H.hesapla(d, { brutSatis: 1000000, smm: 700000, faaliyetGideri: 100000 }, {});
  ok(`${id}: hesapla çalışır + urunKirilimi dolu`, r.devrede && r.urunKirilimi.length >= 4);
  // SMM pay toplamı ≈ 1.0
  const smm = d.alisKalemleri.filter((x) => x.matrahKaynagi === "satMaliyet").reduce((s, x) => s + pt(x), 0);
  ok(`${id}: SMM pay toplamı ≈ 1.0 (${smm.toFixed(2)})`, Math.abs(smm - 1) < 0.011);
  // satış payı ≈ 1.0
  const sat = d.satisKalemleri.reduce((s, x) => s + x.varsayilanCiroPayi.tipik, 0);
  ok(`${id}: satış payı ≈ 1.0`, Math.abs(sat - 1) < 0.011);
  // kaynak her satırda dolu
  const kaynakBos = [...d.satisKalemleri, ...d.alisKalemleri].some((x) => !x.kaynak);
  ok(`${id}: tüm satırlarda kaynak dolu`, !kaynakBos);
  // üretim sektöründe AMBALAJ + ENERJI (notlar ile muafiyet)
  if (d.sektorMeta.altDal === "uretim") {
    const kod = d.alisKalemleri.map((x) => x.girdiKodu.toUpperCase());
    const amb = kod.some((x) => /AMBALAJ|CUVAL|BIGBAG/.test(x));
    const enj = kod.some((x) => /ENERJI|AKARYAKIT|ELEKTRIK/.test(x));
    const muaf = (d.sektorMeta.notlar || []).some((n) => /ambalaj.*enerji|enerji.*alış|üretici/i.test(n));
    ok(`${id}: üretim AMBALAJ+ENERJI (veya notlu muafiyet)`, (amb && enj) || muaf);
  }
}

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k === 0 ? 0 : 1);
