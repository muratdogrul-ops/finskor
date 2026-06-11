/* ui-projeksiyon-testi.js — 4 kova UI eşleme + aylık projeksiyon + pay.tipik.
 * node test/ui-projeksiyon-testi.js */
const fs = require("fs"), path = require("path");
const H = require("../kova-hesaplayici.js");
const UI = require("../kova-ui-esleme.js");
const AP = require("../aylik-kova-projeksiyon.js");
const kok = path.join(__dirname, "..");
const sektor = (id) => JSON.parse(fs.readFileSync(path.join(kok, "sektorler", id + ".json"), "utf8"));
let g = 0, k = 0;
const esit = (ad, b, e) => { const o = JSON.stringify(b) === JSON.stringify(e);
  console.log(`${o ? "✓" : "✗"} ${ad}` + (o ? "" : `\n    beklenen ${JSON.stringify(e)} | bulunan ${JSON.stringify(b)}`));
  o ? g++ : k++; };
const ok = (ad, c) => { console.log(`${c ? "✓" : "✗"} ${ad}`); c ? g++ : k++; };

// === pay.tipik tüketimi: obje pay doğru okunur (sayı sanılmaz) ===
const gu = sektor("gida-uretim");
const ham = gu.alisKalemleri.find((x) => x.girdiKodu === "TICARI_MAL_GIDA_1");
esit("Hammadde pay objesi {min,max,tipik}", typeof ham.pay === "object", true);
esit("Hammadde kdvOrani = 1 (gıda %1, %20 DEĞİL)", ham.kdvOrani, 1);

// === 4 kova UI eşleme ===
const u = UI.esle(gu);
esit("UI raw.oran = 1 (hammadde %1)", u.raw.oran, 1);
esit("UI pack.oran = 20 (ambalaj)", u.pack.oran, 20);
esit("UI energy.oran = 20 (enerji)", u.energy.oran, 20);
ok("UI raw.oran ≠ 20 (tek satır %20 hatası değil)", u.raw.oran !== 20);
ok("UI uyarı metni var", /UI özet/i.test(u.uyari));
// yanlış tek satır göstergesi
const y = UI.yanlisTekSatir(gu);
ok("Yanlış tek-satır ağırlıklı oran 1<oran<20 (hammadde gizlenir)", y.tekSatirOran > 1 && y.tekSatirOran < 20);

// genel ticaret: raw %20 (gerçekten genel oran)
esit("Genel ticaret raw.oran = 20", UI.esle(sektor("genel-ticaret-standart")).raw.oran, 20);

// === Aylık projeksiyon: GENEL 12 ay toplam ≈ yıllık ===
const yillik = H.hesapla(sektor("genel-ticaret-standart"),
  { brutSatis: 12000000, smm: 8400000, faaliyetGideri: 1200000 }, {});
const ap = AP.aylikKovaProjeksiyon(sektor("genel-ticaret-standart"),
  { brutSatis: 12000000, smm: 8400000, faaliyetGideri: 1200000 }, { yil: 2026 });
esit("Aylık 12 dönem", ap.aylik.length, 12);
esit("Aylık toplam ödenecek ≈ yıllık", ap.toplam.odenecek360, yillik.kovalar.odenecek360);
esit("toMotorGirdi uyumlu donemTutarlari.KDV1 12 ay", Object.keys(ap.donemTutarlari.KDV1).length, 12);

// === Aylık ihracat: nakden iade gecikmeli + devreden taşır ===
const ai = AP.aylikKovaProjeksiyon(sektor("ihracat-agirlikli"),
  { brutSatis: 12000000, smm: 8000000, faaliyetGideri: 1500000, ihracat: 9000000 },
  { yil: 2026, firma: { tamTasdik: true } });
ok("İhracat aylık: nakden iade kalemleri üretildi", ai.iadeler.length > 0);
ok("İhracat aylık: iade tahsilDonem gecikmeli", ai.iadeler[0].tahsilDonem !== ai.iadeler[0].donem);

// === Altın senaryo 8M: gida-uretim tam kova seti ===
const altin = H.hesapla(sektor("gida-uretim"), { brutSatis: 8000000, smm: 5600000, faaliyetGideri: 800000 }, {});
esit("Altın 8M: hesaplanan391", altin.kovalar.hesaplanan391, 188000);
esit("Altın 8M: indirilecek191", altin.kovalar.indirilecek191, 588320);
esit("Altın 8M: devredenSonraki", altin.kovalar.devredenSonraki, 400320);
esit("Altın 8M: yumurta hammadde yem %0", sektor("gida-uretim-yumurta").alisKalemleri.find(x => x.girdiKodu === "YEM_13I").kdvOrani, 0);

// === Yumurta: civciv hammadde kovasında (yem %0 + civciv %1 ağırlıklı) ===
const uy = UI.esle(sektor("gida-uretim-yumurta"));
esit("Yumurta raw.pay ≈ 0.68 (yem+civciv)", Math.round(uy.raw.pay * 1000), 680);
esit("Yumurta raw.oran ≈ 0.15 (ağırlıklı %1 civciv)", Math.round(uy.raw.oran * 100), 15);
esit("Yumurta other.pay ≈ 0.08 (işleme/işçilik)", Math.round(uy.other.pay * 1000), 80);
esit("Yumurta other.oran = 20", uy.other.oran, 20);

// === Aylık 29/2: gida-uretim devreden alt sınıra yakın kalır ===
const ag = AP.aylikKovaProjeksiyon(sektor("gida-uretim"),
  { brutSatis: 12000000, smm: 8400000, faaliyetGideri: 1200000 }, { yil: 2026 });
ok("29/2 aylık: ödenecek 0 (devreden pozisyonu)", ag.toplam.odenecek360 === 0);
ok("29/2 aylık: 12 ay üretildi", ag.aylik.length === 12);
ok("29/2 aylık: yıl sonu devreden ≈ alt sınır 164000", Math.abs(ag.aylik[11].devreden190 - 164000) < 1);
const mahsuben292 = ag.aylik.reduce((a, m) => a + (m.iade && m.iade.mahsuben || 0), 0);
ok("29/2 aylık: mahsuben iade kalemleri üretildi", mahsuben292 > 0);
ok("29/2 aylık: mahsuben satırlarında nakden=0", ag.aylik.every(m => !m.iade || m.iade.nakden === 0));

// === Sezon ağırlığı: ağırlıklar toplam değişmez ===
const sezon = AP.aylikKovaProjeksiyon(sektor("genel-ticaret-standart"),
  { brutSatis: 12000000, smm: 8400000, faaliyetGideri: 1200000 },
  { yil: 2026, aylikAgirliklar: [2,1,1,1,1,1,1,1,1,1,1,2] });
ok("Sezon ağırlıklı toplam ≈ düz toplam (±1 TL yuvarlama)", Math.abs(sezon.toplam.odenecek360 - ap.toplam.odenecek360) < 1);

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k === 0 ? 0 : 1);
