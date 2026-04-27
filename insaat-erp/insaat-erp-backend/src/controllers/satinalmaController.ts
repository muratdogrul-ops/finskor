import { Request, Response } from 'express';
import { query } from '../config/database';
import logger from '../utils/logger';
import { santiyeKapsamSql, userCanAccessSantiye } from '../utils/santiyeAccess';
import { writeAudit } from '../utils/auditLog';

export const getSatinalmaTalepleri = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId, rol } = req.user!;
    const { santiye_id, durum, acil, sayfa = '1', limit = '20' } = req.query;
    const offset = (parseInt(sayfa as string, 10) - 1) * parseInt(limit as string, 10);

    let where = 'WHERE st.tenant_id = $1';
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (santiye_id) { where += ` AND st.santiye_id = $${idx++}`; params.push(santiye_id); }
    if (durum) { where += ` AND st.durum = $${idx++}`; params.push(durum); }
    if (acil === 'true') { where += ` AND st.acil_mi = true`; }

    const sc = santiyeKapsamSql(rol, userId, 'st.santiye_id', idx);
    if (sc.sql) {
      where += sc.sql;
      params.push(sc.param);
      idx = sc.nextIdx;
    }

    const countResult = await query(`SELECT COUNT(*) FROM satinalma_talepleri st ${where}`, params);

    const result = await query(
      `SELECT st.*,
        s.ad as santiye_adi,
        k.ad || ' ' || k.soyad as talep_eden_adi,
        o.ad || ' ' || o.soyad as onaylayan_adi
       FROM satinalma_talepleri st
       JOIN santiyeler s ON s.id = st.santiye_id
       JOIN kullanicilar k ON k.id = st.talep_eden_id
       LEFT JOIN kullanicilar o ON o.id = st.onaylayan_id
       ${where}
       ORDER BY st.acil_mi DESC, st.olusturuldu DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    const ozet = await query(
      `SELECT
        COUNT(CASE WHEN st.durum = 'onay_bekliyor' THEN 1 END) as onay_bekleyen,
        COUNT(CASE WHEN st.durum = 'onay_bekliyor' AND st.acil_mi = true THEN 1 END) as acil_bekleyen,
        COALESCE(SUM(CASE WHEN st.durum = 'onay_bekliyor' THEN st.toplam_tahmini END), 0) as bekleyen_tutar
       FROM satinalma_talepleri st
       ${where}`,
      params
    );

    res.json({
      success: true,
      data: result.rows,
      ozet: ozet.rows[0],
      meta: { toplam: parseInt(String(countResult.rows[0].count), 10) }
    });
  } catch (error) {
    logger.error('getSatinalmaTalepleri hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const getSatinalma = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const result = await query(
      `SELECT st.*, s.ad as santiye_adi,
        k.ad || ' ' || k.soyad as talep_eden_adi,
        o.ad || ' ' || o.soyad as onaylayan_adi
       FROM satinalma_talepleri st
       JOIN santiyeler s ON s.id = st.santiye_id
       JOIN kullanicilar k ON k.id = st.talep_eden_id
       LEFT JOIN kullanicilar o ON o.id = st.onaylayan_id
       WHERE st.id = $1 AND st.tenant_id = $2`,
      [id, tenantId]
    );

    if (!result.rows[0]) {
      res.status(404).json({ success: false, message: 'Talep bulunamadı' });
      return;
    }
    if (req.user && !(await userCanAccessSantiye(req.user, result.rows[0].santiye_id))) {
      res.status(403).json({ success: false, message: 'Erişim yok' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('getSatinalma hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const createSatinalma = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId, rol } = req.user!;
    const {
      santiye_id, malzeme_adi, kategori, miktar, birim,
      tahmini_fiyat, tedarikci, tedarikci_tel,
      acil_mi = false, gerekli_tarih, notlar
    } = req.body;

    if (!(await userCanAccessSantiye({ tenantId, userId, rol }, santiye_id))) {
      res.status(403).json({ success: false, message: 'Bu şantiyede talep açamazsınız' });
      return;
    }

    const countRes = await query(
      'SELECT COUNT(*) FROM satinalma_talepleri WHERE tenant_id = $1',
      [tenantId]
    );
    const talep_no = `ST-${new Date().getFullYear()}-${String(parseInt(String(countRes.rows[0].count), 10) + 1).padStart(4, '0')}`;

    const toplam_tahmini = tahmini_fiyat ? Number(miktar) * Number(tahmini_fiyat) : null;

    const result = await query(
      `INSERT INTO satinalma_talepleri
        (tenant_id, santiye_id, talep_no, malzeme_adi, kategori, miktar, birim,
         tahmini_fiyat, toplam_tahmini, tedarikci, tedarikci_tel,
         acil_mi, gerekli_tarih, notlar, talep_eden_id, durum)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'onay_bekliyor')
       RETURNING *`,
      [tenantId, santiye_id, talep_no, malzeme_adi, kategori, miktar, birim,
        tahmini_fiyat, toplam_tahmini, tedarikci, tedarikci_tel,
        acil_mi, gerekli_tarih, notlar, userId]
    );
    if (req.user) void writeAudit(req.user, 'satinalma_talepleri', 'INSERT', { kayitId: result.rows[0].id, yeniDeger: result.rows[0], req });
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('createSatinalma hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const updateSatinalma = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, rol, userId } = req.user!;
    const { id } = req.params;
    const prev = await query('SELECT santiye_id FROM satinalma_talepleri WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (!prev.rows[0] || !(await userCanAccessSantiye({ tenantId, userId, rol }, prev.rows[0].santiye_id))) {
      res.status(403).json({ success: false, message: 'Erişim yok' });
      return;
    }
    const { gercek_fiyat, teslim_tarihi, fatura_no, notlar } = req.body;
    const gercek_toplam = req.body.miktar && gercek_fiyat
      ? req.body.miktar * gercek_fiyat
      : undefined;

    const result = await query(
      `UPDATE satinalma_talepleri SET
        gercek_fiyat = COALESCE($3, gercek_fiyat),
        gercek_toplam = COALESCE($4, gercek_toplam),
        teslim_tarihi = COALESCE($5, teslim_tarihi),
        fatura_no = COALESCE($6, fatura_no),
        notlar = COALESCE($7, notlar)
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId, gercek_fiyat, gercek_toplam, teslim_tarihi, fatura_no, notlar]
    );
    if (!result.rows[0]) {
      res.status(404).json({ success: false, message: 'Talep bulunamadı' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('updateSatinalma hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const onaylaSatinalma = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId, rol } = req.user!;
    const { id } = req.params;
    const { yeni_durum } = req.body;

    const gecerli = ['onaylandi', 'iptal', 'siparis', 'teslim_edildi'];
    if (!gecerli.includes(yeni_durum)) {
      res.status(400).json({ success: false, message: 'Geçersiz durum' });
      return;
    }

    const prev = await query('SELECT * FROM satinalma_talepleri WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (!prev.rows[0] || !(await userCanAccessSantiye({ tenantId, userId, rol }, prev.rows[0].santiye_id))) {
      res.status(403).json({ success: false, message: 'Erişim yok' });
      return;
    }

    const result = await query(
      `UPDATE satinalma_talepleri SET
        durum = $3,
        onaylayan_id = CASE WHEN $3 = 'onaylandi' THEN $4 ELSE onaylayan_id END,
        onay_tarihi = CASE WHEN $3 = 'onaylandi' THEN NOW() ELSE onay_tarihi END,
        teslim_tarihi = CASE WHEN $3 = 'teslim_edildi' THEN CURRENT_DATE ELSE teslim_tarihi END
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId, yeni_durum, userId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ success: false, message: 'Talep bulunamadı' });
      return;
    }

    if (yeni_durum === 'teslim_edildi' && result.rows[0].gercek_toplam) {
      await query(
        `INSERT INTO nakit_hareketleri
          (tenant_id, santiye_id, tarih, tip, kategori, aciklama, tutar, tutar_try, satinalma_id, kaydeden_id, onaylandi)
         VALUES ($1,$2,NOW(),'cikis','malzeme',$3,$4,$4,$5,$6,true)`,
        [tenantId, result.rows[0].santiye_id,
          `Malzeme alımı: ${result.rows[0].malzeme_adi} (${result.rows[0].talep_no})`,
          result.rows[0].gercek_toplam, id, userId]
      );
    }
    if (req.user) void writeAudit(req.user, 'satinalma_talepleri', 'UPDATE', { kayitId: id, yeniDeger: { yeni_durum }, req });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('onaylaSatinalma hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};
