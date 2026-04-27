import { Request, Response } from 'express';
import { query } from '../config/database';
import logger from '../utils/logger';
import { genisSantiyeRol, userCanAccessSantiye } from '../utils/santiyeAccess';

export const getSantiyeler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId, rol } = req.user!;
    const { durum, tip, sayfa = '1', limit = '20' } = req.query;
    const offset = (parseInt(sayfa as string, 10) - 1) * parseInt(limit as string, 10);

    let whereClause = 'WHERE s.tenant_id = $1 AND s.aktif = true';
    const params: unknown[] = [tenantId];
    let paramIdx = 2;

    if (!genisSantiyeRol(rol!)) {
      whereClause += ` AND EXISTS (SELECT 1 FROM santiye_kullanicilar sk 
        WHERE sk.santiye_id = s.id AND sk.kullanici_id = $${paramIdx})`;
      params.push(userId);
      paramIdx++;
    }
    if (durum) {
      whereClause += ` AND s.durum = $${paramIdx}`;
      params.push(durum);
      paramIdx++;
    }
    if (tip) {
      whereClause += ` AND s.tip = $${paramIdx}`;
      params.push(tip);
      paramIdx++;
    }
    const countResult = await query(`SELECT COUNT(*) FROM santiyeler s ${whereClause}`, params);
    const result = await query(
      `SELECT s.*, k.ad || ' ' || k.soyad as mudur_adi,
        (SELECT COUNT(*) FROM fotograflar f WHERE f.santiye_id = s.id) as fotograf_sayisi,
        (SELECT COUNT(*) FROM mesajlar m WHERE m.santiye_id = s.id AND m.silinmis = false) as mesaj_sayisi,
        (SELECT COUNT(*) FROM hakedisler h WHERE h.santiye_id = s.id) as hakedis_sayisi,
        (SELECT COALESCE(SUM(tutar), 0) FROM hakedisler h WHERE h.santiye_id = s.id AND h.durum = 'odendi') as tahsil_edilen,
        (SELECT COUNT(*) FROM personel p WHERE p.santiye_id = s.id AND p.aktif = true) as personel_sayisi
       FROM santiyeler s
       LEFT JOIN kullanicilar k ON k.id = s.mudur_id
       ${whereClause}
       ORDER BY s.olusturuldu DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );
    res.json({
      success: true,
      data: result.rows,
      meta: {
        toplam: parseInt(String(countResult.rows[0].count), 10),
        sayfa: parseInt(sayfa as string, 10),
        limit: parseInt(limit as string, 10),
      }
    });
  } catch (error) {
    logger.error('getSantiyeler hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const getSantiye = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId, rol } = req.user!;
    const { santiyeId: id } = req.params;
    const result = await query(
      `SELECT s.*, k.ad || ' ' || k.soyad as mudur_adi, k.telefon as mudur_telefon, k.email as mudur_email,
        (SELECT COUNT(*) FROM fotograflar f WHERE f.santiye_id = s.id) as fotograf_sayisi,
        (SELECT COUNT(*) FROM ekipmanlar e WHERE e.santiye_id = s.id AND e.aktif = true) as ekipman_sayisi,
        (SELECT COUNT(*) FROM personel p WHERE p.santiye_id = s.id AND p.aktif = true) as personel_sayisi,
        (SELECT COALESCE(SUM(h.tutar), 0) FROM hakedisler h WHERE h.santiye_id = s.id AND h.durum = 'odendi') as tahsil_edilen,
        (SELECT COALESCE(SUM(st.gercek_toplam), 0) FROM satinalma_talepleri st WHERE st.santiye_id = s.id AND st.durum = 'teslim_edildi') as malzeme_harcama,
        (SELECT json_agg(json_build_object('id', ku.id, 'ad', ku.ad, 'soyad', ku.soyad, 'rol', sk.yetki))
         FROM santiye_kullanicilar sk JOIN kullanicilar ku ON ku.id = sk.kullanici_id
         WHERE sk.santiye_id = s.id) as ekip
       FROM santiyeler s
       LEFT JOIN kullanicilar k ON k.id = s.mudur_id
       WHERE s.id = $1 AND s.tenant_id = $2 AND s.aktif = true`,
      [id, tenantId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ success: false, message: 'Şantiye bulunamadı' });
      return;
    }
    if (!(await userCanAccessSantiye({ tenantId, userId, rol: rol! }, id))) {
      res.status(403).json({ success: false, message: 'Bu şantiyeye erişim yetkiniz yok' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('getSantiye hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const createSantiye = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId } = req.user!;
    const {
      ad, tip, il, ilce, adres, koordinat_lat, koordinat_lng,
      mudur_id, baslangic, bitis_planlanan, sozlesme_no, sozlesme_bedel, notlar
    } = req.body;
    const limitCheck = await query(
      `SELECT t.max_santiye, COUNT(s.id) as mevcut
       FROM tenants t
       LEFT JOIN santiyeler s ON s.tenant_id = t.id AND s.aktif = true
       WHERE t.id = $1 GROUP BY t.max_santiye`,
      [tenantId]
    );
    if (limitCheck.rows[0] && parseInt(String(limitCheck.rows[0].mevcut), 10) >= limitCheck.rows[0].max_santiye) {
      res.status(403).json({ success: false, message: `Planda en fazla ${limitCheck.rows[0].max_santiye} şantiye` });
      return;
    }
    const result = await query(
      `INSERT INTO santiyeler
        (tenant_id, ad, tip, il, ilce, adres, koordinat_lat, koordinat_lng,
         mudur_id, baslangic, bitis_planlanan, sozlesme_no, sozlesme_bedel, notlar)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [tenantId, ad, tip, il, ilce, adres, koordinat_lat, koordinat_lng,
        mudur_id, baslangic, bitis_planlanan, sozlesme_no, sozlesme_bedel || 0, notlar]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('createSantiye hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const updateSantiye = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId, rol } = req.user!;
    const { santiyeId: id } = req.params;
    if (!(await userCanAccessSantiye({ tenantId, userId, rol: rol! }, id))) {
      res.status(403).json({ success: false, message: 'Güncelleme yetkisi yok' });
      return;
    }
    const mevcutResult = await query(
      'SELECT id FROM santiyeler WHERE id = $1 AND tenant_id = $2 AND aktif = true', [id, tenantId]
    );
    if (!mevcutResult.rows[0]) {
      res.status(404).json({ success: false, message: 'Şantiye bulunamadı' });
      return;
    }
    const {
      ad, tip, il, ilce, adres, koordinat_lat, koordinat_lng, mudur_id, baslangic, bitis_planlanan, bitis_gercek,
      sozlesme_no, sozlesme_bedel, gerceklesen, fiziksel_ilerleme, durum, notlar
    } = req.body;
    const result = await query(
      `UPDATE santiyeler SET
        ad = COALESCE($3, ad), tip = COALESCE($4, tip), il = COALESCE($5, il), ilce = COALESCE($6, ilce),
        adres = COALESCE($7, adres), koordinat_lat = COALESCE($8, koordinat_lat), koordinat_lng = COALESCE($9, koordinat_lng),
        mudur_id = COALESCE($10, mudur_id), baslangic = COALESCE($11, baslangic), bitis_planlanan = COALESCE($12, bitis_planlanan),
        bitis_gercek = COALESCE($13, bitis_gercek), sozlesme_no = COALESCE($14, sozlesme_no), sozlesme_bedel = COALESCE($15, sozlesme_bedel),
        gerceklesen = COALESCE($16, gerceklesen), fiziksel_ilerleme = COALESCE($17, fiziksel_ilerleme), durum = COALESCE($18, durum), notlar = COALESCE($19, notlar)
       WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, tenantId, ad, tip, il, ilce, adres, koordinat_lat, koordinat_lng, mudur_id, baslangic, bitis_planlanan,
        bitis_gercek, sozlesme_no, sozlesme_bedel, gerceklesen, fiziksel_ilerleme, durum, notlar]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('updateSantiye hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const deleteSantiye = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId, rol } = req.user!;
    const { santiyeId: id } = req.params;
    if (!(await userCanAccessSantiye({ tenantId, userId, rol: rol! }, id))) {
      res.status(403).json({ success: false, message: 'Silme yetkisi yok' });
      return;
    }
    await query('UPDATE santiyeler SET aktif = false WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    res.json({ success: true, message: 'Şantiye silindi' });
  } catch (error) {
    logger.error('deleteSantiye hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const getDashboardKpi = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId, rol } = req.user!;
    const broad = genisSantiyeRol(rol!);
    const sc = ' AND santiye_id IN (SELECT sk.santiye_id FROM santiye_kullanicilar sk WHERE sk.kullanici_id = $2) ';
    const p0: unknown[] = broad ? [tenantId] : [tenantId, userId];
    const p1: unknown[] = broad ? [tenantId] : [tenantId, userId];
    const p2: unknown[] = broad ? [tenantId] : [tenantId, userId];

    const sWhere = 'WHERE s.tenant_id = $1 AND s.aktif = true' + (broad ? '' : ' AND s.id IN (SELECT sk.santiye_id FROM santiye_kullanicilar sk WHERE sk.kullanici_id = $2)');

    const kpiSant = await query(
      `SELECT COUNT(DISTINCT s.id) as toplam_santiye,
        COALESCE(SUM(s.sozlesme_bedel), 0) as toplam_sozlesme,
        COALESCE(SUM(s.gerceklesen), 0) as toplam_gerceklesen,
        ROUND(AVG(s.fiziksel_ilerleme)) as ort_fiziksel,
        COUNT(CASE WHEN s.durum = 'devam' THEN 1 END) as aktif_santiye
       FROM santiyeler s ${sWhere}`,
      p0
    );

    const bh = await query(
      `SELECT COALESCE(SUM(tutar), 0) as bekleyen_hakedis FROM hakedisler h
       WHERE h.tenant_id = $1 AND h.durum NOT IN ('onaylandi','odendi')${broad ? '' : sc}`,
      p1
    );
    const bs = await query(
      `SELECT COUNT(*) as bekleyen_satinalma FROM satinalma_talepleri st
       WHERE st.tenant_id = $1 AND st.durum = 'onay_bekliyor'${broad ? '' : sc}`,
      p1
    );
    const be = await query(
      `SELECT COUNT(*) as bakimda_ekipman FROM ekipmanlar e
       WHERE e.tenant_id = $1 AND e.durum = 'bakimda'${broad ? '' : ' AND (e.santiye_id IN (SELECT sk.santiye_id FROM santiye_kullanicilar sk WHERE sk.kullanici_id = $2) OR e.santiye_id IS NULL)'}`,
      p1
    );

    const kpi = {
      ...kpiSant.rows[0],
      bekleyen_hakedis: bh.rows[0].bekleyen_hakedis,
      bekleyen_satinalma: parseInt(String(bs.rows[0].bekleyen_satinalma), 10),
      bakimda_ekipman: parseInt(String(be.rows[0].bakimda_ekipman), 10),
    };

    const nakitWhere = broad
      ? 'WHERE tenant_id = $1 AND tarih >= NOW() - INTERVAL \'6 months\''
      : 'WHERE tenant_id = $1 AND tarih >= NOW() - INTERVAL \'6 months\' AND santiye_id IN (SELECT sk.santiye_id FROM santiye_kullanicilar sk WHERE sk.kullanici_id = $2)';
    const nakitResult = await query(
      `SELECT DATE_TRUNC('month', tarih) as ay,
        SUM(CASE WHEN tip = 'giris' THEN tutar_try ELSE 0 END) as giris,
        SUM(CASE WHEN tip = 'cikis' THEN tutar_try ELSE 0 END) as cikis
       FROM nakit_hareketleri ${nakitWhere}
       GROUP BY DATE_TRUNC('month', tarih) ORDER BY ay`,
      p2
    );

    const uyariResult = await query(
      `SELECT 'bakim' as tip, ad || ' bakım' as mesaj, sonraki_bakim as tarih
       FROM ekipmanlar WHERE tenant_id = $1 AND aktif = true
         AND sonraki_bakim BETWEEN NOW() AND NOW() + INTERVAL '7 days'`,
      [tenantId]
    );

    res.json({ success: true, data: { kpi, nakit_akisi: nakitResult.rows, uyarilar: uyariResult.rows } });
  } catch (error) {
    logger.error('getDashboardKpi hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};
