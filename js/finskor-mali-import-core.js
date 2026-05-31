// ═══════════════════════════════════════════════════════════════════
// MALİ VERİ IMPORT SİSTEMİ v2
// MİZAN (Excel) ve PDF dosyalarından bilanço verisi otomatik okuma
// Desteklenen format: Hesap Kodu | Hesap Adı | Borç | Alacak | Borç Bakiyesi
// ═══════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// HESAP KODU → SİSTEM KEY MAPPING
// Her key için hangi 3 haneli hesap kodları toplanacak
// ─────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════
// MASTER HESAP MAPPING - BİLANÇO_HESAPLARI.docx + 2025_spread.xlsx
// ═══════════════════════════════════════════════════════════════════

// (-) işaretli hesaplar: masterdan alınan tam liste
const MINUS_KODLAR = new Set([
  103,119,122,124,129,137,139,158,199,
  222,224,229,237,239,241,243,244,246,247,249,
  257,268,278,298,299,
  302,308,322,337,371,402,408,422,437,
  501,503,
  580,581,589,591,   // Geçmiş yıllar zararları + dönem net zararı
  610,611,612,
  620,621,622,623,
  630,631,632,
  653,654,655,656,657,658,659,
  660,661,
  680,681,689,691
]);

// 3 haneli hesap kodu → sistem key'i
// AKTİF 100-299, PASİF 300-591, GELİR 600-699
const KOD_TO_KEY = {
  // HAZIR DEĞERLER
  100:'hazirDegerler', 101:'hazirDegerler', 102:'hazirDegerler',
  103:'hazirDegerler', 108:'hazirDegerler',
  // MENKUL KIYMETLER
  110:'menkKiymetler', 111:'menkKiymetler', 112:'menkKiymetler',
  118:'menkKiymetler', 119:'menkKiymetler',
  // TİCARİ ALACAKLAR
  120:'ticAlacaklar', 121:'ticAlacaklar', 122:'ticAlacaklar',
  124:'ticAlacaklar', 126:'ticAlacaklar', 127:'ticAlacaklar',
  128:'ticAlacaklar', 129:'ticAlacaklar',
  // DİĞER ALACAKLAR
  131:'digerAlacaklar', 132:'digerAlacaklar', 133:'digerAlacaklar',
  135:'digerAlacaklar', 136:'digerAlacaklar', 137:'digerAlacaklar',
  138:'digerAlacaklar', 139:'digerAlacaklar',
  // STOKLAR
  150:'stoklar', 151:'stoklar', 152:'stoklar', 153:'stoklar',
  157:'stoklar', 158:'stoklar', 159:'stoklar',
  // YILLARA YAYGIN
  170:'yilYayginMal', 171:'yilYayginMal', 172:'yilYayginMal',
  173:'yilYayginMal', 174:'yilYayginMal', 175:'yilYayginMal',
  176:'yilYayginMal', 177:'yilYayginMal',
  178:'yilYayginMal', 179:'yilYayginMal',
  // GELECEK AY GİDERLER
  180:'gelecekAyGider', 181:'gelecekAyGider',
  // DİĞER DÖNEN VARLIKLAR
  190:'digerDonen', 191:'digerDonen', 192:'digerDonen',
  193:'digerDonen', 195:'digerDonen', 196:'digerDonen',
  197:'digerDonen', 198:'digerDonen', 199:'digerDonen',
  // UZUN TİCARİ ALACAKLAR
  220:'uzunTicAlacak', 221:'uzunTicAlacak', 222:'uzunTicAlacak',
  224:'uzunTicAlacak', 226:'uzunTicAlacak', 229:'uzunTicAlacak',
  // UZUN DİĞER ALACAKLAR
  231:'uzunDigAlacak', 232:'uzunDigAlacak', 233:'uzunDigAlacak',
  235:'uzunDigAlacak', 236:'uzunDigAlacak', 237:'uzunDigAlacak',
  238:'uzunDigAlacak', 239:'uzunDigAlacak',
  // MALİ DURAN VARLIKLAR
  240:'maliDuranVar', 241:'maliDuranVar', 242:'maliDuranVar',
  243:'maliDuranVar', 244:'maliDuranVar', 245:'maliDuranVar',
  246:'maliDuranVar', 247:'maliDuranVar', 248:'maliDuranVar',
  249:'maliDuranVar',
  // MADDİ DURAN VARLIKLAR (257,258 dahil - 257 MINUS → negatif)
  250:'maddiDuranVar', 251:'maddiDuranVar', 252:'maddiDuranVar',
  253:'maddiDuranVar', 254:'maddiDuranVar', 255:'maddiDuranVar',
  256:'maddiDuranVar', 257:'maddiDuranVar', 258:'maddiDuranVar',
  259:'maddiDuranVar',
  // MADDİ OLMAYAN DURAN VARLIKLAR (268 dahil - MINUS → negatif)
  260:'maddiOlmayan', 261:'maddiOlmayan', 262:'maddiOlmayan',
  263:'maddiOlmayan', 264:'maddiOlmayan', 267:'maddiOlmayan',
  268:'maddiOlmayan', 269:'maddiOlmayan',
  // ÖZEL TÜKENME
  271:'ozelTukenme', 272:'ozelTukenme', 277:'ozelTukenme',
  278:'ozelTukenme', 279:'ozelTukenme',
  // GELECEK YIL GİDER
  280:'gelecekYilGider', 281:'gelecekYilGider',
  // DİĞER DURAN VARLIKLAR
  291:'digerDuran', 292:'digerDuran', 293:'digerDuran',
  294:'digerDuran', 295:'digerDuran',
  296:'digerDuran', // 6736 sayılı kanun düzeltme hesabı vb.; PDF satırı sık: "296 6736 SAYILI KANUN…"
  297:'digerDuran', 298:'digerDuran', 299:'digerDuran',
  // KV MALİ BORÇLAR
  300:'kvMaliBorclar', 301:'kvMaliBorclar', 302:'kvMaliBorclar',
  303:'kvMaliBorclar', 304:'kvMaliBorclar', 305:'kvMaliBorclar',
  306:'kvMaliBorclar', 308:'kvMaliBorclar', 309:'kvMaliBorclar',
  // KV TİCARİ BORÇLAR
  320:'kvTicBorclar', 321:'kvTicBorclar', 322:'kvTicBorclar',
  326:'kvTicBorclar', 329:'kvTicBorclar',
  // KV DİĞER BORÇLAR
  331:'kvDigBorclar', 332:'kvDigBorclar', 333:'kvDigBorclar',
  335:'kvDigBorclar', 336:'kvDigBorclar', 337:'kvDigBorclar',
  // ALINAN AVANSLAR
  340:'alinanAvans', 349:'alinanAvans',
  // YIL YAY. HAKEDIŞ
  350:'yilHakediş', 351:'yilHakediş', 352:'yilHakediş',
  353:'yilHakediş', 354:'yilHakediş', 355:'yilHakediş',
  356:'yilHakediş', 357:'yilHakediş', 358:'yilHakediş', 359:'yilHakediş',
  // ÖDENECEK VERGİ
  360:'odenecekVergi', 361:'odenecekVergi', 368:'odenecekVergi', 369:'odenecekVergi',
  // BORÇ KARŞILIK
  370:'borcKarsilik', 371:'borcKarsilik', 372:'borcKarsilik',
  373:'borcKarsilik', 379:'borcKarsilik',
  // GELECEK AY GELİR
  380:'gelecekAyGelir', 381:'gelecekAyGelir',
  // DİĞER KV
  391:'digerKvYK', 392:'digerKvYK', 393:'digerKvYK',
  397:'digerKvYK', 399:'digerKvYK',
  // UV MALİ BORÇLAR
  400:'uvMaliBorclar', 401:'uvMaliBorclar', 402:'uvMaliBorclar',
  405:'uvMaliBorclar', 407:'uvMaliBorclar', 408:'uvMaliBorclar',
  409:'uvMaliBorclar',
  // UV TİCARİ BORÇLAR
  420:'uvTicBorclar', 421:'uvTicBorclar', 422:'uvTicBorclar',
  426:'uvTicBorclar', 429:'uvTicBorclar',
  // UV DİĞER BORÇLAR
  431:'uvDigBorclar', 432:'uvDigBorclar', 433:'uvDigBorclar',
  436:'uvDigBorclar', 437:'uvDigBorclar', 438:'uvDigBorclar',
  // UV ALINAN AVANS
  440:'uvAlinanAvans', 449:'uvAlinanAvans',
  // UV BORÇ KARŞILIK
  472:'uvBorcKarsilik', 479:'uvBorcKarsilik',
  // UV GELİR
  480:'uvDigYK', 481:'uvDigYK',
  // UV DİĞER
  492:'uvDigYK', 493:'uvDigYK', 499:'uvDigYK',
  // ÖDENMİŞ SERMAYE (50)
  // 500: Sermaye → pozitif katkı
  // 501: Ödenmemiş Sermaye (-) → MINUS_KODLAR'da, negatif katkı
  // 502: Sermaye Düzeltmesi Olumlu Farkları → pozitif katkı → odenmisSermaye'ye
  // 503: Sermaye Düzeltmesi Olumsuz Farkları (-) → MINUS_KODLAR'da, negatif katkı → odenmisSermaye'ye
  500:'odenmisSermaye', 501:'odenmisSermaye', 502:'odenmisSermaye', 503:'odenmisSermaye',
  // SERMAYE YEDEKLERİ (52)
  // 520: Hisse Senedi İhraç Primleri
  // 521: Hisse Senedi İptal Karları
  // 522: MDV Yeniden Değerleme Artışları
  // 523: İştirakler Yeniden Değerleme Artışları
  // 524: Maliyet Artışları Fonu
  // 529: Diğer Sermaye Yedekleri
  520:'sermaYedek', 521:'sermaYedek', 522:'sermaYedek',
  523:'sermaYedek', 524:'sermaYedek', 525:'sermaYedek',
  526:'sermaYedek', 528:'sermaYedek', 529:'sermaYedek',
  // KAR YEDEKLERİ (54)
  // 540: Yasal Yedekler
  // 541: Statü Yedekleri
  // 542: Olağanüstü Yedekler
  // 548: Diğer Kar Yedekleri
  // 549: Özel Fonlar
  540:'karYedek', 541:'karYedek', 542:'karYedek',
  543:'karYedek', 544:'karYedek', 548:'karYedek', 549:'karYedek',
  // GEÇMİŞ YILLAR KARLARI (57)
  // 570: Geçmiş Yıllar Karları
  570:'gecmisKar', 571:'gecmisKar', 575:'gecmisKar', 579:'gecmisKar',
  // GEÇMİŞ YILLAR ZARARLARI (58) — MINUS_KODLAR'da
  // 580: Geçmiş Yıllar Zararları (-)
  580:'gecmisZarar', 581:'gecmisZarar', 589:'gecmisZarar',
  // DÖNEM NET KARI/ZARARI (59)
  // 590: Dönem Net Karı
  // 591: Dönem Net Zararı (-) → MINUS_KODLAR'da
  590:'donemNetKar', 591:'donemNetKar',
  // GELİR TABLOSU
  600:'brutSatis', 601:'brutSatis', 602:'brutSatis',
  610:'satisInd', 611:'satisInd', 612:'satisInd',
  620:'satMaliyet', 621:'satMaliyet', 622:'satMaliyet', 623:'satMaliyet',
  630:'faalGider', 631:'faalGider', 632:'faalGider',
  640:'digerFaalGelir', 641:'digerFaalGelir', 642:'digerFaalGelir',
  643:'digerFaalGelir', 644:'digerFaalGelir', 645:'digerFaalGelir',
  646:'digerFaalGelir', 647:'digerFaalGelir', 648:'digerFaalGelir', 649:'digerFaalGelir',
  653:'digerFaalGider', 654:'digerFaalGider', 655:'digerFaalGider',
  656:'digerFaalGider', 657:'digerFaalGider', 658:'digerFaalGider', 659:'digerFaalGider',
  660:'finansmanGider', 661:'finansmanGider',
  671:'olagandisiGelir', 679:'olagandisiGelir',
  680:'olagandisiGider', 681:'olagandisiGider', 689:'olagandisiGider',
  690:'donemKar',
  691:'vergiKarsilik',
  692:'donemNetKar',
};

/**
 * Bilanço 100–599 + gelir tablosu 600–699: özet ana satır (620 SATIŞLARIN MALİYETİ gibi);
 * kuyruk rakamla başlıyorsa alt hesap — anahtara tekrar yazılmaz (çift toplam önlenir).
 */
const PDF_MIZAN_GRUP_OZET_KEYS = new Set([
  'ticAlacaklar',
  'digerAlacaklar',
  'stoklar',
  'yilYayginMal',
  'gelecekAyGider',
  'digerDonen',
  'uzunTicAlacak',
  'uzunDigAlacak',
  'maliDuranVar',
  'maddiDuranVar',
  'maddiOlmayan',
  'ozelTukenme',
  'gelecekYilGider',
  'digerDuran',
  'kvMaliBorclar',
  'kvTicBorclar',
  'kvDigBorclar',
  'alinanAvans',
  'yilHakediş',
  'odenecekVergi',
  'borcKarsilik',
  'gelecekAyGelir',
  'digerKvYK',
  'uvMaliBorclar',
  'uvTicBorclar',
  'uvDigBorclar',
  'uvAlinanAvans',
  'uvBorcKarsilik',
  'uvDigYK',
  'odenmisSermaye',
  'sermaYedek',
  'karYedek',
  'gecmisKar',
  'gecmisZarar',
  'donemNetKar',
  'brutSatis',
  'satisInd',
  'satMaliyet',
  'faalGider',
  'digerFaalGelir',
  'digerFaalGider',
  'finansmanGider',
  'olagandisiGelir',
  'olagandisiGider',
  'donemKar',
  'vergiKarsilik',
]);

const PDF_MIZAN_GRUP_OZET_KOD_BY_KEY = (function () {
  const m = {};
  for (const k of PDF_MIZAN_GRUP_OZET_KEYS) m[k] = new Set();
  for (const [codeStr, key] of Object.entries(KOD_TO_KEY)) {
    if (!PDF_MIZAN_GRUP_OZET_KEYS.has(key)) continue;
    const n = parseInt(codeStr, 10);
    if (Number.isFinite(n) && n >= 100 && n <= 699) m[key].add(n);
  }
  return m;
})();

function pdfMizanGrupOzetSatirMi(key, rawKod) {
  const s = PDF_MIZAN_GRUP_OZET_KOD_BY_KEY[key];
  return !!(s && s.has(rawKod));
}

/** PDF tablo mizan hazır özet (100–103, 108) — Excel / beyanname ile paylaşılmaz */
const PDF_MIZAN_HAZIR_OZET_KOD = new Set([100, 101, 102, 103, 108]);

/**
 * YOL BAK: yalnız "100 KASA" / "102 BANKALAR" (kod + boşluk + harfli açıklama).
 * Atlanır: "100.01", "101.2024", "102.01.01.01", "100 01 …" (boşluktan sonra rakam).
 */
function pdfMizanHazirAnaSatirMi(lineTrim) {
  return /^(100|101|102|103|108)\s+[A-Za-zÇĞİÖŞÜçğıöşü]/.test(String(lineTrim).trim());
}

/** 12 Ticari alacaklar — KOD_TO_KEY ile aynı kodlar (PDF tablo mizan) */
const PDF_MIZAN_TICARI_OZET_KOD = new Set([120, 121, 122, 124, 126, 127, 128, 129]);

/**
 * Hazır ile aynı YOL BAK kuralı: "120 ALICILAR" / "126 VERİLEN …"
 * Atlanır: "120.A", "120.01", "120.B.02", "120 01 …"
 */
function pdfMizanTicariAlacakAnaSatirMi(lineTrim) {
  return /^(120|121|122|124|126|127|128|129)\s+[A-Za-zÇĞİÖŞÜçğıöşü]/.test(String(lineTrim).trim());
}

/** 13 Diğer alacaklar — KOD_TO_KEY ile aynı kodlar */
const PDF_MIZAN_DIGER_OZET_KOD = new Set([131, 132, 133, 135, 136, 137, 138, 139]);

/** YOL BAK: "136 DİĞER …"; atlanır: "136.S.01", "136.01 …" */
function pdfMizanDigerAlacakAnaSatirMi(lineTrim) {
  return /^(131|132|133|135|136|137|138|139)\s+[A-Za-zÇĞİÖŞÜçğıöşü]/.test(String(lineTrim).trim());
}

/** 15 Stoklar — KOD_TO_KEY ile aynı kodlar */
const PDF_MIZAN_STOK_OZET_KOD = new Set([150, 151, 152, 153, 157, 158, 159]);

/** YOL BAK: "150 İLK MADDE …", "159 VERİLEN …"; atlanır: "150.01", "159.A.01 …" */
function pdfMizanStokAnaSatirMi(lineTrim) {
  return /^(150|151|152|153|157|158|159)\s+[A-Za-zÇĞİÖŞÜçğıöşü]/.test(String(lineTrim).trim());
}

/** 19 Diğer dönen — KOD_TO_KEY (194 yok); çift toplam: ana + 192.01 / 192 01 ikisi birden */
const PDF_MIZAN_DIGER_DONEN_OZET_KOD = new Set([190, 191, 192, 193, 195, 196, 197, 198, 199]);

function pdfMizanDigerDonenAnaSatirMi(lineTrim) {
  return /^(190|191|192|193|195|196|197|198|199)\s+[A-Za-zÇĞİÖŞÜçğıöşü]/.test(String(lineTrim).trim());
}

/** 25–29 duran (KOD_TO_KEY) — grup 24 (240–249) dahil değil; dönen 100–199’a dokunulmaz */
const PDF_MIZAN_DURAN_2529_OZET_KOD = new Set([
  250, 251, 252, 253, 254, 255, 256, 257, 258, 259,
  260, 261, 262, 263, 264, 267, 268, 269,
  271, 272, 277, 278, 279,
  280, 281,
  291, 292, 293, 294, 295, 296, 297, 298, 299,
]);

/**
 * PDF mizan 25–29: özet satır kabul; "250.01" red; "250 1. SINIF", "%…", "296 6736…" kabul.
 * Geniş aktif 100–299 / 100–199 tek regex döngüsü kullanılmaz (dönen bozulmasın).
 */
function pdfMizanDuran2529AnaSatirMi(lineTrim, rawKod) {
  if (!PDF_MIZAN_DURAN_2529_OZET_KOD.has(rawKod)) return true;
  const t = String(lineTrim).trim();
  const esc = String(rawKod).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp('^' + esc + '\\.').test(t)) return false;
  if (new RegExp('^' + esc + '\\s+[A-Za-zÇĞİÖŞÜçğıöşü]').test(t)) return true;
  if (new RegExp('^' + esc + '\\s+%').test(t)) return true;
  if (new RegExp('^' + esc + '\\s+\\d{1,3}\\. ?[A-Za-zÇĞİÖŞÜçğıöşü]').test(t)) return true;
  if (rawKod === 296) {
    const m = t.match(new RegExp('^296\\s+(\\d.*)$'));
    if (m) {
      const mm = m[1].trim().match(/^(\d+)/);
      if (mm && mm[1].length >= 4) return true;
    }
  }
  return false;
}

/**
 * Grup özet: kuyruk rakamla başlıyorsa çoğunlukla alt hesap (296 01…) → atla.
 * İlk token 4+ hane ise çoğunlukla kanun/yıl no (296 6736 SAYILI KANUN…) → ana satır, atlama.
 * 25–29 (250–299): "250 1. SINIF" özet — atlama.
 */
function pdfMizanGrupOzetRakamKuyrukAtlansinMi(afterTrim, rawKod) {
  const a = String(afterTrim).trim();
  if (!a.length) return true;
  if (PDF_MIZAN_DURAN_2529_OZET_KOD.has(rawKod) && /^\d{1,3}\. ?[A-Za-zÇĞİÖŞÜçğıöşü]/.test(a)) return false;
  if (!/^\d/.test(a)) return false;
  const m = a.match(/^(\d+)/);
  if (m && m[1].length >= 4) return false;
  return true;
}

/**
 * Pasif + gelir tablosu (300–699) grup özet: "320.01 …" / "620.01 …" alt satır — ana özetle çift toplam önlenir.
 * Yalnız pdfMizanGrupOzetSatirMi ile birlikte; 100–299 dönen/duran ayrı kurallara dokunulmaz.
 */
function pdfMizanGrupOzetPasifGelirNoktaliAltMi(lineTrim, rawKod) {
  if (rawKod < 300 || rawKod > 699) return false;
  const t = String(lineTrim).trim();
  const esc = String(rawKod).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('^' + esc + '\\.').test(t);
}

// 2 haneli ana grup → key (2-pass için)
const KOD_TO_KEY_2 = {
  10:'hazirDegerler', 11:'menkKiymetler',
  12:'ticAlacaklar', 13:'digerAlacaklar',
  15:'stoklar', 17:'yilYayginMal',
  18:'gelecekAyGider', 19:'digerDonen',
  22:'uzunTicAlacak', 23:'uzunDigAlacak',
  24:'maliDuranVar', 25:'maddiDuranVar',
  26:'maddiOlmayan', 27:'ozelTukenme',
  28:'gelecekYilGider', 29:'digerDuran',
  30:'kvMaliBorclar', 32:'kvTicBorclar',
  33:'kvDigBorclar', 34:'alinanAvans',
  35:'yilHakediş', 36:'odenecekVergi',
  37:'borcKarsilik', 38:'gelecekAyGelir',
  39:'digerKvYK',
  40:'uvMaliBorclar', 42:'uvTicBorclar',
  43:'uvDigBorclar', 44:'uvAlinanAvans',
  47:'uvBorcKarsilik', 48:'uvDigYK',
  49:'uvDigYK',
  50:'odenmisSermaye', 52:'sermaYedek',
  54:'karYedek', 57:'gecmisKar',
  58:'gecmisZarar', 59:'donemNetKar',
  60:'brutSatis', 61:'satisInd', 62:'satMaliyet', 63:'faalGider',
  64:'digerFaalGelir', 65:'digerFaalGider', 66:'finansmanGider',
  67:'olagandisiGelir', 68:'olagandisiGider', 69:'vergiKarsilik',
};

// ─────────────────────────────────────────────────────────────────
// HESAP KODU DEĞERİNİ HESAPLA
// AKTİF (100-299): borç bakiye kullan, (-) hesap → alacak bakiye → negatif
// PASİF (300-591): alacak bakiye kullan, (-) hesap → borç bakiye → negatif  
// GELİR (600-699): (-) hesaplar borç bakiyeli → pozitif tutar olarak sisteme girer
// ─────────────────────────────────────────────────────────────────
// hesapDeger: MİZAN satırından doğru imzalı tutarı hesaplar
// Kural: AKTİF(100-299) borç bakiye, (-) ise alacak bakiye negatif
//        PASİF(300-599) alacak bakiye, (-) ise borç bakiye negatif
//        GELİR(600-699) normal=alacak, (-)=borç ama POZİTİF (gider key)
function hesapDeger(kod, borcBak, alacBak) {
  const bb = Math.abs(borcBak || 0);
  const ab = Math.abs(alacBak || 0);
  const isMinus = MINUS_KODLAR.has(kod);

  if (kod >= 100 && kod <= 299) {
    // AKTİF: normal=borç bakiye(+), (-)=alacak bakiye(-) — düşülür
    return isMinus ? (ab > 0 ? -ab : -bb) : (bb > 0 ? bb : ab);
  }
  if (kod >= 300 && kod <= 599) {
    // PASİF: normal=alacak bakiye(+), (-)=borç bakiye(-) — düşülür
    return isMinus ? (bb > 0 ? -bb : -ab) : (ab > 0 ? ab : bb);
  }
  // GELİR TABLOSU 600-699
  // Normal gelir: alacak bakiye → pozitif
  // (-) gider hesabı: borç bakiye → POZİTİF (sistem gider key olarak işler)
  return isMinus ? (bb > 0 ? bb : ab) : (ab > 0 ? ab : bb);
}


function parseMizanExcel(file) {
  importLog('🔄 Excel okunuyor...', 'info');
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const wb   = XLSX.read(data, {type:'array', raw:true});
      importLog(`📊 Sayfalar: ${wb.SheetNames.join(', ')}`, 'info');

      // 1. Önce "BİLANÇO DETAYLARI" gibi spread sayfası var mı kontrol et
      const BILANCO_SHEETS = ['BİLANÇO DETAYLARI','BILANCO DETAYLARI','BILANÇO DETAYLARI','SPREAD','BİLANÇO','BALANCE'];
      let spreadSheet = null;
      for (const sn of BILANCO_SHEETS) {
        const found = wb.SheetNames.find(n => normTR(n).includes(normTR(sn).split(' ')[0]) && normTR(n).includes('detay'));
        if (found) { spreadSheet = found; break; }
      }

      if (spreadSheet) {
        importLog(`📋 Spread formatı tespit edildi: "${spreadSheet}"`, 'ok');
        const sheet = wb.Sheets[spreadSheet];
        const rows  = XLSX.utils.sheet_to_json(sheet, {header:1, defval:null, raw:true});
        const result = spreadRowlariIsle(rows, importState.year);
        finalizeImport(result);
        return;
      }

      // 2. Normal mizan formatı - en iyi sayfayı bul
      let best = null, bestScore = -1;
      wb.SheetNames.forEach(name => {
        const sheet = wb.Sheets[name];
        const rows  = XLSX.utils.sheet_to_json(sheet, {header:1, defval:null, raw:true});
        const score = mizanFormatSkor(rows);
        importLog(`  📋 "${name}": ${rows.length} satır, skor: ${score}`, 'info');
        if (score > bestScore) { bestScore = score; best = {name, rows}; }
      });

      if (!best) {
        importLog('❌ Excel okunamadı.', 'err');
        if (window._nfMaliImportReject) {
          const rej = window._nfMaliImportReject;
          window._nfMaliImportReject = null;
          window._nfMaliImportResolve = null;
          rej(new Error('Excel okunamadı'));
        }
        return;
      }
      if (bestScore < 1) importLog('⚠️ Standart format tanınamadı, genel tarama yapılıyor...', 'warn');

      importLog(`✅ Seçilen sayfa: "<b>${best.name}</b>"`, 'ok');
      const result = mizanRowlariIsle(best.rows);
      finalizeImport(result);

    } catch(err) {
      importLog(`❌ Hata: ${err.message}`, 'err');
      console.error(err);
      if (window._nfMaliImportReject) {
        const rej = window._nfMaliImportReject;
        window._nfMaliImportReject = null;
        window._nfMaliImportResolve = null;
        rej(err);
      }
    }
  };
  reader.onerror = function () {
    if (window._nfMaliImportReject) {
      const rej = window._nfMaliImportReject;
      window._nfMaliImportReject = null;
      window._nfMaliImportResolve = null;
      rej(new Error('Dosya okunamadı'));
    }
  };
  reader.readAsArrayBuffer(file);
}

// Spread / BİLANÇO DETAYLARI sayfasını oku
// Sütun düzeni: A=hesap kodu, C=ad, D=2022, G=2023, J=2024, M=2025
function spreadRowlariIsle(rows, hedefYil) {
  // Başlık satırında yıl → sütun eşleşmesini bul
  const YIL_COLS = {};
  let headerRowIdx = -1;

  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const row = rows[r] || [];
    const rowStr = row.map(v => String(v||'').toLowerCase());
    
    // "AKTİF" veya "BALANCE" veya "KODU" içeren satır - güvenilir header
    const rowNorm = row.map(v => normTR(String(v||'')));
    const hasAktif = rowNorm.some(v => v.includes('aktif') || v.includes('bilanc') || v.includes('assets') || v.includes('balance'));
    
    const tmpYils = {};
    let foundYears = 0;
    row.forEach((v, c) => {
      // Sadece INTEGER yıl sütunları: "2025/12" string'leri yanıltıcı, sadece int 2025 say
      if (typeof v === 'number' && Number.isInteger(v) && v >= 2018 && v <= 2030) {
        tmpYils[v] = c;
        foundYears++;
      }
    });
    
    // Hem integer yıl (≥2) hem "aktif"/"bilanc" → güvenilir header
    if (foundYears >= 2 && hasAktif) {
      Object.assign(YIL_COLS, tmpYils);
      headerRowIdx = r;
      break;
    }
    // Sadece integer yıl ≥4 → de facto header (aktif kelimesi TR olmadığında)
    if (foundYears >= 4) {
      Object.assign(YIL_COLS, tmpYils);
      headerRowIdx = r;
      break;
    }
  }

  const targetCol = YIL_COLS[hedefYil];
  if (targetCol === undefined) {
    importLog(`⚠️ ${hedefYil} yılı sütunu bulunamadı. Mevcut yıllar: ${Object.keys(YIL_COLS).join(', ')}`, 'warn');
    // En son yılı kullan
    const maxYil = Math.max(...Object.keys(YIL_COLS).map(Number));
    if (!maxYil) { importLog('❌ Yıl sütunu bulunamadı.', 'err'); return {}; }
    importLog(`ℹ️ ${maxYil} yılı kullanılıyor.`, 'info');
    return spreadRowlariIsle(rows, maxYil);
  }

  importLog(`📅 ${hedefYil} → sütun ${String.fromCharCode(65 + targetCol)}`, 'info');

  const result = {};

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const rawA = row[0];
    if (rawA === null || rawA === undefined) continue;

    // A sütununda 3 haneli kod ara
    const s = String(rawA).trim();
    const m = s.match(/^(\d{3})$/);
    if (!m) continue;
    const kod = parseInt(m[1]);
    if (kod < 100 || kod > 699) continue;

    const val = row[targetCol];
    if (val === null || val === undefined) continue;
    const absVal = Math.abs(parseFloat(val) || 0);
    if (absVal === 0) continue;

    // hesapDeger: spread'de değerler zaten doğru işaretli tutar
    // AKTİF: pozitif değer = borç bakiye, negatif/sıfır = yok
    // PASİF: değer = alacak bakiye tutarı
    // (-) hesaplar: spread'de negatif veya pozitif olabilir
    const isMinus = MINUS_KODLAR.has(kod);
    let deger;

    if (kod >= 100 && kod <= 299) {
      // AKTİF: normal=pozitif, (-)=negatif (amortismanlar gibi, düşülür)
      deger = isMinus ? -absVal : absVal;
    } else if (kod >= 300 && kod <= 599) {
      // PASİF: normal=pozitif, (-)=negatif (kiralama düzeltmesi gibi, düşülür)
      deger = isMinus ? -absVal : absVal;
    } else {
      // GELİR TABLOSU 600-699: her zaman pozitif tutar (gider key'leri zaten gider)
      deger = absVal;
    }

    const key = KOD_TO_KEY[kod];
    if (!key) continue;
    // gecmisZarar daima pozitif kaydedilir — hesapToplamlar ozKaynak'tan düşer
    result[key] = (result[key] || 0) + (key === 'gecmisZarar' ? absVal : deger);
    // 601 Yurtdışı Satışlar: brutSatis'e eklenir + ihracat'a ayrıca yaz
    if (kod === 601) result['ihracat'] = (result['ihracat'] || 0) + Math.abs(absVal);
  }

  const n = Object.keys(result).length;
  importLog(`✅ Spread: ${n} kalem okundu`, n > 0 ? 'ok' : 'warn');
  return result;
}


// Sayfanın mizan formatı olup olmadığını puanla
function mizanFormatSkor(rows) {
  let score = 0;
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      // Integer sayı olarak 100-699 arası
      if (typeof v === 'number' && Number.isInteger(v) && v >= 100 && v <= 699) {
        score += 2;
      }
      // String olarak 3 haneli kod (100-699) — ham mizan formatı
      if (typeof v === 'string' && /^\d{3}$/.test(v.trim())) {
        const n = parseInt(v.trim());
        if (n >= 100 && n <= 699) score += 2;
      }
      // "BORÇ" veya "ALACAK" veya "BAKİYE" başlığı var mı?
      if (typeof v === 'string' && /borç|alacak|bakiye|hesap/i.test(v)) {
        score += 3;
      }
    }
  }
  return score;
}

// TR karakter normalize (ğ→g, ü→u, ş→s, ı→i, ö→o, ç→c, İ→i)
function normTR(s) {
  // Önce büyük Türkçe harfleri replace (İ.toLowerCase()='i̇' combining-dot sorununu önler)
  return String(s||'')
    .replace(/İ/g,'i').replace(/I/g,'i').replace(/Ş/g,'s')
    .replace(/Ğ/g,'g').replace(/Ü/g,'u').replace(/Ö/g,'o').replace(/Ç/g,'c')
    .toLowerCase()
    .replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ü/g,'u')
    .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
    .replace(/â/g,'a')  // â→a (kâr, zararı gibi)
    .replace(/î/g,'i')  // î→i
    .replace(/û/g,'u')  // û→u
    .replace(/̂/g,'')   // combining circumflex kaldır
    .replace(/̇/g,'');       // combining dot kaldır
}

/** Excel mizan A sütunu: 100, 100.01, 100-01 → { kod, isAna } */
function parseMizanHesapKodu(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 100 && raw <= 699) {
    return { kod: raw, isAna: true };
  }
  if (typeof raw === 'number' && raw >= 100 && raw <= 699 && Math.floor(raw) === raw) {
    const k = Math.floor(raw);
    return { kod: k, isAna: raw === k };
  }
  const s = String(raw).trim().replace(/\s+/g, '');
  const m3 = s.match(/^(\d{3})$/);
  if (m3) {
    const n = parseInt(m3[1], 10);
    if (n >= 100 && n <= 699) return { kod: n, isAna: true };
  }
  const mSub = s.match(/^(\d{3})[.\-]/);
  if (mSub) {
    const n = parseInt(mSub[1], 10);
    if (n >= 100 && n <= 699) return { kod: n, isAna: false };
  }
  return null;
}

/** Borç/alacak bakiye + dönem toplamından imzalı tutar (PDF ile aynı hesapDeger) */
function mizanKatkiFromBakiye(kod, borcBak, alacBak, borcTutar, alacTutar) {
  let bb = borcBak || 0;
  let ab = alacBak || 0;
  if (bb === 0 && ab === 0 && (borcTutar > 0 || alacTutar > 0)) {
    const net = borcTutar - alacTutar;
    if (net > 0) bb = net;
    else if (net < 0) ab = -net;
  }
  if (bb === 0 && ab === 0) return 0;
  return hesapDeger(kod, bb, ab);
}

/** İki haneli grup → hesapDeger için temsilî 3 haneli kod (59: zarar/kar ayrımı) */
function mizanKod2Temsil3(kod2, bb, ab) {
  if (kod2 === 59) return bb > ab ? 591 : 590;
  return kod2 * 10;
}

// Mizan satırlarını işle: hesap kodu tara, key'e topla
function mizanRowlariIsle(rows) {
  // ── BAŞLIK SATIRI TESPİT ──────────────────────────────────────────
  // Sütun indisleri
  let colKod=-1, colBorc=-1, colAlac=-1, colBorcBak=-1, colAlacBak=-1;
  let headerRow = -1;

  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const row = rows[r] || [];
    const rowN = row.map(v => normTR(String(v||'')));
    // En az BORÇ ve ALACAK sütunları olan satır başlık
    // Geniş eşleşme: "BORÇ", "TL Borç Toplam", "Toplam Borç", "BAK. BORÇ",
    //                "Toplam Alac.", "(Tam) Hesap" gibi farklı muhasebe programı formatlarını destekler
    const borcIdx = rowN.findIndex(v => /bor[oc]/.test(v));
    const alacIdx = rowN.findIndex(v => /alac/.test(v));
    if (borcIdx < 0 || alacIdx < 0) continue;
    headerRow = r;
    rowN.forEach((v, c) => {
      // Hesap kodu sütunu: "Hesap Kodu", "Hesap No", "(Tam) Hesap", "Kod", "No"
      if (/hesap.*(kod|no)|^kod$|^no$|\(tam\).*hesap/.test(v) && colKod < 0) colKod = c;
      // Borç Bakiye: "Borç Bakiyesi", "TL Borç Bakiye", "Bakiye Borç", "BAK. BORÇ"
      // Geniş eşleşme: bak+bor veya bor+bak — Ç/ç encoding sorunlarına karşı raw v de kontrol et
      const rawV = String(row[c]||'').toLowerCase();
      if (!v && !rawV) return; // boş sütunu atla — regex false positive önle
      if ((/bor.{0,5}bak|bak.{0,5}bor/.test(v) || /bor.{0,5}bak|bak.{0,5}bor/.test(rawV)) && colBorcBak < 0) colBorcBak = c;
      // Alacak Bakiye: "Alacak Bakiyesi", "TL Alacak Bakiye", "Bakiye Alac.", "BAK. ALACAK"
      if ((/alac.{0,5}bak|bak.{0,5}alac/.test(v) || /alac.{0,5}bak|bak.{0,5}alac/.test(rawV)) && colAlacBak < 0) colAlacBak = c;
      // Borç Toplam (bakiye içermeyenler): "BORÇ", "TL Borç Toplam", "Toplam Borç"
      if (/bor[oc]/.test(v) && !/bak/.test(v) && colBorc < 0)     colBorc = c;
      // Alacak Toplam (bakiye içermeyenler): "ALACAK", "TL Alacak Toplam", "Toplam Alac."
      if (/alac/.test(v) && !/bak/.test(v) && colAlac < 0)         colAlac = c;
    });
    // Bakiye sütunlarını doğrula: boş sütuna denk geldiyse ikisini birlikte ileri kaydır
    const isColEmpty = (ci) => ci < 0 || ci >= row.length || row[ci] === null || row[ci] === undefined || String(row[ci]).trim() === '';
    if (colBorcBak >= 0 && colAlacBak >= 0 && isColEmpty(colBorcBak) && !isColEmpty(colBorcBak + 1)) {
      // Her ikisi de bir erken bulunmuş — birlikte kaydır
      colBorcBak = colBorcBak + 1;
      colAlacBak = colAlacBak + 1;
    }
    // İkisi de bulunamadıysa: ALACAK'tan sonra boş olmayan 2 sütunu bul
    if (colBorcBak < 0 && colAlacBak < 0 && colBorc >= 0 && colAlac >= 0) {
      const nonEmpty = [];
      for (let ci = colAlac + 1; ci < row.length; ci++) {
        if (!isColEmpty(ci)) nonEmpty.push(ci);
        if (nonEmpty.length === 2) break;
      }
      if (nonEmpty.length >= 2) { colBorcBak = nonEmpty[0]; colAlacBak = nonEmpty[1]; }
      else if (nonEmpty.length === 1) { colBorcBak = nonEmpty[0]; colAlacBak = nonEmpty[0] + 1; }
      else { colBorcBak = colAlac + 1; colAlacBak = colAlac + 2; }
    }
    importLog(`📌 Başlık satır ${r+1}: Kod[${colKod>=0?String.fromCharCode(65+colKod):'?'}] Borç[${colBorc>=0?String.fromCharCode(65+colBorc):'?'}] Alacak[${colAlac>=0?String.fromCharCode(65+colAlac):'?'}] BorcBak[${colBorcBak>=0?String.fromCharCode(65+colBorcBak):'?'}] AlacBak[${colAlacBak>=0?String.fromCharCode(65+colAlacBak):'?'}]`, 'info');
    importLog(`🔍 rowN[5]="${rowN[5]||''}" rowN[6]="${rowN[6]||''}" rowN[7]="${rowN[7]||''}"`, 'info');
    break;
  }

  const startRow = headerRow >= 0 ? headerRow + 1 : 0;
  const colKodList = colKod >= 0 ? [colKod] : [0, 1, 2];

  // ── KURAL ────────────────────────────────────────────────────────
  // AKTİF (100-299):
  //   Borç Bakiye sütununu kullan.
  //   Eğer Borç Bak sütunu yoksa: Borç - Alacak hesapla.
  //   (-) hesap: alacak bakiyeli → negatif katkı (düşülür)
  //   Normal yöntem: bb - ab → pozitifse borç bak, negatifse alacak bak
  //
  // PASİF (300-591):
  //   Alacak Bakiye sütununu kullan.
  //   Eğer Alacak Bak sütunu yoksa: Alacak - Borç hesapla.
  //   (-) hesap: borç bakiyeli → negatif katkı (düşülür)
  //
  // GELİR TABLOSU (600-699):
  //   Alacak bakiye = gelir (pozitif), Borç bakiye = gider (pozitif, negatif işlenir)
  //   (-) hesaplar borç bakiyeli → sistem ilgili gider key'e pozitif olarak yazar
  // ─────────────────────────────────────────────────────────────────


  const result = {};

  // ══════════════════════════════════════════════════════════════════
  // AŞAMA 1: İKİ HANELİ KODLARI OKU (10,12,13,...,60,62...)
  // Bu mizanlarda iki haneli satırlar = alt hesapların hazır toplamı
  // Aktif (10-29): Borç Bakiyesi - Alacak Bakiyesi = net değer
  // Pasif (30-59): Alacak Bakiyesi - Borç Bakiyesi = net değer
  // Gelir (60-69): gider kodları borç bakiyeli, gelir kodları alacak bakiyeli
  // ══════════════════════════════════════════════════════════════════
  const ikiHaneliOkundu = new Set();

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r] || [];
    if (row.every(v => v === null || v === undefined || v === '')) continue;

    let kod2 = null;
    for (const c of colKodList) {
      const raw = row[c];
      if (raw === null || raw === undefined) continue;
      const s = String(raw).trim();
      if (/^\d{2}$/.test(s)) { const n = parseInt(s); if (n >= 10 && n <= 99) { kod2 = n; break; } }
      if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 10 && raw <= 99) { kod2 = raw; break; }
      if (typeof raw === 'number' && raw >= 10 && raw <= 99 && Math.floor(raw) === raw) { kod2 = Math.floor(raw); break; }
    }
    if (kod2 === null) continue;
    // 50 kodunu iki haneli aşamada atla:
    // 500=odenmisSermaye, 502+=sermaYedek ayrışması gerekiyor
    // Üç haneli aşamada KOD_TO_KEY ile doğru key'lere dağıtılır
    if (kod2 === 50) continue;
    const key2 = KOD_TO_KEY_2 && KOD_TO_KEY_2[kod2];
    if (!key2) continue;

    const borcBak2 = colBorcBak >= 0 ? (parseImportNumber(row[colBorcBak]) ?? 0) : 0;
    const alacBak2 = colAlacBak >= 0 ? (parseImportNumber(row[colAlacBak]) ?? 0) : 0;
    const borcT2   = colBorc >= 0 ? (parseImportNumber(row[colBorc]) ?? 0) : 0;
    const alacT2   = colAlac >= 0 ? (parseImportNumber(row[colAlac]) ?? 0) : 0;

    let bb2 = borcBak2, ab2 = alacBak2;
    if (bb2 === 0 && ab2 === 0 && (borcT2 > 0 || alacT2 > 0)) {
      const net2 = borcT2 - alacT2;
      if (net2 > 0) bb2 = net2; else if (net2 < 0) ab2 = -net2;
    }
    if (bb2 === 0 && ab2 === 0) continue;

    const temsil3 = mizanKod2Temsil3(kod2, bb2, ab2);
    const deger2 = mizanKatkiFromBakiye(temsil3, bb2, ab2, borcT2, alacT2);
    if (deger2 === 0) continue;

    result[key2] = (result[key2] || 0) + (key2 === 'gecmisZarar' ? Math.abs(deger2) : deger2);
    ikiHaneliOkundu.add(key2);
  }

  if (ikiHaneliOkundu.size > 0) {
    importLog(`📊 ${ikiHaneliOkundu.size} grup iki haneli koddan okundu`, 'ok');
  }

  // ══════════════════════════════════════════════════════════════════
  // AŞAMA 2: ÜÇ HANELİ + ALT HESAP (100.01) — hesapDeger; ana satır varsa alt toplanmaz
  // ══════════════════════════════════════════════════════════════════
  const ucHaneli = new Map();

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r] || [];
    if (row.every(v => v === null || v === undefined || v === '')) continue;

    let parsed = null;
    for (const c of colKodList) {
      parsed = parseMizanHesapKodu(row[c]);
      if (parsed) break;
    }
    if (!parsed) continue;
    const { kod, isAna } = parsed;

    const borcTutar = colBorc >= 0 ? (parseImportNumber(row[colBorc]) ?? 0) : 0;
    const alacTutar = colAlac >= 0 ? (parseImportNumber(row[colAlac]) ?? 0) : 0;
    const borcBak = colBorcBak >= 0 && colBorcBak < row.length ? (parseImportNumber(row[colBorcBak]) ?? 0) : 0;
    const alacBak = colAlacBak >= 0 && colAlacBak < row.length ? (parseImportNumber(row[colAlacBak]) ?? 0) : 0;

    const katki = mizanKatkiFromBakiye(kod, borcBak, alacBak, borcTutar, alacTutar);
    if (katki === 0) continue;

    let slot = ucHaneli.get(kod);
    if (!slot) {
      slot = { ana: null, altSum: 0 };
      ucHaneli.set(kod, slot);
    }
    if (isAna) slot.ana = (slot.ana || 0) + katki;
    else slot.altSum += katki;
  }

  for (const [kod, slot] of ucHaneli) {
    const key = KOD_TO_KEY[kod];
    if (!key) continue;
    if (ikiHaneliOkundu.has(key)) continue;

    const katki = slot.ana !== null ? slot.ana : slot.altSum;
    if (katki === 0) continue;

    if (kod === 131) {
      result['ortakAlacak131'] = (result['ortakAlacak131'] || 0) + Math.max(0, katki);
      continue;
    }
    result[key] = (result[key] || 0) + (key === 'gecmisZarar' ? Math.abs(katki) : katki);
    if (kod === 601) result['ihracat'] = (result['ihracat'] || 0) + Math.abs(katki);
  }

  const n = Object.keys(result).filter(k => result[k] !== 0).length;
  if (!result.donemNetKar && !result.donemKar && (result.brutSatis || result.satMaliyet)) {
    result._mizan590591Eksik = true;
    importLog(
      'ℹ️ Mizanda 590/591 (dönem karı) satırı yok; dönem sonucu gelir tablosu (600–699) hesabından kapatılacak.',
      'info',
    );
  } else if (result.donemNetKar || result.donemKar) {
    result._mizan590591 = true;
  }
  importLog(`✅ ${n} kalem eşleştirildi`, n > 0 ? 'ok' : 'warn');
  return result;
}


// ─── PDF LABEL → KEY eşleştirme (Beyanname / Ayrıntılı Bilanço formatı) ───────
const BEYAN_GRUP_MAP = [
  // AKTİF DÖNEN
  [/hazir deger|kasa ve banka/,           'hazirDegerler'],
  [/menkul kiymet/,                        'menkKiymetler'],
  [/ticari alacak/,                        'ticAlacaklar'],      // DURAN bölümünde uzunTicAlacak'a override edilir
  [/ortaklardan alacak/,                   'ortakAlacak131'],    // 131 ayrı izlenir; analizde sıfırlanır
  [/diger alacak/,                         'digerAlacaklar'],    // DURAN bölümünde uzunDigAlacak'a override edilir
  [/stok/,                                 'stoklar'],
  [/yillara yaygin/,                        'yilYayginMal'],  // 17x(DONEN) veya 35x(KV) — bolum override ile ayrılır
  // "Gelirler ve Gider" (KV pasif H.) önce — geniş /gider/ yoksa dönen G. satırı KV ile karışır
  [/gelecek ay.*gelirler.*ve.*gider/,      'gelecekAyGelir'],
  [/gelecek ay.*giderler.*ve.*gelir/,      'gelecekAyGider'],
  [/diger donen/,                          'digerDonen'],
  // AKTİF DURAN
  [/maddi duran varlik/,                   'maddiDuranVar'],
  [/maddi olmayan/,                        'maddiOlmayan'],
  [/ozel tuken|tukenmeye tabi varlik/,      'ozelTukenme'],
  [/mali duran/,                           'maliDuranVar'],
  [/gelecek yil.*gider/,                   'gelecekYilGider'],
  [/diger duran/,                          'digerDuran'],
  // PASİF KV
  [/mali borc/,                            'kvMaliBorclar'],
  [/ticari borc/,                          'kvTicBorclar'],      // UV bölümünde uvTicBorclar'a override edilir
  [/diger borc/,                           'kvDigBorclar'],
  [/diger.*kisa.*vadeli.*yabanci|diger kisa vadeli yabanci kaynak/, 'digerKvYK'],
  [/alinan avans/,                         'alinanAvans'],
  [/yillara yaygin.*hakedis/,               'yilHakediş'],    // açıkça "hakedis" yazıyorsa direkt eşleş
  [/borc.*karsili|karsili.*borc|kidem tazminat/,  'borcKarsilik'],
  [/odenecek vergi/,                       'odenecekVergi'],
  // gelecekAyGelir yukarıda (gelirler ve gider) — geniş /gelecek ay.*gelir/ kaldırıldı
  // ÖZ KAYNAK
  [/odenmi[sg] sermaye/,                   'odenmisSermaye'],
  [/sermaye duzeltme.*olumlu/,             'sermaYedek'],
  [/sermaye yedek/,                        'sermaYedek'],
  [/kar yedek|yasal yedek/,               'karYedek'],
  [/gecmis yil(lar)? kar/,                'gecmisKar'],
  [/gecmis yil(lar)? zarar/,              'gecmisZarar'],
  [/donem net kar/,                        'donemNetKar'],
  // donemNetKar gelir tablosundan da hesaplanır ama bilanço değeri de alınsın
  // GELİR TABLOSU — kurumlar beyannamesi gerçek satır isimleri
  [/^brut satis(?!.*kar|.*zarar)/,         'brutSatis'],       // "Brüt Satışlar" — "Brüt Satış Karı" değil
  [/^yurtdisi satis|^yurt disi satis/,       'ihracat'],         // ". 2. Yurtdışı Satışlar"
  [/satis indiri|satislarda indiri/,       'satisInd'],        // "Satış İndirimleri"
  [/net satis/,                            'netSatis'],        // "Net Satışlar" — hesaplamada kullanılır
  [/satislarin maliyeti|satilan.*maliyet/, 'satMaliyet'],      // "Satışların Maliyeti"
  [/brut satis.*kar|brut satis.*zarar/,    null],              // "Brüt Satış Kârı" → hesaplanır, import etme
  [/esas faaliyet|faaliyet.*kar.*zarar/,   null],              // "Esas Faaliyet Kârı" → hesaplanır
  [/faaliyet gider/,                       'faalGider'],       // "Faaliyet Giderleri"
  [/diger faaliy.*gelir/,                  'digerFaalGelir'],  // "Diğer Faaliyetlerden Olağan Gelirler"
  [/diger faaliy.*gider/,                  'digerFaalGider'],  // "Diğer Faaliyetlerden Olağan Giderler"
  [/finansman gider/,                      'finansmanGider'],  // "Finansman Giderleri"
  [/^olagan (kar|zarar)/,                  null],              // "Olağan Kâr" → hesaplanır
  [/olagandisi gelir|olagan disi gelir|olagan disi.*kar/, 'olagandisiGelir'], // "Olağandışı Gelirler" / "I. Olağandışı Gelir ve Karlar"
  [/olagandisi gider|olagan disi gider/,   'olagandisiGider'], // "Olağandışı Giderler"
  [/donem kar[i,\(\)\s]*.*vergi|yasal yukumluluk|vergi karsili/,  'vergiKarsilik'], // "K. Dönem Karı, Vergi..."
  [/donem net kar.*zarar|donem net kar.*kari/, 'donemNetKarGelir'], // "Dönem Net Karı veya Zararı"
  [/donem net kar/,                        'donemNetKar'],
  [/^donem kar[i,\(\)\s]*( veya)?\s*(zarar|kari)(?!.*vergi)(?!.*net)/, 'donemKar'], // "Dönem Karı veya Zararı" — PDF özeti
  [/donem kar.*zarar(?!.*vergi)/,          'donemKar'],              // yedek eşleşme
];

// (-) işaretli olduğu için negatif katkı yapacak key'ler
const BEYAN_NEGATIF = new Set(['satisInd','satMaliyet','faalGider','digerFaalGider','finansmanGider','olagandisiGider','vergiKarsilik']);

/** Tablo mizan: satır başında 3 haneli hesap kodu (100–699, alt hesap: 100.01) */
function countMizanTabloSatirlari(lines) {
  let c = 0;
  for (const raw of lines) {
    const t = raw.trim();
    if (/^([1-6]\d{2})(?:[.\-]\d+)?\s+\S/.test(t)) c++;
  }
  return c;
}

function countMizanNonZeroKeys(obj) {
  return Object.keys(obj || {}).filter(k => !k.startsWith('_') && obj[k] !== 0).length;
}

/** Tek kalemden üstü (TL) — PDF metin parçalanması / yanlış sütun; koordinat yedeğe düş */
const MIZAN_PDF_MAX_PLAUSIBLE_TL = 1e14;

/** PDF: önce metin; metin saçma büyükse koordinat (sabit X bazen daha güvenilir) */
function mergePdfMizanMetinOncelikli(textRes, koordRes) {
  const out = {};
  const keys = new Set([...Object.keys(textRes || {}), ...Object.keys(koordRes || {})]);
  for (const k of keys) {
    if (k.startsWith('_')) continue;
    const tv = textRes[k], kv = koordRes[k];
    const tAbs = tv != null && tv !== 0 ? Math.abs(tv) : 0;
    const tOk = tv != null && tv !== 0 && tAbs <= MIZAN_PDF_MAX_PLAUSIBLE_TL;
    const kOk = kv != null && kv !== 0;
    if (tOk) out[k] = tv;
    else if (kOk) out[k] = kv;
    else if (tv != null && tv !== 0) out[k] = tv;
  }
  if (textRes && textRes._firmaAdi) out._firmaAdi = textRes._firmaAdi;
  else if (koordRes && koordRes._firmaAdi) out._firmaAdi = koordRes._firmaAdi;
  return out;
}

function mizanTextIsle(text, structuredLines) {
  const result = {};
  const lines = text.split(/\n|\r/);
  const year = importState.year || importState.silentYear;

  // ── FORMAT TESPİT ────────────────────────────────────────────────────────────
  // Beyanname formatı: ". A. Hazır Değerler  0,00  8.820.155,96"
  // Mizan formatı:     "100  KASA  1234,56  0,00  1234,56  0,00"
  const mizanTabloSayisi = countMizanTabloSatirlari(lines);

  const hasExplicitBeyanPdf = lines.some(l => {
    const n = normTR(l);
    return /kurumlar\s+vergisi\s+beyannamesi|gecici\s+vergi\s+beyannamesi|beyanname\s+duzenleyen|beyannameyi\s+duzenleyen/.test(n);
  });

  const looseBeyanSignals = lines.some(l => {
    const t = l.trim();
    const n = normTR(t);
    return (
      /^\.\s+[A-Z][\.\s]/.test(t) ||
      /^(I{1,3}V?|IV|V)\.\s+/.test(t) ||
      /^[A-K]\.\s*/.test(t) ||
      /gecici vergi beyannamesi/.test(n) ||
      /hesaplanan gecici vergi/.test(n) ||
      /safi gecici vergi matrahi/.test(n) ||
      // Tek düzen / gelir tablosu: sadece tablo mizan satırı azsa (yoksa mizan PDF yanlışlıkla beyanname sanılıyordu)
      ((/tek duzen hesap plani/.test(n) || /\bgelir tablosu\b/.test(n)) && mizanTabloSayisi < 20)
    );
  });

  // Çok sayıda hesap kodu satırı varsa ve üstün kurumlar beyannamesi PDF'i değilse → tablo mizan
  let isBeyannameFormat = looseBeyanSignals;
  if (mizanTabloSayisi >= 25 && !hasExplicitBeyanPdf) {
    isBeyannameFormat = false;
  }

  importLog(`📄 Format: ${isBeyannameFormat ? 'Beyanname/Ayrıntılı Bilanço' : 'Mizan'}${mizanTabloSayisi ? ` <span style="opacity:.85">(tablo satırı ~${mizanTabloSayisi})</span>` : ''}`, 'info');

  if (isBeyannameFormat) {
    mizanTextIsleBeyanname(lines, result, year);
    const nBeyan = Object.keys(result).filter(k => !k.startsWith('_') && result[k] !== 0).length;
    if (nBeyan > 0) return result;
    const firma = result._firmaAdi;
    importLog('⚠️ Beyanname metni eşleşmedi; dosya tablo mizan olabilir — mizan okuması deneniyor.', 'warn');
    Object.keys(result).forEach(k => { delete result[k]; });
    if (firma) result._firmaAdi = firma;
  }

  const resultKoord = {};
  if (structuredLines && structuredLines.length > 0) {
    mizanTextIsleMizanKoordinat(structuredLines, resultKoord, true);
  }
  const resultText = {};
  mizanTextIsleMizan(lines, resultText, true);

  const nKor = countMizanNonZeroKeys(resultKoord);
  const nTxt = countMizanNonZeroKeys(resultText);

  // Tablo mizan PDF: metin satırı (Excel ile aynı mantık) önce; koordinat YOL BAK sabit X'i diğer programlarda şaşırır
  if (!isBeyannameFormat && mizanTabloSayisi >= 15 && nTxt > 0) {
    Object.assign(result, mergePdfMizanMetinOncelikli(resultText, resultKoord));
    importLog(`📎 PDF mizan: koordinat ${nKor} kalem, metin satırı ${nTxt} kalem`, 'info');
    importLog(`✅ Birleştirme: <b>metin öncelikli</b> (Excel mizan ile uyumlu; koordinat yedek)`, 'ok');
    const nFin = countMizanNonZeroKeys(result);
    importLog(`✅ PDF mizan: ${nFin} kalem aktarıldı`, nFin > 0 ? 'ok' : 'warn');
  } else if (nKor > 0) {
    Object.assign(result, resultKoord);
    importLog(`✅ Mizan PDF (koordinat): ${nKor} kalem eşleştirildi`, 'ok');
  } else {
    Object.assign(result, resultText);
    importLog(`✅ Mizan PDF: ${nTxt} kalem eşleştirildi`, nTxt > 0 ? 'ok' : 'warn');
  }

  // Metin 102 BANKALAR'ı kaçırınca hazır değerler eksik kalıyor: özet 102 satırında X ile bak.borç sütununu oku
  if (!isBeyannameFormat && structuredLines && structuredLines.length && pdfMizanSupplementHazir102FromKoord(result, structuredLines)) {
    const fmt = Number(result.hazirDegerler).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
    importLog(`📎 102 BANKALAR: koordinat <b>bak.borç</b> bandı ile hazır değerler tamamlandı → toplam <b>${fmt} ₺</b>`, 'ok');
  }

  return result;
}

// ── BEYANNAME / AYRINTILI BİLANÇO PARSER ──────────────────────────────────────
// Sadece ". A." seviyesi grup satırlarını alır, alt kalemleri atlar
function mizanTextIsleBeyanname(lines, result, year) {
  let bolum = null;  // DONEN | DURAN | KV | UV | OZKAYNAK | GELIR
  let inGelirTablosu = false;
  let unvan1 = '', unvan2 = '';
  let expectUnvan1 = false, expectUnvan2 = false;
  let inDuzenleyenSection = false; // Mali müşavir bölümüne girince firma adı yazmayı durdur

  for (const rawLine of lines) {
    const rawTrim = rawLine.trim();
    const rawNorm = normTR(rawTrim);

    // "Beyannameyi Düzenleyen" bölümüne giriş tespiti — sonraki unvan1/unvan2 müşavire ait
    if (/beyannameyi duzenleyen/.test(rawNorm)) { inDuzenleyenSection = true; }

    // Etiket ayrı satırdaysa takip eden satır(lar)dan ünvanı al
    if (/^soyadi \(unvani\)$/.test(rawNorm) || /^soyadi, adi \(unvani\)$/.test(rawNorm)) {
      if (!inDuzenleyenSection) expectUnvan1 = true;
      continue;
    }
    if (/^adi \(unvanin devami\)$/.test(rawNorm)) {
      if (!inDuzenleyenSection) expectUnvan2 = true;
      continue;
    }
    if (expectUnvan1 && rawTrim) {
      if (!/^(adi \(unvanin devami\)|ticaret sicil no|irtibat tel no|e-posta adresi|vergi kimlik numarasi|mukellef|beyannameyi duzenleyen)/.test(rawNorm)) {
        unvan1 = rawTrim;
      }
      expectUnvan1 = false;
      continue;
    }
    if (expectUnvan2 && rawTrim) {
      if (!/^(ticaret sicil no|irtibat tel no|e-posta adresi|vergi kimlik numarasi|mukellef|beyannameyi duzenleyen)/.test(rawNorm)) {
        unvan2 = rawTrim;
      }
      expectUnvan2 = false;
      continue;
    }

    // Firma ünvanını yakala — sadece müşavir bölümüne girmemişsek
    if (!inDuzenleyenSection) {
      const unvanM1 = rawLine.match(/Soyadı \(Unvanı\)\s+(.+)/);
      if (unvanM1) { unvan1 = unvanM1[1].trim(); }
      const unvanM2 = rawLine.match(/Adı \(Unvanın Devamı\)\s+(.+)/);
      if (unvanM2) { unvan2 = unvanM2[1].trim(); }
    }
    const line = rawLine.trim();
    if (!line || line.length < 5) continue;
    const ln = normTR(line);

    if (/\bkar\s+dagitim\s+tablosu\b/i.test(ln)) inGelirTablosu = false;
    if (/\bgelir tablosu\b/i.test(ln) && !/\bgelir tablosu\s+dipnot/i.test(ln)) inGelirTablosu = true;

    // Bölüm tespiti: Roman rakamları — ama gelir tablosu I/J satırları hariç
    // I. Olağan Dışı (gelir), J. Olağandışı Gider — bunlar bölüm değil veri satırı
    // ". I. ..." satırlarında baştaki nokta yoksa "I. Diğer Kısa Vadeli Yabancı Kaynaklar" ana başlık sanılıp atlanıyordu
    const isRoman = /^(i{1,3}v?|iv|v|vi|vii)\b/i.test(ln) && !/^\.\s/.test(line.trim());
    const isRomanDigerKv = /^(i{1,3}v?|iv|v|vi|vii)\b/i.test(ln) &&
      /diger.*kisa\s*vadeli/i.test(ln) && /yabanci/i.test(ln);
    const isGelirIJ = /^[ij]\.\s+/.test(ln) && !/^\.\s/.test(line) &&
      (/olagan|olagandisi|olagan dis/.test(ln));
    /** Gelir tablosu özet satırları — "Dönem Karı veya Zararı" (A–K öneki yok) */
    const isGelirOzetBare = (function () {
      const u = ln.replace(/^[a-k]\.\s+/, '').trim();
      if (/^donem net kar/i.test(u) && /veya\s+(zarar|kari)/i.test(u)) return true;
      if (/^donem kar/i.test(u) && /veya\s+(zarar|kari)/i.test(u) && !/vergi|yasal yukumluluk/i.test(u)) return true;
      return false;
    })();
    /** Roman "I. Olağandışı Gelir ve Karlar" — bölüm başlığı + grup toplamı (alt . 1. / . 2. atlanır) */
    const isGelirRomanOlaganDisi =
      /^i\.\s+/.test(ln) && /olagan\s+disi\s+(gelir|kar)/i.test(ln);
    if (isRoman && !isGelirIJ && !isRomanDigerKv && !isGelirRomanOlaganDisi) {
      if (/donen varlik|donen/.test(ln) && !/duran/.test(ln)) bolum = 'DONEN';
      else if (/duran varlik|duran/.test(ln)) bolum = 'DURAN';
      else if (/kisa vadeli/.test(ln)) bolum = 'KV';
      else if (/uzun vadeli/.test(ln)) bolum = 'UV';
      else if (/oz kaynak/.test(ln)) bolum = 'OZKAYNAK';
      continue;
    }

    // Gelir tablosu: "A. Brüt Satışlar" gibi başlıklar (nokta yok, harf ile başlar)
    const isGelirAna = /^[a-k][\.\s]/.test(ln) && !/^\.\s/.test(line);
    // Grup satırı: SADECE harf ile başlayan ". A." / ". B." satırları — toplam satırları
    // ". 1." / ". 3." gibi rakamla başlayan ALT KALEMLER dahil değil (çift sayım önlenir)
    const isGrupHarf = /^\.\s+[a-z][\.\s]/.test(ln);  // sadece harf: ". A.", ". B." vs.
    const isAltRakam = /^\.\s+\d+[\.\s]/.test(ln);    // rakam alt kalem: ". 1.", ". 3." vs.
    // ". 2. Yurtdışı Satışlar" — ihracat tespiti için tek istisna
    const isYurtdisi = /^\.\s+\d+\.?\s*yurt/.test(ln);  // boşluk/nokta varyasyonlarını yakala
    // KURAL: Alt rakam satırları atla (ihracat hariç) — grup harf satırları ve gelir ana satırları al
    const isOrtakAlt = isAltRakam && /ortaklardan alacak/.test(ln);
    if (isAltRakam && !isYurtdisi && !isOrtakAlt) continue;
    if (!isGrupHarf && !isGelirAna && !isGelirIJ && !isYurtdisi && !isOrtakAlt && !isGelirOzetBare && !isGelirRomanOlaganDisi) continue;

    // Sayıları çek: "Önceki Dönem  Cari Dönem" → son sayı = cari dönem
    const sayilar = [...line.matchAll(/(?<![\w\d])-?[\d]+[\d.]*,\d{2,4}/g)]
      .map(m => { const s = m[0].replace(/\./g,'').replace(',','.'); return parseFloat(s); })
      .filter(n => !isNaN(n));
    if (!sayilar.length) continue;

    // Sütun seçimi: son sütun = cari dönem (seçili yıl)
    // NOT: 0,00 meşru bir değerdir — fallback yapma, yoksa önceki dönem (2023) değeri alınır
    // 2023 beyannamesi 3 sütunlu (enflasyon): özkaynak "Dönem Net Karı" son sütun 0,00 → cari 2. sütun
    let cari = sayilar[sayilar.length - 1];
    // Hiç sayı yoksa atla (sadece başlık satırı)
    if (sayilar.length === 0) continue;

    // Label temizle: baştaki ". A." / "I." ve sondaki sayıları çıkar
    let label = ln.replace(/^\.\s+([a-z]|\d+)[\.\s]+/, '').replace(/[\d.,\s\(\)-]+$/, '').trim();
    label = label.replace(/^[a-j]\.\s+/, '').trim();
    label = label.replace(/^i\.\s+/, '').trim();

    const isMinus = line.includes('(-)');

    // Key bul
    let key = null;
    let matched = false;
    for (const [pat, k] of BEYAN_GRUP_MAP) {
      if (pat.test(label)) { key = k; matched = true; break; }
    }
    if (!matched) {
      const labChk = normTR(String(label).trim());
      if (/g\.?v\.?k\.?\s*113|mad\.\s*kapsaminda|hasiat\s+esasli|yurtici\s+satis|yurt\s*ici\s+satis/i.test(labChk)) continue;
      importLog(`  ? Eşleşmedi: "${label.substring(0,40)}"`, 'warn');
      continue;
    }
    if (key === null) continue; // Hesaplanan satır (brüt satış karı vb.) — atla

    // Dönem net karı yalnızca applyDonemNetKarFinal ile (çift yazım önlenir)
    if (key === 'donemNetKar' || key === 'donemNetKarGelir') continue;

    // ── YILLARA YAYGIN BÖLÜM OVERRIDE ─────────────────────────────────────
    // PDF'de başlık kırpılır: ". F. Yıllara Yaygın İnşaat ve Onarım" (Maliyetleri/Hakedişleri yok)
    // Her iki satır da aynı label'a düşer → bölüme göre ayırt et:
    //   DONEN bölümü  → yilYayginMal  (Hesap 17x, AKTİF)
    //   KV bölümü     → yilHakediş   (Hesap 35x, PASİF)
    if (key === 'yilYayginMal' && bolum === 'KV')     key = 'yilHakediş';
    if (key === 'yilHakediş'   && bolum === 'DONEN')  key = 'yilYayginMal';
    // KV'de "Gelirler ve Gider Tahakkukları" (H.) yanlışlıkla gelecekAyGider ile eşleşirse düzelt
    if (bolum === 'KV' && key === 'gelecekAyGider' && /gelirler.*ve.*gider|gelirler ve gider/i.test(label)) key = 'gelecekAyGelir';
    // ── Not: Alt rakam satırları yukarıda zaten filtrelendi ───────────────────

    // UV bölümünde key override
    if (bolum === 'UV') {
      const uvMap = {
        kvMaliBorclar:'uvMaliBorclar', kvTicBorclar:'uvTicBorclar',
        kvDigBorclar:'uvDigBorclar',   alinanAvans:'uvAlinanAvans',
        borcKarsilik:'uvBorcKarsilik', digerKvYK:'uvDigYK',
        odenecekVergi:'uvDigYK',       gelecekAyGelir:'uvDigYK',
      };
      key = uvMap[key] || key;
    }
    // Duran varlıkta ticari/diğer alacaklar uzun vadeli key'e override edilir
    if (bolum === 'DURAN' && key === 'ticAlacaklar')  key = 'uzunTicAlacak';
    if (bolum === 'DURAN' && key === 'digerAlacaklar') key = 'uzunDigAlacak';

    // Sadece gerçekten negatif katkı yapması gereken bilanço kalemleri:
    // amortisman, birikmiş değer düşüklüğü, ödenmemiş sermaye gibi aktifi düşenler
    // Gelir tablosu kalemleri: DAIMA pozitif — sistem key'e göre işler
    // Geçmiş Yıllar Zararı, Satış İndirimleri vb. kendi key'lerinde işlenir
    const GELIR_KEYS = new Set(['brutSatis','satisInd','satMaliyet','faalGider',
      'digerFaalGelir','digerFaalGider','finansmanGider',
      'olagandisiGelir','olagandisiGider','vergiKarsilik','donemKar']);
    // (-) negatif katkı sadece aktif düşüm kalemleri için (amortisman, birik. değer düş.)
    const MINUS_BILANCO_KEYS = new Set(['maddiOlmayan','maddiDuranVar','maliDuranVar','digerDuran']);
    let katki;
    if (GELIR_KEYS.has(key)) {
      katki = cari; // Gelir tablosu: daima pozitif
    } else if (isMinus && MINUS_BILANCO_KEYS.has(key)) {
      katki = -cari; // Amortisman gibi düşüm kalemleri: negatif
    } else {
      katki = cari; // Tüm bilanço kalemleri: pozitif (zararlar kendi key'inde)
    }
    // gecmisZarar daima pozitif kaydedilir — hesapToplamlar ozKaynak'tan düşer
    // borcKarsilik / gecmisZarar / odenmisSermaye: Math.abs → pozitif (ayrı key'de işlenir)
    // Diğer bilanço kalemleri: negatif PDF değeri olduğu gibi geçebilir
    const FORCE_POSITIVE = new Set(['gecmisZarar','odenmisSermaye']);
    result[key] = (result[key] || 0) + (FORCE_POSITIVE.has(key) ? Math.abs(katki) : katki);
    // NOT: PDF beyannamede A.Brüt Satışlar zaten toplam — ihracat brutSatis'e EKLENMIYOR
  }

  // Dönem net karı: gelir tablosu "Dönem Net Karı veya Zararı" öncelikli (bilanço önce gelince çift sayım olmasın)
  // ── KRİTİK: Yalnızca year===2023 (2022 yok, 2024+ yok). Dönem net kar gelir tablosundan okunmaz; bu blok bilanço fallback de yazmaz; alan boş kalır.
  (function applyDonemNetKarFinal() {
    if (year === 2023) return;
    const numRe = /(?<![\w\d])-?[\d]+[\d.]*,\d{2,4}/g;
    function pickCari(sayilar) {
      if (!sayilar.length) return null;
      let cari = sayilar[sayilar.length - 1];
      if (year === 2023 && sayilar.length >= 2 && Math.abs(sayilar[sayilar.length - 1]) < 1e-9) {
        cari = sayilar[sayilar.length - 2];
      }
      return cari;
    }
    function lineIsDonemNetKarVeyaZarar(t) {
      const u = t.replace(/^[a-k]\.\s*/i, '').trim();
      return /^donem net kar/i.test(u) && /veya\s+(zarar|kari)/i.test(u);
    }
    function lineIsDonemKarVeyaZarar(t) {
      const u = t.replace(/^[a-k]\.\s*/i, '').trim();
      return /^donem kar/i.test(u) && /veya\s+(zarar|kari)/i.test(u) && !/vergi|yasal yukumluluk|net kar/i.test(u);
    }
    let inGelirTablosu = false;
    let dnk = null;
    let dk = null;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const t = normTR(line);
      if (/\bkar\s+dagitim\s+tablosu\b/i.test(t)) inGelirTablosu = false;
      if (/\bgelir tablosu\b/i.test(t) && !/\bgelir tablosu\s+dipnot/i.test(t)) inGelirTablosu = true;
      const sayilarDn = [...line.matchAll(numRe)]
        .map(m => { const s = m[0].replace(/\./g,'').replace(',','.'); return parseFloat(s); })
        .filter(n => !isNaN(n));
      if (!sayilarDn.length) continue;
      if (lineIsDonemNetKarVeyaZarar(t)) dnk = pickCari(sayilarDn);
      if (lineIsDonemKarVeyaZarar(t)) dk = pickCari(sayilarDn);
    }
    if (dk !== null) result['donemKar'] = dk;
    if (dnk !== null) {
      result['donemNetKar'] = dnk;
      result['donemNetKarGelir'] = dnk;
      return;
    }
    if (dk !== null && result['vergiKarsilik'] != null) {
      const net = dk - (result['vergiKarsilik'] || 0);
      result['donemNetKar'] = net;
      result['donemNetKarGelir'] = net;
      return;
    }
    let b2 = null;
    const isGelirIJ2 = (ln, line) => /^[ij]\.\s+/.test(ln) && !/^\.\s/.test(line) && (/olagan|olagandisi|olagan dis/.test(ln));
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.length < 5) continue;
      const ln = normTR(line);
      const isRoman2 = /^(i{1,3}v?|iv|v|vi|vii)\b/i.test(ln) && !/^\.\s/.test(line.trim());
      const isRomanDigerKv2 = /^(i{1,3}v?|iv|v|vi|vii)\b/i.test(ln) &&
        /diger.*kisa\s*vadeli/i.test(ln) && /yabanci/i.test(ln);
      if (isRoman2 && !isGelirIJ2(ln, line) && !isRomanDigerKv2) {
        if (/donen varlik|donen/.test(ln) && !/duran/.test(ln)) b2 = 'DONEN';
        else if (/duran varlik|duran/.test(ln)) b2 = 'DURAN';
        else if (/kisa vadeli/.test(ln)) b2 = 'KV';
        else if (/uzun vadeli/.test(ln)) b2 = 'UV';
        else if (/oz kaynak/.test(ln)) b2 = 'OZKAYNAK';
        continue;
      }
      const isGrupHarf2 = /^\.\s+[a-z][\.\s]/.test(ln);
      if (!isGrupHarf2) continue;
      const sayilar = [...line.matchAll(numRe)]
        .map(m => { const s = m[0].replace(/\./g,'').replace(',','.'); return parseFloat(s); })
        .filter(n => !isNaN(n));
      if (!sayilar.length) continue;
      let lab = ln.replace(/^\.\s+([a-z]|\d+)[\.\s]+/, '').replace(/[\d.,\s\(\)-]+$/, '').trim();
      lab = lab.replace(/^[a-j]\.\s+/, '').trim();
      if (!/donem net kar/.test(lab) || b2 !== 'OZKAYNAK') continue;
      let cari = sayilar[sayilar.length - 1];
      if (year === 2023 && sayilar.length >= 2 && Math.abs(sayilar[sayilar.length - 1]) < 1e-9) cari = sayilar[sayilar.length - 2];
      result['donemNetKar'] = cari;
      break;
    }
  })();

  // Firma ünvanını birleştir
  if (unvan1 || unvan2) {
    result._firmaAdi = (unvan1 + (unvan2 ? ' ' + unvan2 : '')).trim();
  }
  const n = Object.keys(result).filter(k => !k.startsWith('_') && result[k] !== 0).length;
  importLog(`✅ Beyanname: ${n} kalem eşleştirildi`, n > 0 ? 'ok' : 'warn');
  return result;
}

// ── MİZAN FORMATLI PDF PARSER ─────────────────────────────────────────────────
// 3 haneli hesap kodu içeren satırlar
// ── KOORDİNAT BAZLI PDF MİZAN PARSER (YENİ) ──────────────────────────────────
// Mevcut fonksiyonlara dokunmaz. Sadece PDF'den gelen koordinat bilgisini kullanır.
// PDF sütun sınırları (YOL BAK formatı, A4 sayfa ~595pt):
//   BORÇ     : ~305-385   ALACAK    : ~385-450
//   BAK.BORÇ : ~450-513   BAK.ALACAK: ~513-600
function mizanTextIsleMizanKoordinat(structuredLines, result, silent) {
  const COL_BAKBORC_MIN  = 440;
  const COL_BAKBORC_MAX  = 513;
  const COL_BAKALAC_MIN  = 513;
  const COL_BAKALAC_MAX  = 600;

  function parseNum(s) {
    const v = parseFloat(s.replace(/[.]/g, '').replace(',', '.'));
    return isNaN(v) ? 0 : v;
  }

  for (const sl of structuredLines) {
    const trimmed = sl.text.trim();
    if (!trimmed || trimmed.length < 5) continue;

    // Satır başı: 100 KASA (özet) veya 100.01 … (hazır özet kodlarında yalnız ana satır toplanır)
    const m = trimmed.match(/^([1-6]\d{2})(?:[.\-]\d+)?\s+\S/);
    if (!m) continue;
    const rawKod = parseInt(m[1], 10);
    const key = KOD_TO_KEY[rawKod];
    if (!key) continue;

    if (key === 'hazirDegerler' && PDF_MIZAN_HAZIR_OZET_KOD.has(rawKod) && !pdfMizanHazirAnaSatirMi(trimmed)) continue;
    if (key === 'ticAlacaklar' && PDF_MIZAN_TICARI_OZET_KOD.has(rawKod) && !pdfMizanTicariAlacakAnaSatirMi(trimmed)) continue;
    if (key === 'digerAlacaklar' && PDF_MIZAN_DIGER_OZET_KOD.has(rawKod) && !pdfMizanDigerAlacakAnaSatirMi(trimmed)) continue;
    if (key === 'stoklar' && PDF_MIZAN_STOK_OZET_KOD.has(rawKod) && !pdfMizanStokAnaSatirMi(trimmed)) continue;
    if (key === 'digerDonen' && PDF_MIZAN_DIGER_DONEN_OZET_KOD.has(rawKod) && !pdfMizanDigerDonenAnaSatirMi(trimmed)) continue;
    if (PDF_MIZAN_DURAN_2529_OZET_KOD.has(rawKod) && !pdfMizanDuran2529AnaSatirMi(trimmed, rawKod)) continue;
    if (pdfMizanGrupOzetSatirMi(key, rawKod) && pdfMizanGrupOzetPasifGelirNoktaliAltMi(trimmed, rawKod)) continue;

    // Bilanço + gelir (100–699) grup özetleri: "620 SATMAL…" gibi; "620 01…" atlanır
    if (pdfMizanGrupOzetSatirMi(key, rawKod)) {
      const head = trimmed.match(/^([1-6]\d{2})(?:[.\-]\d+)?\s+/);
      if (!head) continue;
      const afterKoord = trimmed.slice(head[0].length).trim();
      if (!afterKoord.length || pdfMizanGrupOzetRakamKuyrukAtlansinMi(afterKoord, rawKod)) continue;
    }

    // BAK.BORÇ ve BAK.ALACAK sütunlarındaki değerleri koordinata göre topla
    let borcBak = 0, alacBak = 0;
    for (const item of sl.items) {
      const x = item.x;
      const v = parseNum(item.str);
      if (v <= 0) continue;
      if (x >= COL_BAKBORC_MIN && x < COL_BAKBORC_MAX) borcBak += v;
      else if (x >= COL_BAKALAC_MIN && x < COL_BAKALAC_MAX) alacBak += v;
    }
    if (borcBak === 0 && alacBak === 0) continue;

    // 100–699: bak.borç / bak.alacak → hesapDeger (aktif/pasif/gelir + MINUS_KODLAR)
    if (rawKod < 100 || rawKod > 699) continue;
    const net = hesapDeger(rawKod, borcBak, alacBak);
    if (Math.abs(net) > MIZAN_PDF_MAX_PLAUSIBLE_TL) continue;
    if (net === 0) continue;
    if (rawKod === 131) {
      result['ortakAlacak131'] = (result['ortakAlacak131'] || 0) + Math.max(0, net);
      continue;
    }
    const deltaKoord = key === 'gecmisZarar' ? Math.abs(net) : net;
    result[key] = (result[key] || 0) + deltaKoord;
    if (rawKod === 601) result['ihracat'] = (result['ihracat'] || 0) + Math.abs(net);
  }

  const n = Object.keys(result).filter(k => result[k] !== 0).length;
  if (!silent) importLog(`✅ Mizan PDF (koordinat): ${n} kalem eşleştirildi`, n > 0 ? 'ok' : 'warn');
  return result;
}

/** Yalnız "102 BANKALAR" (102 + boşluk + harf); 102.01… atlanır — pdfMizanHazirAnaSatirMi ile uyumlu */
function pdfMizanKoord102BakBorcOzet(structuredLines) {
  const COL_BAKBORC_MIN = 440;
  const COL_BAKBORC_MAX = 513;
  const COL_BAKALAC_MIN = 513;
  const COL_BAKALAC_MAX = 600;
  function parseNum(s) {
    const v = parseFloat(String(s).replace(/[.]/g, '').replace(',', '.'));
    return isNaN(v) ? 0 : v;
  }
  for (const sl of structuredLines) {
    const trimmed = sl.text.trim();
    if (!/^102\s+[A-Za-zÇĞİÖŞÜçğıöşü]/.test(trimmed)) continue;
    const after102 = trimmed.replace(/^102\s+/, '');
    if (!after102.length) continue;
    let borcBak = 0, alacBak = 0;
    for (const item of sl.items) {
      const v = parseNum(item.str);
      if (v <= 0) continue;
      const x = item.x;
      if (x >= COL_BAKBORC_MIN && x < COL_BAKBORC_MAX) borcBak += v;
      else if (x >= COL_BAKALAC_MIN && x < COL_BAKALAC_MAX) alacBak += v;
    }
    if (borcBak === 0 && alacBak === 0) continue;
    const isM = MINUS_KODLAR.has(102);
    const katki = isM ? (alacBak - borcBak) : (borcBak - alacBak);
    if (katki === 0) continue;
    return Math.abs(katki);
  }
  return 0;
}

/** Metin hazır toplamı 102 bakiyesinden küçükse (102 eksik), koordinat bak.borç ekle — çift sayım: h >= kb ise dokunma */
function pdfMizanSupplementHazir102FromKoord(result, structuredLines) {
  const kb = pdfMizanKoord102BakBorcOzet(structuredLines);
  if (kb <= 0 || kb > MIZAN_PDF_MAX_PLAUSIBLE_TL) return false;
  const h = result.hazirDegerler || 0;
  if (h >= kb) return false;
  result.hazirDegerler = h + kb;
  return true;
}

/** PDF metin mizanı: satır içi 0059145 gibi küçük tamsayıları buda (4 sütundan önce gelen gürültü) */
function pdfMizanTrimLeadingHesapNoise(sayilar) {
  const s = [...sayilar];
  while (s.length >= 4 && s[0] > 0 && s[0] < 1e6 && s[0] === Math.floor(s[0])) {
    s.shift();
  }
  return s;
}

/**
 * Bilanço satırı: hesap kodundan sonra açıklama harfle başlıyorsa özet (100 KASA, 102 BANKALAR) — atla.
 * Ardından gelen ardışık 2–3 haneli alt kod adedi; 3'ten az ise ara özet (102 01 …), yaprak değil — çift toplamı önler.
 */
function pdfMizanBilancoSatirAtla(line, kodMatch) {
  const t = line.slice(kodMatch.index + kodMatch[0].length).trim();
  if (!t.length) return true;
  if (/^[A-Za-zÇĞİÖŞÜçğıöşü]/.test(t)) return true;
  const parts = t.split(/\s+/);
  let depth = 0;
  for (const p of parts) {
    if (/^\d{2}$/.test(p) || /^\d{3}$/.test(p)) depth++;
    else break;
  }
  return depth < 3;
}

/**
 * BORÇ | ALACAK | BAKİYE BORÇ | BAKİYE ALACAK
 * - n≥4: son iki = bakiye borç, bakiye alacak (önceki ikisi dönem toplamı — katkıya girmez).
 * - n=3: dönem borç, dönem alacak, üçüncü = tek bakiye sütunu — aktifte bak.borç, pasifte bak.alacak.
 * - 600–699 n=3: gider (MINUS_KODLAR) → üçüncü = bak.borç; gelir → üçüncü = bak.alacak (pasif ile aynı taraf).
 * - n=2: çoğu PDF dönem borç|alacak → [0,0]. 25–29 duran (250–299) iki eşit tutar = yinelenen bakiye sütunu.
 * Excel mizan bu fonksiyonu kullanmaz.
 */
function pdfMizanPickBakBorcAlacBak(sayilar, kod, rawKod) {
  const s = pdfMizanTrimLeadingHesapNoise(sayilar);
  const n = s.length;
  let borcBak = 0, alacBak = 0;
  if (n === 0) return [0, 0];
  if (n >= 4) {
    borcBak = s[n - 2];
    alacBak = s[n - 1];
  } else if (n === 3) {
    if (kod >= 100 && kod <= 299) {
      borcBak = s[2];
      alacBak = 0;
    } else if (kod >= 300 && kod <= 591) {
      borcBak = 0;
      alacBak = s[2];
    } else if (kod >= 600 && kod <= 699) {
      if (MINUS_KODLAR.has(rawKod)) {
        borcBak = s[2];
        alacBak = 0;
      } else {
        borcBak = 0;
        alacBak = s[2];
      }
    } else {
      borcBak = 0;
      alacBak = 0;
    }
  } else if (n === 2) {
    if (PDF_MIZAN_DURAN_2529_OZET_KOD.has(rawKod)) {
      const a = s[0], b = s[1];
      const mx = Math.max(a, b);
      if (mx > 0 && Math.abs(a - b) / mx < 1e-9) return [a, b];
    }
    return [0, 0];
  } else {
    const v = s[0];
    if (kod >= 100 && kod <= 299) borcBak = v;
    else if (kod >= 300 && kod <= 591) alacBak = v;
    else if (kod >= 600 && kod <= 699) {
      if (MINUS_KODLAR.has(rawKod)) borcBak = v;
      else alacBak = v;
    } else borcBak = v;
  }
  return [borcBak, alacBak];
}

function mizanTextIsleMizan(lines, result, silent) {
  // PDF mizan: çoğu dosyada 2 haneli özet satır yok → yalnızca 3 haneli satır başı kodlar.
  // Hazır / 12–13–15 / 19 diğer dönen / duran 25–29: YOL BAK ana satır; 17–18 ve 24 genişletme yok

  function pdfMizanParaTokenlari(tail) {
    return [...tail.matchAll(/[0-9][0-9.,]*/g)].map(m => m[0]).filter(tok => {
      if (tok.includes(',')) return true;
      if (tok.includes('.') && /^\d{1,3}(\.\d{3})+$/.test(tok.replace(/\s/g, ''))) return true;
      return false;
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/^\uFEFF/, '');
    if (!line.trim() || line.trim().length < 5) continue;

    const kodMatch = line.match(/^\s*([1-6]\d{2})(?:[.\-]\d+)?(?!\d)/);
    if (!kodMatch) continue;

    const rawKod = parseInt(kodMatch[1], 10);
    if (rawKod < 100) continue;

    const key = KOD_TO_KEY[rawKod];
    if (!key) continue;
    const kod = rawKod;

    if (key === 'hazirDegerler' && PDF_MIZAN_HAZIR_OZET_KOD.has(rawKod)) {
      const after = line.slice(kodMatch.index + kodMatch[0].length).trim();
      if (/^\d/.test(after)) continue;
      if (!pdfMizanHazirAnaSatirMi(line)) continue;
    }
    if (key === 'ticAlacaklar' && PDF_MIZAN_TICARI_OZET_KOD.has(rawKod) && !pdfMizanTicariAlacakAnaSatirMi(line)) continue;
    if (key === 'digerAlacaklar' && PDF_MIZAN_DIGER_OZET_KOD.has(rawKod) && !pdfMizanDigerAlacakAnaSatirMi(line)) continue;
    if (key === 'stoklar' && PDF_MIZAN_STOK_OZET_KOD.has(rawKod) && !pdfMizanStokAnaSatirMi(line)) continue;
    if (key === 'digerDonen' && PDF_MIZAN_DIGER_DONEN_OZET_KOD.has(rawKod) && !pdfMizanDigerDonenAnaSatirMi(line)) continue;
    if (PDF_MIZAN_DURAN_2529_OZET_KOD.has(rawKod) && !pdfMizanDuran2529AnaSatirMi(line, rawKod)) continue;
    if (pdfMizanGrupOzetSatirMi(key, rawKod) && pdfMizanGrupOzetPasifGelirNoktaliAltMi(line, rawKod)) continue;
    if (pdfMizanGrupOzetSatirMi(key, rawKod)) {
      const afterGr = line.slice(kodMatch.index + kodMatch[0].length).trim();
      if (!afterGr.length || pdfMizanGrupOzetRakamKuyrukAtlansinMi(afterGr, rawKod)) continue;
    }

    if (rawKod >= 100 && rawKod <= 599 && key !== 'hazirDegerler' &&
        !pdfMizanGrupOzetSatirMi(key, rawKod) &&
        pdfMizanBilancoSatirAtla(line, kodMatch)) continue;

    let workLine = line;
    let extra = 0;
    // PDF satır kırığı: hesap adı bir satır, tutarlar altta — hazır + grup özet (bilanço + gelir)
    if ((key === 'hazirDegerler' && PDF_MIZAN_HAZIR_OZET_KOD.has(rawKod)) ||
        pdfMizanGrupOzetSatirMi(key, rawKod)) {
      let tailTry = workLine.slice(kodMatch.index + kodMatch[0].length);
      let toksTry = pdfMizanParaTokenlari(tailTry);
      let numsTry = toksTry.map(m => parseImportNumber(m)).filter(n => n !== null && isFinite(n) && n >= 0);
      while (numsTry.length < 3 && i + 1 + extra < lines.length) {
        const nxt = lines[i + 1 + extra].replace(/^\uFEFF/, '').trim();
        if (!nxt) {
          extra++;
          continue;
        }
        if (/^\s*[1-6]\d{2}(?:[.\-]\d+)?(?!\d)/.test(nxt)) break;
        if (!/^\d/.test(nxt)) break;
        workLine = workLine + ' ' + nxt;
        extra++;
        tailTry = workLine.slice(kodMatch.index + kodMatch[0].length);
        toksTry = pdfMizanParaTokenlari(tailTry);
        numsTry = toksTry.map(m => parseImportNumber(m)).filter(n => n !== null && isFinite(n) && n >= 0);
      }
      i += extra;
    }

    const tail = workLine.slice(kodMatch.index + kodMatch[0].length);
    const moneyTokens = pdfMizanParaTokenlari(tail);
    const sayilar = moneyTokens
      .map(m => parseImportNumber(m))
      .filter(n => n !== null && isFinite(n) && n >= 0);
    if (!sayilar.length) continue;

    const [borcBak, alacBak] = pdfMizanPickBakBorcAlacBak(sayilar, kod, rawKod);
    if (borcBak === 0 && alacBak === 0) continue;

    const isMinus = MINUS_KODLAR.has(rawKod);
    let katki = 0;
    if (kod >= 100 && kod <= 299)
      katki = isMinus ? -(alacBak || borcBak) : (borcBak || -alacBak);
    else if (kod >= 300 && kod <= 591)
      katki = isMinus ? -(borcBak || alacBak) : (alacBak || -borcBak);
    else
      katki = isMinus ? (borcBak || alacBak) : (alacBak || borcBak);

    if (katki === 0) continue;
    const absK = Math.abs(katki);
    if (absK > MIZAN_PDF_MAX_PLAUSIBLE_TL) continue;
    if (kod >= 100 && kod <= 591) {
      if (rawKod === 131) {
        result['ortakAlacak131'] = (result['ortakAlacak131'] || 0) + Math.max(0, katki);
        continue;
      }
      const deltaTxt = key === 'gecmisZarar' ? absK : katki;
      result[key] = (result[key] || 0) + deltaTxt;
    } else {
      result[key] = (result[key] || 0) + absK;
      if (rawKod === 601) result['ihracat'] = (result['ihracat'] || 0) + absK;
    }
  }

  const n = Object.keys(result).filter(k => result[k] !== 0).length;
  if (!silent) importLog(`✅ Mizan PDF: ${n} kalem eşleştirildi`, n > 0 ? 'ok' : 'warn');
  return result;
}


// ─────────────────────────────────────────────────────────────────
// SONUÇ & UYGULAMA
// ─────────────────────────────────────────────────────────────────
function finalizeImport(data) {
  const girilen = Object.entries(data).filter(([k, v]) => !k.startsWith('_') && v && v !== 0);

  if (girilen.length === 0) {
    importLog('⚠️ Hiçbir hesap kalemi eşleştirilemedi.', 'warn');
    if (window._nfMaliImportReject) {
      const rej = window._nfMaliImportReject;
      window._nfMaliImportReject = null;
      window._nfMaliImportResolve = null;
      rej(new Error('Eşleşen hesap bulunamadı'));
    }
    return;
  }

  if (data._firmaAdi) importLog(`🏢 Firma: <b>${data._firmaAdi}</b>`, 'ok');
  importLog(`🎯 <b>${girilen.length}</b> kalem okundu (${importState._formatLabel || 'dosya'})`, 'ok');

  if (typeof hesapToplamlarOnObject === 'function' && importState.year) {
    const probe = { ...data };
    hesapToplamlarOnObject(probe, importState.year);
    const a = probe.aktifToplam || 0;
    const p = probe.pasifToplam || 0;
    const fark = a - p;
    if (Math.abs(fark) >= 1) {
      const dnk = probe.donemNetKar || probe.donemNetKarGelir || 0;
      const gelirKapanis =
        Math.abs(Math.abs(fark) - Math.abs(dnk)) < 1000 &&
        Math.abs(dnk) >= 1 &&
        !(probe._mizan590591 || probe.donemNetKarBilanco);
      importLog(
        `⚖️ Okunan bilanço özeti: Aktif <b>${a.toLocaleString('tr-TR')}</b> · Pasif <b>${p.toLocaleString('tr-TR')}</b> · Fark <b>${fark.toLocaleString('tr-TR')}</b> TL` +
          (gelirKapanis
            ? ' <span style="opacity:.85">(590/591 yok — gelir tablosu kapanışı özkaynağa işlenmeli; sayfayı yenileyin)</span>'
            : ''),
        'warn',
      );
    } else {
      importLog(`⚖️ Bilanço dengesi: Aktif = Pasif (<b>${a.toLocaleString('tr-TR')}</b> TL)`, 'ok');
    }
  }

  importState.parsed = data;

  if (window._nfMaliImportResolve) {
    const res = window._nfMaliImportResolve;
    window._nfMaliImportResolve = null;
    window._nfMaliImportReject = null;
    res({
      data,
      format: importState._formatLabel || 'dosya',
      count: girilen.length,
      year: importState.year,
    });
    return;
  }

  if (importState.silentYear) {
    importState.silentYear = null;
    applyParsedToYear(data, importState.year);
    return;
  }
  const applyBtn = document.getElementById('importApplyBtn');
  if (applyBtn) applyBtn.style.display = 'block';
}

function applyImport() {
  if (!importState.parsed) {
    showToast('⚠️ Lütfen önce dosya yükleyin ve eşleştirme sonucunu bekleyin');
    return;
  }
  const year = importState.year;
  if (!year || year < 2020 || year > 2030) {
    showToast('⚠️ Lütfen hedef yılı seçin');
    return;
  }
  // Import öncesi o yılın tüm verisini sıfırla
  // Eski değerler üstüne import = çift sayım hatası
  state.yearData[year] = {};

  let n = 0;
  Object.entries(importState.parsed).forEach(([key, val]) => {
    if (key.startsWith('_')) return;
    if (val !== null && val !== 0) {
      state.yearData[year][key] = val;
      n++;
    }
  });

  // Gelir tablosu varsa donemNetKar sıfırla — SADECE 2023: dönem net karı kasıtlı boş (gelir tablosu kullanılmaz)
  const d0 = state.yearData[year];
  if ((d0.brutSatis || d0.satMaliyet || d0.faalGider) && year !== 2023) {
    d0.donemNetKar = 0;
  }
  if (year === 2023) d0.donemNetKar = 0;
  normalizeOrtakAlacak131(d0);

  // Önce eksik toplamları hesapla
  hesapToplamlar(year);

  // Sonra tüm input alanlarını güncelle (toplamlar dahil)
  document.querySelectorAll(`input[data-key][data-year="${year}"]`).forEach(inp => {
    const key = inp.dataset.key;
    if (state.yearData[year][key] !== undefined && state.yearData[year][key] !== 0) {
      inp.value = fmtN(state.yearData[year][key]);
    }
  });

  recalc();  // total_ span'larını ve state'i günceller
  autoSave();  // Veriyi otomatik kaydet

  hideImportModal();
  showToast(`✓ ${year} yılı için ${n} kalem aktarıldı`);
}

// Bilanço toplamlarını alt kalemlerden hesapla
function hesapToplamlar(year) {
  const d = state.yearData[year];
  if (!d) return;
  const sum = (...keys) => keys.reduce((t, k) => t + (d[k] || 0), 0);

  // Dönen Varlık = alt kalemler toplamı (yoksa sıfır)
  const donenYeni = sum('hazirDegerler','menkKiymetler','ticAlacaklar','digerAlacaklar','stoklar','yilYayginMal','gelecekAyGider','digerDonen');
  if (!d.donenVarlik || donenYeni > d.donenVarlik) d.donenVarlik = donenYeni;

  // Duran Varlık
  const duranYeni = sum('uzunTicAlacak','uzunDigAlacak','maliDuranVar','maddiDuranVar','maddiOlmayan','ozelTukenme','gelecekYilGider','digerDuran');
  if (!d.duranVarlik || duranYeni > d.duranVarlik) d.duranVarlik = duranYeni;

  // Aktif Toplam
  d.aktifToplam = (d.donenVarlik||0) + (d.duranVarlik||0);

  // KV / UV Yabancı Kaynak — 2025'te UV ticari KV ticariye dahil
  const { kvTic: kvTicEff, uvTic: uvTicEff } = ticBorclarEtkinKvUv(year, d);
  const kvAlt = sum('kvMaliBorclar','kvDigBorclar','alinanAvans','yilHakediş','odenecekVergi','borcKarsilik','gelecekAyGelir','digerKvYK') + kvTicEff;
  d.kvYKToplam = kvAlt > 0 ? kvAlt : (d.kvYKToplam || 0);

  const uvAlt = sum('uvMaliBorclar','uvDigBorclar','uvAlinanAvans','uvBorcKarsilik','uvDigYK') + uvTicEff;
  d.uvYKToplam = uvAlt > 0 ? uvAlt : (d.uvYKToplam || 0);

  // Net Satışlar
  const netSatisYeni = (d.brutSatis||0) - (d.satisInd||0);
  if (!d.netSatis || netSatisYeni > 0) d.netSatis = netSatisYeni;

  // Brüt Satış Karı
  d.brutSatisKar = (d.netSatis||0) - (d.satMaliyet||0);

  // Faaliyet Karı
  d.faalKar = (d.brutSatisKar||0) - (d.faalGider||0);

  // Olağan Kar
  d.olagan = (d.faalKar||0) + (d.digerFaalGelir||0) - (d.digerFaalGider||0) - (d.finansmanGider||0);

  // Dönem Karı
  d.donemKar = (d.olagan||0) + (d.olagandisiGelir||0) - (d.olagandisiGider||0);

  // Dönem Net Karı: gelir tablosu varsa oradan hesapla (bilanço değerini override et)
  // SADECE 2023: dönem net karı gelir tablosundan hesaplanmaz; import da yazmaz — alan boş kalır (yukarıdaki blok donemNetKar'a dokunmaz)
  if (year !== 2023) {
    if (d.brutSatis || d.satMaliyet || d.faalGider) {
      d.donemNetKar = (d.donemKar||0) - (d.vergiKarsilik||0);
    } else if (!d.donemNetKar) {
      d.donemNetKar = (d.donemKar||0) - (d.vergiKarsilik||0);
    }
  }
  d.donemNetKarGelir = d.donemNetKar;
  if (typeof finSkorOzKaynakVePasif === 'function') finSkorOzKaynakVePasif(d);
}





// ────────────────────────────────────────────────────────────────
// IMPORT - Yardımcı Fonksiyonlar
// ────────────────────────────────────────────────────────────────
let importState = { year: 2025, parsed: null };

// Türkçe/İngilizce formatlı sayıyı float'a çevir
// "1.234.567,89" → 1234567.89 | "1,234,567.89" → 1234567.89
function parseImportNumber(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v).trim().replace(/\s/g,'');
  if (!s || s === '-' || s === '') return null;
  // Hem nokta hem virgül varsa: hangisi binlik hangisi ondalık?
  const hasComma = s.includes(',');
  const hasDot   = s.includes('.');
  let clean;
  if (hasComma && hasDot) {
    // Son seperatör ondalık: "1.234,56" veya "1,234.56"
    const lastComma = s.lastIndexOf(',');
    const lastDot   = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      // Türkçe: nokta=binlik, virgül=ondalık
      clean = s.replace(/\./g,'').replace(',','.');
    } else {
      // İngilizce: virgül=binlik, nokta=ondalık
      clean = s.replace(/,/g,'');
    }
  } else if (hasComma) {
    // Sadece virgül: Türkçe ondalık veya binlik
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      clean = s.replace(',', '.'); // ondalık
    } else {
      clean = s.replace(/,/g,''); // binlik
    }
  } else if (hasDot) {
    // Sadece nokta: "1.542.620.742" TR binlik (virgül yok) — aksi halde parseFloat "1.542" keser
    const sTrim = s.replace(/\s/g, '');
    if (/^\d{1,3}(\.\d{3})+$/.test(sTrim)) {
      clean = sTrim.replace(/\./g, '');
    } else {
      clean = s;
    }
  } else {
    clean = s;
  }
  const n = parseFloat(clean);
  return isFinite(n) ? n : null;
}

// TR normalize: ğ→g, ü→u vs.
function normTRChar(s) {
  return String(s||'').toLowerCase()
    .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
    .replace(/ı/g,'i').replace(/İ/g,'i').replace(/ö/g,'o').replace(/ç/g,'c');
}

function importLog(msg, type) {
  const el = document.getElementById('opening-import-log') || document.getElementById('importLog');
  if (!el) return;
  const color =
    type === 'err' ? '#be123c' : type === 'ok' ? '#059669' : type === 'warn' ? '#d97706' : 'var(--tx3)';
  if (msg) el.innerHTML += `<div style="color:${color};font-size:.78rem;margin:2px 0">${msg}</div>`;
  el.scrollTop = el.scrollHeight;
}

function openLastImportDialog() {
  const t = importState.lastType || 'excel';
  const id = t === 'pdf' ? 'importFilePDF' : 'importFileExcel';
  const el = document.getElementById(id);
  if (el) el.click();
}

function showImportModal() {
  const modal = document.getElementById('importModal');
  if (!modal) return;
  modal.style.display = 'flex';
  importState.lastType = null;
  const prog = document.getElementById('importProgress');
  const applyBtn = document.getElementById('importApplyBtn');
  const logEl = document.getElementById('importLog');
  // Önceki parse sonucu varsa koru — yıl değiştirip tekrar uygulayabilsin
  if (importState.parsed) {
    if (prog) prog.style.display = 'block';
    if (applyBtn) applyBtn.style.display = 'block';
    if (logEl) logEl.innerHTML = '<div style="color:var(--success);font-size:11px">✓ Önceki dosya yüklü — yıl seçip "Aktarımı Uygula"ya basın.</div>';
  } else {
    importState.parsed = null;
    if (prog) prog.style.display = 'none';
    if (applyBtn) applyBtn.style.display = 'none';
    if (logEl) logEl.innerHTML = '';
  }
  ['importFileExcel','importFilePDF'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  // Üstteki seçili yılı otomatik al
  const refYearEl = document.getElementById('refYear');
  const curYear = refYearEl ? (parseInt(refYearEl.value) || 2025) : 2025;
  importState.year = curYear;
  let matched = false;
  document.querySelectorAll('.import-yr-btn').forEach(b => {
    const active = parseInt(b.dataset.y) === curYear;
    b.classList.toggle('active', active);
    if (active) matched = true;
  });
  if (!matched) {
    importState.year = 2025;
    document.querySelectorAll('.import-yr-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.y === '2025');
    });
  }
  updateYrBtnLabels();
}

function hideImportModal() {
  const modal = document.getElementById('importModal');
  if (modal) modal.style.display = 'none';
  if (typeof unlockPageScroll === 'function') unlockPageScroll();
}

function updateYrBtnLabels() {
  document.querySelectorAll('.import-yr-btn').forEach(b => {
    const y = parseInt(b.dataset.y);
    const yd = state.yearData && state.yearData[y];
    const dolu = yd ? Object.values(yd).filter(v => v && v !== 0).length : 0;
    const badge = dolu > 3
      ? `<span style="font-size:9px;background:#f59e0b;color:#000;border-radius:3px;padding:0 3px;margin-left:4px">DOLU</span>`
      : `<span style="font-size:9px;color:var(--text-muted);margin-left:4px">boş</span>`;
    b.innerHTML = `${y}${badge}`;
  });
}

function selectImportYear(btn) {
  document.querySelectorAll('.import-yr-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  importState.year = parseInt(btn.dataset.y);
  // Zaten yüklü parse sonucu varsa Uygula butonunu göster
  if (importState.parsed) {
    const applyBtn = document.getElementById('importApplyBtn');
    if (applyBtn) applyBtn.style.display = 'block';
    importLog('💡 Yıl değiştirildi: <b>'+importState.year+'</b> — "Aktarımı Uygula" ile uygulayın', 'info');
  }
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (file) processImportFile(file);
}

function handleImportDrop(event) {
  event.preventDefault();
  const dz = document.getElementById('dropZone');
  if (dz) { dz.style.borderColor = 'var(--border)'; dz.style.background = ''; }
  const file = event.dataTransfer.files[0];
  if (file) processImportFile(file);
}

function processImportFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const prog = document.getElementById('importProgress');
  if (prog) prog.style.display = 'block';
  const logEl = document.getElementById('importLog');
  if (logEl) logEl.innerHTML = '';
  const applyBtn = document.getElementById('importApplyBtn');
  if (applyBtn) applyBtn.style.display = 'none';
  importState.parsed = null;

  importLog(`📁 <b>${file.name}</b> (${(file.size/1024).toFixed(1)} KB)`, 'info');
  importLog(`📅 Hedef yıl: <b>${importState.year}</b>`, 'info');

  // Hedef yılda veri var mı? Uyar ama devam et
  const yr = importState.year;
  const yd = state.yearData && state.yearData[yr];
  if (yd) {
    const doluSayisi = Object.values(yd).filter(v => v && v !== 0).length;
    if (doluSayisi > 3) {
      importLog(`⚠️ ${yr} yılında mevcut veri var (${doluSayisi} kalem). Üzerine yazılacak.`, 'warn');
    }
  }
  importLog('', 'info');

  // Dosya tipi tespiti - sadece uzantıya bak (MIME tipi güvenilmez)
  const isPDF   = ext === 'pdf' || file.type === 'application/pdf';
  const isExcel = ext === 'xlsx' || ext === 'xls';

  if (isExcel) {
    parseMizanExcel(file);
  } else if (isPDF) {
    parseMizanPDF(file);
  } else if (file.size > 0) {
    importLog(`⚠️ Uzantı tanınamadı (.${ext}), Excel formatı deneniyor...`, 'warn');
    parseMizanExcel(file);
  } else {
    importLog('❌ Geçersiz dosya.', 'err');
  }
}

// PDF parser — PDF.js ile metin çıkar, mizanTextIsle ile parse
function parseMizanPDF(file) {
  importLog('🔄 PDF okunuyor... (pdf.js yükleniyor)', 'info');

  if (typeof pdfjsLib !== 'undefined') {
    doParsePDF(file);
    return;
  }

  // Birden fazla CDN dene
  const PDFJS_URLS = [
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
    'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js'
  ];
  const WORKER_URLS = [
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
    'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
  ];

  let tried = 0;
  function tryLoad(idx) {
    if (idx >= PDFJS_URLS.length) {
      importLog('❌ PDF.js kütüphanesi yüklenemedi. İnternet bağlantısı gerekli.', 'err');
      importLog('💡 İpucu: PDF yerine Excel (.xlsx) mizan kullanmayı deneyin.', 'warn');
      return;
    }
    importLog(`   CDN deneniyor (${idx+1}/${PDFJS_URLS.length})...`, 'info');
    const script = document.createElement('script');
    script.src = PDFJS_URLS[idx];
    script.onload = () => {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_URLS[idx];
        importLog('✅ PDF.js yüklendi', 'ok');
        doParsePDF(file);
      } catch(e) { tryLoad(idx+1); }
    };
    script.onerror = () => tryLoad(idx+1);
    document.head.appendChild(script);
  }
  tryLoad(0);
}

async function doParsePDF(file) {
  try {
    importLog('📄 PDF sayfaları taranıyor...', 'info');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
    importLog(`📑 Toplam sayfa: ${pdf.numPages}`, 'info');
    
    let allText = '';
    const pdfStructuredLines = []; // koordinat bazlı analiz için
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // Satırları y koordinatına göre grupla
      const items = content.items;
      if (items.length === 0) continue;
      
      // y değerlerine göre sırala (sayfa yukarıdan aşağı)
      const byY = {};
      items.forEach(item => {
        const y = Math.round(item.transform[5]);
        if (!byY[y]) byY[y] = [];
        // x koordinatını da sakla — satır içi sıralama için
        byY[y].push({ x: item.transform[4], str: item.str });
      });
      
      // Satır satır metin oluştur — x'e göre sıralı (soldan sağa)
      const sortedY = Object.keys(byY).map(Number).sort((a,b) => b-a);
      sortedY.forEach(y => {
        const rowItems = byY[y].sort((a,b) => a.x - b.x);
        // Akıllı birleştirme: items arası mesafeye göre boşluk koy
        // Eğer bir sonraki item öncekinin hemen yanındaysa (fark < 2pt) boşluksuz
        let lineText = '';
        for (let k = 0; k < rowItems.length; k++) {
          const cur = rowItems[k];
          if (k === 0) { lineText += cur.str; continue; }
          const prev = rowItems[k-1];
          // prev item genişliği: str uzunluğu * ortalama karakter genişliği (~6pt)
          const prevWidth = (prev.width !== undefined) ? prev.width : prev.str.length * 6;
          const gap = cur.x - (prev.x + prevWidth);
          // gap > 3pt ise boşluk koy, aksi halde bitişik yaz
          lineText += (gap > 3 ? ' ' : '') + cur.str;
        }
        lineText = lineText.trim();
        allText += lineText + '\n';
        pdfStructuredLines.push({ text: lineText, items: rowItems });
      });
    }
    
    importLog(`✅ PDF metin çıkarıldı (${allText.length} karakter)`, 'ok');
    if (allText.length < 100) {
      importLog('⚠️ PDF içeriği çok az. Taranmış (görüntü) PDF olabilir.', 'warn');
      return;
    }
    
    const result = mizanTextIsle(allText, pdfStructuredLines);
    finalizeImport(result);
    
  } catch(err) {
    importLog(`❌ PDF okuma hatası: ${err.message}`, 'err');
    console.error(err);
    if (window._nfMaliImportReject) {
      const rej = window._nfMaliImportReject;
      window._nfMaliImportReject = null;
      window._nfMaliImportResolve = null;
      rej(err);
    }
  }
}
