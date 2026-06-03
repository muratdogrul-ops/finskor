/**
 * FinSkor iyileştirme önerileri — NakitFlow (app.html downloadReport kuralları, FinSkor dosyasına dokunulmaz)
 */
(function (root) {
  function n(v) {
    return Number(v) || 0;
  }

  function fmtTl(v) {
    return Math.round(n(v)).toLocaleString('tr-TR');
  }

  function maliKapanisYiliLabel(f) {
    const o = (f && f.opening) || {};
    const y = n(o.maliKapanisYili) || n(o.maliKapanisYil);
    if (y) return Math.round(y);
    if (f && f.startDate) {
      const sd = new Date(f.startDate);
      if (!isNaN(+sd)) return sd.getFullYear() - 1;
    }
    return null;
  }

  /** Mizan kapanış yılı dönem net karı (projeksiyon öncesi son yıl). */
  function openingDonemNetKar(f) {
    const o = (f && f.opening) || {};
    const is_ = (f && f.incomeStmt) || {};
    if (o.priorYearNetKar != null && o.priorYearNetKar !== '') return n(o.priorYearNetKar);
    if (o.maliYilDonemNetKar != null && o.maliYilDonemNetKar !== '') return n(o.maliYilDonemNetKar);
    return n(is_.donemNetKar);
  }

  function enrichRatios(r, f) {
    const out = Object.assign({}, r);
    const o = (f && f.opening) || {};
    const is_ = (f && f.incomeStmt) || {};
    const ar = n(o.ar);
    const stok = n(o.inventory);
    const ciro = n(out.netSatis) || n(is_.revenue);
    const cogs = n(out.satMaliyet) || n(is_.cogs);
    out.ticAlacaklar = ar;
    out.stoklar = stok;
    out.alacakTahsil = ciro > 0 ? (ar / ciro) * 360 : 0;
    out.alacakTahsilSuresi = out.alacakTahsil;
    out.stokGun = cogs > 0 ? (stok / cogs) * 360 : 0;
    out.stokGunSayisi = out.stokGun;
    out.donemNetKarOncekiYil = openingDonemNetKar(f);
    out.maliKapanisYili = maliKapanisYiliLabel(f);
    const netGecmis = n(o.priorYearGecmisKar);
    out.gecmisZarar = netGecmis < 0 ? Math.abs(netGecmis) : 0;
    if (!out.finansGid && is_.finansmanGider) out.finansGid = n(is_.finansmanGider);
    return out;
  }

  /** FinSkor downloadReport — mali tablo önerileri */
  function buildMaliTips(r, firmType) {
    const tips = [];
    const paz = firmType === 'pazarlama';
    const borcOzEsik = paz ? 1.99 : 1.49;

    if (n(r.borcOzKay) > borcOzEsik) {
      const gerekli = Math.max(0, n(r.totalBor) - n(r.ozKaynak) * borcOzEsik);
      tips.push({
        pri: 1,
        icon: '💰',
        html:
          '<b>Sermaye artışı veya borç azaltımı</b> — Borç/ÖzKaynak <b>' +
          r.borcOzKay.toFixed(2) +
          'x</b> (hedef ≤' +
          borcOzEsik +
          '). ' +
          (gerekli > 0 ? 'Yaklaşık <b>' + fmtTl(gerekli) + ' TL</b> borç azaltımı veya özkaynak artışı ' : '') +
          'kredi notu ve likidite için en etkili adımlardan biridir.',
      });
    }
    if (n(r.kvBankaB_Sat) > 20) {
      tips.push({
        pri: 2,
        icon: '🏦',
        html:
          '<b>KV banka borçlarını azaltın</b> — KV banka borç/satış <b>%' +
          r.kvBankaB_Sat.toFixed(1) +
          '</b> (hedef ≤%20). Kısa vadeli banka borcunu UV’ye taşıma veya geri ödeme değerlendirin.',
      });
    }
    if (n(r.cariOran) < 1.25) {
      tips.push({
        pri: 3,
        icon: '🔵',
        html:
          '<b>Cari oranı güçlendirin</b> — Cari oran <b>' +
          r.cariOran.toFixed(2) +
          '</b> (iyi seviye &gt;1,39). Nakit ve alacak tahsilatını artırın veya kısa vadeli borçları azaltın.',
      });
    }
    if (n(r.likOran) < (paz ? 0.69 : 0.59)) {
      tips.push({
        pri: 3,
        icon: '💧',
        html:
          '<b>Likit varlıkları artırın</b> — Likidite oranı <b>' +
          r.likOran.toFixed(2) +
          '</b> (hedef &gt;' +
          (paz ? '0,84' : '0,74') +
          '). Nakit, tahsilat ve stok yönetimini gözden geçirin.',
      });
    }
    if (n(r.netKarMarj) < (paz ? 9 : 14)) {
      tips.push({
        pri: 4,
        icon: '📈',
        html:
          '<b>Karlılığı artırın</b> — VÖ kar/satış <b>%' +
          r.netKarMarj.toFixed(1) +
          '</b> (hedef &gt;%' +
          (paz ? '9' : '14') +
          '). Fiyatlandırma ve maliyet kontrolü nakit üretimini doğrudan iyileştirir.',
      });
    }
    if (n(r.reelFaalKarBuy) < 5) {
      tips.push({
        pri: 5,
        icon: '📊',
        html:
          '<b>Faaliyet karlılığını artırın</b> — Reel faaliyet kâr büyümesi <b>%' +
          r.reelFaalKarBuy.toFixed(1) +
          '</b> (hedef &gt;%5). Gider ve brüt marj iyileşmesi hem kredi notuna hem likiditeye yansır.',
      });
    }
    if (n(r.alacakTahsil) > 90) {
      tips.push({
        pri: 4,
        icon: '📋',
        html:
          '<b>Alacak tahsilatını hızlandırın</b> — Ortalama tahsil süresi <b>' +
          Math.round(r.alacakTahsil) +
          ' gün</b> (hedef ≤60). Erken ödeme iskontosu veya faktoring dönen varlıkları rahatlatır.',
      });
    }
    if (n(r.stokGun) > 120) {
      tips.push({
        pri: 5,
        icon: '📦',
        html:
          '<b>Stok yönetimini iyileştirin</b> — Stok gün sayısı <b>' +
          Math.round(r.stokGun) +
          ' gün</b> (hedef ≤90). Talep tahmini ve zamanında stok (JIT) yönetimi nakit ihtiyacını düşürür.',
      });
    }
    if (n(r.ihracatSatis) < (paz ? 10 : 5)) {
      tips.push({
        pri: 6,
        icon: '🌍',
        html:
          '<b>İhracat payını artırın</b> — İhracat/satış <b>%' +
          r.ihracatSatis.toFixed(1) +
          '</b>. Yurtdışı pazar geliştirme finansman ve kredi notu kriterlerine katkı sağlar.',
      });
    }
    if (n(r.reelSatisBuy) < 5) {
      tips.push({
        pri: 6,
        icon: '🚀',
        html:
          '<b>Reel satış büyümesi</b> — ÜFE düzeltmeli reel büyüme <b>%' +
          r.reelSatisBuy.toFixed(1) +
          '</b> (hedef &gt;%4). Ciro ve nakit girişi projeksiyonunu güçlendirir.',
      });
    }

    if (n(r.ihracatSatis) >= 15) {
      const toplamKredi = n(r.kvMaliBor) + n(r.uvMaliBor);
      const hesapliFinGider = toplamKredi * 0.065;
      const tasarruf = n(r.finansGid) > 0 ? n(r.finansGid) - hesapliFinGider : 0;
      const tasarrufYuzde = n(r.finansGid) > 0 && tasarruf > 0 ? ((tasarruf / n(r.finansGid)) * 100).toFixed(0) : null;
      let dovizEk =
        ' Toplam banka kredisi <b>' + fmtTl(toplamKredi) + ' TL</b>. EUR/USD kredi değerlendirin.';
      if (toplamKredi > 0 && n(r.finansGid) > 0) {
        dovizEk =
          ' Toplam banka kredisi <b>' +
          fmtTl(toplamKredi) +
          ' TL</b>; tamamı döviz faizli olsaydı yıllık finansman ~<b>' +
          fmtTl(hesapliFinGider) +
          ' TL</b>';
        if (tasarruf > 0 && tasarrufYuzde)
          dovizEk += ' — yaklaşık <b>' + fmtTl(tasarruf) + ' TL (%' + tasarrufYuzde + ')</b> tasarruf potansiyeli.';
        else dovizEk += ' — banka teklifine göre faiz avantajı değerlendirin.';
      }
      tips.push({
        pri: 2,
        icon: '💱',
        html:
          '<b>Döviz kredisi</b> — İhracat/satış <b>%' +
          r.ihracatSatis.toFixed(1) +
          '</b>. İhracat geliri kur riskini dengeler.' +
          dovizEk,
      });
      tips.push({
        pri: 4,
        icon: '🔄',
        html:
          '<b>Vadeli döviz satışı (forward)</b> — TL kredi vadelerine karşılık EUR/USD forward ile kur ve finansman maliyetini yönetin.',
      });
      tips.push({
        pri: 3,
        icon: '🏛️',
        html:
          '<b>Eximbank ihracat kredisi</b> — İhracat payı <b>%' +
          r.ihracatSatis.toFixed(1) +
          '</b> ile Eximbank reeskont/limit başvurusu (banka kanalıyla).',
      });
      tips.push({
        pri: 3,
        icon: '📤',
        html:
          '<b>İhracat faktoring / forfaiting</b> — Kısa/orta vadeli ihracat alacaklarını devrederek <b>anında nakit</b> ve bilançoda ek borçlanma olmadan likidite güçlendirin.',
      });
    }

    const toplamMali = n(r.kvMaliBor) + n(r.uvMaliBor);
    if (toplamMali > 0) {
      const kvOran = (n(r.kvMaliBor) / toplamMali) * 100;
      if (kvOran >= 45) {
        tips.push({
          pri: 2,
          icon: '🏭',
          html:
            '<b>Sat–geri kirala</b> — KV mali borç payı <b>%' +
            kvOran.toFixed(1) +
            '</b>. MDV satışı ile nakit → KV geri ödeme; borç vadesi uzar, cari oran iyileşir.',
        });
      }
    }

    if (n(r.stokGun) > 90 && firmType === 'uretim') {
      const stokTL = n(r.stoklar);
      tips.push({
        pri: 5,
        icon: '🏗️',
        html:
          '<b>Emtia rehinli kredi</b> — Stok <b>' +
          Math.round(r.stokGun) +
          ' gün</b>' +
          (stokTL > 0 ? ', stok ~<b>' + fmtTl(stokTL) + ' TL</b>' : '') +
          '. Lisanslı depo teminatı ile işletme sermayesi, stoktaki nakidi serbest bırakır.',
      });
    }

    if (n(r.gecmisZarar) > 0) {
      const zarar = n(r.gecmisZarar);
      const ozk = n(r.ozKaynak);
      tips.push({
        pri: 3,
        icon: '💼',
        html:
          '<b>Geçmiş yıl zararını kapatın</b> — Birikmiş zarar <b>' +
          fmtTl(zarar) +
          ' TL</b>' +
          (ozk > 0 ? ' (özkaynağın ~%' + ((zarar / ozk) * 100).toFixed(1) + '’i)' : '') +
          '. Sermaye artışı Borç/ÖzKaynak ve kredi notu için olumludur.',
      });
    }

    if (n(r.netKarMarj) < 5 && n(r.netSatis) > 0) {
      tips.push({
        pri: 4,
        icon: '📊',
        html:
          '<b>Net kar marjı</b> — Marj <b>%' +
          r.netKarMarj.toFixed(2) +
          '</b>. Fiyat, maliyet, ürün karması ve daha düşük faizli refinansman adımlarını planlayın.' +
          (n(r.ihracatSatis) > 0 ? ' İhracatçı iseniz döviz/Eximbank finansmanı marjı yükseltir.' : ''),
      });
    }

    if (n(r.bnkBorcAkt) > (paz ? 39 : 44)) {
      tips.push({
        pri: 5,
        icon: '🏦',
        html:
          '<b>Banka borcu / aktif</b> — Oran <b>%' +
          r.bnkBorcAkt.toFixed(1) +
          '</b> yüksek. Mali borçları azaltmak bilanço ve likidite görünümünü iyileştirir.',
      });
    }

    if (!tips.length) {
      tips.push({
        pri: 9,
        icon: '✅',
        html: 'Mali oranlar genel olarak iyi seviyede. Mevcut politikaları sürdürün; projeksiyon likiditesini aşağıdaki tabloda izleyin.',
      });
    }

    tips.sort((a, b) => a.pri - b.pri);
    return tips;
  }

  /** NakitFlow projeksiyon — likidite özeti */
  function buildLiquidityTips(liq, f) {
    const tips = [];
    if (!liq || !liq.months) return tips;

    if (liq.eksideMonths > 0) {
      tips.push({
        pri: 1,
        icon: '⚠️',
        html:
          '<b>BCH kullanımı</b> — <b>' +
          liq.eksideMonths +
          '/' +
          liq.months +
          ' ay</b> işletme nakdi BCH ile kapatılmış; toplam kullanım <b>' +
          fmtTl(liq.totalBchDraw) +
          ' TL</b>. Faaliyet nakdini (ciro, tahsil, gider) ve borç servisini gözden geçirin.',
      });
    }
    if (liq.firstEksideLabel) {
      tips.push({
        pri: 2,
        icon: '📅',
        html:
          '<b>İlk nakit açığı</b> — <b>' +
          liq.firstEksideLabel +
          '</b> civarı. Bu dönemde tedarikçi ödemeleri, tahsilat ve finansman takvimini sıkılaştırın.',
      });
    }
    let faalNeg = 0;
    for (const x of liq.series || []) {
      if (n(x.faaliyetNet) < -1e5) faalNeg++;
    }
    if (faalNeg >= 3) {
      tips.push({
        pri: 2,
        icon: '📉',
        html:
          '<b>Faaliyet nakdi</b> — <b>' +
          faalNeg +
          ' ay</b> faaliyet neti belirgin eksi. <b>Ciro / Giderler / Varsayımlar</b> sekmesinde büyüme ve gider varsayımlarını güncelleyin.',
      });
    }
    if (liq.totalBchRepay > 0 && liq.artidaBchMonths > 0) {
      tips.push({
        pri: 4,
        icon: '✅',
        html:
          'Fazla nakit dönemlerinde <b>BCH geri ödeme</b> yapılmış (<b>' +
          fmtTl(liq.totalBchRepay) +
          ' TL</b>) — faiz yükünü azaltmak için bu pratiği sürdürün.',
      });
    }
    if (liq.artidaMevduatMonths < Math.floor(liq.months / 4) && liq.eksideMonths > 0) {
      tips.push({
        pri: 5,
        icon: '🏦',
        html:
          'Nakit fazlasını mümkün olduğunca <b>mevduata</b> aktarın — stopaj sonrası faiz geliri likidite tamponu oluşturur (motor ay başı yansıtır).',
      });
    }

    const ass = (f && f.assumptions) || {};
    if (n(ass.growth) > 40 && liq.eksideMonths > 2) {
      tips.push({
        pri: 3,
        icon: '📊',
        html:
          'Yüksek ciro büyüme varsayımı (%' +
          n(ass.growth) +
          ') stok ve alacak ihtiyacını artırır; <b>DSO/DPO</b> (açılış / varsayımlar) ile uyumlu olup olmadığını kontrol edin.',
      });
    }

    if (typeof firmHasYurtdisiSatis === 'function' && firmHasYurtdisiSatis(f) && liq.eksideMonths > 0) {
      tips.push({
        pri: 4,
        icon: '🌍',
        html:
          'İhracatçı firmada BCH ihtiyacında <b>USD payı en az ihracat/ciro oranı</b> (kalan TL veya USD) uygulanır — Kur ve Krediler ayarlarınızı buna göre tutun.',
      });
    }

    const last = (liq.series || [])[liq.series.length - 1];
    if (last && n(last.taksitBal) + n(last.spotBal) > n(last.bchEndBal) * 0.5) {
      tips.push({
        pri: 4,
        icon: '📆',
        html:
          'Ay sonu <b>taksit/spot</b> bakiyesi yüksek — UV borç servisi nakit çıkışı yaratır; refinansman veya vadeleri projeksiyonla uyumlu planlayın.',
      });
    }

    return tips;
  }

  /** Tam sayfa özet — 5 aksiyon maddesi (başlık + kısa açıklama) */
  function buildTop5Actions(top5) {
    return (top5 || []).map(function (t, i) {
      const plain = tipHtmlToPlain(t.html);
      const sep = plain.indexOf(' — ') >= 0 ? ' — ' : plain.indexOf(' - ') >= 0 ? ' - ' : ' — ';
      const ix = plain.indexOf(sep);
      const title = (ix >= 0 ? plain.slice(0, ix) : plain.slice(0, 72)).trim();
      const detail = (ix >= 0 ? plain.slice(ix + sep.length) : plain).trim();
      return { rank: i + 1, icon: t.icon, title: title || 'Adım ' + (i + 1), detail: detail || plain };
    });
  }

  /**
   * Finansal durum özeti (açılış mali + likidite projeksiyonu)
   */
  function buildFinancialSituationSummary(r, liq, ratingScore, f) {
    const kpis = [];
    let severity = 'medium';
    const paragraphs = [];

    function bump(level) {
      const order = { low: 0, medium: 1, high: 2, critical: 3 };
      if (order[level] > order[severity]) severity = level;
    }

    if (ratingScore && ratingScore.rating) {
      const puan = n(ratingScore.toplam);
      kpis.push({
        lbl: 'FinSkor notu',
        val: ratingScore.rating.note || '—',
        cls: 'rating',
        color: ratingScore.rating.color,
      });
      kpis.push({ lbl: 'Kredi notu puanı', val: String(puan), cls: puan < 45 ? 'bad' : puan < 68 ? 'warn' : 'ok' });
      if (puan < 45) bump('critical');
      else if (puan < 68) bump('high');
    }

    if (r && (n(r.netSatis) > 0 || n(r.aktif) > 0)) {
      const borcOz = n(r.borcOzKay);
      kpis.push({ lbl: 'Borç / Öz kaynak', val: borcOz.toFixed(2) + '×', cls: borcOz > 1.49 ? 'bad' : borcOz > 1.2 ? 'warn' : 'ok' });
      if (borcOz > 1.49) bump('critical');
      else if (borcOz > 1.2) bump('high');

      const kvBs = n(r.kvBankaB_Sat);
      kpis.push({ lbl: 'KV banka / satış', val: '%' + kvBs.toFixed(1), cls: kvBs > 20 ? 'bad' : 'ok' });
      kpis.push({ lbl: 'Cari oran', val: n(r.cariOran).toFixed(2), cls: n(r.cariOran) < 1.25 ? 'bad' : 'ok' });
      kpis.push({ lbl: 'Likidite oranı', val: n(r.likOran).toFixed(2), cls: n(r.likOran) < 0.59 ? 'bad' : 'ok' });
      kpis.push({ lbl: 'Net kar marjı', val: '%' + n(r.netKarMarj).toFixed(1), cls: n(r.netKarMarj) < 9 ? 'bad' : 'ok' });
      if (n(r.ihracatSatis) >= 5)
        kpis.push({ lbl: 'İhracat / satış', val: '%' + n(r.ihracatSatis).toFixed(1), cls: 'info' });
      if (n(r.alacakTahsil) > 60)
        kpis.push({
          lbl: 'Alacak tahsil',
          val: Math.round(n(r.alacakTahsil)) + ' gün',
          cls: n(r.alacakTahsil) > 90 ? 'bad' : 'warn',
        });
      if (n(r.stokGun) > 60)
        kpis.push({ lbl: 'Stok günü', val: Math.round(n(r.stokGun)) + ' gün', cls: n(r.stokGun) > 120 ? 'bad' : 'warn' });
      const dnk = n(r.donemNetKarOncekiYil);
      if (Math.abs(dnk) > 1e-6) {
        const yil = r.maliKapanisYili || maliKapanisYiliLabel(f);
        const yilLbl = yil ? yil + ' ' : '';
        const zararMi = dnk < 0;
        kpis.push({
          lbl: yilLbl + 'dönem net ' + (zararMi ? 'zarar' : 'kar'),
          val: fmtTl(Math.abs(dnk)) + ' TL',
          cls: zararMi ? 'bad' : 'ok',
        });
      }
      if (n(r.gecmisZarar) > 1e-6)
        kpis.push({ lbl: 'Geçmiş yıl zararları (58)', val: fmtTl(r.gecmisZarar) + ' TL', cls: 'warn' });
    }

    if (liq && liq.months) {
      kpis.push({ lbl: 'Projeksiyon', val: liq.months + ' ay', cls: 'info' });
      kpis.push({
        lbl: 'BCH kullanılan ay',
        val: liq.eksideMonths + ' / ' + liq.months,
        cls: liq.eksideMonths > liq.months * 0.35 ? 'bad' : liq.eksideMonths > 0 ? 'warn' : 'ok',
      });
      if (n(liq.totalBchDraw) > 0)
        kpis.push({ lbl: 'Toplam BCH kullanım', val: fmtTl(liq.totalBchDraw) + ' TL', cls: 'bad' });
      if (n(liq.totalBchRepay) > 0)
        kpis.push({ lbl: 'BCH geri ödeme', val: fmtTl(liq.totalBchRepay) + ' TL', cls: 'ok' });
      if (liq.firstEksideLabel) kpis.push({ lbl: 'İlk nakit açığı', val: liq.firstEksideLabel, cls: 'warn' });
      if (liq.eksideMonths > 0) bump(liq.eksideMonths > liq.months * 0.4 ? 'critical' : 'high');
    }

    let headline = 'Finansal durum özeti';
    if (severity === 'critical') headline = 'Finansal baskı yüksek — öncelikli 5 aksiyon';
    else if (severity === 'high') headline = 'Likidite ve borç yapısı dikkat gerektiriyor';
    else if (severity === 'low') headline = 'Genel görünüm dengeli';

    if (r && n(r.borcOzKay) > 1.49) {
      const gerekli = Math.max(0, n(r.totalBor) - n(r.ozKaynak) * 1.49);
      paragraphs.push(
        'Borçlar özkaynağın <b>' +
          r.borcOzKay.toFixed(1) +
          ' katı</b>. Bankacılık ve FinSkor açısından kaldıraç yüksek' +
          (gerekli > 0 ? '; yaklaşık <b>' + fmtTl(gerekli) + ' TL</b> borç azaltımı veya özkaynak artışı hedeflenir' : '') +
          '.'
      );
    }
    if (liq && liq.eksideMonths > 0) {
      paragraphs.push(
        '<b>' +
          liq.eksideMonths +
          ' ay</b> boyunca işletme nakdi BCH ile kapatılıyor (toplam kullanım <b>' +
          fmtTl(liq.totalBchDraw) +
          ' TL</b>). Ciro, tahsilat ve gider varsayımları ile uyumlu bir nakit planı şart.'
      );
      if (liq.firstEksideLabel)
        paragraphs.push('İlk nakit açığı <b>' + liq.firstEksideLabel + '</b> civarında başlıyor; bu döneme özel finansman ve tahsilat takvimi planlayın.');
    }
    if (r && n(r.kvBankaB_Sat) > 20) {
      paragraphs.push(
        'Kısa vadeli banka borcu satışların <b>%' + n(r.kvBankaB_Sat).toFixed(0) + '</b>\'i kadar; KV yükü fazla. UV\'ye taşıma, geri ödeme veya refinansman değerlendirin.'
      );
    }
    if (r && n(r.ihracatSatis) >= 15) {
      paragraphs.push(
        'Firma <b>ihracatçı profil</b> (satışın ~%' +
          n(r.ihracatSatis).toFixed(0) +
          '\'): döviz kredisi, Eximbank ve ihracat faktoringi uygun olabilir. Nakit motorunda BCH ihtiyacının en az yarısı USD kuralına dikkat edin.'
      );
    }
    if (ratingScore && ratingScore.rating) {
      const riskTxt = formatRatingRisk(ratingScore.risk);
      paragraphs.push(
        'Açılış mali tablo FinSkor notu <b>' +
          ratingScore.rating.note +
          '</b> (puan ' +
          ratingScore.toplam +
          ')' +
          (riskTxt ? ' — ' + riskTxt : '') +
          '.'
      );
    }
    if (!paragraphs.length) {
      paragraphs.push('Temel göstergeler makul seviyede; yine de aşağıdaki 5 aksiyonu yıllık planınıza yazın.');
    }

    const numberedParagraphs = paragraphs.map(function (html, i) {
      return { num: i + 1, html: html };
    });

    return {
      headline,
      severity,
      kpis,
      paragraphs: numberedParagraphs,
      firmName: (f && f.name) || '',
    };
  }

  /** En kritik 5 öneri (mali + likidite karışık) */
  function buildTop5Tips(mali, liq) {
    const top = [];
    const usable = (arr) => (arr || []).filter((t) => t.pri < 9);
    const m = usable(mali);
    const l = usable(liq);
    if (m[0]) top.push(m[0]);
    if (l[0] && top.indexOf(l[0]) < 0) top.push(l[0]);
    const rest = [...m, ...l]
      .filter((t) => top.indexOf(t) < 0)
      .sort((a, b) => a.pri - b.pri);
    for (const t of rest) {
      top.push(t);
      if (top.length >= 5) break;
    }
    return top.slice(0, 5).map((t, i) => Object.assign({}, t, { rank: i + 1 }));
  }

  function formatRatingRisk(risk) {
    if (!risk) return '';
    if (typeof risk === 'string') return risk;
    if (typeof risk === 'object' && risk.text) return String(risk.text);
    return '';
  }

  function tipHtmlToPlain(html) {
    return String(html || '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Tüm öneri paketi
   * @param {object} opts { f, r, firmType, liquidity, ratingScore }
   */
  function buildImprovementPack(opts) {
    const o = opts || {};
    const f = o.f;
    let r = o.r;
    const firmType = o.firmType || (f && f.finskorFirmType) || 'uretim';
    if (r && f) r = enrichRatios(r, f);

    const mali = r ? buildMaliTips(r, firmType) : [];
    const liq = buildLiquidityTips(o.liquidity, f);
    const top5 = buildTop5Tips(mali, liq);
    const quick = top5.slice();
    const actions = buildTop5Actions(top5);
    const situation = buildFinancialSituationSummary(r, o.liquidity, o.ratingScore, f);

    return {
      firmType,
      mali,
      liq,
      top5,
      actions,
      situation,
      quick,
      rating: o.ratingScore || null,
      r,
      hasMali: !!r && (n(r.netSatis) > 0 || n(r.aktif) > 0),
    };
  }

  root.FinSkorImprovementTips = {
    maliKapanisYiliLabel,
    openingDonemNetKar,
    enrichRatios,
    buildMaliTips,
    buildLiquidityTips,
    buildTop5Tips,
    buildTop5Actions,
    buildFinancialSituationSummary,
    buildImprovementPack,
    formatRatingRisk,
    tipHtmlToPlain,
    fmtTl,
  };
})(typeof window !== 'undefined' ? window : globalThis);
