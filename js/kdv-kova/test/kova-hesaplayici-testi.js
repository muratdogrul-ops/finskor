/* kova-hesaplayici-testi.js — 3 sektör × beyanname-only + mizan kapısı.
 * Çalıştır: node test/kova-hesaplayici-testi.js  (paket kökünden)    */
const fs = require("fs");
const path = require("path");
const H = require("../kova-hesaplayici.js");

const kok = path.join(__dirname, "..");
const sektor = (id) => JSON.parse(fs.readFileSync(path.join(kok, "sektorler", id + ".json"), "utf8"));
const ornek = (f) => JSON.parse(fs.readFileSync(path.join(kok, "ornekler", f), "utf8"));

let g = 0, k = 0;
const esit = (ad, b, e) => {
  const ok = JSON.stringify(b) === JSON.stringify(e);
  console.log(`${ok ? "✓" : "✗"} ${ad}` + (ok ? "" : `\n    beklenen ${JSON.stringify(e)} | bulunan ${JSON.stringify(b)}`));
  ok ? g++ : k++;
};

// 3 sektör × beyanname-only örnek (beklenen değerler örnek dosyalarında)
for (const dosya of ["beyanname-only-genel-ticaret.json",
                     "beyanname-only-gida-perakende.json",
                     "beyanname-only-findik-ihracat.json"]) {
  const o = ornek(dosya);
  const s = H.hesapla(sektor(o.sektorId), o.beyanname, {});
  esit(`${o.sektorId}: ödenecek360 = ${o.beklenen.odenecek360}`, s.kovalar.odenecek360, o.beklenen.odenecek360);
  esit(`${o.sektorId}: iadePotansiyeli = ${o.beklenen.iadePotansiyeli}`, s.kovalar.iadePotansiyeli, o.beklenen.iadePotansiyeli);
  esit(`${o.sektorId}: ürün kırılımı dolu`, s.urunKirilimi.length > 0, true);
  esit(`${o.sektorId}: guvenSkoru etiketli`, s.guvenSkoru, "beyanname_only_urun_model");
}

// Mizan kapısı: devreye girmemeli
const mz = H.hesapla(sektor("genel-ticaret-standart"), { brutSatis: 1000000, smm: 700000, faaliyetGideri: 100000 }, { mizanVar: true });
esit("Mizan varsa devrede=false", mz.devrede, false);
esit("Mizan varsa kovalar=null", mz.kovalar, null);

// Aylık dağılım toplamı yıllığa eşit (genel ticaret odenecek 50.000 / 12 ay)
const sg = H.hesapla(sektor("genel-ticaret-standart"), { brutSatis: 1000000, smm: 700000, faaliyetGideri: 100000 }, { donemSayisi: 12 });
const aylikToplam = Math.round(sg.aylikDagilim.reduce((a, m) => a + m.kovalar.odenecek360, 0));
esit("Aylık dağılım toplamı ≈ yıllık ödenecek (42800)", aylikToplam, 42800);
esit("Aylık dağılım 12 dönem", sg.aylikDagilim.length, 12);

// Motor girdisine dönüşüm
const motor = H.toMotorGirdi(sg);
esit("toMotorGirdi KDV1 dönem üretir", Object.keys(motor.donemTutarlari.KDV1).length, 12);

// İhracat örneğinde iade motor girdisine taşınır
const sf = H.hesapla(sektor("findik-kuruyemis-ihracat"), ornek("beyanname-only-findik-ihracat.json").beyanname, {});
const motorF = H.toMotorGirdi(sf);
esit("Fındık: iade kalemleri motor girdisinde var", motorF.iadeler.length > 0, true);
esit("Fındık: iade türü 11/1-a", motorF.iadeler[0].tur, "IHRACAT_11_1_A");

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k === 0 ? 0 : 1);
