/* =====================================================================
 * aylik-kova-projeksiyon.js
 * hesapla() çıktısından AYLIK 391/191/360/190/iade üretir. Devreden ayları
 * taşır; rejim bazlı dallanır; motor iade fonksiyonlarını uygular.
 * Çıktı toMotorGirdi() ile uyumlu (donemTutarlari + iadeler).
 *
 * Rejimler: GENEL · INDIRIMLI_ORAN_29_2 · IHRACAT_11_1_A/TAM_ISTISNA_13_I · TEVKIFAT
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./muhasebe-motoru.js"), require("./kova-hesaplayici.js"));
  else root.AylikKovaProjeksiyon = factory(root.MuhasebeMotoru, root.KovaHesaplayici);
})(typeof self !== "undefined" ? self : this, function (M, H) {
  "use strict";
  const r2 = M.r2;
  function donemEkle(d, n) { let [y, a] = d.split("-").map(Number); a += n;
    while (a > 12) { a -= 12; y++; } while (a < 1) { a += 12; y--; } return `${y}-${String(a).padStart(2,"0")}`; }

  /**
   * @param sektor  sektör JSON
   * @param gelirYillik { brutSatis, smm, faaliyetGideri, ihracat? }  (yıllık)
   * @param opts {
   *   baslangicDonem='2026-01', donemSayisi=12,
   *   aylikAgirliklar:[..] (sezon; toplam normalize edilir),
   *   seri:{ 'YYYY-MM': gelirTablosu } (verilirse yıllık yerine kullanılır),
   *   yil=2026, firma:{tamTasdik,his}, mahsubaAdayBorclarAylik:{donem:tutar}
   * }
   */
  function aylikKovaProjeksiyon(sektor, gelirYillik, opts) {
    opts = opts || {};
    const yil = opts.yil || 2026;
    const N = opts.donemSayisi || 12;
    const bas = opts.baslangicDonem || `${yil}-01`;
    const agirRaw = (opts.aylikAgirliklar && opts.aylikAgirliklar.length === N)
      ? opts.aylikAgirliklar : Array(N).fill(1 / N);
    const agirT = agirRaw.reduce((a, b) => a + b, 0) || 1;
    const ib = sektor.iadeBaglantisi || {};
    const tur = ib.tur;

    let oncekiDevreden = r2(opts.devreden190Baslangic || 0), kumYuk = 0, kumHes = 0, oncekiMahsup = 0;
    const aylik = [], donemTutarlari = { KDV1: {} }, iadeler = [];

    for (let i = 0; i < N; i++) {
      const donem = donemEkle(bas, i);
      const w = agirRaw[i] / agirT;
      const g = (opts.seri && opts.seri[donem]) ? opts.seri[donem] : {
        brutSatis: (gelirYillik.brutSatis || 0) * w,
        netSatis: gelirYillik.netSatis != null ? gelirYillik.netSatis * w : undefined,
        smm: (gelirYillik.smm || 0) * w,
        faaliyetGideri: (gelirYillik.faaliyetGideri || 0) * w,
        ihracat: gelirYillik.ihracat != null ? gelirYillik.ihracat * w : undefined,
      };
      const s = H.hesapla(sektor, g, { devreden190: oncekiDevreden, donemSayisi: 1, baslangicDonem: donem });
      const hes = s.kovalar.hesaplanan391, ind = s.kovalar.indirilecek191;
      const saticiBeyan = s.kovalar.saticiBeyan391, tevkif = s.kovalar.tevkifEdilen || 0;
      const net = r2(saticiBeyan - ind - oncekiDevreden);
      let odenecek = Math.max(0, net), devreden = Math.max(0, -net), iadeAy = null, iadeTutar = 0;

      const mahsubaAday = (opts.mahsubaAdayBorclarAylik || {})[donem] || 0;
      if (tur === "GENEL" || !tur) {
        // klasik devret/öde
      } else if (tur === "INDIRIMLI_ORAN_29_2") {
        kumYuk = r2(kumYuk + ind); kumHes = r2(kumHes + hes);
        const it = M.iadeIndirimliOran(kumYuk, kumHes, oncekiMahsup, devreden, { yil, yilIci: true });
        iadeAy = it; iadeTutar = it.iadeEdilebilir; oncekiMahsup = r2(oncekiMahsup + it.mahsupEdilen);
      } else if (tur === "IHRACAT_11_1_A" || tur === "TAM_ISTISNA_13_I") {
        if (devreden > 0) { const it = M.iadeIhracat(devreden, mahsubaAday,
            { tamTasdik: !!(opts.firma||{}).tamTasdik, hizlandirilmis: !!(opts.firma||{}).his, yil });
          it.iadeTuru = tur; iadeAy = it; iadeTutar = it.iadeEdilebilir; }
      } else if (tur === "TEVKIFAT") {
        const taban = r2(devreden + tevkif);
        if (taban > 0) { iadeAy = M.iadeTevkifat(taban, mahsubaAday); iadeTutar = iadeAy.iadeEdilebilir; }
      }

      // devredeni iade kadar düş (iade hakkına dönüşen kısım)
      const devredenSonra = (tur && tur !== "GENEL") ? Math.max(0, r2(devreden - iadeTutar)) : devreden;
      oncekiDevreden = devredenSonra;

      if (odenecek > 0) donemTutarlari.KDV1[donem] = r2(odenecek);
      if (iadeAy && iadeAy.nakden > 0) {
        const td = donemEkle(donem, ib.nakdenGecikmeAy || 0);
        iadeler.push({ donem, tahsilDonem: td, tutar: r2(iadeAy.nakden), tur: iadeAy.iadeTuru || tur, yontem: "NAKDEN" });
      }
      aylik.push({ donem, hesaplanan391: r2(hes), indirilecek191: r2(ind),
        odenecek360: r2(odenecek), devreden190: r2(devredenSonra),
        iade: iadeAy ? { tur: iadeAy.iadeTuru || tur, edilebilir: r2(iadeTutar),
          mahsuben: r2(iadeAy.mahsupEdilen || 0), nakden: r2(iadeAy.nakden || 0) } : null });
    }

    const toplam = {
      hesaplanan391: r2(aylik.reduce((a, m) => a + m.hesaplanan391, 0)),
      indirilecek191: r2(aylik.reduce((a, m) => a + m.indirilecek191, 0)),
      odenecek360: r2(aylik.reduce((a, m) => a + m.odenecek360, 0)),
      iadeNakden: r2(iadeler.reduce((a, x) => a + x.tutar, 0)),
    };
    return { rejim: sektor.sektorMeta.kdvRejimi, motorRejim: ib.motorRejim, tur,
             aylik, toplam, donemTutarlari, iadeler,
             not: "Aylık projeksiyon; devreden aylar arası taşınır. NakitFlow buildKdvSchedule yerine donemTutarlari+iadeler merge edilir." };
  }

  return { aylikKovaProjeksiyon, donemEkle };
});
