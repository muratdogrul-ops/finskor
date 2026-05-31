/**
 * FinSkor kredi notu — NakitFlow 5Y bilanço (app.html RATING / B127-E127 ile uyumlu)
 */
(function (root) {
  const SUBJ_AUTO_PUAN = 20.6;

  const RATING_SCALE = [
    { note: 'AAA', color: '#22c55e', label: '93 üzeri', teminat: 'KEFALET OLMAKSIZIN ÇALIŞILABİLİR' },
    { note: 'AA', color: '#4ade80', label: '84 - 93', teminat: 'MADDİ TEMİNAT OLMAKSIZIN KEFALET KARŞILIĞI ÇALIŞILABİLİR' },
    { note: 'A', color: '#86efac', label: '76 - 84', teminat: 'MADDİ TEMİNAT OLMAKSIZIN KEFALET KARŞILIĞI ÇALIŞILABİLİR' },
    { note: 'BBB', color: '#fbbf24', label: '68 - 76', teminat: 'KEFALET VEYA MÜŞTERİ ÇEKİ KARŞILIĞI ÇALIŞILABİLİR' },
    { note: 'BB', color: '#f59e0b', label: '60 - 68', teminat: 'KEFALET İLE MÜŞTERİ ÇEKİ VEYA İPOTEK TEMİNATI KARŞILIĞI ÇALIŞILABİLİR' },
    { note: 'B', color: '#d97706', label: '52 - 60', teminat: 'İPOTEK VE MÜŞTERİ ÇEKİ TEMİNATI KARŞILIĞI ÇALIŞILABİLİR' },
    { note: 'CCC', color: '#fb923c', label: '44 - 52', teminat: 'MARJLI İPOTEK KARŞILIĞI ÇALIŞILABİLİR' },
    { note: 'CC', color: '#f87171', label: '36 - 44', teminat: 'ÇALIŞMA YAPILMAZ' },
    { note: 'C', color: '#ef4444', label: '30 - 36', teminat: 'ÇALIŞMA YAPILMAZ' },
    { note: 'D', color: '#dc2626', label: '30 altı', teminat: 'TASFİYE' },
  ];

  function getRating(puan) {
    if (puan > 93) return RATING_SCALE[0];
    if (puan > 84) return RATING_SCALE[1];
    if (puan > 76) return RATING_SCALE[2];
    if (puan > 68) return RATING_SCALE[3];
    if (puan > 60) return RATING_SCALE[4];
    if (puan > 52) return RATING_SCALE[5];
    if (puan > 44) return RATING_SCALE[6];
    if (puan > 36) return RATING_SCALE[7];
    if (puan >= 30) return RATING_SCALE[8];
    return RATING_SCALE[9];
  }

  /** Subjektif: seçim yok → otomatik 20,60 (FinSkor varsayılanı) */
  function calcSubjPuanAuto() {
    return SUBJ_AUTO_PUAN;
  }

  function ratingRiskLabel(note) {
    if (!note || ['B', 'BB', 'BBB', 'A', 'AA', 'AAA'].includes(note)) {
      return { level: 'normal', text: 'Yatırım yapılabilir bant — standart bankacılık koşulları.' };
    }
    if (note === 'D') {
      return { level: 'critical', text: 'Tasfiye / temerrüt riski — çalışma önerilmez.' };
    }
    if (note === 'CCC') {
      return { level: 'high', text: 'Yüksek risk bandı — güçlü teminat ve sıkı koşullar gerekir.' };
    }
    if (note === 'C' || note === 'CC') {
      return { level: 'blocked', text: 'Çalışma yapılmaz bandı — teminat yeterli olsa bile politika kısıtı.' };
    }
    return { level: 'warn', text: 'Dikkatli değerlendirme gerekir.' };
  }

  /** Excel RATING — calcObjScore (app.html ile aynı) */
  function calcObjScore(r, firmType) {
    const paz = firmType === 'pazarlama';
    let s = 0;

    const _c1 =
      r.cariOran > 1.39 ? 12 : r.cariOran > 1.24 ? 9 : r.cariOran > 1.04 ? 6 : r.cariOran > 0.84 ? 3 : r.cariOran > 0.74 ? 1 : 0;
    s += _c1;

    const _c2 = paz
      ? r.likOran > 0.84
        ? 6
        : r.likOran > 0.79
          ? 4
          : r.likOran > 0.69
            ? 3
            : r.likOran > 0.64
              ? 2
              : r.likOran > 0.59
                ? 1
                : 0
      : r.likOran > 0.74
        ? 6
        : r.likOran > 0.69
          ? 4
          : r.likOran > 0.59
            ? 3
            : r.likOran > 0.54
              ? 2
              : r.likOran > 0.49
                ? 1
                : 0;
    s += _c2;

    const _c3 = paz
      ? r.borcOzKay > 7.99
        ? 0
        : r.borcOzKay > 5.99
          ? 2
          : r.borcOzKay > 4.49
            ? 4
            : r.borcOzKay > 2.99
              ? 6
              : r.borcOzKay > 1.99
                ? 9
                : r.borcOzKay > 0
                  ? 12
                  : 0
      : r.borcOzKay > 2.99
        ? 0
        : r.borcOzKay > 2.09
          ? 2
          : r.borcOzKay > 1.69
            ? 4
            : r.borcOzKay > 1.49
              ? 6
              : r.borcOzKay > 1.1
                ? 9
                : r.borcOzKay > 0
                  ? 12
                  : 0;
    s += _c3;

    const _c4 = paz
      ? r.netKarMarj > 14
        ? 6
        : r.netKarMarj > 9
          ? 5
          : r.netKarMarj > 5
            ? 3
            : r.netKarMarj > 2
              ? 2
              : r.netKarMarj > 0
                ? 1
                : 0
      : r.netKarMarj > 19
        ? 6
        : r.netKarMarj > 14
          ? 5
          : r.netKarMarj > 9
            ? 3
            : r.netKarMarj > 4
              ? 2
              : r.netKarMarj > 1
                ? 1
                : 0;
    s += _c4;

    const _c5 =
      r.reelFaalKarBuy > 14 ? 5 : r.reelFaalKarBuy > 9 ? 4 : r.reelFaalKarBuy > 5 ? 3 : r.reelFaalKarBuy > 2 ? 2 : r.reelFaalKarBuy > 0 ? 1 : 0;
    s += _c5;

    const _c6 = r.prevFaalKar < 0 ? 5 : 0;
    s += _c6;

    const _c7 =
      r.kvBankaB_Sat > 35 ? 0 : r.kvBankaB_Sat > 30 ? 1 : r.kvBankaB_Sat > 25 ? 2 : r.kvBankaB_Sat > 20 ? 4 : r.kvBankaB_Sat > 15 ? 6 : r.kvBankaB_Sat > 10 ? 8 : 10;
    s += _c7;

    const _c8 = paz
      ? r.kvBorcSat < 36
        ? 6
        : r.kvBorcSat < 46
          ? 4
          : r.kvBorcSat < 56
            ? 3
            : r.kvBorcSat < 61
              ? 2
              : r.kvBorcSat < 66
                ? 1
                : 0
      : r.kvBorcSat < 30
        ? 6
        : r.kvBorcSat < 40
          ? 4
          : r.kvBorcSat < 50
            ? 3
            : r.kvBorcSat < 55
              ? 2
              : r.kvBorcSat < 60
                ? 1
                : 0;
    s += _c8;

    const _c9 = paz
      ? r.ihracatSatis > 49
        ? 3
        : r.ihracatSatis > 29
          ? 2
          : r.ihracatSatis > 9
            ? 1
            : 0
      : r.ihracatSatis > 39
        ? 3
        : r.ihracatSatis > 24
          ? 2
          : r.ihracatSatis > 4
            ? 1
            : 0;
    s += _c9;

    const _c10 = paz
      ? r.bnkBorcAkt > 39
        ? 0
        : r.bnkBorcAkt > 29
          ? 1
          : r.bnkBorcAkt > 19
            ? 2
            : r.bnkBorcAkt > 14
              ? 3
              : 5
      : r.bnkBorcAkt > 44
        ? 0
        : r.bnkBorcAkt > 34
          ? 1
          : r.bnkBorcAkt > 24
            ? 2
            : r.bnkBorcAkt > 14
              ? 3
              : 5;
    s += _c10;

    const _c11 =
      r.reelSatisBuy > 150
        ? 0
        : r.reelSatisBuy > 110
          ? 1
          : r.reelSatisBuy > 70
            ? 4
            : r.reelSatisBuy > 20
              ? 5
              : r.reelSatisBuy > 4
                ? 4
                : r.reelSatisBuy > 0
                  ? 1
                  : 0;
    s += _c11;

    return s;
  }

  /**
   * NakitFlow yıl sonu bal / inc → FinSkor oran vektörü (taahhüt hariç; üretim/pazarlama).
   */
  function buildRatiosFromNakit(bal, inc, prevBal, prevInc, opts) {
    const o = opts || {};
    const kvPlug = Number(o.kvPlug) || 0;
    const uvPlug = Number(o.uvPlug) || 0;
    const hazirDeg = Number(bal.nakit) || 0;
    const ticAlacak = Number(bal.ar) || 0;
    const digerDon = Number(bal.otherAssets) || 0;
    const stoklar = Number(bal.stok) || 0;
    const prevStoklar = (prevBal && prevBal.stok) || Number(o.openingStok) || 0;
    const donenVar = hazirDeg + ticAlacak + stoklar + digerDon;
    const duranVar = Number(bal.mdv) || 0;
    const aktif = Number(bal.aktifToplam) || donenVar + duranVar;
    const kvMaliBor = Number(bal.bch) || 0;
    const kvTicBor = Number(bal.ap) || 0;
    const uvMaliBor = (Number(bal.taksit) || 0) + (Number(bal.spot) || 0);
    const kvBorclar = kvTicBor + kvMaliBor + kvPlug;
    const uvBorclar = uvMaliBor + uvPlug;
    const ozKaynak = Math.max(0, aktif - kvBorclar - uvBorclar);
    const totalBor = kvBorclar + uvBorclar;

    const netSatis = Number(inc.ciro) || 0;
    const satMaliyet = Number(inc.cogs) || 0;
    const faalKar = Number(inc.faalKar) != null ? Number(inc.faalKar) : netSatis - satMaliyet - (Number(inc.opex) || 0);
    const voKar = Number(inc.ebt) != null ? Number(inc.ebt) : Number(inc.net) || 0;
    const finansGid = Number(inc.finGid) || 0;

    const cariOran = kvBorclar > 0 ? donenVar / kvBorclar : 0;
    const likit = hazirDeg + ticAlacak + digerDon;
    const likOran = kvBorclar > 0 ? likit / kvBorclar : 0;
    const borcOzKay = ozKaynak > 0 ? totalBor / ozKaynak : 0;
    const netKarMarj = netSatis > 0 && voKar > 0 ? (voKar / netSatis) * 100 : 0;
    const kvBankaToplam = kvMaliBor;
    const kvBankaB_Sat = netSatis > 0 ? (kvBankaToplam / netSatis) * 100 : 0;
    const kvBorcSat = netSatis > 0 ? (kvBorclar / netSatis) * 100 : 0;
    const toplamFinBor = kvMaliBor + uvMaliBor;
    const bnkBorcAkt = aktif > 0 ? (toplamFinBor / aktif) * 100 : 0;

    const enfl = Number(o.enflasyon) || 0.26;
    const prevNetSatis = (prevInc && prevInc.ciro) || 0;
    const prevFaalKar = (prevInc && prevInc.faalKar) != null ? prevInc.faalKar : 0;
    const ihracatOrani = Number(o.ihracatOrani) || 0;

    const r = {
      donenVar,
      duranVar,
      aktif,
      kvBorclar,
      uvBorclar,
      ozKaynak,
      totalBor,
      kvMaliBor,
      kvTicBor,
      uvMaliBor,
      netSatis,
      satMaliyet,
      faalKar,
      voKar,
      finansGid,
      cariOran,
      likOran,
      borcOzKay,
      netKarMarj,
      kvBankaB_Sat,
      kvBorcSat,
      bnkBorcAkt,
      ihracatSatis: ihracatOrani,
      satisBuy: prevNetSatis > 0 ? ((netSatis - prevNetSatis) / prevNetSatis) * 100 : 0,
      reelSatisBuy: prevNetSatis > 0 ? (netSatis / prevNetSatis / (1 + enfl) - 1) * 100 : 0,
      prevNetSatis,
      faalKarBuy: prevFaalKar > 0 ? ((faalKar - prevFaalKar) / prevFaalKar) * 100 : 0,
      reelFaalKarBuy: prevFaalKar > 0 ? (faalKar / prevFaalKar / (1 + enfl) - 1) * 100 : 0,
      faalKarYillik: faalKar - prevFaalKar,
      prevFaalKar,
    };
    return r;
  }

  function scoreYear(r, firmType) {
    const objPuan = calcObjScore(r, firmType);
    const subjPuan = calcSubjPuanAuto();
    const toplam = Math.round((objPuan + subjPuan) * 100) / 100;
    const rating = getRating(toplam);
    const risk = ratingRiskLabel(rating.note);
    return { objPuan, subjPuan, toplam, rating, risk, r };
  }

  root.FinSkorRating = {
    SUBJ_AUTO_PUAN,
    RATING_SCALE,
    getRating,
    calcSubjPuanAuto,
    calcObjScore,
    buildRatiosFromNakit,
    scoreYear,
    ratingRiskLabel,
  };
})(typeof window !== 'undefined' ? window : globalThis);
