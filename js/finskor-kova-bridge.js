/**
 * FinSkor NakitFlow ↔ KDV Kova Kütüphanesi köprüsü (v5.2)
 * Kapatma: localStorage.setItem('finskor_kova_lib','0') veya window.FINSKOR_KOVA_LIB=false
 * Geri al: scripts/rollback-kova-integration.bat
 */
(function (root) {
  'use strict';

  const LS_KEY = 'finskor_kova_lib';

  function isEnabled() {
    if (root.FINSKOR_KOVA_LIB === false) return false;
    try {
      if (localStorage.getItem(LS_KEY) === '0') return false;
    } catch (e) { /* ignore */ }
    return !!(
      root.MuhasebeMotoru &&
      root.KovaHesaplayici &&
      root.BeyannameKovaBootstrap &&
      root.KovaUiEsleme &&
      root.AylikKovaProjeksiyon
    );
  }

  function getSektor(id) {
    const map = root.KDV_KOVA_SEKTORLER || {};
    return map[id] || null;
  }

  /** Mizan 190/191/391 veya ayrı KDV satırı varsa kütüphane devre dışı. */
  function firmHasMizanKdv(f) {
    if (!f) return false;
    const raw = f.maliParsedSnapshot && f.maliParsedSnapshot.raw;
    if (raw && raw._mizan19KdvAyriSatir) return true;
    const rows =
      (f.maliParsedSnapshot && f.maliParsedSnapshot.bilancoRows) ||
      (f.finskorBilancoSnapshot && f.finskorBilancoSnapshot.rows) ||
      [];
    const keys = ['hesaplananKdv', 'devredenKdv', 'indirilecekKdv'];
    for (const k of keys) {
      const r = rows.find((x) => x && x.key === k && x.type !== 'cat');
      if (!r) continue;
      const v = Number(r.tutar != null ? r.tutar : r.value) || 0;
      if (v > 0) return true;
    }
    if (raw) {
      if (Number(raw.devredenKdv) > 0 || Number(raw.indirilecekKdv) > 0) return true;
      if (Number(raw.hesaplananKdv) > 0 && Number(raw.odenecekKdv) > 0) return true;
    }
    const o = f.opening || {};
    if (Number(o.devredenKdv) > 0 && f.maliParsedSnapshot) return true;
    return false;
  }

  /** Mizan/beyan ihracat payı (0–100). Sektör şablonu değil. */
  function firmExportRatioPct(f) {
    if (typeof window !== 'undefined' && typeof window.firmIhracatOraniFromMali === 'function') {
      const m = window.firmIhracatOraniFromMali(f);
      if (m > 0) return m;
    }
    const gt = gelirTablosuFromFirm(f);
    if (gt.ihracat > 0 && gt.brutSatis > 0) {
      return Math.max(0, Math.min(100, (gt.ihracat / gt.brutSatis) * 100));
    }
    const p = f && f.kdvProfile;
    if (p && p.exportEnabled && Number(p.exportRatio) > 0) return Number(p.exportRatio);
    return 0;
  }

  /** Beyanname bootstrap — yalnızca mizan KDV satırı yokken. */
  function shouldUseBootstrap(f) {
    return isEnabled() && f && !firmHasMizanKdv(f);
  }

  /** Aylık kova KDV projeksiyonu — mizan KDV satırı yokken (mizanlı ihracat buildKdvSchedule havuz+iade). */
  function shouldUseMonthlyKova(f) {
    if (!isEnabled() || !f) return false;
    return !firmHasMizanKdv(f);
  }

  /** Mizanlı ihracatçı veya m.29/2 indirimli oran: KDV iade mahsubu → SGK/stopaj nakit. */
  function firmIndirimli292Eligible(f) {
    if (!f || firmExportRatioPct(f) > 0.01) return false;
    const o = f.opening || {};
    const dev = Number(o.devredenKdv) || 0;
    const rev = Number(f.incomeStmt && f.incomeStmt.revenue) || 0;
    const hes = Number(o.hesaplananKdv || o.odenecekKdv) || 0;
    if (dev > 500000 && rev > 0 && hes / rev < 0.06) return true;
    const p = f.kdvProfile || {};
    const sid = resolveSektorId(f);
    const s = sid ? getSektor(sid) : null;
    if (s) {
      const ib = s.iadeBaglantisi || {};
      if (ib.tur === 'INDIRIMLI_ORAN_29_2') return true;
      if (s.sektorMeta && s.sektorMeta.kdvRejimi === 'INDIRIMLI_ORAN') return true;
    }
    const salesR = Math.max(0, Number(p.domesticSalesRate) || 0) / 100;
    let purchR = Math.max(0, Number(p.opexRate) || 0) / 100;
    if (typeof window !== 'undefined' && typeof window.kdvBucketEffectiveRate === 'function') {
      purchR = window.kdvBucketEffectiveRate(p);
    }
    const genR = 0.2;
    if (salesR > 0 && salesR < genR - 0.001) return true;
    if (purchR > salesR + 0.005) return true;
    if (p.sector === 'food' && salesR <= 0.11) return true;
    if (Number(p.domesticSalesRate) <= 10 && purchR > 0.02) return true;
    return false;
  }

  function shouldUseVergi36Mahsup(f) {
    if (!isEnabled() || !f) return false;
    if (!firmHasMizanKdv(f)) return false;
    if (firmExportRatioPct(f) > 0.01) return true;
    return firmIndirimli292Eligible(f);
  }

  function shouldUse(f) {
    return shouldUseMonthlyKova(f);
  }

  const REJIM_LABELS = {
    GENEL: 'Genel oran',
    INDIRIMLI_ORAN: 'İndirimli oran / 29-2',
    IHRACAT_ISTISNASI: 'İhracat istisnası',
    TEVKIFAT_AGIRLIKLI: 'Tevkifat ağırlıklı',
    KARMA: 'Karma',
  };

  function listSektorler() {
    const kat = root.KDV_KOVA_KATALOG;
    return kat && Array.isArray(kat.sektorler) ? kat.sektorler.slice() : [];
  }

  const UI_GRUP_ORDER = ['gida', 'imalat', 'ticaret', 'hizmet'];
  const UI_GRUP_LABELS = {
    gida: 'Gıda & tarım',
    imalat: 'İmalat & enerji',
    ticaret: 'Ticaret',
    hizmet: 'Hizmet & taahhüt',
  };
  const UI_GRUP_BY_ID = {
    'genel-ticaret-standart': 'ticaret',
    'hammadde-ticaret': 'ticaret',
    'gida-toptan-perakende': 'gida',
    'gida-uretim': 'gida',
    'gida-uretim-sut': 'gida',
    'gida-uretim-et': 'gida',
    'gida-uretim-yumurta': 'gida',
    'un-irmik-uretim': 'gida',
    'hayvan-yemi-uretim': 'gida',
    'findik-kuruyemis-ihracat': 'gida',
    'tarim-isleme': 'gida',
    'makine-imalat': 'imalat',
    'otomotiv-yan-sanayi': 'imalat',
    'demir-celik-metallurgy': 'imalat',
    'kimya-plastik': 'imalat',
    'tekstil-konfeksiyon': 'imalat',
    'enerji-yenilenebilir': 'imalat',
    'ihracat-agirlikli': 'imalat',
    'insaat-taahhut-tevkifat': 'hizmet',
    'hizmet-tevkifat': 'hizmet',
    'lojistik-tasimacilik': 'hizmet',
    'turizm-konaklama': 'hizmet',
  };
  const TIPIK_LABELS = { ODENECEK: 'Ödenecek', DEVREDEN: 'Devreden', IADE: 'İade' };

  function htmlEsc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function getUiGrup(sektorId) {
    const kat = listSektorler().find((x) => x.id === sektorId);
    if (kat && kat.uiGrup) return kat.uiGrup;
    return UI_GRUP_BY_ID[sektorId] || 'ticaret';
  }

  function tipikLabel(tipik) {
    return TIPIK_LABELS[tipik] || tipik || '';
  }

  function sektorCardMeta(sektorId) {
    const kat = listSektorler().find((x) => x.id === sektorId);
    const s = getSektor(sektorId);
    if (!kat && !s) return null;
    const tipik =
      (kat && kat.netPozisyonTipik) ||
      (s && s.sektorMeta && s.sektorMeta.netPozisyonTipik) ||
      '';
    const grup = getUiGrup(sektorId);
    return {
      id: sektorId,
      ad: sektorLabel(sektorId),
      tipik: tipik,
      tipikLabel: tipikLabel(tipik),
      aciklama: (kat && kat.aciklama) || '',
      grup: grup,
      grupLabel: UI_GRUP_LABELS[grup] || grup,
    };
  }

  /** Arama: gida↔gıda, insaat↔inşaat, ASCII klavye uyumu */
  function searchFold(s) {
    return String(s || '')
      .toLocaleLowerCase('tr')
      .replace(/ı/g, 'i')
      .replace(/ş/g, 's')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9\s/]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const SEARCH_GRUP_ALIASES = {
    gida: 'gida',
    gidauretim: 'gida',
    tarim: 'gida',
    ziraat: 'gida',
    findik: 'gida',
    kuruyemis: 'gida',
    yumurta: 'gida',
    tavuk: 'gida',
    kanatli: 'gida',
    sut: 'gida',
    peynir: 'gida',
    et: 'gida',
    un: 'gida',
    yem: 'gida',
    ticaret: 'ticaret',
    hammadde: 'ticaret',
    imalat: 'imalat',
    uretim: 'imalat',
    otomotiv: 'imalat',
    celik: 'imalat',
    demir: 'imalat',
    tekstil: 'imalat',
    kimya: 'imalat',
    plastik: 'imalat',
    hizmet: 'hizmet',
    insaat: 'hizmet',
    taahhut: 'hizmet',
    lojistik: 'hizmet',
    tasimacilik: 'hizmet',
    turizm: 'hizmet',
    konaklama: 'hizmet',
    ihracat: 'ihracat',
    export: 'ihracat',
    enerji: 'enerji',
    yenilenebilir: 'enerji',
  };

  function resolveSearchGrup(qFold) {
    if (!qFold) return null;
    if (UI_GRUP_ORDER.indexOf(qFold) >= 0) return qFold;
    for (const g of UI_GRUP_ORDER) {
      if (searchFold(UI_GRUP_LABELS[g]).indexOf(qFold) >= 0) return g;
    }
    const compact = qFold.replace(/\s+/g, '');
    if (SEARCH_GRUP_ALIASES[compact]) return SEARCH_GRUP_ALIASES[compact];
    for (const key of Object.keys(SEARCH_GRUP_ALIASES)) {
      if (compact.indexOf(key) >= 0 || key.indexOf(compact) >= 0) {
        return SEARCH_GRUP_ALIASES[key];
      }
    }
    return null;
  }

  function sektorMatchesSearch(meta, qRaw) {
    if (!qRaw) return true;
    const q = searchFold(qRaw);
    if (!q) return true;
    const grupHit = resolveSearchGrup(q);
    if (grupHit && meta.grup === grupHit) return true;
    const hay = searchFold(
      meta.ad +
        ' ' +
        meta.aciklama +
        ' ' +
        meta.grupLabel +
        ' ' +
        meta.grup +
        ' ' +
        String(meta.id || '').replace(/-/g, ' ')
    );
    if (hay.indexOf(q) >= 0) return true;
    const parts = q.split(/\s+/).filter(Boolean);
    if (parts.length > 1 && parts.every(function (p) { return hay.indexOf(p) >= 0; })) return true;
    return parts.some(function (p) {
      return p.length >= 2 && hay.indexOf(p) >= 0;
    });
  }

  /** Kart ızgarası HTML (NakitFlow sektör sekmesi) */
  function buildSectorPickerHtml(opts) {
    opts = opts || {};
    const selectedId = opts.selectedId || '';
    const isCustom = !!opts.isCustom;
    const grupFilter = opts.grupFilter || '';
    const q = String(opts.search || '').trim();
    const list = listSektorler();
    const groups = {};
    for (const s of list) {
      const meta = sektorCardMeta(s.id);
      if (!meta) continue;
      if (grupFilter && meta.grup !== grupFilter) continue;
      if (!sektorMatchesSearch(meta, q)) continue;
      if (!groups[meta.grup]) groups[meta.grup] = [];
      groups[meta.grup].push(meta);
    }
    let html = '';
    for (const g of UI_GRUP_ORDER) {
      const items = groups[g];
      if (!items || !items.length) continue;
      html +=
        '<div class="kdv-sector-grup"><div class="kdv-sector-grup-title">' +
        htmlEsc(UI_GRUP_LABELS[g]) +
        '</div><div class="kdv-sector-grid">';
      for (const m of items) {
        const sel = !isCustom && m.id === selectedId;
        html +=
          '<button type="button" class="kdv-sector-card' +
          (sel ? ' is-selected' : '') +
          '" data-sector-id="' +
          htmlEsc(m.id) +
          '" onclick="kovaPickSector(\'' +
          String(m.id).replace(/'/g, "\\'") +
          '\',event)">';
        html += '<span class="kdv-sector-card-title">' + htmlEsc(m.ad) + '</span>';
        if (m.tipikLabel) {
          html +=
            '<span class="kdv-sector-badge kdv-badge-' +
            String(m.tipik).toLowerCase() +
            '">' +
            htmlEsc(m.tipikLabel) +
            '</span>';
        }
        if (m.aciklama) {
          html += '<span class="kdv-sector-card-desc">' + htmlEsc(m.aciklama) + '</span>';
        }
        if (sel) html += '<span class="kdv-sector-check" aria-hidden="true">✓</span>';
        html += '</button>';
      }
      html += '</div></div>';
    }
    if (!html && q) {
      html =
        '<div class="notice">“' +
        htmlEsc(q) +
        '” ile eşleşen sektör yok. Filtreyi temizleyin veya aşağıdan grubu seçin.</div>';
    }
    html +=
      '<div class="kdv-sector-grup kdv-sector-grup--manual"><div class="kdv-sector-grup-title">Diğer</div><div class="kdv-sector-grid">';
    html +=
      '<button type="button" class="kdv-sector-card kdv-sector-card--custom' +
      (isCustom ? ' is-selected' : '') +
      '" data-sector-id="__custom__" onclick="kovaPickSector(\'__custom__\',event)">';
    html += '<span class="kdv-sector-card-title">⚙ Özel / manuel</span>';
    html +=
      '<span class="kdv-sector-card-desc">KDV oranlarını ve kovaları kendiniz girersiniz.</span>';
    if (isCustom) html += '<span class="kdv-sector-check" aria-hidden="true">✓</span>';
    html += '</button></div></div>';
    return html;
  }

  function suggestSektorForFirm(f) {
    return resolveSektorId(f);
  }

  function inferLegacySectorFromKovaId(id) {
    const map = {
      'genel-ticaret-standart': { sector: 'general' },
      'hammadde-ticaret': { sector: 'general' },
      'gida-toptan-perakende': { sector: 'food', foodSub: 'catering' },
      'gida-uretim': { sector: 'food', foodSub: 'general' },
      'gida-uretim-sut': { sector: 'food', foodSub: 'dairy' },
      'gida-uretim-et': { sector: 'food', foodSub: 'general' },
      'gida-uretim-yumurta': { sector: 'food', foodSub: 'egg' },
      'un-irmik-uretim': { sector: 'food', foodSub: 'general' },
      'hayvan-yemi-uretim': { sector: 'food', foodSub: 'general' },
      'findik-kuruyemis-ihracat': { sector: 'food', foodSub: 'general' },
      'tarim-isleme': { sector: 'food', foodSub: 'general' },
      'ihracat-agirlikli': { sector: 'general' },
      'insaat-taahhut-tevkifat': { sector: 'construction' },
      'hizmet-tevkifat': { sector: 'service' },
      'demir-celik-metallurgy': { sector: 'general' },
      'makine-imalat': { sector: 'general' },
      'otomotiv-yan-sanayi': { sector: 'auto' },
      'kimya-plastik': { sector: 'general' },
      'lojistik-tasimacilik': { sector: 'service' },
      'tekstil-konfeksiyon': { sector: 'general' },
      'turizm-konaklama': { sector: 'service' },
      'enerji-yenilenebilir': { sector: 'general' },
    };
    return map[id] || { sector: 'general' };
  }

  function bucketKeyForGirdi(g) {
    const c = String(g.girdiKodu || '').toUpperCase();
    if (/ENERJI|AKARYAKIT|ELEKTRIK/.test(c)) return 'energy';
    if (/AMBALAJ|CUVAL|BIGBAG|PACK/.test(c)) return 'pack';
    if (/ISLEME|ISCILIK|KURUTMA|NAKLIYE|LOJISTIK/.test(c)) return 'other';
    if (g.matrahKaynagi === 'faalGider' || g.kovaTipi === 'OPEX') return 'other';
    return 'raw';
  }

  function sektorBlurbHtml(sektorId) {
    const s = getSektor(sektorId);
    const kat = listSektorler().find((x) => x.id === sektorId);
    if (!s && !kat) return '';
    const meta = (s && s.sektorMeta) || {};
    const ad = meta.ad || (kat && kat.ad) || sektorId;
    const rejim = REJIM_LABELS[meta.kdvRejimi || (kat && kat.kdvRejimi)] || meta.kdvRejimi || '';
    const tip = kat && kat.netPozisyonTipik ? kat.netPozisyonTipik : meta.netPozisyonTipik || '';
    const acik = (kat && kat.aciklama) || (s && s.iadeBaglantisi && s.iadeBaglantisi.aciklama) || '';
    const satis = (s && s.satisKalemleri) || [];
    const alis = (s && s.alisKalemleri) || [];
    const satOzet = satis
      .slice(0, 4)
      .map((k) => k.urunAdi + ' %' + k.kdvOrani)
      .join(' · ');
    const alOzet = alis
      .slice(0, 3)
      .map((g) => g.girdiAdi.split('(')[0].trim())
      .join(' · ');
    return (
      '<b>' + ad + '</b>' +
      (rejim ? ' · ' + rejim : '') +
      (tip ? ' · Tipik: ' + tip : '') +
      (acik ? '<br><span style="opacity:.85">' + acik + '</span>' : '') +
      (satOzet ? '<br>Satış: ' + satOzet : '') +
      (alOzet ? '<br>Alış: ' + alOzet : '')
    );
  }

  function tipikPay(v) {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'object' && v.tipik != null) return Number(v.tipik) || 0;
    return Number(v) || 0;
  }

  /** v5.2 UI eşleme → NakitFlow 4 kova özeti (hammadde %1 korunur). */
  function bucketsFromUiEsle(s) {
    const UI = root.KovaUiEsleme;
    if (!UI || !s) return null;
    const u = UI.esle(s);
    const smmPay = u.raw.pay + u.pack.pay + u.energy.pay + u.other.pay;
    if (smmPay <= 0) return null;
    return {
      buckets: {
        raw: { pct: Math.round((u.raw.pay / smmPay) * 1000) / 10, rate: u.raw.oran },
        pack: { pct: Math.round((u.pack.pay / smmPay) * 1000) / 10, rate: u.pack.oran },
        energy: { pct: Math.round((u.energy.pay / smmPay) * 1000) / 10, rate: u.energy.oran },
        other: { pct: Math.round((u.other.pay / smmPay) * 1000) / 10, rate: u.other.oran },
      },
      opexRate: u.opex.oran || 20,
    };
  }

  /** Kova JSON → NakitFlow kdvProfile alanları */
  function sektorToKdvProfilePatch(sektorId, opts) {
    opts = opts || {};
    const s = getSektor(sektorId);
    if (!s) return null;
    const cur = opts.cur || {};
    const satis = s.satisKalemleri || [];
    let domPay = 0;
    let domRate = 0;
    let exportPay = 0;
    for (const k of satis) {
      const pay = (k.varsayilanCiroPayi && k.varsayilanCiroPayi.tipik) || 0;
      if (k.istisnaTipi === 'ihracat' || (k.kdvOrani === 0 && k.istisnaTipi)) {
        exportPay += pay;
      } else {
        domRate += pay * (k.kdvOrani || 0);
        domPay += pay;
      }
    }
    const domesticSalesRate = domPay > 0 ? domRate / domPay : 20;
    let buckets = {
      raw: { pct: 0, rate: 20 },
      pack: { pct: 0, rate: 20 },
      energy: { pct: 0, rate: 20 },
      other: { pct: 0, rate: 20 },
    };
    let opexRate = 20;
    const uiBuckets = bucketsFromUiEsle(s);
    if (uiBuckets) {
      buckets = uiBuckets.buckets;
      opexRate = uiBuckets.opexRate;
    } else {
      const alis = s.alisKalemleri || [];
      const bucketW = { raw: 0, pack: 0, energy: 0, other: 0 };
      const bucketRateW = { raw: 0, pack: 0, energy: 0, other: 0 };
      for (const g of alis) {
        const pay = tipikPay(g.pay);
        const rate = g.kdvOrani != null ? g.kdvOrani : 20;
        if (g.matrahKaynagi === 'faalGider' || g.kovaTipi === 'OPEX') {
          opexRate = rate;
          continue;
        }
        const bk = bucketKeyForGirdi(g);
        bucketW[bk] += pay;
        bucketRateW[bk] += pay * rate;
      }
      const wSum = bucketW.raw + bucketW.pack + bucketW.energy + bucketW.other;
      if (wSum > 0) {
        buckets.raw.pct = (bucketW.raw / wSum) * 100;
        buckets.pack.pct = (bucketW.pack / wSum) * 100;
        buckets.energy.pct = (bucketW.energy / wSum) * 100;
        buckets.other.pct = (bucketW.other / wSum) * 100;
        ['raw', 'pack', 'energy', 'other'].forEach(function (bk) {
          if (bucketW[bk] > 0) buckets[bk].rate = bucketRateW[bk] / bucketW[bk];
        });
      } else {
        buckets.raw.pct = 100;
      }
    }
    const ib = s.iadeBaglantisi || {};
    let refundMode = 'carry';
    let refundDelayMonths = ib.nakdenGecikmeAy != null ? ib.nakdenGecikmeAy : 0;
    let refundCashPct = 70;
    let refundOffsetPct = 30;
    if (ib.tur === 'IHRACAT_11_1_A' || ib.tur === 'TAM_ISTISNA_13_I') {
      refundMode = exportPay > 0.01 ? 'mixed' : 'carry';
      refundDelayMonths = ib.nakdenGecikmeAy != null ? ib.nakdenGecikmeAy : 4;
    } else if (ib.tur === 'TEVKIFAT') {
      refundMode = 'mixed';
      refundDelayMonths = 4;
    } else if (ib.tur === 'INDIRIMLI_ORAN_29_2') {
      refundMode = 'offset';
      refundDelayMonths = 0;
      refundCashPct = 0;
      refundOffsetPct = 100;
    }
    const legacy = inferLegacySectorFromKovaId(sektorId);
    const patch = {
      kovaSektorId: sektorId,
      sector: legacy.sector,
      foodSub: legacy.foodSub,
      domesticSalesRate: Math.round(domesticSalesRate * 100) / 100,
      exportEnabled: exportPay > 0.01,
      exportRatio: Math.round(exportPay * 1000) / 10,
      buckets: buckets,
      opexRate: opexRate,
      investRate: 20,
      refundMode: refundMode,
      refundDelayMonths: refundDelayMonths,
      refundCashPct: refundCashPct,
      refundOffsetPct: refundOffsetPct,
      openingRefundMode: refundMode === 'carry' ? 'carry' : 'mixed',
    };
    // İhracat sektörü seçildiğinde export alanlarını ASLA eski (kapalı) profille ezme — aksi halde
    // buildKdvSchedule klasik 190 birikimine düşer (27M → 800M+ patlama).
    const sectorIsExport = exportPay > 0.01;
    if (opts.keepExport && cur) {
      if (!sectorIsExport) {
        patch.exportEnabled = cur.exportEnabled;
        patch.exportRatio = cur.exportRatio;
      }
      // İade gecikmesi / nakit-mahsup oranları UI'dan gelir; sektör nakdenGecikmeAy ile ezilmesin.
      if (cur.refundMode != null && cur.refundMode !== '') patch.refundMode = cur.refundMode;
      if (cur.refundDelayMonths != null && cur.refundDelayMonths !== '') {
        patch.refundDelayMonths = cur.refundDelayMonths;
      }
      if (cur.refundCashPct != null && cur.refundCashPct !== '') patch.refundCashPct = cur.refundCashPct;
      if (cur.refundOffsetPct != null && cur.refundOffsetPct !== '') {
        patch.refundOffsetPct = cur.refundOffsetPct;
      }
      if (cur.openingRefundMode != null && cur.openingRefundMode !== '') {
        patch.openingRefundMode = cur.openingRefundMode;
      }
      if (cur.exportRefundRate != null && cur.exportRefundRate !== '') {
        patch.exportRefundRate = cur.exportRefundRate;
      }
      if (cur.exportSeason) patch.exportSeason = cur.exportSeason.slice();
    }
    return patch;
  }

  function applySektorToProfile(sektorId, opts) {
    const patch = sektorToKdvProfilePatch(sektorId, opts);
    if (!patch) return opts && opts.cur ? opts.cur : {};
    return Object.assign({}, opts && opts.cur ? opts.cur : {}, patch);
  }

  function populateKovaSectorSelect(selectEl, selectedId) {
    if (!selectEl) return;
    const list = listSektorler();
    if (!list.length) return;
    const prev = selectedId || selectEl.value;
    const groups = {};
    for (const s of list) {
      const g = REJIM_LABELS[s.kdvRejimi] || s.kdvRejimi || 'Diğer';
      if (!groups[g]) groups[g] = [];
      groups[g].push(s);
    }
    let html = '<option value="">— sektör seçin —</option>';
    for (const g of Object.keys(groups).sort()) {
      html += '<optgroup label="' + g.replace(/"/g, '&quot;') + '">';
      for (const s of groups[g]) {
        html +=
          '<option value="' +
          s.id +
          '">' +
          s.ad.replace(/</g, '&lt;') +
          '</option>';
      }
      html += '</optgroup>';
    }
    selectEl.innerHTML = html;
    if (prev && getSektor(prev)) selectEl.value = prev;
    else if (list[0]) selectEl.value = list[0].id;
  }

  function sektorLabel(sektorId) {
    const kat = listSektorler().find((x) => x.id === sektorId);
    const s = getSektor(sektorId);
    return (s && s.sektorMeta && s.sektorMeta.ad) || (kat && kat.ad) || sektorId || '';
  }

  /** NakitFlow kdvProfile → kova sektor id */
  function resolveSektorId(f) {
    const p = (f && f.kdvProfile) || {};
    if (p.kovaSektorId && getSektor(p.kovaSektorId)) return p.kovaSektorId;
    const exp =
      (p.exportEnabled && Number(p.exportRatio) > 0) ||
      (f.maliIhracat && Number(f.maliIhracat.ihracatOrani) > 0);
    const expPct = p.exportEnabled ? Number(p.exportRatio) || 0 : Number(f.maliIhracat && f.maliIhracat.ihracatOrani) || 0;
    if (p.sector === 'food') {
      if (exp && expPct >= 40) return 'findik-kuruyemis-ihracat';
      if (p.foodSub === 'catering') return 'gida-toptan-perakende';
      if (p.foodSub === 'egg') return 'gida-uretim-yumurta';
      if (p.foodSub === 'dairy') return 'gida-uretim-sut';
      return 'gida-uretim';
    }
    const map = {
      general: 'genel-ticaret-standart',
      auto: 'otomotiv-yan-sanayi',
      service: 'hizmet-tevkifat',
      construction: 'insaat-taahhut-tevkifat',
      custom: 'genel-ticaret-standart',
    };
    if (exp && expPct >= 50) return 'ihracat-agirlikli';
    return map[p.sector] || 'genel-ticaret-standart';
  }

  function gelirTablosuFromFirm(f) {
    const raw = (f && f.maliParsedSnapshot && f.maliParsedSnapshot.raw) || {};
    const inc = (f && f.incomeStmt) || {};
    const rev = Number(inc.revenue) || Number(raw.netSatis) || Number(raw.brutSatis) || 0;
    const smm = Number(inc.cogs) || Number(raw.satMaliyet) || 0;
    const opex = Number(inc.opex) || Number(raw.faalGider) || 0;
    const brut = Number(raw.brutSatis) || rev;
    const gt = { brutSatis: brut, smm, faaliyetGideri: opex };
    const ihr = Number(raw.ihracat);
    if (ihr > 0) gt.ihracat = ihr;
    else if (f.maliIhracat && Number(f.maliIhracat.ihracatTutar) > 0) gt.ihracat = Number(f.maliIhracat.ihracatTutar);
    else if (f.maliIhracat && Number(f.maliIhracat.ihracatOrani) > 0 && brut > 0) {
      gt.ihracat = brut * (Number(f.maliIhracat.ihracatOrani) / 100);
    }
    return gt;
  }

  function beyannamePayloadFromFirm(f, donem) {
    const raw = (f && f.maliParsedSnapshot && f.maliParsedSnapshot.raw) || {};
    const o = (f && f.opening) || {};
    const payload = {
      donem: donem || '2026-01',
      gelirTablosu: gelirTablosuFromFirm(f),
    };
    const hk = Number(raw.hesaplananKdv);
    const ik = Number(raw.indirilecekKdv);
    const ok = Number(raw.odenecekKdv) || Number(o.odenecekKdv);
    const dk = Number(raw.devredenKdv) || Number(o.devredenKdv);
    if (hk || ik || ok || dk) {
      payload.kdvBeyani = {
        hesaplananKdv: hk || undefined,
        indirilecekKdv: ik || undefined,
        odenecekKdv: ok || undefined,
        devredenKdv: dk || undefined,
        devredenAcilis: Number(o.devredenKdv) || undefined,
      };
    }
    const stopaj = Number(raw.muhtasarStopaj || raw.stopaj);
    const sgk = Number(raw.sgkPrim || raw.sgk);
    if (stopaj > 0) payload.muhtasar = { stopaj };
    if (sgk > 0) payload.sgk = { prim: sgk };
    let ov36 = Number(o.odenecekVergi) || 0;
    if (!ov36 && raw.odenecekVergi) ov36 = Number(raw.odenecekVergi) || 0;
    if (ov36 > 0) payload.f36 = { odenecekVergi: ov36 };
    return payload;
  }

  function projectionYear(f) {
    const sd = f && f.startDate ? new Date(f.startDate) : null;
    if (sd && !Number.isNaN(sd.getTime())) return sd.getFullYear();
    const y = Number(f && f.maliParsedSnapshot && f.maliParsedSnapshot.year);
    if (y > 0) return y;
    return new Date().getFullYear();
  }

  function runBootstrap(f, donem) {
    if (!shouldUseBootstrap(f)) return null;
    const B = root.BeyannameKovaBootstrap;
    const id = resolveSektorId(f);
    const sektor = getSektor(id);
    if (!B || !sektor) return null;
    const yil = projectionYear(f);
    const beyan = beyannamePayloadFromFirm(f, donem || yil + '-01');
    return B.bootstrap(beyan, sektor, {
      yil,
      mizanVar: false,
      firma: { tamTasdik: !!(f && f.tamTasdik), his: !!(f && f.his) },
    });
  }

  /** Mali import sonrası açılış KDV kutularını kova ile zenginleştir (mizan yokken). */
  function applyBootstrapToOpening(f, opening, bootstrap) {
    if (!bootstrap || !bootstrap.devrede || !opening) return opening;
    const k = bootstrap.kovalar || {};
    if (k.odenecek360 != null && !(Number(opening.odenecekKdv) > 0 && bootstrap.kaynak === 'BEYANNAME')) {
      opening.odenecekKdv = Math.round(k.odenecek360);
    }
    if (k.devredenSonraki != null && !(Number(opening.devredenKdv) > 0)) {
      opening.devredenKdv = Math.round(k.devredenSonraki);
    }
    if (k.indirilecek191 != null && !(Number(opening.indirilecekKdv) > 0)) {
      opening.indirilecekKdv = Math.round(k.indirilecek191);
    }
    if (bootstrap.f36) {
      f.kovaBootstrap = {
        sektorId: resolveSektorId(f),
        kaynak: bootstrap.kaynak,
        f36: bootstrap.f36,
        notlar: bootstrap.notlar || [],
        at: new Date().toISOString(),
      };
    }
    return opening;
  }

  function monthIndexFromDate(startDt, isoDate, months) {
    if (!isoDate || !startDt) return -1;
    const d = new Date(isoDate + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return -1;
    const diff =
      (d.getFullYear() - startDt.getFullYear()) * 12 + (d.getMonth() - startDt.getMonth());
    if (diff < 0 || diff >= months) return -1;
    return diff;
  }

  function ciroAssHelpers(ass) {
    const a = ass || {};
    const leg = Number(a.growth) || 0;
    function ciroAnnualPct(yi) {
      const k = yi <= 1 ? 1 : yi >= 5 ? 5 : yi;
      const v = a['ciroY' + k];
      if (v != null && v !== '' && !Number.isNaN(Number(v))) return Number(v);
      return leg;
    }
    function cumCiroFactor(yi) {
      let p = 1;
      for (let k = 1; k <= yi; k++) p *= 1 + ciroAnnualPct(k) / 100;
      return p;
    }
    return { ciroAnnualPct, cumCiroFactor };
  }

  /** İade mahsubu: önce SGK (361), sonra stopaj (360) — beyanname-kova-bootstrap ile aynı sıra. */
  function splitIadeMahsup(mahsupEdilen, sgkGross, stopajGross) {
    let kalan = Math.max(0, Number(mahsupEdilen) || 0);
    const sgkMahsup = Math.min(kalan, Math.max(0, sgkGross));
    kalan = Math.max(0, kalan - sgkMahsup);
    const stopajMahsup = Math.min(kalan, Math.max(0, stopajGross));
    return {
      sgkMahsup: Math.round(sgkMahsup),
      stopajMahsup: Math.round(stopajMahsup),
      sgkNet: Math.max(0, Math.round(sgkGross - sgkMahsup)),
      stopajNet: Math.max(0, Math.round(stopajGross - stopajMahsup)),
    };
  }

  /** Yıllık brüt SGK/stopaj — açılış mahsubundan önce (29/2 mahsuben için taban). */
  function resolveGrossSgkStopajAnnual(f) {
    const yil = projectionYear(f);
    const beyan = beyannamePayloadFromFirm(f, yil + '-01');
    const boot = runBootstrap(f, yil + '-01');
    const o = (f && f.opening) || {};
    let sgkG = Math.max(0, Number((beyan.sgk || {}).prim) || 0);
    let stopajG = Math.max(0, Number((beyan.muhtasar || {}).stopaj) || 0);
    const notlar = (boot && boot.notlar) || [];

    if (sgkG <= 0 && stopajG <= 0 && beyan.f36 && beyan.f36.odenecekVergi != null && boot) {
      const kdv = Math.max(0, Number(boot.f36 && boot.f36.odenecekKdv) || 0);
      const kalan = Math.max(0, Number(beyan.f36.odenecekVergi) - kdv);
      stopajG = Math.round(kalan * 0.65);
      sgkG = Math.round(kalan - stopajG);
    }

    if (sgkG <= 0 && stopajG <= 0 && boot && boot.f36) {
      const sgkN = Math.max(0, Number(boot.f36.sgk) || 0);
      const stopajN = Math.max(0, Number(boot.f36.stopaj) || 0);
      const mahsup = boot.iade ? Math.max(0, Number(boot.iade.mahsupEdilen) || 0) : 0;
      const totalG = sgkN + stopajN + mahsup;
      if (totalG > 0) {
        if (sgkN + stopajN > 0) {
          sgkG = Math.round(totalG * (sgkN / (sgkN + stopajN)));
          stopajG = totalG - sgkG;
        } else {
          stopajG = Math.round(totalG * 0.65);
          sgkG = totalG - stopajG;
        }
      }
    }

    if (sgkG <= 0 && stopajG <= 0) {
      const ov36 = Math.max(0, Number(o.odenecekVergi) || 0);
      const kdv =
        Math.max(0, Number(o.odenecekKdv) || 0) ||
        Math.max(0, Number(boot && boot.f36 && boot.f36.odenecekKdv) || 0);
      const kalan = Math.max(0, ov36 - kdv);
      if (kalan > 0) {
        stopajG = Math.round(kalan * 0.65);
        sgkG = kalan - stopajG;
      }
    }

    return { sgk: sgkG, stopaj: stopajG, notlar };
  }

  function buildGrossSgkStopajMonthly(annualSgk, annualStopaj, months, ciroAss) {
    const grossSgk = new Array(months).fill(0);
    const grossStopaj = new Array(months).fill(0);
    const { cumCiroFactor } = ciroAssHelpers(ciroAss);
    function targetAt(t, annual) {
      const yi = Math.floor(t / 12) + 1;
      const moy = t % 12;
      const yearStart = yi === 1 ? annual : annual * cumCiroFactor(yi - 1);
      const yearEnd = annual * cumCiroFactor(yi);
      return yearStart + ((yearEnd - yearStart) * (moy + 1)) / 12;
    }
    let prevSgk = 0;
    let prevSt = 0;
    for (let t = 0; t < months; t++) {
      const endSgk = targetAt(t, annualSgk);
      const endSt = targetAt(t, annualStopaj);
      grossSgk[t] = Math.max(0, endSgk - prevSgk);
      grossStopaj[t] = Math.max(0, endSt - prevSt);
      prevSgk = endSgk;
      prevSt = endSt;
    }
    return { grossSgk, grossStopaj };
  }

  function applyAylikIadeMahsupToCash(grossSgk, grossStopaj, aylikProj, months) {
    const cashPay = new Array(months).fill(0);
    const mahsupSgk = new Array(months).fill(0);
    const mahsupStopaj = new Array(months).fill(0);
    const rows = (aylikProj && aylikProj.aylik) || [];
    for (let t = 0; t < months; t++) {
      const gS = grossSgk[t] || 0;
      const gSt = grossStopaj[t] || 0;
      const mahsuben =
        rows[t] && rows[t].iade ? Math.max(0, Number(rows[t].iade.mahsuben) || 0) : 0;
      const sp = splitIadeMahsup(mahsuben, gS, gSt);
      mahsupSgk[t] = sp.sgkMahsup;
      mahsupStopaj[t] = sp.stopajMahsup;
      cashPay[t] = sp.sgkNet + sp.stopajNet;
    }
    const toplamMahsup = mahsupSgk.reduce((a, b) => a + b, 0) + mahsupStopaj.reduce((a, b) => a + b, 0);
    return { cashPay, mahsupSgk, mahsupStopaj, toplamMahsup };
  }

  /**
   * Beyanname-only: SGK/stopaj nakit çıkışı (KDV buildKdvSchedule'da kalır).
   * opts.aylikProj verilirse 29/2 (ve diğer) mahsuben iade o ay SGK/stopaj nakdini düşürür.
   * @returns {{ cashPay: number[], openNonKdv: number, sektorId: string, notlar: string[], mahsupApplied?: number }|null}
   */
  function buildVergi36NonKdvCash(f, months, startDt, ciroAss, opts) {
    if (!shouldUseMonthlyKova(f) && !shouldUseVergi36Mahsup(f)) return null;
    opts = opts || {};
    const sektorId = resolveSektorId(f);
    const grossAnnual = resolveGrossSgkStopajAnnual(f);
    let notlar = grossAnnual.notlar || [];
    const openNonKdvGross = grossAnnual.sgk + grossAnnual.stopaj;

    const bs = f.kovaBootstrap || null;
    let openStopajNet = 0;
    let openSgkNet = 0;
    if (bs && bs.f36) {
      openStopajNet = Math.max(0, Number(bs.f36.stopaj) || 0);
      openSgkNet = Math.max(0, Number(bs.f36.sgk) || 0);
      if (!notlar.length) notlar = bs.notlar || [];
    } else {
      const boot = runBootstrap(f, projectionYear(f) + '-01');
      if (boot && boot.devrede) {
        applyBootstrapToOpening(f, f.opening || {}, boot);
        openStopajNet = Math.max(0, Number(boot.f36 && boot.f36.stopaj) || 0);
        openSgkNet = Math.max(0, Number(boot.f36 && boot.f36.sgk) || 0);
        if (!notlar.length) notlar = boot.notlar || [];
      }
    }
    const openNonKdvNet = openStopajNet + openSgkNet;
    const openNonKdv = openNonKdvGross > 0 ? openNonKdvGross : openNonKdvNet;
    if (openNonKdv <= 0 && !(opts.aylikProj && opts.aylikProj.aylik)) {
      return { cashPay: new Array(months).fill(0), openNonKdv: 0, sektorId, notlar };
    }

    const ass = ciroAss || {};
    let cashPay = new Array(months).fill(0);
    let mahsupApplied = 0;

    if (opts.aylikProj && opts.aylikProj.aylik) {
      const annualSgk = grossAnnual.sgk > 0 ? grossAnnual.sgk : openSgkNet;
      const annualStopaj = grossAnnual.stopaj > 0 ? grossAnnual.stopaj : openStopajNet;
      const { grossSgk, grossStopaj } = buildGrossSgkStopajMonthly(
        annualSgk,
        annualStopaj,
        months,
        ass
      );
      const mah = applyAylikIadeMahsupToCash(grossSgk, grossStopaj, opts.aylikProj, months);
      cashPay = mah.cashPay;
      mahsupApplied = mah.toplamMahsup;
      if (mahsupApplied > 0) {
        notlar = notlar.concat([
          'Aylık KDV iade mahsubu: SGK(361)+stopaj(360) nakit çıkışından düşüldü (' +
            mahsupApplied.toLocaleString('tr-TR') +
            ' TL, nakit-nötr).',
        ]);
      }
    } else {
      const { cumCiroFactor } = ciroAssHelpers(ass);
      function targetAt(t) {
        const yi = Math.floor(t / 12) + 1;
        const moy = t % 12;
        const yearStart = yi === 1 ? openNonKdv : openNonKdv * cumCiroFactor(yi - 1);
        const yearEnd = openNonKdv * cumCiroFactor(yi);
        return yearStart + ((yearEnd - yearStart) * (moy + 1)) / 12;
      }
      for (let t = 1; t < months; t++) {
        const yi = Math.floor((t - 1) / 12) + 1;
        const prevEnd = yi === 1 ? openNonKdv : openNonKdv * cumCiroFactor(yi - 1);
        const thisEnd = openNonKdv * cumCiroFactor(yi);
        cashPay[t] = Math.max(0, (thisEnd - prevEnd) / 12);
      }
      const boot = runBootstrap(f, projectionYear(f) + '-01');
      if (boot && boot.vergiCikislari && startDt) {
        let m0 = 0;
        for (const x of boot.vergiCikislari) {
          if (x.tip === 'KDV1') continue;
          const ix = monthIndexFromDate(startDt, x.tarih, months);
          const amt = Math.abs(Number(x.tutar) || 0);
          if (ix === 0) m0 += amt;
          else if (ix > 0) cashPay[ix] = (cashPay[ix] || 0) + amt;
        }
        if (m0 > 0) cashPay[0] = m0;
        else if (cashPay[0] === 0 && openNonKdv > 0) {
          cashPay[0] = Math.max(0, targetAt(0));
        }
      } else if (openNonKdv > 0) {
        cashPay[0] = Math.max(0, targetAt(0));
      }
    }

    return { cashPay, openNonKdv, sektorId, notlar, mahsupApplied };
  }

  function enrichAfterMaliImport(f, opening) {
    if (!shouldUseBootstrap(f)) return opening;
    try {
      const boot = runBootstrap(f, projectionYear(f) + '-01');
      if (boot && boot.devrede) return applyBootstrapToOpening(f, opening, boot);
    } catch (e) {
      console.warn('[FinSkorKovaBridge] import', e);
    }
    return opening;
  }

  function donemFromStart(startDt, t) {
    const d = new Date(startDt.getTime());
    d.setMonth(d.getMonth() + t);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function weightedSmmPurchaseRate(profile) {
    const p = profile || {};
    const b = p.buckets || {};
    let sum = 0;
    let rate = 0;
    for (const k of ['raw', 'pack', 'energy', 'other']) {
      const pct = Math.max(0, Number(b[k] && b[k].pct) || 0);
      const r = Math.max(0, Number(b[k] && b[k].rate) || 0) / 100;
      sum += pct;
      rate += (pct / 100) * r;
    }
    return sum > 0 ? rate : 0.2;
  }

  /**
   * v5.2 aylık KDV — buildKdvSchedule yerine aylik-kova-projeksiyon (rejim + devreden taşıma).
   * @returns buildKdvSchedule ile uyumlu obje veya null
   */
  function buildMonthlyKdvSchedule(f, months, sales, purchases, opex, investNet, opening, startDt, profile) {
    const AP = root.AylikKovaProjeksiyon;
    if (!AP || !shouldUseMonthlyKova(f)) return null;
    const sektor = getSektor(resolveSektorId(f));
    if (!sektor || !startDt) return null;
    const p = profile || (f && f.kdvProfile) || {};
    const expPct = firmExportRatioPct(f);
    const expR = Math.max(0, Math.min(1, expPct / 100));
    const investRate = Math.max(0, Number(p.investRate) || 20) / 100;
    const smmRate = weightedSmmPurchaseRate(p);
    const opexRate = Math.max(0, Number(p.opexRate) || 20) / 100;
    const bas = donemFromStart(startDt, 0);
    const seri = {};
    const grossAnnual = resolveGrossSgkStopajAnnual(f);
    const { grossSgk, grossStopaj } = buildGrossSgkStopajMonthly(
      grossAnnual.sgk,
      grossAnnual.stopaj,
      months,
      (f && f.assumptions) || {}
    );
    const mahsubaAdayBorclarAylik = {};
    for (let t = 0; t < months; t++) {
      const brut = Math.max(0, sales[t] || 0);
      const donem = donemFromStart(startDt, t);
      const row = {
        brutSatis: brut,
        smm: Math.max(0, purchases[t] || 0),
        faaliyetGideri: Math.max(0, opex[t] || 0),
      };
      if (expR > 0 && brut > 0) row.ihracat = brut * expR;
      seri[donem] = row;
      const aday = (grossSgk[t] || 0) + (grossStopaj[t] || 0);
      if (aday > 0) mahsubaAdayBorclarAylik[donem] = aday;
    }
    const proj = AP.aylikKovaProjeksiyon(
      sektor,
      { brutSatis: 0, smm: 0, faaliyetGideri: 0 },
      {
        baslangicDonem: bas,
        donemSayisi: months,
        seri: seri,
        yil: startDt.getFullYear(),
        firma: { tamTasdik: !!(f && f.tamTasdik), his: !!(f && f.his) },
        devreden190Baslangic: Math.max(0, (opening && opening.devredenKdv) || 0),
        mahsubaAdayBorclarAylik: mahsubaAdayBorclarAylik,
      }
    );
    const vatPay = new Array(months).fill(0);
    const refundCash = new Array(months).fill(0);
    const refundClaimed = new Array(months).fill(0);
    const refundOffsetMahsup = new Array(months).fill(0);
    const salesVat = new Array(months).fill(0);
    const purchaseVat = new Array(months).fill(0);
    const opexVat = new Array(months).fill(0);
    const investVat = (investNet || []).map(function (v) {
      return Math.max(0, v || 0) * investRate;
    });
    const devredenEnd = new Array(months).fill(0);
    const devredenArtis = new Array(months).fill(0);
    const odenecekEnd = new Array(months).fill(0);
    const indirilecekEnd = new Array(months).fill(0);
    const exportSales = new Array(months).fill(0);
    const exportLoaded = new Array(months).fill(0);
    const exportPool = new Array(months).fill(0);
    const openingRefundMonth = new Array(months).fill(0);
    const indirimli292Month = new Array(months).fill(0);
    let openOd = Math.max(0, (opening && opening.odenecekKdv) || 0);
    let investCarry = 0;
    let prevDev190 = Math.max(0, (opening && opening.devredenKdv) || 0);
    for (let t = 0; t < months; t++) {
      const donem = donemFromStart(startDt, t);
      investCarry += investVat[t] || 0;
      const m = proj.aylik[t];
      if (expR > 0) {
        exportSales[t] = Math.max(0, (sales[t] || 0) * expR);
      }
      if (m) {
        salesVat[t] = m.hesaplanan391 || 0;
        purchaseVat[t] = Math.max(0, purchases[t] || 0) * smmRate;
        opexVat[t] = Math.max(0, opex[t] || 0) * opexRate;
        const kova190 = m.devreden190 || 0;
        devredenEnd[t] = kova190 + investCarry;
        devredenArtis[t] = devredenEnd[t] - prevDev190;
        prevDev190 = devredenEnd[t];
        if (m.iade) {
          if (m.iade.edilebilir > 0) refundClaimed[t] = m.iade.edilebilir;
          if (m.iade.mahsuben > 0) refundOffsetMahsup[t] = m.iade.mahsuben;
        }
      } else {
        devredenEnd[t] = prevDev190 + (investVat[t] || 0);
        devredenArtis[t] = devredenEnd[t] - prevDev190;
        prevDev190 = devredenEnd[t];
      }
      vatPay[t] = (proj.donemTutarlari.KDV1 && proj.donemTutarlari.KDV1[donem]) || 0;
      if (t === 0 && openOd > 0) {
        vatPay[t] += openOd;
        openOd = 0;
      }
      odenecekEnd[t] = vatPay[t];
      if (expR > 0) {
        exportLoaded[t] = Math.max(0, (purchases[t] || 0) * smmRate * expR);
        exportPool[t] = exportLoaded[t] + Math.max(0, (opexVat[t] || 0) * expR);
      }
    }
    for (let i = 0; i < (proj.iadeler || []).length; i++) {
      const it = proj.iadeler[i];
      const ix = monthIndexFromDate(startDt, it.tahsilDonem || it.donem, months);
      if (ix >= 0) refundCash[ix] = (refundCash[ix] || 0) + Math.max(0, it.tutar || 0);
    }
    const inputVat = purchaseVat.map(function (v, t) {
      return v + (opexVat[t] || 0) + (investVat[t] || 0);
    });
    const domShare = Math.max(0, 1 - expR);
    const domSalesRate = Math.max(0, Number(p.domesticSalesRate) || 0) / 100;
    return {
      salesVat: salesVat,
      purchaseVat: purchaseVat,
      opexVat: opexVat,
      investVat: investVat,
      inputVat: inputVat,
      exportSales: exportSales,
      exportLoaded: exportLoaded,
      exportPool: exportPool,
      devredenArtis: devredenArtis,
      openingRefundMonth: openingRefundMonth,
      indirimli292Month: indirimli292Month,
      vatPay: vatPay,
      refundCash: refundCash,
      refundClaimed: refundClaimed,
      refundOffsetMahsup: refundOffsetMahsup,
      indirilecekEnd: indirilecekEnd,
      devredenEnd: devredenEnd,
      odenecekEnd: odenecekEnd,
      effectiveSalesVatRate: domShare * domSalesRate,
      effectivePurchaseVatRate: smmRate,
      exportRatio: expR,
      exportRefundRateApplied: Math.max(0, Math.min(100, Number(p.exportRefundRate) || 0)),
      _kovaAylik: true,
      _aylikProj: proj,
      _kovaProj: { sektorId: sektor.sektorMeta.id, tur: proj.tur, toplam: proj.toplam },
    };
  }

  function getUiBucketSummary(sektorId) {
    const s = getSektor(sektorId);
    if (!s || !root.KovaUiEsleme) return null;
    return root.KovaUiEsleme.esle(s);
  }

  root.FinSkorKovaBridge = {
    isEnabled,
    shouldUse,
    shouldUseBootstrap,
    shouldUseMonthlyKova,
    shouldUseVergi36Mahsup,
    firmExportRatioPct,
    firmHasMizanKdv,
    resolveSektorId,
    suggestSektorForFirm,
    getSektor,
    listSektorler,
    sektorLabel,
    sektorCardMeta,
    tipikLabel,
    getUiGrup,
    buildSectorPickerHtml,
    sektorBlurbHtml,
    sektorToKdvProfilePatch,
    applySektorToProfile,
    populateKovaSectorSelect,
    runBootstrap,
    applyBootstrapToOpening,
    buildVergi36NonKdvCash,
    buildMonthlyKdvSchedule,
    getUiBucketSummary,
    bucketsFromUiEsle,
    enrichAfterMaliImport,
    getKatalog: function () {
      return root.KDV_KOVA_KATALOG || null;
    },
  };
})(typeof self !== 'undefined' ? self : this);
