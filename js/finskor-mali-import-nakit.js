/** NakitFlow — açılış bilanço: FinSkor çek / Excel-PDF mizan-beyanname yükleme */
(function () {
  function nkmNum(v) {
    const n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  function otherAssetsPlug(d) {
    return (
      nkmNum(d.menkKiymetler) +
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

  /** KV → BCH mevcut; UV → 24 ay taksitli (ilk ödeme 01.02.2026, faiz = BCH Y1) */
  window.syncLoansFromMaliBorc = function (f, d) {
    if (!f) return { kv: 0, uv: 0 };
    const kv = Math.round(nkmNum(d.kvMaliBorclar));
    const uv = Math.round(nkmNum(d.uvMaliBorclar));
    if (!f.loans) f.loans = [];
    f.loans = f.loans.filter((L) => !L._maliAuto);
    if (kv > 0) {
      f.loans.push({
        type: 'bch_existing',
        bank: 'KV Mali Borç (mizan/FinSkor)',
        ccy: 'TL',
        principal: kv,
        _maliAuto: 'kv',
      });
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
    return { kv, uv };
  };

  function mapRetainedFromMizan(copy) {
    const gk = nkmNum(copy.gecmisKar);
    const gz = nkmNum(copy.gecmisZarar);
    const dnk = nkmNum(copy.donemNetKarGelir) || nkmNum(copy.donemNetKar);
    const priorYearGecmisKar = Math.round(gk - gz);
    const priorYearNetKar = Math.round(dnk);
    const openingRetainedEarnings = priorYearGecmisKar + priorYearNetKar;
    return { priorYearGecmisKar, priorYearNetKar, openingRetainedEarnings, maliYilDonemNetKar: priorYearNetKar };
  }

  /** Ödenmiş sermaye + yedekler; devreden kar/zarar ayrı satırda (5Y bilanço çift sayımı önlenir). */
  function openingCapitalFromMizan(copy, retained) {
    const oz = nkmNum(copy.ozKaynak);
    const re = Math.round(retained?.openingRetainedEarnings || 0);
    const explicit = Math.round(
      nkmNum(copy.odenmisSermaye) + nkmNum(copy.sermaYedek) + nkmNum(copy.karYedek),
    );
    if (explicit > 0 && (oz <= 0 || Math.abs(oz - explicit - re) < 1000)) return explicit;
    if (oz > 0 && re > 0) return Math.round(Math.max(0, oz - re));
    return Math.round(oz || explicit);
  }

  window.FinSkorMaliImport = {
    mapToOpening(d, year) {
      const y = year || new Date().getFullYear();
      const copy = { ...d };
      hesapToplamlarOnObject(copy, y);
      const kasaBanka = nkmNum(copy.hazirDegerler);
      const retained = mapRetainedFromMizan(copy);
      return {
        cash: 0,
        bank: kasaBanka,
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
      sourceYear: year,
    };
    if (inc.faalGider > 0 && typeof applyFaalGiderFromMali === 'function') {
      applyFaalGiderFromMali(f, inc.faalGider);
    }
    if (typeof populateIncome === 'function') populateIncome();
    return inc;
  };

  window.applyParsedToOpeningBalance = function (parsed, meta) {
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
    const synced = syncLoansFromMaliBorc(f, parsed);
    if (synced.kv > 0 || synced.uv > 0) {
      importLog(
        `🏦 Krediler: KV <b>${synced.kv.toLocaleString('tr-TR')}</b> TL (BCH) · UV <b>${synced.uv.toLocaleString('tr-TR')}</b> TL (24 ay taksit, ilk ödeme 01.02.2026, faiz %${maliUvInstallmentRate(f)})`,
        'ok',
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
    if (typeof saveState === 'function') saveState();
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
          };
          if (p.otherAssets) d.menkKiymetler = p.otherAssets;
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
