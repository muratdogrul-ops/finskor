/* =====================================================================
 * beyanname-kova-bootstrap.js
 * Beyanname-only senaryoda 36 (Ödenecek Vergi ve Fonlar / F satırı) + KDV
 * kovalarını ayrıştırır ve nakit çıkışlarına dönüştürür.
 *
 * Cursor eksik listesini kapatır:
 *   A) 36 (F satırı) + SGK/stopaj  -> vergiCikislari (KDV1/MPHB_STOPAJ/SGK_PRIM)
 *   B) Beyanname KDV satırları      -> varsa sektör tahminini EZER (BEYANNAME önceliği)
 *   C) Gerçek iade (motor)          -> iadeIndirimliOran(164k alt sınır)/iadeIhracat(mahsup/YMM/teminat)
 *   +  KARMA rejim eşlemesi         -> sektor.iadeBaglantisi.motorRejim
 *
 * Kaynak önceliği: MİZAN > BEYANNAME(KDV satırı) > SEKTÖR+ÜRÜN MODELİ
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./muhasebe-motoru.js"), require("./kova-hesaplayici.js"));
  else root.BeyannameKovaBootstrap = factory(root.MuhasebeMotoru, root.KovaHesaplayici);
})(typeof self !== "undefined" ? self : this, function (M, H) {
  "use strict";
  if (!M || !H) throw new Error("muhasebe-motoru.js ve kova-hesaplayici.js yüklenmeli.");
  const r2 = M.r2;

  function kdvSatiriVarMi(b) {
    const k = b && b.kdvBeyani;
    return !!(k && (k.hesaplananKdv != null || k.odenecekKdv != null || k.devredenKdv != null));
  }

  /**
   * @param beyanname {
   *   donem:'YYYY-MM',
   *   gelirTablosu:{ brutSatis, netSatis?, smm, faaliyetGideri, ihracat? },
   *   kdvBeyani?:{ hesaplananKdv, indirilecekKdv, devredenKdv, odenecekKdv, yuklenilenKdv? },
   *   muhtasar?:{ stopaj },   // 360 (stopaj)
   *   sgk?:{ prim },          // 361
   *   f36?:{ odenecekVergi }  // 36 toplamı doğrudan verildiyse
   * }
   * @param sektor sektör JSON
   * @param opts { mizanVar, yil=2026, firma:{tamTasdik,his}, mahsubaAdayBorclar? }
   */
  function bootstrap(beyanname, sektor, opts) {
    opts = opts || {};
    const yil = opts.yil || 2026;
    const donem = beyanname.donem || `${yil}-01`;
    const notlar = [];

    if (opts.mizanVar) {
      return { devrede: false, sebep: "Mizan mevcut; 36/190/191 gerçek değerlerden alınır.",
               kaynak: "MIZAN", kovalar: null, iade: null, vergiCikislari: [], odenecekVergi36Net: null, notlar };
    }

    // --- Kovaları belirle: BEYANNAME (KDV satırı) > SEKTÖR ---
    let kovalar, kaynak, devredenSonraki, hesaplanan, indirilecek, tevkifEdilen = 0, urunKirilimi = [];
    if (kdvSatiriVarMi(beyanname)) {
      const k = beyanname.kdvBeyani;
      hesaplanan = r2(k.hesaplananKdv || 0);
      indirilecek = r2(k.indirilecekKdv || 0);
      const odenecek = r2(k.odenecekKdv != null ? k.odenecekKdv : Math.max(0, hesaplanan - indirilecek - (k.devredenKdv || 0)));
      devredenSonraki = r2(k.devredenKdv != null ? k.devredenKdv : Math.max(0, indirilecek - hesaplanan));
      kovalar = { hesaplanan391: hesaplanan, indirilecek191: indirilecek,
                  devreden190: r2(k.devredenAcilis || 0), odenecek360: odenecek,
                  iadePotansiyeli: r2(devredenSonraki), tevkifEdilen: 0,
                  saticiBeyan391: hesaplanan, devredenSonraki };
      kaynak = "BEYANNAME";
      notlar.push("Beyanname KDV satırları kullanıldı; sektör tahmini ezildi (yüksek güven).");
    } else {
      const s = H.hesapla(sektor, beyanname.gelirTablosu || {}, {
        devreden190: (beyanname.kdvBeyani || {}).devredenAcilis || 0, donemSayisi: 1, baslangicDonem: donem });
      kovalar = s.kovalar; kaynak = "SEKTOR_URUN_MODELI";
      devredenSonraki = s.kovalar.devredenSonraki; hesaplanan = s.kovalar.hesaplanan391;
      indirilecek = s.kovalar.indirilecek191; tevkifEdilen = s.kovalar.tevkifEdilen || 0;
      urunKirilimi = s.urunKirilimi; notlar.push.apply(notlar, s.notlar);
    }

    // --- Gerçek iade (motor) ---
    const ib = sektor.iadeBaglantisi || {};
    const tur = ib.tur;
    const mahsubaAday = r2(opts.mahsubaAdayBorclar != null ? opts.mahsubaAdayBorclar
                          : ((beyanname.muhtasar || {}).stopaj || 0) + ((beyanname.sgk || {}).prim || 0));
    let iade = null;
    if (tur === "IHRACAT_11_1_A" || tur === "TAM_ISTISNA_13_I") {
      iade = M.iadeIhracat(devredenSonraki, mahsubaAday,
                           { tamTasdik: !!(opts.firma || {}).tamTasdik, hizlandirilmis: !!(opts.firma || {}).his, yil });
      iade.iadeTuru = tur;
      if (tur === "TAM_ISTISNA_13_I") notlar.push("13/ı tam istisna iadesi; ihracat iade prosedürü (mahsup+nakden) uygulandı.");
    } else if (tur === "INDIRIMLI_ORAN_29_2") {
      iade = M.iadeIndirimliOran(indirilecek, hesaplanan, 0, devredenSonraki, { yil, yilIci: true });
      notlar.push(`İndirimli oran 29/2: yıllık alt sınır (${M.param("INDIRIMLI_ORAN_IADE_ALT_SINIR", yil).toLocaleString("tr-TR")} TL) uygulandı. Kümülatif yıl verisiyle netleşir.`);
    } else if (tur === "TEVKIFAT") {
      iade = M.iadeTevkifat(r2(devredenSonraki + tevkifEdilen), mahsubaAday);
    }

    // --- 36 (F satırı) nakit çıkışları + mahsup uygulaması ---
    const odenecekKdv = kovalar.odenecek360;

    // Müstahsil GV stopajı (varsa) — KDV dışı, MPHB'de beyan, nakde girer
    const gt = beyanname.gelirTablosu || {};
    const kdeger = (ad) => ad === "satMaliyet" ? (gt.smm || 0)
                         : ad === "faalGider" ? (gt.faaliyetGideri || 0)
                         : ad === "netSatis" ? (gt.netSatis != null ? gt.netSatis : gt.brutSatis || 0)
                         : (gt.brutSatis || 0);
    let mustahsilStopaj = 0;
    if (sektor.mustahsilStopaj) {
      const ms = sektor.mustahsilStopaj;
      mustahsilStopaj = r2(kdeger(ms.matrahKaynagi) * (ms.pay || 1) * ms.oran);
    }

    // stopaj/SGK kaynağı: (1) ayrı alanlar (2) tek F satırı bölme (3) yalnız müstahsil
    const stopajVar = (beyanname.muhtasar || {}).stopaj != null;
    const sgkVar = (beyanname.sgk || {}).prim != null;
    let stopaj, sgk;
    if (stopajVar || sgkVar) {
      stopaj = r2(((beyanname.muhtasar || {}).stopaj || 0) + mustahsilStopaj);
      sgk = r2((beyanname.sgk || {}).prim || 0);
    } else if (beyanname.f36 && beyanname.f36.odenecekVergi != null) {
      const fTop = r2(beyanname.f36.odenecekVergi);
      const kalan = Math.max(0, r2(fTop - odenecekKdv));   // 36 toplamından KDV düşülür -> stopaj+SGK
      const bo = opts.f36BolmeOrani || { stopaj: 0.65, sgk: 0.35 };
      stopaj = r2(kalan * bo.stopaj);
      sgk = r2(kalan * bo.sgk);
      notlar.push(`F satırı toplamı (${fTop.toLocaleString("tr-TR")} TL) kullanıldı: KDV (${odenecekKdv.toLocaleString("tr-TR")}) düşülüp kalan stopaj/SGK %${(bo.stopaj*100).toFixed(0)}/%${(bo.sgk*100).toFixed(0)} TAHMİNİ bölündü. Mizan F satırıyla kalibre edilmeli. (Müstahsil stopajı F içinde varsayıldı.)`);
    } else {
      stopaj = r2(mustahsilStopaj);
      sgk = 0;
    }
    if (mustahsilStopaj > 0 && (stopajVar || sgkVar))
      notlar.push(`Müstahsil GV stopajı ${mustahsilStopaj.toLocaleString("tr-TR")} TL stopaja (360/MPHB) eklendi (KDV dışı).`);

    // İade mahsubu önce SGK (361), sonra stopaj (360) borcunu söndürür
    let mahsupKalan = iade ? r2(iade.mahsupEdilen || 0) : 0;
    const sgkMahsup = Math.min(mahsupKalan, sgk); mahsupKalan = r2(mahsupKalan - sgkMahsup);
    const stopajMahsup = Math.min(mahsupKalan, stopaj); mahsupKalan = r2(mahsupKalan - stopajMahsup);
    const sgkNet = r2(sgk - sgkMahsup);
    const stopajNet = r2(stopaj - stopajMahsup);
    if (iade && (sgkMahsup + stopajMahsup) > 0)
      notlar.push(`İade mahsubu: SGK(361) ${sgkMahsup.toLocaleString("tr-TR")} + stopaj(360) ${stopajMahsup.toLocaleString("tr-TR")} TL borç söndürüldü (nakit-nötr).`);

    const donemTutarlari = {};
    if (odenecekKdv > 0) donemTutarlari.KDV1 = { [donem]: odenecekKdv };
    if (stopajNet > 0)   donemTutarlari.MPHB_STOPAJ = { [donem]: stopajNet };
    if (sgkNet > 0)      donemTutarlari.SGK_PRIM = { [donem]: sgkNet };
    const vergiCikislari = M.vergiTakvimiNakitKalemleri(donemTutarlari)
      .map((x) => ({ ...x, kaynak }));

    // Nakden iade -> gelecekteki giriş
    const iadeGirisleri = [];
    if (iade && iade.nakden > 0) {
      const gAy = ib.nakdenGecikmeAy || 0;
      const td = H.donemEkle(donem, gAy);
      const [yy, aa] = td.split("-").map(Number);
      iadeGirisleri.push({ tip: "KDV_IADE", donem,
        tarih: M.fmt(M.yukumlulukGunu("KDV1", yy, aa - 1).efektif),
        tutar: iade.nakden, yon: "GIRIS", iadeTuru: iade.iadeTuru || tur });
    }

    const odenecekVergi36Net = r2(odenecekKdv + stopajNet + sgkNet);

    return {
      devrede: true, sebep: "Beyanname-only; 36 + KDV kovaları türetildi.",
      donem, kaynak, guvenSkoru: "beyanname_only_urun_model",
      kovalar, iade, urunKirilimi,
      f36: { odenecekKdv, stopaj: stopajNet, sgk: sgkNet, odenecekVergi36Net },
      vergiCikislari, iadeGirisleri, odenecekVergi36Net, notlar,
    };
  }

  return { bootstrap, kdvSatiriVarMi };
});
