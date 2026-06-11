/* =====================================================================
 * muhasebe-motoru.js
 * NakitFlow eksiklerini kapatan saf JavaScript motoru (bağımlılık yok).
 * Cursor karşılaştırma raporundaki açıkları öncelik sırasıyla doldurur:
 *   #1 36 (360/361) ile 391 (KDV) ayrımı     -> mapHesapToYukumluluk + kdvUzlastir
 *   #2 Vergi takvimi (tatil/mali tatil kaymalı) -> efektifSonGun, yukumlulukGunu
 *   #3 KDV iade (ihracat mahsup/YMM/teminat)  -> iadeIhracat
 *   #4 İndirimli oran iade (29/2, alt sınır)  -> iadeIndirimliOran
 *   +  Tevkifat (1/2 No.lu, satıcı iadesi)    -> faturaTevkifat, iadeTevkifat
 *   +  Yıllık tebliğ parametreleri (sabit değil) -> VERGI_PARAMETRE
 *   +  Kambiyo değerleme (646/656)            -> kurDegerle
 *
 * Tarayıcıda <script src> ile veya ES module olarak import edilebilir.
 * Para matematiği: tek noktada r2() ile 2 haneye yuvarlanır (Python Decimal
 * altın testiyle birebir aynı sonuçları üretir).
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MuhasebeMotoru = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

  // ===================================================================
  // 0. YILLIK PARAMETRELER  (tebliğle değişir -> tek yerden yönet, SABİT DEĞİL)
  // ===================================================================
  const VERGI_PARAMETRE = {
    INDIRIMLI_ORAN_IADE_ALT_SINIR: { 2024: 90800, 2025: 130700, 2026: 164000 },
    IHRACAT_TAMTASDIKSIZ_NAKIT_UST_SINIR: { 2026: 2000000 },
  };
  function param(anahtar, yil) {
    const t = VERGI_PARAMETRE[anahtar];
    if (!t || t[yil] == null)
      throw new Error(`Parametre yok: ${anahtar} / ${yil} -> tebliğe göre ekleyin`);
    return t[yil];
  }

  // Yükümlülük şablonları (yasal günler; efektif gün runtime'da hesaplanır)
  // odemeGun=0 => "ay sonu" (SGK primi)
  const YUKUMLULUK_SABLONU = {
    KDV1:            { periyot: "AYLIK",   ay: 1, beyanGun: 28, odemeGun: 28 },
    KDV2:            { periyot: "AYLIK",   ay: 1, beyanGun: 21, odemeGun: 23 }, // 01.01.2024'ten beri
    MPHB_STOPAJ:     { periyot: "AYLIK",   ay: 1, beyanGun: 26, odemeGun: 26 },
    SGK_PRIM:        { periyot: "AYLIK",   ay: 1, beyanGun: 26, odemeGun: 0  }, // ay sonu
    GECICI_VERGI:    { periyot: "UCAYLIK", ay: 2, beyanGun: 17, odemeGun: 17 }, // 4 DÖNEM (7566 s.K.)
    KURUMLAR_VERGISI:{ periyot: "YILLIK",  ay: 4, beyanGun: 30, odemeGun: 30 },
  };

  // ===================================================================
  // 1. TATİL & GÜN KAYDIRMA MOTORU  (eksik #2)
  // ===================================================================
  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  function resmiTatiller(yil) {
    // Sabit milli tatiller. Dini bayramlar hicri olduğundan diniBayramEkle() ile beslenir.
    const sabit = [[1,1],[4,23],[5,1],[5,19],[7,15],[8,30],[10,29]];
    const s = new Set(sabit.map(([m, g]) => fmt(new Date(yil, m - 1, g))));
    s.add(fmt(new Date(yil - 1, 11, 31)));
    return s;
  }
  // Dini bayram tarihlerini dışarıdan ekleme kancası (Diyanet/GİB beslemesi)
  const DINI_BAYRAM = new Set(); // örn: DINI_BAYRAM.add('2026-03-20')
  function diniBayramEkle(isoTarihler) { isoTarihler.forEach((t) => DINI_BAYRAM.add(t)); }

  function maliTatil(yil) {
    return { bas: new Date(yil, 6, 1), son: new Date(yil, 6, 20) }; // 1-20 Temmuz (5604 s.K.)
  }
  function isGunuMu(d) {
    const wd = d.getDay(); // 0=Pzr,6=Cmt
    return wd !== 0 && wd !== 6 && !resmiTatiller(d.getFullYear()).has(fmt(d)) && !DINI_BAYRAM.has(fmt(d));
  }
  function sonrakiIsGunu(d) {
    const x = new Date(d);
    while (!isGunuMu(x)) x.setDate(x.getDate() + 1);
    return x;
  }
  function efektifSonGun(yasalGun) {
    let g = new Date(yasalGun);
    const mt = maliTatil(g.getFullYear());
    // Mali tatil kuralı: son gün mali tatile rastlarsa mali tatil bitişini izleyen 7. güne
    if (g >= mt.bas && g <= mt.son) {
      g = new Date(mt.son);
      g.setDate(g.getDate() + 7);
    }
    return sonrakiIsGunu(g); // hafta sonu / resmi / dini tatil kaydırması (VUK md.18)
  }
  function aySonu(yil, ay) { return new Date(yil, ay, 0); } // ay: 1-12

  // Bir yükümlülüğün dönem sonuna göre (yasal, efektif) gününü döndürür
  function yukumlulukGunu(tip, donemSonYil, donemSonAy) {
    const s = YUKUMLULUK_SABLONU[tip];
    let ay = donemSonAy + s.ay, yil = donemSonYil;
    while (ay > 12) { ay -= 12; yil += 1; }
    const yasal = s.odemeGun === 0 ? aySonu(yil, ay) : new Date(yil, ay - 1, s.odemeGun);
    return { yasal, efektif: efektifSonGun(yasal) };
  }

  // ===================================================================
  // 2. THP HESAP -> YÜKÜMLÜLÜK HARİTASI  (eksik #1: 36 ile 391 ayrımı)
  // ===================================================================
  // 391 bir TAHAKKUK kovasıdır; doğrudan ödeme kalemi DEĞİLDİR. 191 ile netleşip
  // 360'a (Ödenecek KDV) dönüşür. 36x grubu ise gerçek nakit çıkış kalemleridir.
  function mapHesapToYukumluluk(hesapKodu) {
    const k = String(hesapKodu);
    if (k.startsWith("391")) return { tip: null, nakitKalem: false, not: "Tahakkuk kovası; 191 ile netleşir, 360'a döner" };
    if (k.startsWith("361")) return { tip: "SGK_PRIM", nakitKalem: true, not: "Ödenecek SGK -> ay sonu" };
    if (k.startsWith("360")) return { tip: "KDV1", nakitKalem: true, not: "Ödenecek vergi/fon -> ilgili beyan günü (KDV/stopaj/geçici/kurumlar)" };
    if (k.startsWith("190") || k.startsWith("191")) return { tip: null, nakitKalem: false, not: "Devreden/indirilecek KDV; nakit çıkış değil" };
    return { tip: null, nakitKalem: false, not: "Vergi yükümlülüğü değil" };
  }

  // ===================================================================
  // 3. KDV KOVA UZLAŞTIRMA  (191/391/190/360) — destekler #1
  // ===================================================================
  // faturalar: [{tip:'SATIS'|'ALIS'|'IHRACAT'|'ITHALAT', matrah, kdvOrani,
  //              tevkifat:[pay,payda]|null, yuklenilenKdv}]
  function faturaKdv(f)      { return r2((f.matrah * (f.kdvOrani || 0)) / 100); }
  function tevkifEdilen(f)   { return f.tevkifat ? r2((faturaKdv(f) * f.tevkifat[0]) / f.tevkifat[1]) : 0; }
  function saticiBeyan(f)    { return r2(faturaKdv(f) - tevkifEdilen(f)); }

  function kdvUzlastir(donem, faturalar, oncekiDevreden, rejim, yil) {
    let hesaplanan = 0, indirilecek = 0, yuklenilen = 0;
    for (const f of faturalar) {
      if (f.tip === "SATIS") hesaplanan += saticiBeyan(f);
      if (f.tip === "ALIS" || f.tip === "ITHALAT") indirilecek += faturaKdv(f);
      yuklenilen += f.yuklenilenKdv || 0;
    }
    hesaplanan = r2(hesaplanan); indirilecek = r2(indirilecek);
    const net = r2(hesaplanan - (indirilecek + oncekiDevreden));
    let odenecek = 0, sonraki = 0, iadeHakki = 0;
    if (net >= 0) { odenecek = net; }
    else {
      sonraki = r2(-net);
      if (rejim === "IHRACAT_ISTISNASI" || rejim === "INDIRIMLI_ORAN") {
        iadeHakki = Math.min(r2(yuklenilen), sonraki);
        sonraki = r2(sonraki - iadeHakki);
      }
    }
    return { donem, hesaplanan, indirilecek, oncekiDevreden,
             odenecek, sonrakiDevreden: sonraki, iadeHakki };
  }

  // ===================================================================
  // 4. KDV İADE ALGORİTMALARI  (eksik #3, #4, tevkifat)
  // ===================================================================
  // 4.1 İhracat istisnası (KDVK 11/1-a). Önce mahsup (360/361 + tüm borçlar),
  //     kalan nakden. Mahsup edilen nakit üst sınırına dahil edilmez.
  function iadeIhracat(iadeHakki, mahsubaAdayBorclar, opts) {
    opts = opts || {};
    const { tamTasdik = false, hizlandirilmis = false, yil = 2026 } = opts;
    const mahsup = Math.min(iadeHakki, mahsubaAdayBorclar);
    const kalan = r2(iadeHakki - mahsup);
    let ymm, teminat = false, bloke = 0, not;
    if (hizlandirilmis) {
      ymm = false;
      not = "HİS/İTUS: teminat, inceleme ve YMM raporu aranmaz.";
    } else if (tamTasdik) {
      ymm = kalan > 0;
      not = "Tam tasdik var: YMM raporu ile nakit iade üst sınırsız.";
    } else {
      const ust = param("IHRACAT_TAMTASDIKSIZ_NAKIT_UST_SINIR", yil);
      ymm = kalan > 0;
      teminat = kalan > ust;
      bloke = teminat ? r2(kalan - ust) : 0;
      not = `Tam tasdik yok: YMM nakit üst sınırı ${ust.toLocaleString("tr-TR")} TL; aşan kısım teminat/inceleme.`;
    }
    return { iadeTuru: "IHRACAT_11_1_A", iadeEdilebilir: r2(iadeHakki),
             mahsupEdilen: r2(mahsup), nakden: kalan,
             ymmRaporuGerekli: ymm, teminatGerekli: teminat, blokeNakit: bloke, not };
  }

  // 4.2 İndirimli orana tabi iade (KDVK 29/2) — kümülatif yöntem
  function iadeIndirimliOran(kumYuklenilen, kumHesaplanan, oncekiMahsup, devredenKdv, opts) {
    opts = opts || {};
    const { yil = 2026, yilIci = true } = opts;
    const altSinir = param("INDIRIMLI_ORAN_IADE_ALT_SINIR", yil);
    const fark = r2(kumYuklenilen - kumHesaplanan);
    const talep = r2(fark - altSinir - oncekiMahsup);
    if (talep <= 0 || devredenKdv <= 0) {
      return { iadeTuru: "INDIRIMLI_ORAN_29_2", iadeEdilebilir: 0, mahsupEdilen: 0,
               nakden: 0, ymmRaporuGerekli: false, blokeNakit: 0,
               not: `Alt sınır (${altSinir.toLocaleString("tr-TR")} TL) aşılmadı / devreden KDV yok: iade doğmadı.` };
    }
    const iade = Math.min(talep, devredenKdv);
    if (yilIci)
      return { iadeTuru: "INDIRIMLI_ORAN_29_2", iadeEdilebilir: r2(iade),
               mahsupEdilen: r2(iade), nakden: 0, ymmRaporuGerekli: false, blokeNakit: 0,
               not: "Yıl içi: yalnızca MAHSUBEN (en erken Ocak/Şubat, en geç Kasım/Aralık beyanı)." };
    return { iadeTuru: "INDIRIMLI_ORAN_29_2", iadeEdilebilir: r2(iade),
             mahsupEdilen: 0, nakden: r2(iade), ymmRaporuGerekli: true, blokeNakit: 0,
             not: "İzleyen yıl: nakden veya mahsuben (YMM/teminat tebliğ hadlerine göre)." };
  }

  // 4.3 Tevkifat (kısmi) — satıcı iadesi
  function iadeTevkifat(tevkifEdilenToplam, mahsubaAdayBorclar) {
    const mahsup = Math.min(tevkifEdilenToplam, mahsubaAdayBorclar);
    const nakden = r2(tevkifEdilenToplam - mahsup);
    return { iadeTuru: "TEVKIFAT", iadeEdilebilir: r2(tevkifEdilenToplam),
             mahsupEdilen: r2(mahsup), nakden, ymmRaporuGerekli: nakden > 0, blokeNakit: 0,
             not: "Satıcı iadesi: önce mahsup, kalan nakden (tevkifat hadleri dahilinde)." };
  }

  // ===================================================================
  // 5. KAMBİYO DEĞERLEME  (646/656, realize vs gayri-nakdi)
  // ===================================================================
  function kurDegerle(hesapKodu, dovizBakiye, oncekiKur, degerlemeKuru, realize) {
    let fark = r2((degerlemeKuru - oncekiKur) * dovizBakiye);
    const aktif = String(hesapKodu)[0] === "1";
    if (!aktif) fark = r2(-fark); // pasif (320): kur ↑ -> borç büyür -> zarar
    return { hesap: String(hesapKodu), dovizBakiye, oncekiKur, degerlemeKuru,
             farkTl: fark, karsiHesap: fark >= 0 ? "646" : "656",
             realize: realize ? "REALIZE" : "GAYRI_NAKDI" };
  }

  // ===================================================================
  // 6. NAKİT AKIŞ ENTEGRASYONU  (5Y projeksiyona vergi çıkışları üret)
  // ===================================================================
  // donemTutarlari: { 'KDV1': {'2026-02': 50000, ...}, 'SGK_PRIM': {...}, ... }
  // -> her yükümlülük için EFEKTİF tarihte negatif nakit kalem üretir.
  function vergiTakvimiNakitKalemleri(donemTutarlari) {
    const kalemler = [];
    for (const tip of Object.keys(donemTutarlari)) {
      for (const donem of Object.keys(donemTutarlari[tip])) {
        const [y, a] = donem.split("-").map(Number);
        const { efektif } = yukumlulukGunu(tip, y, a);
        kalemler.push({
          tip, donem, tarih: fmt(efektif),
          tutar: -Math.abs(donemTutarlari[tip][donem]), yon: "CIKIS",
        });
      }
    }
    return kalemler.sort((p, q) => p.tarih.localeCompare(q.tarih));
  }

  return {
    r2, VERGI_PARAMETRE, param, YUKUMLULUK_SABLONU,
    fmt, resmiTatiller, diniBayramEkle, maliTatil, isGunuMu, efektifSonGun, yukumlulukGunu,
    mapHesapToYukumluluk,
    faturaKdv, tevkifEdilen, saticiBeyan, kdvUzlastir,
    iadeIhracat, iadeIndirimliOran, iadeTevkifat,
    kurDegerle, vergiTakvimiNakitKalemleri,
  };
});
