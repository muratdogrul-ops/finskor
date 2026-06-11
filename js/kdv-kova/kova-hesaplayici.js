/* =====================================================================
 * kova-hesaplayici.js  (Kütüphane 2 — ürün/girdi bazlı KDV kova hesaplayıcı)
 * Bağımsız JS. Beyanname gelir tablosundan (brüt satış, SMM, faaliyet gideri)
 * + sektör ürün modelinden KDV kovalarını doldurur. "Boş tahmin" değil;
 * etiketli, ürün kırılımlı, kaynaklı sektör modeli.
 *
 * KURAL: Mizan doluysa (opts.mizanVar) DEVREYE GİRMEZ.
 * Oranlar sektör JSON'ından gelir; kodda sabit %20 YOKTUR.
 * Çıktı muhasebe-motoru.js'e dönüştürülebilir (toMotorGirdi).
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.KovaHesaplayici = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

  function kaynakDeger(ad, b) {
    switch (ad) {
      case "brutSatis": return b.brutSatis || 0;
      case "netSatis":  return (b.netSatis != null ? b.netSatis : b.brutSatis) || 0;
      case "satMaliyet":return b.smm || 0;
      case "faalGider": return b.faaliyetGideri || 0;
      default: return 0;
    }
  }
  function donemEkle(donem, ay) {
    let [y, a] = donem.split("-").map(Number); a += ay;
    while (a > 12) { a -= 12; y += 1; } while (a < 1) { a += 12; y -= 1; }
    return `${y}-${String(a).padStart(2, "0")}`;
  }

  /**
   * @param sektor   sektör JSON (sektorler/*.json)
   * @param beyanname { brutSatis, netSatis?, smm, faaliyetGideri }
   * @param opts {
   *   mizanVar:bool, devreden190:number (varsa açılış),
   *   urunAgirliklariOverride:{ urunKodu|girdiKodu: pay },
   *   donemSayisi:int=12, baslangicDonem:'YYYY-MM'='2026-01', aylikAgirliklar:[..]
   * }
   */
  function hesapla(sektor, beyanname, opts) {
    opts = opts || {};
    if (opts.mizanVar) {
      return { devrede: false, sebep: "Mizan mevcut; gerçek 360.03/190/191 esas. Kütüphane override etmez.",
               kovalar: null, aylikDagilim: [], urunKirilimi: [], guvenSkoru: null, notlar: [] };
    }
    const ov = opts.urunAgirliklariOverride || {};
    const notlar = [];
    const urunKirilimi = [];

    // --- İhracat tutarı verildiyse satış paylarını EZ (sektör varsayılanı yerine) ---
    const ihracatOv = {};
    const brut = kaynakDeger("brutSatis", beyanname) || 0;
    if (beyanname.ihracat != null && brut > 0) {
      const ihrPay = Math.min(1, Math.max(0, beyanname.ihracat / brut));
      const ihrKalem = sektor.satisKalemleri.find((x) => x.istisnaTipi === "ihracat");
      if (ihrKalem) {
        ihracatOv[ihrKalem.urunKodu] = ihrPay;
        const digerler = sektor.satisKalemleri.filter((x) => x.istisnaTipi !== "ihracat");
        const digerToplamTipik = digerler.reduce((s, x) => s + x.varsayilanCiroPayi.tipik, 0) || 1;
        for (const d of digerler)               // kalan payı oranlı dağıt
          if (ov[d.urunKodu] == null)
            ihracatOv[d.urunKodu] = (1 - ihrPay) * (d.varsayilanCiroPayi.tipik / digerToplamTipik);
        notlar.push(`İhracat tutarı (${beyanname.ihracat.toLocaleString("tr-TR")} TL) verildi; ihracat payı %${(ihrPay*100).toFixed(1)} olarak satış paylarını ezdi.`);
      }
    }
    const payAl = (kod, varsayilan) =>
      ov[kod] != null ? ov[kod] : (ihracatOv[kod] != null ? ihracatOv[kod] : varsayilan);

    // --- Satış tarafı: 391 ---
    let hesaplanan = 0;
    for (const k of sektor.satisKalemleri) {
      const pay = payAl(k.urunKodu, k.varsayilanCiroPayi.tipik);
      const matrah = r2(kaynakDeger(k.matrahKaynagi, beyanname) * pay);
      const kdv = r2((matrah * k.kdvOrani) / 100);
      hesaplanan = r2(hesaplanan + kdv);
      urunKirilimi.push({ taraf: "SATIS", kod: k.urunKodu, ad: k.urunAdi,
                          oran: k.kdvOrani, matrah, kdv, istisna: k.istisnaTipi || null });
    }

    // --- Tevkifat (varsa): satıcıda beyan/iade ayrımı ---
    let tevkifEdilen = 0;
    const tevkifatAktif = sektor.tevkifat && sektor.tevkifat.var && opts.tevkifatUygula !== false;
    if (tevkifatAktif) {
      const t = sektor.tevkifat;
      const oran = t.pay / t.payda;
      const genelKdv = urunKirilimi.filter((x) => x.taraf === "SATIS" && x.oran === 20)
                                   .reduce((s, x) => s + x.kdv, 0);
      tevkifEdilen = r2(genelKdv * (t.kapsamOrani || 0) * oran);
      notlar.push(`Tevkifat ${t.pay}/${t.payda} (${t.gibKod || ""}): tevkif edilen KDV ${tevkifEdilen.toLocaleString("tr-TR")} TL satıcı iade hakkı; alt sınır KDV dahil ${t.altSinirKdvDahil} TL.`);
      if (t.islemEsigiKdvDahil)
        notlar.push(`Uyarı: ${t.islemEsigiKdvDahil.toLocaleString("tr-TR")} TL işlem eşiği FATURA bazında uygulanır; toplulaştırılmış beyanname modelinde doğrulanamaz (opts.tevkifatUygula=false ile kapatılabilir).`);
    } else if (sektor.tevkifat && sektor.tevkifat.var) {
      notlar.push("Tevkifat opts.tevkifatUygula=false ile devre dışı bırakıldı (eşik altı/uygulanmıyor).");
    }
    const saticiBeyan = r2(hesaplanan - tevkifEdilen); // 1 No.lu beyanda kalan

    // --- Alış tarafı: 191 (istisna girdiler indirilecek doğurmaz) ---
    let indirilecek = 0;
    for (const g of sektor.alisKalemleri) {
      const gpay = (typeof g.pay === "object" && g.pay) ? g.pay.tipik : g.pay;
      const pay = ov[g.girdiKodu] != null ? ov[g.girdiKodu] : gpay;
      const matrah = r2(kaynakDeger(g.matrahKaynagi, beyanname) * pay);
      const kdv = r2((matrah * g.kdvOrani) / 100);
      indirilecek = r2(indirilecek + kdv);
      urunKirilimi.push({ taraf: "ALIS", kod: g.girdiKodu, ad: g.girdiAdi,
                          oran: g.kdvOrani, matrah, kdv, kova: g.kovaTipi,
                          istisna: g.istisnaTipi || null });
    }

    // --- Net / kovalar ---
    const devreden190 = r2(opts.devreden190 || 0);
    if (!opts.devreden190) notlar.push("Açılış devreden KDV (190) bilinmiyor; 0 alındı (mizan yokken). Güven: tahmin.");
    const net = r2(saticiBeyan - indirilecek - devreden190);
    const odenecek360 = Math.max(0, net);
    const devredenSonraki = Math.max(0, -net);

    // iade potansiyeli rejime göre
    const rejim = sektor.sektorMeta.kdvRejimi;
    const iadeTur = (sektor.iadeBaglantisi || {}).tur;
    let iadePotansiyeli = 0;
    if (iadeTur === "IHRACAT_11_1_A" || iadeTur === "INDIRIMLI_ORAN_29_2" || iadeTur === "TAM_ISTISNA_13_I") {
      iadePotansiyeli = r2(devredenSonraki);
    } else if (iadeTur === "TEVKIFAT") {
      iadePotansiyeli = r2(devredenSonraki + tevkifEdilen);
    } else {
      if (devredenSonraki > 0)
        notlar.push(`Negatif net (${devredenSonraki.toLocaleString("tr-TR")} TL) iade rejimi olmadığından devreden olarak taşınır (iade değil).`);
    }
    if (iadeTur === "INDIRIMLI_ORAN_29_2")
      notlar.push("İndirimli oran iadesi 29/2: yıllık alt sınır VERGI_PARAMETRE'den uygulanır (muhasebe-motoru.iadeIndirimliOran); yıl içi mahsuben.");

    const kovalar = {
      hesaplanan391: hesaplanan,
      indirilecek191: indirilecek,
      devreden190: devreden190,
      odenecek360: r2(odenecek360),
      iadePotansiyeli: r2(iadePotansiyeli),
      // ek alanlar (şeffaflık; spec dışı, tüketici yok sayabilir)
      tevkifEdilen: tevkifEdilen,
      saticiBeyan391: saticiBeyan,
      devredenSonraki: r2(devredenSonraki),
    };

    // --- Aylık dağılım ---
    const N = opts.donemSayisi || 12;
    const bas = opts.baslangicDonem || `${sektor.sektorMeta.gecerlilikYili}-01`;
    const agir = opts.aylikAgirliklar && opts.aylikAgirliklar.length === N
      ? opts.aylikAgirliklar : Array(N).fill(1 / N);
    const agirToplam = agir.reduce((a, b) => a + b, 0) || 1;
    const aylikDagilim = [];
    for (let i = 0; i < N; i++) {
      const f = agir[i] / agirToplam;
      aylikDagilim.push({
        donem: donemEkle(bas, i),
        kovalar: {
          hesaplanan391: r2(hesaplanan * f),
          indirilecek191: r2(indirilecek * f),
          odenecek360: r2(odenecek360 * f),
          iadePotansiyeli: r2(iadePotansiyeli * f),
        },
      });
    }

    return {
      devrede: true,
      sebep: "Mizan yok; sektör+ürün modeli ile beyanname gelir tablosundan türetildi.",
      sektorId: sektor.sektorMeta.id,
      rejim, iadeTur,
      kovalar, aylikDagilim, urunKirilimi,
      guvenSkoru: "beyanname_only_urun_model",
      guven: sektor.sektorMeta.guven || "orta",
      notlar,
    };
  }

  /**
   * muhasebe-motoru.js girdisine dönüştürür.
   * @returns { donemTutarlari:{KDV1:{donem:odenecek}}, iadeler:[{donem,tutar,tur}] }
   * CURSOR_ENTEGRASYON.md: M.vergiTakvimiNakitKalemleri(donemTutarlari) ile efektif tarihli çıkış.
   */
  function toMotorGirdi(sonuc) {
    if (!sonuc.devrede) return { devrede: false, donemTutarlari: {}, iadeler: [] };
    const kdv1 = {};
    const iadeler = [];
    for (const ad of sonuc.aylikDagilim) {
      if (ad.kovalar.odenecek360 > 0) kdv1[ad.donem] = ad.kovalar.odenecek360;
      if (ad.kovalar.iadePotansiyeli > 0)
        iadeler.push({ donem: ad.donem, tutar: ad.kovalar.iadePotansiyeli, tur: sonuc.iadeTur });
    }
    return { devrede: true, donemTutarlari: { KDV1: kdv1 }, iadeler };
  }

  return { hesapla, toMotorGirdi, r2, donemEkle };
});
