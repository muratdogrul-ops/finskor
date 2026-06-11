/** NakitFlow — FinSkor mali import ön tanımlar (core.js öncesi) */

/** Tüm KDV tahakkuku / projeksiyon oranı (TDHP’den bağımsız tek oran). */
const FINSKOR_KDV_ORAN_PCT = 20;

function finskorKdvOraniPct() {
  return FINSKOR_KDV_ORAN_PCT;
}

const HESAPLAR = [
  { type: 'cat', label: 'I. DÖNEN VARLIKLAR' },
  { key: 'hazirDegerler', label: '10. Hazır Değerler', isTotal: false },
  { key: 'menkKiymetler', label: '11. Menkul Kıymetler', isTotal: false },
  { key: 'ticAlacaklar', label: '12. Ticari Alacaklar', isTotal: false },
  { key: 'digerAlacaklar', label: '13. Diğer Alacaklar', isTotal: false },
  { key: 'stoklar', label: '15. Stoklar', isTotal: false },
  { key: 'yilYayginMal', label: '17. Yıllara Yaygın İnşaat Maliyetleri', isTotal: false },
  { key: 'gelecekAyGider', label: '18. Gelecek Aylara Ait Giderler', isTotal: false },
  { key: 'indirilecekKdv', label: '191. İndirilecek KDV', isTotal: false },
  { key: 'devredenKdv', label: '190. Devreden KDV', isTotal: false },
  { key: 'digerDonen', label: '19. Diğer Dönen Varlıklar', isTotal: false },
  { key: 'donenVarlik', label: '▶ DÖNEN VARLIK TOPLAMI', isTotal: true },
  { type: 'cat', label: 'II. DURAN VARLIKLAR' },
  { key: 'uzunTicAlacak', label: '22. Ticari Alacaklar', isTotal: false },
  { key: 'uzunDigAlacak', label: '23. Diğer Alacaklar', isTotal: false },
  { key: 'maliDuranVar', label: '24. Mali Duran Varlıklar', isTotal: false },
  { key: 'maddiDuranVar', label: '25. Maddi Duran Varlıklar', isTotal: false },
  { key: 'maddiOlmayan', label: '26. Maddi Olmayan Duran Varlıklar', isTotal: false },
  { key: 'ozelTukenme', label: '27. Özel Tükenmeye Tabi Varlıklar', isTotal: false },
  { key: 'gelecekYilGider', label: '28. Gelecek Yıllara Ait Giderler', isTotal: false },
  { key: 'digerDuran', label: '29. Diğer Duran Varlıklar', isTotal: false },
  { key: 'duranVarlik', label: '▶ DURAN VARLIK TOPLAMI', isTotal: true },
  { key: 'aktifToplam', label: '▶▶ AKTİF TOPLAM', isTotal: true },
  { type: 'cat', label: 'III. KISA VADELİ YABANCI KAYNAKLAR' },
  { key: 'kvMaliBorclar', label: '30. Mali Borçlar', isTotal: false },
  { key: 'kvTicBorclar', label: '32. Ticari Borçlar', isTotal: false },
  { key: 'kvDigBorclar', label: '33. Diğer Borçlar', isTotal: false },
  { key: 'alinanAvans', label: '34. Alınan Avanslar', isTotal: false },
  { key: 'yilHakediş', label: '35. Yıllara Yaygın Hakedişler', isTotal: false },
  { key: 'odenecekVergi', label: '36. Ödenecek Vergi ve Yükümlülükler', isTotal: false },
  { key: 'borcKarsilik', label: '37. Borç ve Gider Karşılıkları', isTotal: false },
  { key: 'gelecekAyGelir', label: '38. Gelecek Aylara Ait Gelirler', isTotal: false },
  { key: 'hesaplananKdv', label: '391–393 Hesaplanan KDV', isTotal: false },
  { key: 'digerKvYK', label: '39. Diğer KV Yabancı Kaynaklar', isTotal: false },
  { key: 'kvYKToplam', label: '▶ KV YABANCI KAYNAK TOPLAMI', isTotal: true },
  { type: 'cat', label: 'IV. UZUN VADELİ YABANCI KAYNAKLAR' },
  { key: 'uvMaliBorclar', label: '40. Mali Borçlar', isTotal: false },
  { key: 'uvTicBorclar', label: '42. Ticari Borçlar', isTotal: false },
  { key: 'uvDigBorclar', label: '43. Diğer Borçlar', isTotal: false },
  { key: 'uvAlinanAvans', label: '44. Alınan Avanslar', isTotal: false },
  { key: 'uvBorcKarsilik', label: '47. Borç ve Gider Karşılıkları', isTotal: false },
  { key: 'uvDigYK', label: '49. Diğer Yabancı Kaynaklar', isTotal: false },
  { key: 'uvYKToplam', label: '▶ UV YABANCI KAYNAK TOPLAMI', isTotal: true },
  { type: 'cat', label: 'V. ÖZ KAYNAKLAR' },
  { key: 'odenmisSermaye', label: '50. Ödenmiş Sermaye', isTotal: false },
  { key: 'sermaYedek', label: '52. Sermaye Yedekleri', isTotal: false },
  { key: 'karYedek', label: '54. Kar Yedekleri', isTotal: false },
  { key: 'gecmisKar', label: '57. Geçmiş Yıllar Karları', isTotal: false },
  { key: 'gecmisZarar', label: '58. Geçmiş Yıllar Zararları (-)', isTotal: false },
  { key: 'donemNetKar', label: '59. Dönem Net Karı (Zararı)', isTotal: false },
  { key: 'ozKaynak', label: '▶ ÖZ KAYNAK TOPLAMI', isTotal: true },
  { key: 'pasifToplam', label: '▶▶ PASİF TOPLAM', isTotal: true },
  { type: 'cat', label: 'GELİR TABLOSU' },
  { key: 'brutSatis', label: '60. Brüt Satışlar', isTotal: false },
  { key: 'satisInd', label: '61. Satış İndirimleri (-)', isTotal: false },
  { key: 'netSatis', label: '▶ NET SATIŞLAR', isTotal: true },
  { key: 'satMaliyet', label: '62. Satışların Maliyeti (-)', isTotal: false },
  { key: 'brutSatisKar', label: '▶ BRÜT SATIŞ KARI', isTotal: true },
  { key: 'faalGider', label: '63. Faaliyet Giderleri (-)', isTotal: false },
  { key: 'faalKar', label: '▶ FAALİYET KARI', isTotal: true },
  { key: 'digerFaalGelir', label: '64. Diğer Faaliyet Gelirleri', isTotal: false },
  { key: 'digerFaalGider', label: '65. Diğer Faaliyet Giderleri (-)', isTotal: false },
  { key: 'finansmanGider', label: '66. Finansman Giderleri (-)', isTotal: false },
  { key: 'olagan', label: '▶ OLAĞAN KAR / ZARAR', isTotal: true },
  { key: 'olagandisiGelir', label: '67. Olağandışı Gelirler', isTotal: false },
  { key: 'olagandisiGider', label: '68. Olağandışı Giderler (-)', isTotal: false },
  { key: 'donemKar', label: '▶ DÖNEM KARI / ZARARI', isTotal: true },
  { key: 'vergiKarsilik', label: '69. Vergi Karşılığı (-)', isTotal: false },
  { key: 'donemNetKarGelir', label: '▶▶ DÖNEM NET KARI / ZARARI', isTotal: true },
];
function bilancoEtiketNumsiz(label) {
  return String(label || '').trim();
}
function applyParsedToYear() {}
function showToast() {}
function hideImportModal() {}
function fmtN() {
  return '';
}
function normalizeOrtakAlacak131(d) {
  if (!d) return;
  const v = Math.max(0, Number(d.ortakAlacak131) || 0);
  if (v > 0) {
    d.ortakAlacak131 = 0;
    // Tenzili kalıcı sakla: finSkorOzKaynakVePasif ozKaynak'ı alt kalemlerden
    // yeniden hesaplayıp buradaki düşmeyi eziyordu → tenzil _ortak131Tenzil'de izlenir
    d._ortak131Tenzil = (Number(d._ortak131Tenzil) || 0) + v;
    d.ozKaynak = Math.max(0, (Number(d.ozKaynak) || 0) - v);
  }
}
function ticBorclarEtkinKvUv(year, row) {
  const kv = parseFloat((row && row.kvTicBorclar) || 0) || 0;
  const uv = parseFloat((row && row.uvTicBorclar) || 0) || 0;
  if (year === 2025) return { kvTic: kv + uv, uvTic: 0 };
  return { kvTic: kv, uvTic: uv };
}

/** Kurumlar beyannamesi: "Enflasyon Düzeltmesi Sonrası" sütunlu bilanço */
function maliInflationBeyanDetected(d) {
  return !!(d && (d._enflasyonSonrasiBilanco || d.enflasyonSonrasiBilanco));
}

/**
 * Öz kaynak toplamına eklenecek dönem net kar.
 * Enflasyon sonrası bilançoda dönem net 0 ise gelir tablosu neti EKLENMEZ (çift sayım önlenir).
 */
function maliEffectiveDonemNetForOzKaynak(d) {
  if (!d) return 0;
  if (maliInflationBeyanDetected(d)) {
    if (d.donemNetKarBilanco != null && d.donemNetKarBilanco !== '') {
      return Number(d.donemNetKarBilanco) || 0;
    }
    return Number(d.donemNetKar) || 0;
  }
  if (d._mizan590591Eksik) {
    const g = Number(d.donemNetKarGelir);
    if (Math.abs(g) >= 1) return g;
  }
  const bil = Number(d.donemNetKar) || 0;
  if (Math.abs(bil) >= 1) return bil;
  return Number(d.donemNetKarGelir) || 0;
}

/** Parse sonrası: enflasyon beyan'da donemNetKar = bilanço; gelir neti yalnızca donemNetKarGelir */
function maliNormalizeDonemNetForOzkaynak(d, year) {
  if (!d) return;
  const y = year || new Date().getFullYear();
  const pdfDonemKar = d.donemKar;
  const pdfDonemNetKar = d.donemNetKar;
  const pdfDonemNetKarGelir = d.donemNetKarGelir;
  if (maliInflationBeyanDetected(d)) {
    if (d.donemNetKarBilanco != null && d.donemNetKarBilanco !== '') {
      d.donemNetKar = Number(d.donemNetKarBilanco) || 0;
    } else {
      d.donemNetKar = Number(d.donemNetKar) || 0;
    }
    if (pdfDonemNetKarGelir != null && pdfDonemNetKarGelir !== '' && pdfDonemNetKarGelir !== 0) {
      d.donemNetKarGelir = Number(pdfDonemNetKarGelir);
    }
    return;
  }
  const hadMizanDonem =
    d._mizan590591 &&
    ((pdfDonemNetKar != null && pdfDonemNetKar !== 0) || (pdfDonemKar != null && pdfDonemKar !== 0));
  if (d.brutSatis || d.satMaliyet || d.faalGider) {
    const netSatisYeni = (d.brutSatis || 0) - (d.satisInd || 0);
    if (!d.netSatis || netSatisYeni > 0) d.netSatis = netSatisYeni;
    d.brutSatisKar = (d.netSatis || 0) - (d.satMaliyet || 0);
    d.faalKar = (d.brutSatisKar || 0) - (d.faalGider || 0);
    d.olagan =
      (d.faalKar || 0) + (d.digerFaalGelir || 0) - (d.digerFaalGider || 0) - (d.finansmanGider || 0);
    if (pdfDonemKar == null || pdfDonemKar === 0) {
      d.donemKar = (d.olagan || 0) + (d.olagandisiGelir || 0) - (d.olagandisiGider || 0);
    }
    if (!hadMizanDonem && (pdfDonemNetKar == null || pdfDonemNetKar === 0)) {
      d.donemNetKar = (d.donemKar || 0) - (d.vergiKarsilik || 0);
      d.donemNetKarGelir = d.donemNetKar;
    }
  }
  if (pdfDonemKar != null && pdfDonemKar !== 0) d.donemKar = pdfDonemKar;
  if (pdfDonemNetKar != null && pdfDonemNetKar !== 0) {
    d.donemNetKar = pdfDonemNetKar;
    d.donemNetKarGelir = pdfDonemNetKarGelir != null ? pdfDonemNetKarGelir : pdfDonemNetKar;
  } else if (pdfDonemKar != null && pdfDonemKar !== 0 && d.vergiKarsilik != null) {
    d.donemNetKar = pdfDonemKar - (d.vergiKarsilik || 0);
    d.donemNetKarGelir = d.donemNetKar;
  }
  if (d._mizan590591Eksik) {
    const g = Number(d.donemNetKarGelir);
    if (Math.abs(g) >= 1) d.donemNetKar = g;
  }
}

/** Nakit likidite: kasa + banka + diğer hazır (108) + menkul (101/103 hariç) */
function nakitLikiditeToplam(d) {
  if (!d) return 0;
  return (Number(d.hazirDegerler) || 0) + (Number(d.menkKiymetler) || 0);
}

/** Öz kaynak + pasif toplam — dönem net kar (gelir tablosu) hesaplandıktan SONRA çağrılmalı */
function finSkorOzKaynakVePasif(d) {
  if (!d) return;
  const sum = (...keys) => keys.reduce((t, k) => t + (Number(d[k]) || 0), 0);
  const ortak131Tenzil = Math.max(0, d.ortakAlacak131 || 0) + Math.max(0, Number(d._ortak131Tenzil) || 0);
  const donemOz = maliEffectiveDonemNetForOzKaynak(d);
  const ozAlt =
    sum('odenmisSermaye', 'sermaYedek', 'karYedek', 'gecmisKar') +
    donemOz -
    (Number(d.gecmisZarar) || 0) -
    ortak131Tenzil;
  d.ozKaynak = Math.abs(ozAlt) > 0 ? ozAlt : d.ozKaynak || 0;
  d.pasifToplam = (Number(d.kvYKToplam) || 0) + (Number(d.uvYKToplam) || 0) + (Number(d.ozKaynak) || 0);
}

/**
 * Mizan parse sonrası: öz kaynakta çift yazılmış dönem neti (59 özet + 590 detay vb.) varsa düzelt.
 * İki/üç haneli özet atlama sonrası kalan küçük farklar için güvenlik ağı.
 */
function maliBilancoFarkDuzelt(d, year) {
  if (!d) return;
  const y = year || new Date().getFullYear();
  hesapToplamlarOnObject(d, y);
  let fark = (Number(d.aktifToplam) || 0) - (Number(d.pasifToplam) || 0);
  if (Math.abs(fark) < 1) return;

  const dnk = Number(d.donemNetKar) || 0;
  const dnkG = Number(d.donemNetKarGelir) || Number(d.donemNetKar) || 0;

  if (d._mizan590591 && Math.abs(dnk) >= 1 && Math.abs(Math.abs(fark) - Math.abs(dnk)) < 1000) {
    d.donemNetKar = dnk + fark;
    if (dnkG && Math.abs(dnkG - dnk) < 1000) d.donemNetKarGelir = dnkG;
    else if (dnkG) d.donemNetKarGelir = dnkG;
    d.donemNetKarBilanco = d.donemNetKar;
    d._mizanBilancoFarkDuzeltildi = 'donem-net-cift';
    finSkorOzKaynakVePasif(d);
    hesapToplamlarOnObject(d, y);
  }
}

function hesapToplamlarOnObject(d, year) {
  if (!d) return;
  const y = year || new Date().getFullYear();
  const sum = (...keys) => keys.reduce((t, k) => t + (Number(d[k]) || 0), 0);
  const donenYeni = sum(
    'hazirDegerler',
    'menkKiymetler',
    'ticAlacaklar',
    'digerAlacaklar',
    'stoklar',
    'yilYayginMal',
    'gelecekAyGider',
    'indirilecekKdv',
    'devredenKdv',
    'digerDonen',
  );
  if (!d.donenVarlik || donenYeni > d.donenVarlik) d.donenVarlik = donenYeni;
  const duranYeni = sum(
    'uzunTicAlacak',
    'uzunDigAlacak',
    'maliDuranVar',
    'maddiDuranVar',
    'maddiOlmayan',
    'ozelTukenme',
    'gelecekYilGider',
    'digerDuran',
  );
  if (!d.duranVarlik || duranYeni > d.duranVarlik) d.duranVarlik = duranYeni;
  d.aktifToplam = (d.donenVarlik || 0) + (d.duranVarlik || 0);
  const { kvTic: kvTicEff, uvTic: uvTicEff } = ticBorclarEtkinKvUv(y, d);
  const kvAlt =
    sum(
      'kvMaliBorclar',
      'kvDigBorclar',
      'alinanAvans',
      'yilHakediş',
      'odenecekVergi',
      'borcKarsilik',
      'gelecekAyGelir',
      'hesaplananKdv',
      'digerKvYK',
    ) + kvTicEff;
  d.kvYKToplam = kvAlt > 0 ? kvAlt : d.kvYKToplam || 0;
  const uvAlt =
    sum('uvMaliBorclar', 'uvDigBorclar', 'uvAlinanAvans', 'uvBorcKarsilik', 'uvDigYK') + uvTicEff;
  d.uvYKToplam = uvAlt > 0 ? uvAlt : d.uvYKToplam || 0;
  maliNormalizeDonemNetForOzkaynak(d, y);
  normalizeOrtakAlacak131(d);
  finSkorOzKaynakVePasif(d);
}
