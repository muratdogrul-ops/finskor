/**
 * AI Uyarı Motoru — kural tabanlı inşaat ERP analitik sistemi
 *
 * Kullanılan endüstri standartları:
 *   SPI  = Schedule Performance Index (İlerleme performansı)
 *   CPI  = Cost Performance Index (Maliyet performansı)
 *   EAC  = Estimate at Completion (Tahmini toplam maliyet)
 *   VAC  = Variance at Completion (Tahmini maliyet sapması)
 */
import { Request, Response } from 'express';
import { query } from '../config/database';
import logger from '../utils/logger';

// ─── TİPLER ──────────────────────────────────────────────────────────────────
interface Uyari {
  id: string;
  tip: 'kritik' | 'uyari' | 'bilgi';
  kategori: 'maliyet' | 'gecikme' | 'tahsilat' | 'stok' | 'butce';
  santiye_id?: string;
  santiye_adi?: string;
  baslik: string;
  aciklama: string;
  deger?: number;
  hedef?: number;
  sapma_yuzdesi?: number;
  oneri: string;
  tarih: string;
}

interface ProjeRisk {
  santiye_id: string;
  santiye_adi: string;
  risk_skoru: number;        // 0–100
  risk_seviyesi: 'dusuk' | 'orta' | 'yuksek' | 'kritik';
  spi: number | null;        // Schedule Performance Index
  cpi: number | null;        // Cost Performance Index
  tamamlanma_tahmini: string | null;
  gecikme_gun: number;
  maliyet_sapma_yuzdesi: number;
  tahsilat_bekleyen: number;
  uyarilar: string[];
}

// ─── YARDIMCI FONKSİYONLAR ───────────────────────────────────────────────────
function riskSeviyesi(skor: number): ProjeRisk['risk_seviyesi'] {
  if (skor >= 75) return 'kritik';
  if (skor >= 50) return 'yuksek';
  if (skor >= 25) return 'orta';
  return 'dusuk';
}

function cpiSkor(cpi: number | null): number {
  if (cpi === null) return 0;
  if (cpi < 0.7) return 40;
  if (cpi < 0.85) return 25;
  if (cpi < 0.95) return 10;
  return 0;
}

function spiSkor(spi: number | null): number {
  if (spi === null) return 0;
  if (spi < 0.6) return 35;
  if (spi < 0.75) return 20;
  if (spi < 0.9) return 10;
  return 0;
}

// ─── PROJE BAZLI RİSK ANALİZİ ────────────────────────────────────────────────
export const getProjeRiskler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;

    // Aktif şantiyeler + mali veriler
    const santiyeRes = await query(
      `SELECT
         s.id, s.ad, s.durum, s.baslangic, s.bitis_planlanan,
         s.sozlesme_bedel, s.gerceklesen, s.fiziksel_ilerleme,
         -- Hakediş özet
         COALESCE(h.toplam_hakedis, 0)   AS toplam_hakedis,
         COALESCE(h.odenen_hakedis, 0)   AS odenen_hakedis,
         COALESCE(h.bekleyen_hakedis, 0) AS bekleyen_hakedis,
         -- Satın alma (gerçekleşen gider)
         COALESCE(sa.gercek_gider, 0)    AS gercek_gider,
         COALESCE(sa.tahmin_gider, 0)    AS tahmin_gider,
         -- Fatura vadesi geçmiş
         COALESCE(f.vadesi_gecmis, 0)    AS vadesi_gecmis_tutar
       FROM santiyeler s
       LEFT JOIN (
         SELECT santiye_id,
           SUM(toplam_tutar) AS toplam_hakedis,
           SUM(toplam_tutar) FILTER (WHERE durum='odendi') AS odenen_hakedis,
           SUM(toplam_tutar) FILTER (WHERE durum NOT IN ('odendi','iptal')) AS bekleyen_hakedis
         FROM hakedisler WHERE tenant_id = $1 GROUP BY santiye_id
       ) h ON h.santiye_id = s.id
       LEFT JOIN (
         SELECT santiye_id,
           SUM(gercek_toplam) FILTER (WHERE durum='teslim_edildi') AS gercek_gider,
           SUM(tahmini_fiyat * miktar) AS tahmin_gider
         FROM satinalma_talepleri WHERE tenant_id = $1 GROUP BY santiye_id
       ) sa ON sa.santiye_id = s.id
       LEFT JOIN (
         SELECT santiye_id,
          SUM(genel_toplam) FILTER (WHERE odeme_durumu='bekliyor' AND vade_tarihi < CURRENT_DATE AND gib_durum != 'iptal') AS vadesi_gecmis
         FROM faturalar WHERE tenant_id = $1 GROUP BY santiye_id
       ) f ON f.santiye_id = s.id
       WHERE s.tenant_id = $1 AND s.aktif = true AND s.durum != 'tamamlandi'
       ORDER BY s.olusturuldu`,
      [tenantId]
    );

    const riskler: ProjeRisk[] = santiyeRes.rows.map((s) => {
      const bugun = new Date();
      const baslangic = new Date(s.baslangic);
      const bitisPlan = new Date(s.bitis_planlanan);

      // Süre hesabı
      const toplamGun = Math.max((bitisPlan.getTime() - baslangic.getTime()) / 86400000, 1);
      const gecenGun  = Math.max((bugun.getTime() - baslangic.getTime()) / 86400000, 0);
      const tahminiIlerleme = Math.min((gecenGun / toplamGun) * 100, 100);

      const fiziksellerleme = parseFloat(s.fiziksel_ilerleme) || 0;
      const sozlesme = parseFloat(s.sozlesme_bedel) || 0;
      const gerceklesen = parseFloat(s.gerceklesen) || 0;
      const gercekGider = parseFloat(s.gercek_gider) || 0;

      // SPI = gerçek ilerleme / planlanan ilerleme
      const spi = tahminiIlerleme > 0 ? fiziksellerleme / tahminiIlerleme : null;

      // CPI = kazanılan değer / gerçek maliyet
      const kazanilanDeger = sozlesme * (fiziksellerleme / 100);
      const cpi = gercekGider > 0 ? kazanilanDeger / gercekGider : null;

      // EAC (Estimate at Completion)
      const eac = cpi && cpi > 0 ? sozlesme / cpi : sozlesme;
      const vac = sozlesme - eac;
      const maliyetSapmaYuzdesi = sozlesme > 0 ? ((eac - sozlesme) / sozlesme) * 100 : 0;

      // Gecikme tahmini
      const kalan = 100 - fiziksellerleme;
      const ilerlemeHizi = gecenGun > 0 ? fiziksellerleme / gecenGun : 0;
      let tamamlanmaTahmini: string | null = null;
      let gecikmeGun = 0;

      if (ilerlemeHizi > 0 && kalan > 0) {
        const kalanGun = kalan / ilerlemeHizi;
        const tahminiTarih = new Date(bugun.getTime() + kalanGun * 86400000);
        tamamlanmaTahmini = tahminiTarih.toISOString().slice(0, 10);
        gecikmeGun = Math.max(Math.round((tahminiTarih.getTime() - bitisPlan.getTime()) / 86400000), 0);
      } else if (bugun > bitisPlan && fiziksellerleme < 100) {
        gecikmeGun = Math.round((bugun.getTime() - bitisPlan.getTime()) / 86400000);
      }

      // Risk skoru hesabı (0–100)
      let riskSkor = 0;
      const uyarlar: string[] = [];

      riskSkor += cpiSkor(cpi);
      riskSkor += spiSkor(spi);

      if (gecikmeGun > 90) { riskSkor += 30; uyarlar.push(`${gecikmeGun} gün gecikme tahmini`); }
      else if (gecikmeGun > 30) { riskSkor += 15; uyarlar.push(`${gecikmeGun} gün gecikme tahmini`); }
      else if (gecikmeGun > 0) { riskSkor += 5; uyarlar.push(`${gecikmeGun} gün gecikme riski`); }

      if (cpi !== null && cpi < 0.85) uyarlar.push(`CPI: ${cpi.toFixed(2)} — maliyet aşımı`);
      if (spi !== null && spi < 0.80) uyarlar.push(`SPI: ${spi.toFixed(2)} — ilerleme yavaş`);
      if (parseFloat(s.vadesi_gecmis_tutar) > 0) {
        riskSkor += 10;
        uyarlar.push(`${Intl.NumberFormat('tr-TR').format(s.vadesi_gecmis_tutar)} ₺ vadesi geçmiş`);
      }
      if (maliyetSapmaYuzdesi > 20) { riskSkor += 15; }
      else if (maliyetSapmaYuzdesi > 10) { riskSkor += 8; }

      if (vac < 0) uyarlar.push(`${Math.abs(Math.round(vac/1000))}K ₺ tahmini maliyet aşımı`);

      return {
        santiye_id: s.id,
        santiye_adi: s.ad,
        risk_skoru: Math.min(riskSkor, 100),
        risk_seviyesi: riskSeviyesi(Math.min(riskSkor, 100)),
        spi,
        cpi,
        tamamlanma_tahmini: tamamlanmaTahmini,
        gecikme_gun: gecikmeGun,
        maliyet_sapma_yuzdesi: maliyetSapmaYuzdesi,
        tahsilat_bekleyen: parseFloat(s.bekleyen_hakedis) || 0,
        uyarilar: uyarlar,
      };
    });

    // Risk skoru yüksekten düşüğe sırala
    riskler.sort((a, b) => b.risk_skoru - a.risk_skoru);

    res.json({ success: true, data: riskler });
  } catch (error) {
    logger.error('getProjeRiskler hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ─── GENEL UYARI PANELİ ──────────────────────────────────────────────────────
export const getUyarilar = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const uyarilar: Uyari[] = [];

    // 1. Vadesi geçmiş faturalar
    const vadesiGeçmisRes = await query(
      `SELECT COUNT(*) AS sayi, COALESCE(SUM(genel_toplam),0) AS toplam,
              (SELECT STRING_AGG(fatura_no, ', ')
               FROM (SELECT fatura_no FROM faturalar
                     WHERE tenant_id = $1 AND odeme_durumu = 'bekliyor'
                       AND vade_tarihi < CURRENT_DATE AND gib_durum != 'iptal'
                     ORDER BY vade_tarihi LIMIT 3) sub) AS ornek_no
       FROM faturalar f
       WHERE f.tenant_id = $1 AND f.odeme_durumu = 'bekliyor'
         AND f.vade_tarihi < CURRENT_DATE AND f.gib_durum != 'iptal'`,
      [tenantId]
    );
    const vg = vadesiGeçmisRes.rows[0];
    if (parseInt(vg.sayi) > 0) {
      uyarilar.push({
        id: 'vade-gecmis',
        tip: parseInt(vg.sayi) > 3 ? 'kritik' : 'uyari',
        kategori: 'tahsilat',
        baslik: `${vg.sayi} faturanın vadesi geçmiş`,
        aciklama: `Toplam ${Number(vg.toplam).toLocaleString('tr-TR')} ₺ tahsilat bekliyor. (${vg.ornek_no})`,
        deger: Number(vg.toplam),
        oneri: 'Vadesi geçmiş faturalar için müşteri ile iletişime geçin, gerekirse hukuki süreç başlatın.',
        tarih: new Date().toISOString(),
      });
    }

    // 2. Kritik stok seviyeleri
    const stokRes = await query(
      `SELECT COUNT(*) AS sayi,
              (SELECT STRING_AGG(malzeme_adi, ', ')
               FROM (SELECT malzeme_adi FROM stoklar
                     WHERE tenant_id = $1 AND aktif = true
                       AND minimum_miktar > 0 AND mevcut_miktar <= minimum_miktar
                     ORDER BY (mevcut_miktar::float / NULLIF(minimum_miktar, 0)) LIMIT 3) sub) AS ornekler
       FROM stoklar
       WHERE tenant_id = $1 AND aktif = true
         AND minimum_miktar > 0 AND mevcut_miktar <= minimum_miktar`,
      [tenantId]
    );
    const stk = stokRes.rows[0];
    if (parseInt(stk.sayi) > 0) {
      uyarilar.push({
        id: 'kritik-stok',
        tip: parseInt(stk.sayi) > 5 ? 'kritik' : 'uyari',
        kategori: 'stok',
        baslik: `${stk.sayi} malzeme kritik stok seviyesinde`,
        aciklama: `Minimum stok altına düşen malzemeler: ${stk.ornekler || '—'}`,
        deger: parseInt(stk.sayi),
        oneri: 'Acil satın alma talebi oluşturun. Saha durdurma riskini değerlendirin.',
        tarih: new Date().toISOString(),
      });
    }

    // 3. Onay bekleyen satın alma talepleri (2 günden eski)
    const satinalmaRes = await query(
      `SELECT COUNT(*) AS sayi
       FROM satinalma_talepleri
       WHERE tenant_id = $1 AND durum = 'beklemede'
         AND olusturuldu < NOW() - INTERVAL '2 days'`,
      [tenantId]
    );
    const sa = satinalmaRes.rows[0];
    if (parseInt(sa.sayi) > 0) {
      uyarilar.push({
        id: 'bekleyen-satinalma',
        tip: 'uyari',
        kategori: 'butce',
        baslik: `${sa.sayi} satın alma talebi 2+ gündür onay bekliyor`,
        aciklama: 'Onay gecikmesi saha faaliyetlerini durdurabilir.',
        deger: parseInt(sa.sayi),
        oneri: 'Satın alma listesini gözden geçirin, acil olanları önceliklendirin.',
        tarih: new Date().toISOString(),
      });
    }

    // 4. Onay bekleyen hakedişler (5 günden eski)
    const hakedisRes = await query(
      `SELECT COUNT(*) AS sayi, COALESCE(SUM(toplam_tutar),0) AS tutar
       FROM hakedisler
       WHERE tenant_id = $1 AND durum = 'gonderildi'
         AND olusturuldu < NOW() - INTERVAL '5 days'`,
      [tenantId]
    );
    const hk = hakedisRes.rows[0];
    if (parseInt(hk.sayi) > 0) {
      uyarilar.push({
        id: 'bekleyen-hakedis',
        tip: 'uyari',
        kategori: 'tahsilat',
        baslik: `${hk.sayi} hakediş 5+ gündür onay bekliyor`,
        aciklama: `Toplam ${Number(hk.tutar).toLocaleString('tr-TR')} ₺ nakit akışını etkiliyor.`,
        deger: Number(hk.tutar),
        oneri: 'İşveren ile hakediş onay sürecini hızlandırın.',
        tarih: new Date().toISOString(),
      });
    }

    // 5. Maliyet aşımı olan şantiyeler (gerceklesen > sozlesme_bedel * 0.9)
    const maliyetRes = await query(
      `SELECT COUNT(*) AS sayi,
              (SELECT STRING_AGG(ad, ', ')
               FROM (SELECT ad FROM santiyeler
                     WHERE tenant_id = $1 AND aktif = true AND durum != 'tamamlandi'
                       AND sozlesme_bedel > 0 AND gerceklesen > sozlesme_bedel * 0.9
                     ORDER BY (gerceklesen - sozlesme_bedel) DESC LIMIT 2) sub) AS ornekler,
              COALESCE(SUM(gerceklesen - sozlesme_bedel),0) AS toplam_asim
       FROM santiyeler
       WHERE tenant_id = $1 AND aktif = true AND durum != 'tamamlandi'
         AND sozlesme_bedel > 0 AND gerceklesen > sozlesme_bedel * 0.9`,
      [tenantId]
    );
    const mal = maliyetRes.rows[0];
    if (parseInt(mal.sayi) > 0) {
      uyarilar.push({
        id: 'maliyet-asimi',
        tip: Number(mal.toplam_asim) > 0 ? 'kritik' : 'uyari',
        kategori: 'maliyet',
        baslik: `${mal.sayi} şantiyede maliyet eşiğine yaklaşıldı`,
        aciklama: `${mal.ornekler || ''} — Sözleşme bedelinin %90'ına ulaşıldı.`,
        deger: Number(mal.toplam_asim),
        oneri: 'Kalan iş kalemlerini gözden geçirin, varyasyon teklifi hazırlayın.',
        tarih: new Date().toISOString(),
      });
    }

    // 6. Süresi yaklaşan projeler (30 gün içinde bitiyor, ilerleme < %80)
    const surRes = await query(
      `SELECT COUNT(*) AS sayi,
              (SELECT STRING_AGG(ad, ', ')
               FROM (SELECT ad FROM santiyeler
                     WHERE tenant_id = $1 AND aktif = true AND durum != 'tamamlandi'
                       AND bitis_planlanan BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
                       AND fiziksel_ilerleme < 80
                     ORDER BY bitis_planlanan LIMIT 2) sub) AS ornekler
       FROM santiyeler
       WHERE tenant_id = $1 AND aktif = true AND durum != 'tamamlandi'
         AND bitis_planlanan BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
         AND fiziksel_ilerleme < 80`,
      [tenantId]
    );
    const sur = surRes.rows[0];
    if (parseInt(sur.sayi) > 0) {
      uyarilar.push({
        id: 'sure-dolmak-uzere',
        tip: 'kritik',
        kategori: 'gecikme',
        baslik: `${sur.sayi} şantiyenin süresi 30 gün içinde doluyor`,
        aciklama: `${sur.ornekler || ''} — Fiziksel ilerleme %80 altında.`,
        oneri: 'Kaynak takviyesi yapın veya süre uzatım talebini işverene iletin.',
        tarih: new Date().toISOString(),
      });
    }

    // 7. Uzun süredir günlük rapor girilmeyen şantiyeler
    const gunlukRes = await query(
      `SELECT COUNT(*) AS sayi,
              (SELECT STRING_AGG(ad, ', ')
               FROM (SELECT s2.ad FROM santiyeler s2
                     WHERE s2.tenant_id = $1 AND s2.aktif = true AND s2.durum = 'devam'
                       AND NOT EXISTS (
                         SELECT 1 FROM santiye_gunlukleri g
                         WHERE g.santiye_id = s2.id AND g.tarih >= CURRENT_DATE - INTERVAL '5 days'
                       )
                     ORDER BY s2.ad LIMIT 2) sub) AS ornekler
       FROM santiyeler s
       WHERE s.tenant_id = $1 AND s.aktif = true AND s.durum = 'devam'
         AND NOT EXISTS (
           SELECT 1 FROM santiye_gunlukleri g
           WHERE g.santiye_id = s.id AND g.tarih >= CURRENT_DATE - INTERVAL '5 days'
         )`,
      [tenantId]
    );
    const gnl = gunlukRes.rows[0];
    if (parseInt(gnl.sayi) > 0) {
      uyarilar.push({
        id: 'gunluk-eksik',
        tip: 'bilgi',
        kategori: 'gecikme',
        baslik: `${gnl.sayi} şantiyede 5+ gündür günlük rapor yok`,
        aciklama: `${gnl.ornekler || ''} — Saha takibi eksik kalıyor.`,
        oneri: 'Saha mühendislerine hatırlatma yapın. Düzenli günlük rapor tutulması önerilir.',
        tarih: new Date().toISOString(),
      });
    }

    // 8. Geciken projeler (bitis_planlanan geçmiş, tamamlanmamış)
    const gecikmisRes = await query(
      `SELECT COUNT(*) AS sayi,
              (SELECT STRING_AGG(ad, ', ')
               FROM (SELECT ad FROM santiyeler
                     WHERE tenant_id = $1 AND aktif = true AND durum != 'tamamlandi'
                       AND bitis_planlanan < CURRENT_DATE AND fiziksel_ilerleme < 100
                     ORDER BY bitis_planlanan LIMIT 3) sub) AS ornekler
       FROM santiyeler
       WHERE tenant_id = $1 AND aktif = true AND durum != 'tamamlandi'
         AND bitis_planlanan < CURRENT_DATE AND fiziksel_ilerleme < 100`,
      [tenantId]
    );
    const gec = gecikmisRes.rows[0];
    if (parseInt(gec.sayi) > 0) {
      uyarilar.push({
        id: 'geciken-proje',
        tip: parseInt(gec.sayi) > 2 ? 'kritik' : 'uyari',
        kategori: 'gecikme',
        baslik: `${gec.sayi} proje planlanan bitiş tarihini geçti`,
        aciklama: `${gec.ornekler || ''} — Sözleşmesel gecikme cezası riski.`,
        deger: parseInt(gec.sayi),
        oneri: 'Süre uzatım talebini işverene iletin; gerekçe raporunu hazırlayın.',
        tarih: new Date().toISOString(),
      });
    }

    // Uyarıları önem sırasına göre sırala
    const sirala = { kritik: 0, uyari: 1, bilgi: 2 };
    uyarilar.sort((a, b) => sirala[a.tip] - sirala[b.tip]);

    const ozet = {
      kritik: uyarilar.filter(u => u.tip === 'kritik').length,
      uyari: uyarilar.filter(u => u.tip === 'uyari').length,
      bilgi: uyarilar.filter(u => u.tip === 'bilgi').length,
      toplam: uyarilar.length,
    };

    res.json({ success: true, data: uyarilar, ozet });
  } catch (error) {
    logger.error('getUyarilar hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ─── DASHBOARD KPI (hızlı özet) ───────────────────────────────────────────────
export const getAiOzet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;

    const [riskRes, uyariRes] = await Promise.all([
      query(
        `SELECT
           COUNT(*) FILTER (WHERE durum NOT IN ('tamamlandi','iptal')) AS aktif_proje,
           AVG(fiziksel_ilerleme) FILTER (WHERE durum = 'devam') AS ort_ilerleme,
           COUNT(*) FILTER (WHERE bitis_planlanan < CURRENT_DATE AND fiziksel_ilerleme < 100 AND durum != 'tamamlandi') AS geciken_proje,
           COALESCE(SUM(gerceklesen) FILTER (WHERE durum != 'tamamlandi'), 0) AS toplam_gerceklesen,
           COALESCE(SUM(sozlesme_bedel) FILTER (WHERE durum != 'tamamlandi'), 0) AS toplam_sozlesme
         FROM santiyeler WHERE tenant_id = $1 AND aktif = true`,
        [tenantId]
      ),
      query(
        `SELECT
           COUNT(*) FILTER (WHERE odeme_durumu='bekliyor' AND vade_tarihi < CURRENT_DATE) AS vadesi_gecmis,
           COALESCE(SUM(genel_toplam) FILTER (WHERE odeme_durumu='bekliyor' AND vade_tarihi < CURRENT_DATE), 0) AS vadesi_gecmis_tutar,
           COALESCE(SUM(genel_toplam) FILTER (WHERE odeme_durumu='bekliyor'), 0) AS tahsil_bekleyen
         FROM faturalar WHERE tenant_id = $1 AND gib_durum != 'iptal'`,
        [tenantId]
      ),
    ]);

    const r = riskRes.rows[0];
    const u = uyariRes.rows[0];

    const ortIlerleme = parseFloat(r.ort_ilerleme) || 0;
    const toplamSozlesme = parseFloat(r.toplam_sozlesme) || 0;
    const toplamGercek = parseFloat(r.toplam_gerceklesen) || 0;
    const maliyetTahmin = toplamSozlesme > 0 ? ((toplamGercek / toplamSozlesme) * 100) : 0;

    res.json({
      success: true,
      data: {
        aktif_proje: parseInt(r.aktif_proje) || 0,
        geciken_proje: parseInt(r.geciken_proje) || 0,
        ort_ilerleme: Math.round(ortIlerleme),
        maliyet_gerceklesme: Math.round(maliyetTahmin),
        vadesi_gecmis_fatura: parseInt(u.vadesi_gecmis) || 0,
        vadesi_gecmis_tutar: parseFloat(u.vadesi_gecmis_tutar) || 0,
        tahsil_bekleyen: parseFloat(u.tahsil_bekleyen) || 0,
      },
    });
  } catch (error) {
    logger.error('getAiOzet hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};
