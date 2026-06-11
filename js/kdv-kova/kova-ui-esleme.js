/* =====================================================================
 * kova-ui-esleme.js
 * Sektör alış kalemlerini NakitFlow'un 4 kova ÖZETİNE eşler (raw/pack/energy/other)
 * + ayrı OPEX. Bu YALNIZCA UI özetidir; gerçek hesap urunKirilimi/hesapla()'dır.
 *
 * Ağırlıklı oran (SMM kovaları): Σ(pay.tipik × oran) / Σ(pay.tipik).
 * OPEX (faalGider) SMM kovalarına KARIŞMAZ; ayrı opexRate verilir.
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.KovaUiEsleme = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const pt = (x) => (typeof x.pay === "object" && x.pay ? x.pay.tipik : x.pay);

  // girdiKodu -> UI kovası deseni
  function uiKova(girdiKodu) {
    const k = String(girdiKodu).toUpperCase();
    if (/AMBALAJ|CUVAL|BIGBAG|KRAFT|KOLI/.test(k)) return "pack";
    if (/ENERJI|AKARYAKIT|ELEKTRIK|DOGALGAZ|YAKIT/.test(k)) return "energy";
    if (/HAMMADDE|CIG|CIVCIL|TAVUK|DAMIZLIK|TAHIL|BUGDAY|TICARI_MAL|FINDIK|HURDA|CEVHER|SUT|ET_HAMMADDE|YEM|MUSTAHSIL/.test(k)) return "raw";
    if (/KDVSIZ/.test(k)) return "other"; // KDV'siz maliyet -> other (oran 0)
    return "other"; // ISLEME/ISCILIK/NAKLIYE/YARDIMCI/KIMYASAL/FASON/KATKI/ILAC/GUBRE...
  }

  function agirlikliOran(kalemler) {
    const payT = kalemler.reduce((s, x) => s + pt(x), 0);
    if (payT === 0) return { pay: 0, oran: 0 };
    const wsum = kalemler.reduce((s, x) => s + pt(x) * x.kdvOrani, 0);
    return { pay: Math.round(payT * 1000) / 1000, oran: Math.round((wsum / payT) * 100) / 100,
             kalemSayisi: kalemler.length };
  }

  /**
   * @param sektor sektör JSON
   * @returns { raw, pack, energy, other, opex } — her biri {pay, oran, kalemSayisi}
   *   raw/pack/energy/other: SMM (matrahKaynagi=satMaliyet) kovaları, ağırlıklı oran
   *   opex: faalGider kalemleri (ayrı taban), ağırlıklı oran
   */
  function esle(sektor) {
    const smm = sektor.alisKalemleri.filter((x) => x.matrahKaynagi === "satMaliyet");
    const opex = sektor.alisKalemleri.filter((x) => x.matrahKaynagi === "faalGider");
    const grup = { raw: [], pack: [], energy: [], other: [] };
    for (const x of smm) grup[uiKova(x.girdiKodu)].push(x);
    return {
      sektorId: sektor.sektorMeta.id,
      raw: agirlikliOran(grup.raw),
      pack: agirlikliOran(grup.pack),
      energy: agirlikliOran(grup.energy),
      other: agirlikliOran(grup.other),
      opex: { ...agirlikliOran(opex), not: "OPEX faaliyet gideri tabanına uygulanır; SMM kovalarına karışmaz." },
      uyari: "Bu 4 kova SADECE UI özetidir. Gerçek hesap urunKirilimi + hesapla() çıktısıdır; tek satıra indirgemeyin.",
    };
  }

  // Yanlış kullanım göstergesi: tüm SMM'i tek 'hammadde' satırına ezerse oran ne çıkar?
  function yanlisTekSatir(sektor) {
    const smm = sektor.alisKalemleri.filter((x) => x.matrahKaynagi === "satMaliyet");
    const o = agirlikliOran(smm); // tüm SMM ağırlıklı tek oran
    return { tekSatirOran: o.oran,
      not: `YANLIŞ: tüm SMM'i tek 'hammadde @%${o.oran}' satırına ezmek, hammadde gerçek oranını (örn gıda %1) ve ambalaj/enerji %20'yi gizler; indirilecek KDV'yi ve iade/devreden pozisyonunu bozar.` };
  }

  return { esle, uiKova, agirlikliOran, yanlisTekSatir };
});
