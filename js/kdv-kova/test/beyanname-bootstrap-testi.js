/* beyanname-bootstrap-testi.js — 36/F satırı, KDV override, motor iade, mahsup,
 * F36 bölme, ihracat override, müstahsil stopajı. node test/beyanname-bootstrap-testi.js */
const fs = require("fs"), path = require("path");
const H = require("../kova-hesaplayici.js");
const B = require("../beyanname-kova-bootstrap.js");
const kok = path.join(__dirname, "..");
const sektor = (id) => JSON.parse(fs.readFileSync(path.join(kok, "sektorler", id + ".json"), "utf8"));
const ornek = (f) => JSON.parse(fs.readFileSync(path.join(kok, "ornekler", f), "utf8"));
let g = 0, k = 0;
const esit = (ad, b, e) => { const ok = JSON.stringify(b) === JSON.stringify(e);
  console.log(`${ok ? "✓" : "✗"} ${ad}` + (ok ? "" : `\n    beklenen ${JSON.stringify(e)} | bulunan ${JSON.stringify(b)}`));
  ok ? g++ : k++; };

// === A) 7 sektör × beyanname-only (hesaplayıcı, detaylı reçete) ===
for (const dosya of ["beyanname-only-genel-ticaret.json","beyanname-only-gida-perakende.json",
                     "beyanname-only-findik-ihracat.json","demir-celik-beyan-only.json",
                     "yem-uretim-beyan-only.json","hammadde-trade-beyan-only.json",
                     "gida-uretim-beyan-only.json","gida-uretim-sut-beyan-only.json",
                     "gida-uretim-et-beyan-only.json","gida-uretim-yumurta-beyan-only.json",
                     "tekstil-konfeksiyon-beyan-only.json"]) {
  const o = ornek(dosya);
  const s = H.hesapla(sektor(o.sektorId), o.beyanname, {});
  esit(`${o.sektorId}: ödenecek360 = ${o.beklenen.odenecek360}`, s.kovalar.odenecek360, o.beklenen.odenecek360);
  esit(`${o.sektorId}: iadePotansiyeli = ${o.beklenen.iadePotansiyeli}`, s.kovalar.iadePotansiyeli, o.beklenen.iadePotansiyeli);
  if (o.beklenen.hesaplanan391 != null)
    esit(`${o.sektorId}: hesaplanan391 = ${o.beklenen.hesaplanan391}`, s.kovalar.hesaplanan391, o.beklenen.hesaplanan391);
  if (o.beklenen.indirilecek191 != null)
    esit(`${o.sektorId}: indirilecek191 = ${o.beklenen.indirilecek191}`, s.kovalar.indirilecek191, o.beklenen.indirilecek191);
  if (o.beklenen.devredenSonraki != null)
    esit(`${o.sektorId}: devredenSonraki = ${o.beklenen.devredenSonraki}`, s.kovalar.devredenSonraki, o.beklenen.devredenSonraki);
  esit(`${o.sektorId}: alış kalemi >= 4 (ayrı satırlar)`, sektor(o.sektorId).alisKalemleri.length >= 4, true);
}

// === B) Üretim sektörlerinde AMBALAJ + ENERJI satırı zorunlu ===
for (const id of ["gida-uretim","gida-uretim-sut","gida-uretim-et","gida-uretim-yumurta","un-irmik-uretim",
                  "hayvan-yemi-uretim","demir-celik-metallurgy"]) {
  const kodlar = sektor(id).alisKalemleri.map(x => x.girdiKodu);
  esit(`${id}: AMBALAJ satırı var`, kodlar.includes("AMBALAJ"), true);
  esit(`${id}: ENERJI satırı var`, kodlar.some(x => x.startsWith("ENERJI") || x === "AKARYAKIT"), true);
}

// === C) Katalog 21 sektör + uiGrup/altDal ===
const kat = JSON.parse(fs.readFileSync(path.join(kok, "sektor-katalog.json"), "utf8"));
esit("Katalog 22 sektör", kat.sektorler.length, 22);
esit("Her sektör dosyası mevcut", kat.sektorler.every(s => fs.existsSync(path.join(kok, s.dosya))), true);
esit("gida-uretim altDal=uretim", kat.sektorler.find(s => s.id === "gida-uretim").altDal, "uretim");
esit("gida uiGrup sektör sayısı", kat.sektorler.filter(s => s.uiGrup === "gida").length, 9);
esit("Yumurta sektörü katalogda", !!kat.sektorler.find(s => s.id === "gida-uretim-yumurta"), true);
const guHam = sektor("gida-uretim").alisKalemleri.find(x => x.girdiKodu === "TICARI_MAL_GIDA_1");
esit("gida-uretim hammadde KDV %1", guHam && guHam.kdvOrani, 1);

// === D) Bootstrap demir-çelik: tevkifat iade + tam mahsup ===
const bc = B.bootstrap({ donem: "2026-02",
  gelirTablosu: { brutSatis: 10000000, smm: 7000000, faaliyetGideri: 1000000 },
  muhtasar: { stopaj: 50000 }, sgk: { prim: 80000 } },
  sektor("demir-celik-metallurgy"), { yil: 2026 });
esit("Demir: ödenecek KDV 0 (devreden)", bc.f36.odenecekKdv, 0);
esit("Demir: tevkifat iade mahsup 130000", bc.iade.mahsupEdilen, 130000);
esit("Demir: tevkifat iade nakden 546000", bc.iade.nakden, 546000);
esit("Demir: SGK+stopaj mahsupla 0", [bc.f36.sgk, bc.f36.stopaj], [0, 0]);
esit("Demir: 36Net 0 (tümü mahsup/devreden)", bc.odenecekVergi36Net, 0);
esit("Demir: vergi çıkışı yok (hepsi söndü)", bc.vergiCikislari.length, 0);
esit("Demir: nakden iade girişi 1", bc.iadeGirisleri.length, 1);

// === E) Beyanname KDV satırı sektörü EZER ===
const bk = B.bootstrap({ donem: "2026-03",
  kdvBeyani: { hesaplananKdv: 200000, indirilecekKdv: 120000, odenecekKdv: 80000, devredenKdv: 0 } },
  sektor("genel-ticaret-standart"), { yil: 2026 });
esit("KDV satırı: kaynak BEYANNAME", bk.kaynak, "BEYANNAME");
esit("KDV satırı: ödenecek beyandan 80000", bk.f36.odenecekKdv, 80000);

// === F) 29/2 alt sınır (164.000 TL) UYGULANIYOR ===
const e0 = B.bootstrap({ donem: "2026-04",
  gelirTablosu: { brutSatis: 2000000, smm: 1400000, faaliyetGideri: 200000 } },
  sektor("gida-toptan-perakende"), { yil: 2026 });
esit("29/2 alt sınır altı (devreden 35.880) -> iade 0", e0.iade.iadeEdilebilir, 0);
const e1 = B.bootstrap({ donem: "2026-04",
  gelirTablosu: { brutSatis: 10000000, smm: 7000000, faaliyetGideri: 1000000 } },
  sektor("gida-toptan-perakende"), { yil: 2026 });
esit("29/2 alt sınır üstü -> iadeEdilebilir 15400", e1.iade.iadeEdilebilir, 15400);
const e2 = B.bootstrap({ donem: "2026-04",
  gelirTablosu: { brutSatis: 30000000, smm: 21000000, faaliyetGideri: 3000000 } },
  sektor("gida-toptan-perakende"), { yil: 2026 });
esit("29/2 büyük ölçek -> iadeEdilebilir 374200", e2.iade.iadeEdilebilir, 374200);

// === G) İhracat iadesi: mahsup + YMM ===
const fx = B.bootstrap({ donem: "2026-02",
  gelirTablosu: { brutSatis: 5000000, smm: 3500000, faaliyetGideri: 300000 },
  sgk: { prim: 50000 }, muhtasar: { stopaj: 30000 } },
  sektor("findik-kuruyemis-ihracat"), { yil: 2026, firma: { tamTasdik: true } });
esit("İhracat: iade türü 11/1-a", fx.iade.iadeTuru, "IHRACAT_11_1_A");
esit("İhracat: mahsup 80000 (SGK+stopaj)", fx.iade.mahsupEdilen, 80000);
esit("İhracat: tam tasdik -> teminat yok", fx.iade.teminatGerekli, false);
esit("İhracat: YMM raporu gerekli", fx.iade.ymmRaporuGerekli, true);

// === H) 13/ı yem üreticisi: tam istisna -> iade ===
const yg = B.bootstrap({ donem: "2026-02",
  gelirTablosu: { brutSatis: 4000000, smm: 3000000, faaliyetGideri: 400000 } },
  sektor("hayvan-yemi-uretim"), { yil: 2026 });
esit("Yem 13/ı: ödenecek KDV 0", yg.f36.odenecekKdv, 0);
esit("Yem 13/ı: iade türü etiketi", yg.iade.iadeTuru, "TAM_ISTISNA_13_I");
esit("Yem 13/ı: nakden iade 370000", yg.iade.nakden, 370000);

// === I) İhracat tutarı ciro payını EZİYOR ===
const io = H.hesapla(sektor("makine-imalat"),
  { brutSatis: 10000000, ihracat: 8000000, smm: 6000000, faaliyetGideri: 1000000 }, {});
esit("İhracat override: hesaplanan391 = 400000", io.kovalar.hesaplanan391, 400000);
const io2 = H.hesapla(sektor("makine-imalat"),
  { brutSatis: 10000000, smm: 6000000, faaliyetGideri: 1000000 }, {});
esit("İhracat verilmezse tipik pay -> hesaplanan 1.400.000", io2.kovalar.hesaplanan391, 1400000);

// === J) Tek F satırı (36 toplam) otomatik ayrıştırma ===
const fl = B.bootstrap({ donem: "2026-02",
  gelirTablosu: { brutSatis: 1000000, smm: 700000, faaliyetGideri: 100000 },
  f36: { odenecekVergi: 200000 } }, sektor("genel-ticaret-standart"), { yil: 2026 });
esit("F satırı: KDV 42800", fl.f36.odenecekKdv, 42800);
esit("F satırı: stopaj %65 = 102180", fl.f36.stopaj, 102180);
esit("F satırı: SGK %35 = 55020", fl.f36.sgk, 55020);
esit("F satırı: 36Net = F toplamı 200000", fl.odenecekVergi36Net, 200000);
const fl2 = B.bootstrap({ donem: "2026-02",
  gelirTablosu: { brutSatis: 1000000, smm: 700000, faaliyetGideri: 100000 },
  f36: { odenecekVergi: 200000 } }, sektor("genel-ticaret-standart"),
  { yil: 2026, f36BolmeOrani: { stopaj: 0.5, sgk: 0.5 } });
esit("F satırı: özel bölme %50 -> stopaj 78600", fl2.f36.stopaj, 78600);

// === K) Müstahsil GV stopajı nakde giriyor ===
const mu = B.bootstrap({ donem: "2026-02",
  gelirTablosu: { brutSatis: 5000000, smm: 3500000, faaliyetGideri: 300000 } },
  sektor("findik-kuruyemis-ihracat"), { yil: 2026 });
esit("Müstahsil stopajı 54600", mu.f36.stopaj, 54600);
esit("Müstahsil: MPHB_STOPAJ çıkışı var", mu.vergiCikislari.some(x => x.tip === "MPHB_STOPAJ"), true);

// === L) Mizan varsa devre dışı ===
const mz = B.bootstrap({ donem: "2026-02", gelirTablosu: { brutSatis: 1000000 } },
  sektor("genel-ticaret-standart"), { mizanVar: true });
esit("Mizan: bootstrap devrede=false", mz.devrede, false);
esit("Mizan: kaynak MIZAN", mz.kaynak, "MIZAN");

console.log(`\n${g} geçti, ${k} kaldı`);
process.exit(k === 0 ? 0 : 1);
