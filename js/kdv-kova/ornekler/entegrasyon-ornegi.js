/* Uçtan uca: hesaplayıcı -> toMotorGirdi -> muhasebe-motoru. node ornekler/entegrasyon-ornegi.js */
const fs = require("fs"), path = require("path");
const H = require("../kova-hesaplayici.js");
const M = require("../muhasebe-motoru.js");
const sektor = JSON.parse(fs.readFileSync(path.join(__dirname,"..","sektorler","ihracat-agirlikli.json"),"utf8"));

const sonuc = H.hesapla(sektor, { brutSatis:12000000, smm:8000000, faaliyetGideri:1500000 },
                        { baslangicDonem:"2026-01", donemSayisi:12 });
const girdi = H.toMotorGirdi(sonuc);
const cikis = M.vergiTakvimiNakitKalemleri(girdi.donemTutarlari);
console.log("Rejim:", sonuc.rejim, "| Güven:", sonuc.guven);
console.log("Yıllık kovalar:", JSON.stringify(sonuc.kovalar));
console.log("KDV1 çıkış dönemi sayısı:", cikis.length);
console.log("İlk iade kalemi:", JSON.stringify(girdi.iadeler[0]));
