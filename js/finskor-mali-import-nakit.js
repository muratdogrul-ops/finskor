/** NakitFlow — açılış bilanço: FinSkor çek / Excel-PDF mizan-beyanname yükleme */
(function () {
  function nkmNum(v) {
    const n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  /** Kasa + banka + diğer hazır + menkul (THP 100/102/108 + 11; 101 çek → AR) */
  function nkmLikiditeToplam(d) {
    return nkmNum(d.hazirDegerler) + nkmNum(d.menkKiymetler);
  }

  function otherAssetsPlug(d) {
    return (
      nkmNum(d.digerAlacaklar) +
      nkmNum(d.yilYayginMal) +
      nkmNum(d.gelecekAyGider) +
      nkmNum(d.digerDonen)
    );
  }

  function otherLiabKvPlug(d) {
    return (
      nkmNum(d.kvDigBorclar) +
      nkmNum(d.alinanAvans) +
      nkmNum(d.yilHakediş) +
      nkmNum(d.odenecekVergi) +
      nkmNum(d.borcKarsilik) +
      nkmNum(d.gelecekAyGelir) +
      nkmNum(d.digerKvYK)
    );
  }

  function otherLiabUvPlug(d) {
    return (
      nkmNum(d.uvDigBorclar) +
      nkmNum(d.uvAlinanAvans) +
      nkmNum(d.uvBorcKarsilik) +
      nkmNum(d.uvDigYK)
    );
  }

  function duranToplam(d) {
    return (
      nkmNum(d.uzunTicAlacak) +
      nkmNum(d.uzunDigAlacak) +
      nkmNum(d.maliDuranVar) +
      nkmNum(d.maddiDuranVar) +
      nkmNum(d.maddiOlmayan) +
      nkmNum(d.ozelTukenme) +
      nkmNum(d.gelecekYilGider) +
      nkmNum(d.digerDuran)
    );
  }

  /** Varsayımlar → TL BCH Y1 (2026); UV taksitli faiz */
  window.maliUvInstallmentRate = function (f) {
    const ass = (f && f.assumptions) || {};
    if (Number(ass.bch1) > 0) return Number(ass.bch1);
    if (Number(ass.bchRate) > 0) return Number(ass.bchRate);
    return 40;
  };

  window.UV_MALI_INSTALL_TERM = 24;
  window.UV_MALI_FIRST_PAYMENT = '2026-02-01T00:00:00.000Z';

  /** Açılış USD/TL kuru (NakitFlow fx veya varsayılan spot) */
  window.getMaliUsdOpenRate = function (f) {
    const fx = (f && f.fx) || {};
    const v = Number(fx.usdOpen);
    if (v > 0) return v;
    if (typeof FX_SPOT !== 'undefined' && Number(FX_SPOT.usd) > 0) return Number(FX_SPOT.usd);
    return 42.9229;
  };

  /** Yurtdışı satış: mizan ihracat (601) > 0 */
  window.firmHasYurtdisiSatis = function (f, parsed) {
    return window.maliIhracatTutar(f, parsed) > 0;
  };

  window.applyMaliIhracatMeta = function (f, parsed, year) {
    if (!f) return;
    const ihr = Math.round(nkmNum(parsed && parsed.ihracat));
    const rev =
      nkmNum(parsed && parsed.netSatis) ||
      Math.max(0, nkmNum(parsed && parsed.brutSatis) - nkmNum(parsed && parsed.satisInd)) ||
      nkmNum(f.incomeStmt && f.incomeStmt.revenue);
    f.maliIhracat = {
      ihracat: ihr,
      hasYurtdisiSatis: ihr > 0,
      ihracatOrani: rev > 0 ? (ihr / rev) * 100 : 0,
      year: year || null,
    };
  };

  /** İhracatçı: KV BCH %50 TL + %50 USD (UV taksitli TL aynı) */
  window.splitKvBchForExport = function (kvTl, f) {
    const kv = Math.max(0, Math.round(nkmNum(kvTl)));
    if (kv <= 0) return [];
    const halfTl = Math.floor(kv / 2);
    const halfTlUsdLeg = kv - halfTl;
    const usdRate = window.getMaliUsdOpenRate(f);
    const usdPrincipal = Math.round((halfTlUsdLeg / usdRate) * 100) / 100;
    return [
      {
        type: 'bch_existing',
        bank: 'KV Mali Borç — TL (%50)',
        ccy: 'TL',
        principal: halfTl,
        _maliAuto: 'kv_tl',
      },
      {
        type: 'bch_existing',
        bank: 'KV Mali Borç — USD (%50)',
        ccy: 'USD',
        principal: usdPrincipal,
        _maliAuto: 'kv_usd',
      },
    ];
  };

  /** BCH toplamında USD payı (TL karşılığı); EUR ihracat kuralına dahil değil */
  window.bchUsdShareRatio = function (f, fx, monthIndex) {
    const loans = (f && f.loans) || [];
    const mi = monthIndex == null ? 0 : monthIndex;
    let tl = 0;
    let usdEq = 0;
    for (const L of loans) {
      if (L.type !== 'bch_existing') continue;
      const p = Math.max(0, nkmNum(L.principal));
      const ccy = L.ccy || 'TL';
      if (ccy === 'USD') {
        const r =
          typeof getFxRate === 'function' ? getFxRate(fx || f.fx, 'USD', mi) : getMaliUsdOpenRate(f);
        usdEq += p * (r > 0 ? r : getMaliUsdOpenRate(f));
      } else if (ccy === 'TL') {
        tl += p;
      }
    }
    const tot = tl + usdEq;
    return tot > 0 ? usdEq / tot : 0;
  };

  /**
   * Likidite eksiği BCH çekimi — ihracatçıda USD payı ≥ %50 (TL karşılığı).
   * Kalan kısım TL veya USD; EUR kullanılmaz.
   */
  window.splitBchDrawForExport = function (needTl, bbalTl, bbalUsdFc, fxUsd) {
    const need = Math.max(0, needTl);
    const fx = fxUsd > 0 ? fxUsd : 1;
    const tl = Math.max(0, bbalTl);
    const usdFc = Math.max(0, bbalUsdFc);
    const totalEq = tl + usdFc * fx;
    const usdEq = usdFc * fx;
    if (need <= 0) return { drawTl: 0, drawUsdFc: 0 };
    const targetUsdEq = 0.5 * (totalEq + need);
    const minUsdEq = Math.max(0, targetUsdEq - usdEq);
    const drawUsdEq = Math.min(need, minUsdEq);
    const drawUsdFc = drawUsdEq / fx;
    const drawTl = need - drawUsdEq;
    return { drawTl, drawUsdFc };
  };

  /** Firma kaynağından ihracat tutarı (601) */
  window.maliIhracatTutar = function (f, parsed) {
    if (parsed && nkmNum(parsed.ihracat) > 0) return Math.round(nkmNum(parsed.ihracat));
    if (f && f.maliIhracat && nkmNum(f.maliIhracat.ihracat) > 0) {
      return Math.round(nkmNum(f.maliIhracat.ihracat));
    }
    if (f && f.maliSource && nkmNum(f.maliSource.ihracat) > 0) {
      return Math.round(nkmNum(f.maliSource.ihracat));
    }
    const raw = f && f.maliParsedSnapshot && f.maliParsedSnapshot.raw;
    if (raw && nkmNum(raw.ihracat) > 0) return Math.round(nkmNum(raw.ihracat));
    if (f && f.openingMaliMeta && nkmNum(f.openingMaliMeta.ihracat) > 0) {
      return Math.round(nkmNum(f.openingMaliMeta.ihracat));
    }
    if (f && f.incomeStmt && nkmNum(f.incomeStmt.ihracat) > 0) {
      return Math.round(nkmNum(f.incomeStmt.ihracat));
    }
    try {
      const pack = JSON.parse(localStorage.getItem('kas_autosave') || 'null');
      const y =
        (f && f.opening && f.opening.maliKapanisYili) ||
        (f && f.maliIhracat && f.maliIhracat.year) ||
        new Date().getFullYear() - 1;
      const yd = pack && pack.yearData && pack.yearData[y];
      if (yd && nkmNum(yd.ihracat) > 0) return Math.round(nkmNum(yd.ihracat));
    } catch {
      /* yoksay */
    }
    return 0;
  };

  /** syncLoansFromMaliBorc için tam payload (ihracat dahil) */
  window.maliBorcSyncPayload = function (f, overrides) {
    const o = overrides || {};
    const ihr = window.maliIhracatTutar(f, o);
    return {
      kvMaliBorclar: Math.round(nkmNum(o.kvMaliBorclar != null ? o.kvMaliBorclar : f && f.opening && f.opening.kvMaliBorclar)),
      uvMaliBorclar: Math.round(nkmNum(o.uvMaliBorclar != null ? o.uvMaliBorclar : f && f.opening && f.opening.uvMaliBorclar)),
      ihracat: ihr,
      brutSatis: nkmNum(o.brutSatis) || nkmNum(f && f.maliSource && f.maliSource.brutSatis),
      netSatis: nkmNum(o.netSatis) || nkmNum(f && f.maliSource && f.maliSource.netSatis),
    };
  };

  /** Kayıtlı meta eksikse ihracat alanlarını doldur */
  window.backfillMaliIhracatMeta = function (f) {
    if (!f) return false;
    const ihr = window.maliIhracatTutar(f);
    if (ihr <= 0) return false;
    const year = (f.opening && f.opening.maliKapanisYili) || (f.maliIhracat && f.maliIhracat.year) || null;
    window.applyMaliIhracatMeta(f, { ihracat: ihr, netSatis: nkmNum(f.incomeStmt && f.incomeStmt.revenue), brutSatis: nkmNum(f.maliSource && f.maliSource.brutSatis) }, year);
    if (!f.maliSource) f.maliSource = { ihracat: ihr, year };
    else if (!nkmNum(f.maliSource.ihracat)) f.maliSource.ihracat = ihr;
    if (f.incomeStmt && !nkmNum(f.incomeStmt.ihracat)) f.incomeStmt.ihracat = ihr;
    if (!f.openingMaliMeta) f.openingMaliMeta = {};
    if (!nkmNum(f.openingMaliMeta.ihracat)) {
      f.openingMaliMeta.ihracat = ihr;
      f.openingMaliMeta.hasYurtdisiSatis = true;
    }
    const snap = f.maliParsedSnapshot;
    if (snap) {
      if (!snap.raw) snap.raw = {};
      if (!nkmNum(snap.raw.ihracat)) snap.raw.ihracat = ihr;
    }
    return true;
  };

  /** İhracatçı KV BCH: tek TL → %50 TL + %50 USD (manuel ihracat ile de çalışır) */
  window.reapplyExportKvBchLoans = function (f, ihrOverride) {
    if (!f) return false;
    const ihr =
      ihrOverride != null && ihrOverride !== ''
        ? Math.round(nkmNum(ihrOverride))
        : window.maliIhracatTutar(f);
    if (ihr <= 0) return false;
    window.applyMaliIhracatMeta(
      f,
      {
        ihracat: ihr,
        netSatis: nkmNum(f.incomeStmt && f.incomeStmt.revenue),
        brutSatis: nkmNum(f.maliSource && f.maliSource.brutSatis),
      },
      (f.opening && f.opening.maliKapanisYili) || null,
    );
    window.backfillMaliIhracatMeta(f);
    const kv = Math.round(
      nkmNum(f.opening && f.opening.kvMaliBorclar) ||
        ((f.loans || []).find((L) => L._maliAuto && String(L._maliAuto).startsWith('kv')) || {}).principal ||
        0,
    );
    if (kv <= 0) return false;
    window.syncLoansFromMaliBorc(
      f,
      window.maliBorcSyncPayload(f, {
        kvMaliBorclar: kv,
        uvMaliBorclar: f.opening && f.opening.uvMaliBorclar,
        ihracat: ihr,
      }),
    );
    return true;
  };

  /** Eski tek TL KV BCH → ihracatçıda %50 TL + %50 USD */
  window.migrateExportKvBchSplit = function (f) {
    if (!f) return false;
    window.backfillMaliIhracatMeta(f);
    if (!window.firmHasYurtdisiSatis(f)) return false;
    const kvLoans = (f.loans || []).filter(
      (L) => L.type === 'bch_existing' && L._maliAuto && String(L._maliAuto).startsWith('kv'),
    );
    const alreadySplit =
      kvLoans.some((L) => L._maliAuto === 'kv_tl') && kvLoans.some((L) => L._maliAuto === 'kv_usd');
    if (alreadySplit) return false;
    const legacySingle =
      kvLoans.length === 1 && (kvLoans[0]._maliAuto === 'kv' || kvLoans[0].bank === 'KV Mali Borç (mizan/FinSkor)');
    if (!legacySingle && kvLoans.length > 0) return false;
    const kv = Math.round(
      nkmNum(f.opening && f.opening.kvMaliBorclar) || (kvLoans[0] && kvLoans[0].principal) || 0,
    );
    if (kv <= 0) return false;
    window.syncLoansFromMaliBorc(
      f,
      window.maliBorcSyncPayload(f, { kvMaliBorclar: kv, uvMaliBorclar: f.opening && f.opening.uvMaliBorclar }),
    );
    return true;
  };

  /** KV → BCH mevcut; UV → 24 ay taksitli (ilk ödeme 01.02.2026, faiz = BCH Y1) */
  window.syncLoansFromMaliBorc = function (f, d) {
    if (!f) return { kv: 0, uv: 0, bchSplit: false };
    const kv = Math.round(nkmNum(d.kvMaliBorclar));
    const uv = Math.round(nkmNum(d.uvMaliBorclar));
    if (!f.loans) f.loans = [];
    f.loans = f.loans.filter((L) => !L._maliAuto);
    let bchSplit = false;
    if (kv > 0) {
      if (window.firmHasYurtdisiSatis(f, d)) {
        window.splitKvBchForExport(kv, f).forEach((loan) => f.loans.push(loan));
        bchSplit = true;
      } else {
        f.loans.push({
          type: 'bch_existing',
          bank: 'KV Mali Borç (mizan/FinSkor)',
          ccy: 'TL',
          principal: kv,
          _maliAuto: 'kv',
        });
      }
    }
    if (uv > 0) {
      const rate = maliUvInstallmentRate(f);
      f.loans.push({
        type: 'installment',
        bank: 'UV Mali Borç (mizan/FinSkor)',
        ccy: 'TL',
        principal: uv,
        term: UV_MALI_INSTALL_TERM,
        rate,
        existing: true,
        firstPaymentDate: UV_MALI_FIRST_PAYMENT,
        startDate: UV_MALI_FIRST_PAYMENT,
        _maliAuto: 'uv',
      });
      const last = f.loans[f.loans.length - 1];
      if (typeof normalizeInstallmentLoan === 'function') normalizeInstallmentLoan(last);
    }
    if (!f.opening) f.opening = {};
    f.opening.kvMaliBorclar = kv;
    f.opening.uvMaliBorclar = uv;
    return { kv, uv, bchSplit };
  };

  function maliInflationBeyanFromCopy(copy) {
    if (typeof maliInflationBeyanDetected === 'function') return maliInflationBeyanDetected(copy);
    return !!(copy && (copy._enflasyonSonrasiBilanco || copy.enflasyonSonrasiBilanco));
  }

  function mapRetainedFromMizan(copy) {
    const inf = maliInflationBeyanFromCopy(copy);
    const gk = nkmNum(copy.gecmisKar);
    const gz = nkmNum(copy.gecmisZarar);
    let priorYearNetKar;
    if (inf && copy.donemNetKarBilanco != null && copy.donemNetKarBilanco !== '') {
      priorYearNetKar = Math.round(nkmNum(copy.donemNetKarBilanco));
    } else if (inf) {
      priorYearNetKar = Math.round(nkmNum(copy.donemNetKar) || 0);
    } else {
      priorYearNetKar = Math.round(nkmNum(copy.donemNetKarGelir) || nkmNum(copy.donemNetKar));
    }
    const priorYearGecmisKar = Math.round(gk - gz);
    const openingRetainedEarnings = priorYearGecmisKar + priorYearNetKar;
    return {
      priorYearGecmisKar,
      priorYearNetKar,
      openingRetainedEarnings,
      maliYilDonemNetKar: priorYearNetKar,
      maliYilDonemNetKarGelir: Math.round(nkmNum(copy.donemNetKarGelir) || 0),
      enflasyonSonrasiBilanco: inf,
    };
  }

  /** Ödenmiş sermaye + yedekler; devreden kar/zarar ayrı satırda (5Y bilanço çift sayımı önlenir). */
  function openingCapitalFromMizan(copy, retained) {
    const inf = maliInflationBeyanFromCopy(copy);
    const explicit = Math.round(
      nkmNum(copy.odenmisSermaye) + nkmNum(copy.sermaYedek) + nkmNum(copy.karYedek),
    );
    if (inf && explicit > 0) return explicit;
    const oz = nkmNum(copy.ozKaynak);
    const re = Math.round(retained?.openingRetainedEarnings || 0);
    if (explicit > 0 && (oz <= 0 || Math.abs(oz - explicit - re) < 1000)) return explicit;
    if (oz > 0 && re > 0) return Math.round(Math.max(0, oz - re));
    return Math.round(oz || explicit);
  }

  window.FinSkorMaliImport = {
    mapToOpening(d, year) {
      const y = year || new Date().getFullYear();
      const copy = { ...d };
      hesapToplamlarOnObject(copy, y);
      const likidite = nkmLikiditeToplam(copy);
      const retained = mapRetainedFromMizan(copy);
      return {
        cash: 0,
        bank: likidite,
        ar: nkmNum(copy.ticAlacaklar),
        ap: nkmNum(copy.kvTicBorclar) + nkmNum(copy.uvTicBorclar),
        inventory: nkmNum(copy.stoklar),
        mdv: duranToplam(copy) || nkmNum(copy.maddiDuranVar),
        capital: openingCapitalFromMizan(copy, retained),
        openingCapitalExcludesRetained: true,
        otherAssets: otherAssetsPlug(copy),
        otherLiab: otherLiabKvPlug(copy) + otherLiabUvPlug(copy),
        openingOtherLiabKv: otherLiabKvPlug(copy),
        openingOtherLiabUv: otherLiabUvPlug(copy),
        kvMaliBorclar: Math.round(nkmNum(copy.kvMaliBorclar)),
        uvMaliBorclar: Math.round(nkmNum(copy.uvMaliBorclar)),
        priorYearGecmisKar: retained.priorYearGecmisKar,
        priorYearNetKar: retained.priorYearNetKar,
        openingRetainedEarnings: retained.openingRetainedEarnings,
        maliKapanisYili: y,
        enflasyonSonrasiBilanco: retained.enflasyonSonrasiBilanco,
        _parsedYear: y,
        _sourceKeys: copy,
      };
    },

    mapToIncomeStmt(d, year) {
      const y = year || new Date().getFullYear();
      const copy = { ...d };
      hesapToplamlarOnObject(copy, y);
      let revenue = Math.round(nkmNum(copy.netSatis));
      if (!revenue && (copy.brutSatis || copy.satisInd)) {
        revenue = Math.round(nkmNum(copy.brutSatis) - nkmNum(copy.satisInd));
      }
      const cogs = Math.round(nkmNum(copy.satMaliyet));
      return {
        revenue,
        cogs,
        faalGider: Math.round(nkmNum(copy.faalGider)),
        brutSatisKar: Math.round(nkmNum(copy.brutSatisKar)),
        finansmanGider: Math.round(nkmNum(copy.finansmanGider)),
        donemNetKar: Math.round(nkmNum(copy.donemNetKarGelir) || nkmNum(copy.donemNetKar)),
        ihracat: Math.round(nkmNum(copy.ihracat)),
        sourceYear: y,
      };
    },

    parseFile(file, year) {
      return new Promise((resolve, reject) => {
        if (typeof parseMizanExcel !== 'function' || typeof parseMizanPDF !== 'function') {
          reject(new Error('Mali import modülü yüklenemedi'));
          return;
        }
        window._nfMaliImportResolve = resolve;
        window._nfMaliImportReject = reject;
        importState.year = year;
        importState.silentYear = null;
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        const isPdf = ext === 'pdf' || file.type === 'application/pdf';
        importState._formatLabel = isPdf ? 'PDF mizan/beyanname' : 'Excel mizan';
        clearOpeningImportLog();
        importLog(`📁 <b>${file.name}</b> okunuyor…`, 'info');
        if (isPdf) parseMizanPDF(file);
        else parseMizanExcel(file);
      });
    },
  };

  window.clearOpeningImportLog = function () {
    const el = document.getElementById('opening-import-log');
    if (el) el.innerHTML = '';
  };

  window.getDefaultMaliYear = function (f) {
    if (f && f.startDate) return new Date(f.startDate).getFullYear() - 1;
    return new Date().getFullYear() - 1;
  };

  window.populateOpeningMaliYearSelect = function () {
    const sel = document.getElementById('opening-mali-yil');
    if (!sel) return;
    const def = getDefaultMaliYear(typeof curFirm === 'function' ? curFirm() : null);
    const years = [def - 1, def, def + 1, def + 2].filter((y) => y >= 2018 && y <= 2030);
    const uniq = [...new Set(years)].sort((a, b) => b - a);
    sel.innerHTML = uniq.map((y) => `<option value="${y}"${y === def ? ' selected' : ''}>${y}</option>`).join('');
  };

  function fmtMaliTr(n) {
    const v = Number(n) || 0;
    return v.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
  }

  function openingFieldsBalance(o, openingRetained) {
    const x = o || {};
    const re = Number(openingRetained) || Number(x.openingRetainedEarnings) || 0;
    const aktif =
      nkmNum(x.cash) +
      nkmNum(x.bank) +
      nkmNum(x.ar) +
      nkmNum(x.inventory) +
      nkmNum(x.mdv) +
      nkmNum(x.otherAssets);
    const pasif =
      nkmNum(x.ap) +
      nkmNum(x.kvMaliBorclar) +
      nkmNum(x.uvMaliBorclar) +
      nkmNum(x.capital) +
      nkmNum(x.otherLiab) +
      re;
    return { aktif, pasif, fark: aktif - pasif };
  }

  function buildMaliParsedSnapshot(parsed, year, meta) {
    const copy = { ...parsed };
    delete copy._firmaAdi;
    hesapToplamlarOnObject(copy, year);
    const bilancoRows = [];
    const gelirRows = [];
    let inGelir = false;
    for (const row of HESAPLAR) {
      if (row.type === 'cat') {
        if (/GELİR/i.test(row.label)) inGelir = true;
        const target = inGelir ? gelirRows : bilancoRows;
        target.push({ type: 'cat', label: row.label });
        continue;
      }
      const v = Number(copy[row.key]) || 0;
      if (!row.isTotal && v === 0) continue;
      const item = { key: row.key, label: row.label, value: v, isTotal: !!row.isTotal };
      if (inGelir) gelirRows.push(item);
      else bilancoRows.push(item);
    }
    const aktifToplam = copy.aktifToplam || 0;
    const pasifToplam = copy.pasifToplam || 0;
    return {
      year,
      source: meta?.source || 'file',
      format: meta?.format || '',
      fileName: meta?.fileName || '',
      firmaAdi: parsed._firmaAdi || '',
      at: new Date().toISOString(),
      totals: { aktifToplam, pasifToplam, fark: aktifToplam - pasifToplam },
      bilancoRows,
      gelirRows,
      raw: {
        ihracat: Math.round(nkmNum(parsed.ihracat)),
        brutSatis: nkmNum(parsed.brutSatis),
        netSatis: nkmNum(copy.netSatis),
      },
    };
  }

  window.renderOpeningMaliPreview = function () {
    const card = document.getElementById('opening-mali-preview-card');
    if (!card) return;
    const f = typeof curFirm === 'function' ? curFirm() : null;
    const snap = f && f.maliParsedSnapshot;
    if (!snap || (!snap.bilancoRows?.length && !snap.gelirRows?.length)) {
      card.style.display = 'none';
      const bar = document.getElementById('opening-mali-balance-bar');
      if (bar) bar.innerHTML = '';
      const metaEl = document.getElementById('opening-mali-preview-meta');
      if (metaEl) metaEl.textContent = '';
      ['opening-mali-bilanco-body', 'opening-mali-gelir-body'].forEach((id) => {
        const body = document.getElementById(id);
        if (body) body.innerHTML = '';
      });
      return;
    }
    card.style.display = 'block';
    const metaEl = document.getElementById('opening-mali-preview-meta');
    if (metaEl) {
      const src =
        snap.source === 'finskor'
          ? `FinSkor · ${snap.year} kapanış`
          : `${snap.format || 'Dosya'}${snap.fileName ? ' · ' + snap.fileName : ''} · ${snap.year}`;
      metaEl.textContent =
        (snap.firmaAdi ? snap.firmaAdi + ' — ' : '') +
        src +
        (snap.at ? ' · ' + new Date(snap.at).toLocaleString('tr-TR') : '');
    }
    const bar = document.getElementById('opening-mali-balance-bar');
    if (bar && snap.totals) {
      const tf = snap.totals;
      const re =
        typeof openingRetainedForFirm === 'function'
          ? openingRetainedForFirm(f)
          : Number(f.opening?.openingRetainedEarnings) || 0;
      const ob = openingFieldsBalance(f.opening, re);
      const okParsed = Math.abs(tf.fark) < 1;
      const okOpening = Math.abs(ob.fark) < 1;
      bar.innerHTML =
        `<div class="opening-mali-kpi"><div class="lbl">Dosya — Aktif</div><div class="val">${fmtMaliTr(tf.aktifToplam)}</div></div>` +
        `<div class="opening-mali-kpi"><div class="lbl">Dosya — Pasif</div><div class="val">${fmtMaliTr(tf.pasifToplam)}</div></div>` +
        `<div class="opening-mali-kpi ${okParsed ? 'ok' : 'warn'}"><div class="lbl">Dosya — Fark (A−P)</div><div class="val">${fmtMaliTr(tf.fark)}</div></div>` +
        `<div class="opening-mali-kpi"><div class="lbl">Açılış kutuları — Fark</div><div class="val ${okOpening ? '' : 'neg'}">${fmtMaliTr(ob.fark)}</div></div>`;
    }
    function renderRows(bodyId, rows) {
      const body = document.getElementById(bodyId);
      if (!body) return;
      body.innerHTML = (rows || [])
        .map((row) => {
          if (row.type === 'cat') {
            return `<tr class="muted-row"><td colspan="2">${row.label}</td></tr>`;
          }
          const cls = row.isTotal ? ' style="font-weight:700"' : '';
          const vCls = row.value < 0 ? 'neg' : '';
          return `<tr${cls}><td>${row.label}</td><td class="${vCls}">${fmtMaliTr(row.value)}</td></tr>`;
        })
        .join('');
    }
    renderRows('opening-mali-bilanco-body', snap.bilancoRows);
    renderRows('opening-mali-gelir-body', snap.gelirRows);
  };

  window.applyParsedToIncomeStmt = function (f, parsed, meta) {
    if (!f || !parsed) return null;
    const year = meta?.year || getDefaultMaliYear(f);
    const inc = FinSkorMaliImport.mapToIncomeStmt(parsed, year);
    if (!inc.revenue && !inc.cogs && !inc.faalGider) return null;
    f.incomeStmt = {
      revenue: inc.revenue,
      cogs: inc.cogs,
      faalGider: inc.faalGider,
      brutSatisKar: inc.brutSatisKar,
      finansmanGider: inc.finansmanGider,
      donemNetKar: inc.donemNetKar,
      ihracat: inc.ihracat || 0,
      sourceYear: year,
    };
    if (inc.faalGider > 0 && typeof applyFaalGiderFromMali === 'function') {
      applyFaalGiderFromMali(f, inc.faalGider);
    }
    if (typeof populateIncome === 'function') populateIncome();
    return inc;
  };

  window.applyParsedToOpeningBalance = async function (parsed, meta) {
    const f = typeof curFirm === 'function' ? curFirm() : null;
    if (!f) {
      showAlert('Önce firma seçin veya oluşturun.', 'err');
      return;
    }
    const year = meta?.year || getDefaultMaliYear(f);
    const opening = FinSkorMaliImport.mapToOpening(parsed, year);
    if (!f.opening) f.opening = {};
    Object.assign(f.opening, {
      cash: opening.cash,
      bank: opening.bank,
      ar: opening.ar,
      ap: opening.ap,
      inventory: opening.inventory,
      mdv: opening.mdv,
      capital: opening.capital,
      otherAssets: opening.otherAssets,
      otherLiab: opening.otherLiab,
      openingOtherLiabKv: opening.openingOtherLiabKv,
      openingOtherLiabUv: opening.openingOtherLiabUv,
      kvMaliBorclar: opening.kvMaliBorclar,
      uvMaliBorclar: opening.uvMaliBorclar,
      priorYearGecmisKar: opening.priorYearGecmisKar,
      priorYearNetKar: opening.priorYearNetKar,
      openingRetainedEarnings: opening.openingRetainedEarnings,
      maliKapanisYili: opening.maliKapanisYili,
      openingCapitalExcludesRetained: opening.openingCapitalExcludesRetained,
    });
    const retained = mapRetainedFromMizan(parsed);
    if (retained.enflasyonSonrasiBilanco) {
      const gelirNet = Math.round(nkmNum(parsed.donemNetKarGelir) || 0);
      importLog(
        `📐 Enflasyon beyan: devreden dönem net <b>${(opening.priorYearNetKar || 0).toLocaleString('tr-TR')}</b> TL (bilanço son sütun)` +
          (gelirNet && Math.abs(gelirNet - (opening.priorYearNetKar || 0)) > 1000
            ? ` · gelir tablosu net <b>${gelirNet.toLocaleString('tr-TR')}</b> yalnızca gelir özetinde`
            : ''),
        'info',
      );
    }
    if (opening.openingRetainedEarnings) {
      importLog(
        `📒 ${year} kapanış → ${year + 1} devreden: geçmiş <b>${(opening.priorYearGecmisKar || 0).toLocaleString('tr-TR')}</b> + dönem net <b>${(opening.priorYearNetKar || 0).toLocaleString('tr-TR')}</b> = <b>${opening.openingRetainedEarnings.toLocaleString('tr-TR')}</b> TL`,
        'ok',
      );
    } else if (opening.priorYearNetKar) {
      importLog(
        `📒 Dönem net kar (${year}): <b>${opening.priorYearNetKar.toLocaleString('tr-TR')}</b> TL → sonraki yıl geçmiş dönem karı`,
        'ok',
      );
    }
    f.maliSource = {
      ihracat: Math.round(nkmNum(parsed.ihracat)),
      brutSatis: nkmNum(parsed.brutSatis),
      netSatis: nkmNum(parsed.netSatis),
      year,
    };
    window.applyMaliIhracatMeta(f, parsed, year);
    const synced = window.syncLoansFromMaliBorc(f, window.maliBorcSyncPayload(f, parsed));
    if (synced.kv > 0 || synced.uv > 0) {
      const bchTxt = synced.bchSplit
        ? `KV <b>${synced.kv.toLocaleString('tr-TR')}</b> TL → BCH <b>%50 TL + %50 USD</b> (ihracat)`
        : `KV <b>${synced.kv.toLocaleString('tr-TR')}</b> TL (BCH)`;
      importLog(
        `🏦 Krediler: ${bchTxt} · UV <b>${synced.uv.toLocaleString('tr-TR')}</b> TL (24 ay taksit, ilk ödeme 01.02.2026, faiz %${maliUvInstallmentRate(f)})`,
        'ok',
      );
    }
    if (f.maliIhracat && f.maliIhracat.hasYurtdisiSatis) {
      importLog(
        `🌍 Yurtdışı satış <b>${f.maliIhracat.ihracat.toLocaleString('tr-TR')}</b> TL` +
          (f.maliIhracat.ihracatOrani > 0
            ? ` (ciro ~%${f.maliIhracat.ihracatOrani.toFixed(1)}) — BCH çekiminde min. %50 USD`
            : ''),
        'info',
      );
    }
    if (typeof renderLoans === 'function') renderLoans();
    const inc = applyParsedToIncomeStmt(f, parsed, meta);
    if (inc && (inc.revenue || inc.cogs)) {
      const gm =
        inc.revenue > 0 ? (((inc.revenue - inc.cogs) / inc.revenue) * 100).toFixed(1) : '—';
      importLog(
        `📊 Referans gelir: ciro <b>${inc.revenue.toLocaleString('tr-TR')}</b> · SMM <b>${inc.cogs.toLocaleString('tr-TR')}</b> TL · brüt marj <b>%${gm}</b>`,
        'ok',
      );
      if (inc.faalGider > 0) {
        importLog(
          `📋 Faaliyet gideri (63): yıllık <b>${inc.faalGider.toLocaleString('tr-TR')}</b> → Giderler / Operasyon-Diğer aylık`,
          'info',
        );
      }
    } else if (inc && inc.faalGider > 0) {
      importLog(`📋 Faaliyet gideri aylık giderlere yazıldı (ciro/SMM mizanda yok).`, 'info');
    } else {
      importLog(
        '⚠️ Gelir tablosu (net satış / SMM) bu dosyada bulunamadı — Referans Gelir sayfasından manuel girin.',
        'warn',
      );
    }
    f.openingMaliMeta = {
      source: meta?.source || 'file',
      format: meta?.format || '',
      year,
      fileName: meta?.fileName || '',
      at: new Date().toISOString(),
      ihracat: f.maliIhracat?.ihracat || 0,
      hasYurtdisiSatis: !!(f.maliIhracat && f.maliIhracat.hasYurtdisiSatis),
    };
    f.maliParsedSnapshot = buildMaliParsedSnapshot(parsed, year, meta);
    if (f.maliParsedSnapshot?.totals) {
      const t = f.maliParsedSnapshot.totals;
      importLog(
        `⚖️ Dosya bilanço: Aktif <b>${fmtMaliTr(t.aktifToplam)}</b> · Pasif <b>${fmtMaliTr(t.pasifToplam)}</b> · Fark <b>${fmtMaliTr(t.fark)}</b> TL`,
        Math.abs(t.fark) < 1 ? 'ok' : 'warn',
      );
    }
    if (typeof renderOpeningMaliPreview === 'function') renderOpeningMaliPreview();
    if (typeof populateOpening === 'function') populateOpening();
    try {
      if (typeof autoFillTcmbDefaultsForFirm === 'function') {
        await autoFillTcmbDefaultsForFirm(f, { refreshUi: false, fetchTcmb: true });
        if (typeof markTcmbAutofillDone === 'function') markTcmbAutofillDone(f);
        importLog(
          '⚙️ Varsayımlar ve 120 ay kur tablosu TCMB kurallarıyla dolduruldu — alanları elle değiştirebilirsiniz.',
          'ok',
        );
      } else if (typeof applyTcmbAssumptionsToFirm === 'function') {
        applyTcmbAssumptionsToFirm(f);
        applyTcmbFxToFirm(f, {});
        if (typeof markTcmbAutofillDone === 'function') markTcmbAutofillDone(f);
      }
      if (typeof enrichFxOpeningFromTcmbYearend === 'function') enrichFxOpeningFromTcmbYearend(f);
    } catch (e) {
      if (typeof applyTcmbAssumptionsToFirm === 'function') {
        applyTcmbAssumptionsToFirm(f);
        applyTcmbFxToFirm(f, {});
        if (typeof markTcmbAutofillDone === 'function') markTcmbAutofillDone(f);
      }
      importLog('⚙️ Varsayımlar yerel TCMB tahminiyle dolduruldu (canlı TCMB: ' + (e.message || e) + ').', 'warn');
    }
    if (typeof saveState === 'function') await saveState();
    if (state.currentFirmId === f.id) {
      if (typeof populateAssumptions === 'function') populateAssumptions();
      if (typeof populateFx === 'function') populateFx();
      if (typeof updateTcmbAutofillUi === 'function') updateTcmbAutofillUi();
    }
    const src =
      meta?.source === 'finskor'
        ? `FinSkor (${year})`
        : `${meta?.format || 'Dosya'}${meta?.fileName ? ': ' + meta.fileName : ''}`;
    const gelirNote =
      inc && inc.revenue
        ? ` Referans gelir: ${inc.revenue.toLocaleString('tr-TR')} TL.`
        : '';
    showAlert(`Açılış + gelir güncellendi — ${src}.${gelirNote} Alanları düzenleyebilirsiniz.`, 'ok');
  };

  window.handleOpeningMaliFile = async function (ev) {
    const file = ev.target?.files?.[0];
    ev.target.value = '';
    if (!file) return;
    const f = typeof curFirm === 'function' ? curFirm() : null;
    if (!f) {
      showAlert('Önce firma seçin.', 'err');
      return;
    }
    const year = parseInt(document.getElementById('opening-mali-yil')?.value, 10) || getDefaultMaliYear(f);
    try {
      const result = await FinSkorMaliImport.parseFile(file, year);
      applyParsedToOpeningBalance(result.data, {
        source: 'file',
        format: result.format,
        year,
        fileName: file.name,
      });
    } catch (e) {
      importLog(`❌ ${e.message || e}`, 'err');
      showAlert(e.message || 'Dosya okunamadı', 'err');
    }
  };

  window.pullOpeningFromFinSkor = function () {
    const f = typeof curFirm === 'function' ? curFirm() : null;
    if (!f) {
      showAlert('Önce firma seçin.', 'err');
      return;
    }
    clearOpeningImportLog();
    const pending = localStorage.getItem('nakit_akis_finskor_data');
    if (pending) {
      try {
        const p = JSON.parse(pending);
        if (p && p.kaynak === 'finskor') {
          const d = {
            hazirDegerler: p.kasaBanka,
            menkKiymetler: p.menkKiymetler || 0,
            ticAlacaklar: p.ticariAlacaklar,
            stoklar: p.stoklar,
            kvTicBorclar: p.kvTicariBorclar,
            kvMaliBorclar: p.kvMaliBorclar,
            uvMaliBorclar: p.uvMaliBorclar,
            netSatis: p.netSatis,
            satMaliyet: p.satMaliyet,
            faalGider: p.faalGider,
            brutSatis: p.brutSatis,
            satisInd: p.satisInd,
            ozKaynak: p.ozKaynak,
            maddiDuranVar: p.maddiDuranVar,
            duranVarlikToplami: p.duranVarlikToplami,
            otherAssets: p.otherAssets,
          };
          applyParsedToOpeningBalance(d, { source: 'finskor', format: 'Nakit aktarım bekleyen', year: p.veriYili });
          importLog('ℹ️ FinSkor NakitFlow aktarım verisi kullanıldı (tam firma aktarımı için sayfayı yenileyin).', 'info');
          return;
        }
      } catch {
        /* devam */
      }
    }

    const raw = localStorage.getItem('kas_autosave');
    if (!raw) {
      importLog('FinSkor otomatik kayıt (kas_autosave) bulunamadı.', 'err');
      showAlert(
        'FinSkor verisi yok. Aynı tarayıcıda önce FinSkor analiz sayfasında (app.html) veri girin veya kaydedin.',
        'err',
      );
      return;
    }
    let pack;
    try {
      pack = JSON.parse(raw);
    } catch {
      showAlert('FinSkor kayıt dosyası okunamadı.', 'err');
      return;
    }
    const year = parseInt(document.getElementById('opening-mali-yil')?.value, 10) || getDefaultMaliYear(f);
    const yd = pack.yearData && pack.yearData[year];
    if (!yd || !Object.entries(yd).some(([k, v]) => !k.startsWith('_') && v && v !== 0)) {
      importLog(`${year} yılı için FinSkor verisi yok.`, 'warn');
      showAlert(`${year} yılı FinSkor verisi bulunamadı. Başka yıl seçin.`, 'err');
      return;
    }
    importLog(`FinSkor kas_autosave → ${year} yılı`, 'ok');
    if (pack.firmaAdi) importLog(`Firma: ${pack.firmaAdi}`, 'info');
    applyParsedToOpeningBalance({ ...yd }, { source: 'finskor', format: 'FinSkor otomatik kayıt', year });
  };

  document.addEventListener('DOMContentLoaded', function () {
    populateOpeningMaliYearSelect();
  });
})();
