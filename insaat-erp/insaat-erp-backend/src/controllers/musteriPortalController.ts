import { Request, Response } from 'express';
import { query } from '../config/database';
import logger from '../utils/logger';

// ─── RAPOR LİNKİ OLUŞTUR ─────────────────────────────────────────────────────
export const createRaporLinki = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId } = req.user!;
    const { id: santiyeId } = req.params;
    const { baslik, gun = 30 } = req.body;

    const santiye = await query(
      'SELECT id, ad FROM santiyeler WHERE id = $1 AND tenant_id = $2 AND aktif = true',
      [santiyeId, tenantId]
    );
    if (!santiye.rows[0]) {
      res.status(404).json({ success: false, message: 'Şantiye bulunamadı' });
      return;
    }

    const gecerlilik = new Date();
    gecerlilik.setDate(gecerlilik.getDate() + parseInt(String(gun)));

    const result = await query(
      `INSERT INTO musteri_rapor_linkleri
         (tenant_id, santiye_id, baslik, gecerlilik_tarihi, olusturan_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, token, gecerlilik_tarihi, baslik`,
      [tenantId, santiyeId,
       baslik || `${santiye.rows[0].ad} — Müşteri Raporu`,
       gecerlilik.toISOString().slice(0, 10), userId]
    );

    const link = result.rows[0];
    logger.info(`Rapor linki oluşturuldu: ${link.token} (santiye: ${santiyeId})`);

    res.status(201).json({
      success: true,
      data: { ...link, url: `/p/${link.token}` },
    });
  } catch (error) {
    logger.error('createRaporLinki hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ─── RAPOR LİNKLERİNİ LİSTELE ────────────────────────────────────────────────
export const getRaporLinkleri = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { id: santiyeId } = req.params;

    const result = await query(
      `SELECT l.*, k.ad || ' ' || k.soyad AS olusturan_adi
       FROM musteri_rapor_linkleri l
       LEFT JOIN kullanicilar k ON k.id = l.olusturan_id
       WHERE l.santiye_id = $1 AND l.tenant_id = $2
       ORDER BY l.olusturuldu DESC`,
      [santiyeId, tenantId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('getRaporLinkleri hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ─── RAPOR LİNKİ DEAKTIF ET ──────────────────────────────────────────────────
export const deactivateRaporLinki = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { linkId } = req.params;

    await query(
      'UPDATE musteri_rapor_linkleri SET aktif = false WHERE id = $1 AND tenant_id = $2',
      [linkId, tenantId]
    );
    res.json({ success: true, message: 'Link deaktif edildi' });
  } catch (error) {
    logger.error('deactivateRaporLinki hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ─── PUBLIC: TOKEN İLE RAPOR GETİR (auth gerektirmez) ────────────────────────
export const getPublicRapor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    // Token geçerli mi?
    const linkRes = await query(
      `SELECT l.*, s.id AS santiye_id, s.tenant_id
       FROM musteri_rapor_linkleri l
       JOIN santiyeler s ON s.id = l.santiye_id
       WHERE l.token = $1 AND l.aktif = true
         AND l.gecerlilik_tarihi >= CURRENT_DATE`,
      [token]
    );
    if (!linkRes.rows[0]) {
      res.status(404).json({ success: false, message: 'Link bulunamadı veya süresi dolmuş' });
      return;
    }
    const link = linkRes.rows[0];

    // Erişim istatistiği güncelle
    query(
      `UPDATE musteri_rapor_linkleri
         SET erisim_sayisi = erisim_sayisi + 1, son_erisim = NOW()
       WHERE id = $1`,
      [link.id]
    ).catch(() => {});

    // Şantiye bilgileri
    const santiyeRes = await query(
      `SELECT s.*,
              t.ad AS firma_adi, t.logo_url AS firma_logo,
              k.ad || ' ' || k.soyad AS mudur_adi,
              k.telefon AS mudur_telefon, k.email AS mudur_email
       FROM santiyeler s
       JOIN tenants t ON t.id = s.tenant_id
       LEFT JOIN kullanicilar k ON k.id = s.mudur_id
       WHERE s.id = $1`,
      [link.santiye_id]
    );

    // Hakediş özeti
    const hakedisRes = await query(
      `SELECT
         COUNT(*) AS toplam,
         COALESCE(SUM(toplam_tutar), 0) AS toplam_tutar,
         COALESCE(SUM(toplam_tutar) FILTER (WHERE durum = 'odendi'), 0) AS odenen,
         COALESCE(SUM(toplam_tutar) FILTER (WHERE durum NOT IN ('odendi','iptal')), 0) AS bekleyen,
         json_agg(json_build_object(
           'no', no, 'tip', tip, 'tutar', toplam_tutar, 'durum', durum,
           'tarih', olusturuldu::date
         ) ORDER BY olusturuldu) AS liste
       FROM hakedisler
       WHERE santiye_id = $1 AND tenant_id = $2`,
      [link.santiye_id, link.tenant_id]
    );

    // Son 10 günlük rapor
    const gunlukRes = await query(
      `SELECT g.tarih, g.baslik, g.icerik, g.hava_durumu, g.sicaklik,
              g.sahada_personel, g.sahada_ekipman, g.fiziksel_ilerleme,
              g.gecikme_var_mi, g.gecikme_nedeni, g.risk_notu,
              k.ad || ' ' || k.soyad AS ekleyen_adi,
              (SELECT COUNT(*) FROM fotograflar f WHERE f.gunluk_id = g.id) AS foto_sayisi
       FROM santiye_gunlukleri g
       JOIN kullanicilar k ON k.id = g.ekleyen_id
       WHERE g.santiye_id = $1 AND g.tenant_id = $2
       ORDER BY g.tarih DESC LIMIT 10`,
      [link.santiye_id, link.tenant_id]
    );

    // Son 8 fotoğraf
    const fotoRes = await query(
      `SELECT f.thumbnail_yolu, f.dosya_yolu, f.aciklama, f.olusturuldu::date AS tarih
       FROM fotograflar f
       WHERE f.santiye_id = $1 AND f.tenant_id = $2
       ORDER BY f.olusturuldu DESC LIMIT 8`,
      [link.santiye_id, link.tenant_id]
    );

    // Aylık ilerleme
    const ilerleRes = await query(
      `SELECT DATE_TRUNC('month', tarih) AS ay, MAX(fiziksel_ilerleme) AS max_ilerleme
       FROM santiye_gunlukleri
       WHERE santiye_id = $1 AND tenant_id = $2 AND fiziksel_ilerleme IS NOT NULL
       GROUP BY DATE_TRUNC('month', tarih)
       ORDER BY ay`,
      [link.santiye_id, link.tenant_id]
    );

    // Satın alma
    const satinalmaRes = await query(
      `SELECT COUNT(*) AS toplam,
         COALESCE(SUM(gercek_toplam) FILTER (WHERE durum = 'teslim_edildi'), 0) AS harcanan,
         COALESCE(SUM(tahmini_fiyat * miktar) FILTER (WHERE durum NOT IN ('teslim_edildi','iptal')), 0) AS planlanan
       FROM satinalma_talepleri
       WHERE santiye_id = $1 AND tenant_id = $2`,
      [link.santiye_id, link.tenant_id]
    );

    res.json({
      success: true,
      data: {
        rapor_tarihi: new Date().toISOString(),
        link_baslik: link.baslik,
        gecerlilik_tarihi: link.gecerlilik_tarihi,
        santiye: santiyeRes.rows[0],
        hakedis: hakedisRes.rows[0],
        gunluk_raporlar: gunlukRes.rows,
        fotograflar: fotoRes.rows,
        ilerleme_grafigi: ilerleRes.rows,
        satinalma: satinalmaRes.rows[0],
      },
    });
  } catch (error) {
    logger.error('getPublicRapor hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};
