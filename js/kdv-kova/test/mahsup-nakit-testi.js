/* mahsup-nakit-testi.js — 29/2 mahsuben → SGK/stopaj nakit düşümü (bridge mantığı).
 * node test/mahsup-nakit-testi.js */
const fs = require("fs"), path = require("path");
const AP = require("../aylik-kova-projeksiyon.js");
const kok = path.join(__dirname, "..");
const sektor = (id) => JSON.parse(fs.readFileSync(path.join(kok, "sektorler", id + ".json"), "utf8"));
let g = 0, k = 0;
const esit = (ad, b, e) => {
  const o = JSON.stringify(b) === JSON.stringify(e);
  console.log(`${o ? "✓" : "✗"} ${ad}` + (o ? "" : `\n    beklenen ${JSON.stringify(e)} | bulunan ${JSON.stringify(b)}`));
  o ? g++ : k++;
};
const ok = (ad, c) => { console.log(`${c ? "✓" : "✗"} ${ad}`); c ? g++ : k++; };

function splitIadeMahsup(mahsupEdilen, sgkGross, stopajGross) {
  let kalan = Math.max(0, mahsupEdilen);
  const sgkMahsup = Math.min(kalan, Math.max(0, sgkGross));
  kalan = Math.max(0, kalan - sgkMahsup);
  const stopajMahsup = Math.min(kalan, Math.max(0, stopajGross));
  return {
    sgkMahsup: Math.round(sgkMahsup),
    stopajMahsup: Math.round(stopajMahsup),
    nakit: Math.max(0, Math.round(sgkGross - sgkMahsup + stopajGross - stopajMahsup)),
  };
}

function applyMahsupToMonths(aylikProj, grossPerMonth) {
  const cash = [];
  let toplamMahsup = 0;
  for (let i = 0; i < aylikProj.aylik.length; i++) {
    const m = aylikProj.aylik[i];
    const gross = grossPerMonth[i] || 0;
    const mahsuben = m.iade && m.iade.mahsuben ? m.iade.mahsuben : 0;
    const sp = splitIadeMahsup(mahsuben, gross * 0.35, gross * 0.65);
    toplamMahsup += sp.sgkMahsup + sp.stopajMahsup;
    cash.push(sp.nakit);
  }
  return { cash, toplamMahsup };
}

// === Mahsup sırası: SGK önce ===
esit("Mahsup tam: 50k mahsup, SGK 30k+stopaj 20k → nakit 0", splitIadeMahsup(50000, 30000, 20000).nakit, 0);
esit("Mahsup kısmi: 20k → stopaj 20k kalır", splitIadeMahsup(20000, 30000, 40000).nakit, 50000);
esit("Mahsup SGK önce: 35k mahsup, SGK 30k", splitIadeMahsup(35000, 30000, 40000).sgkMahsup, 30000);
esit("Mahsup SGK önce: kalan 5k stopaj", splitIadeMahsup(35000, 30000, 40000).stopajMahsup, 5000);

// === 29/2 gıda üretim: yıl içi mahsuben üretilir ===
const ag = AP.aylikKovaProjeksiyon(sektor("gida-uretim"),
  { brutSatis: 12000000, smm: 8400000, faaliyetGideri: 1200000 }, { yil: 2026 });
const mahsubenToplam = ag.aylik.reduce((a, m) => a + (m.iade && m.iade.mahsuben || 0), 0);
ok("29/2: yıllık mahsuben toplam > 0", mahsubenToplam > 0);
ok("29/2: nakden iade yok (yıl içi)", ag.iadeler.length === 0);

// === Brüt SGK/stopaj + mahsuben → nakit düşer ===
const grossAy = 120000 / 12;
const grossArr = ag.aylik.map(() => grossAy);
const sim = applyMahsupToMonths(ag, grossArr);
const brutToplam = grossArr.reduce((a, b) => a + b, 0);
const nakitToplam = sim.cash.reduce((a, b) => a + b, 0);
ok("Mahsuben nakit düşümü: toplam mahsup > 0", sim.toplamMahsup > 0);
ok("Mahsuben nakit düşümü: nakit < brüt", nakitToplam < brutToplam);
ok("Mahsuben nakit düşümü: fark ≈ mahsup", Math.abs(brutToplam - nakitToplam - sim.toplamMahsup) < 2);

// === İhracat: mahsubaAday ile mahsup ===
const ihr = AP.aylikKovaProjeksiyon(sektor("findik-kuruyemis-ihracat"),
  { brutSatis: 6000000, smm: 4200000, faaliyetGideri: 600000, ihracat: 4500000 },
  { yil: 2026, firma: { tamTasdik: true },
    mahsubaAdayBorclarAylik: { "2026-01": 80000, "2026-02": 80000 } });
const ihrMahsup = ihr.aylik.reduce((a, m) => a + (m.iade && m.iade.mahsuben || 0), 0);
ok("İhracat aylık: mahsuben > 0 (aday borç var)", ihrMahsup > 0);

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k === 0 ? 0 : 1);
