import { Request, Response } from 'express';
import { query, withTransaction } from '../config/database';
import logger from '../utils/logger';
import { santiyeKapsamSql, userCanAccessSantiye } from '../utils/santiyeAccess';
import { writeAudit } from '../utils/auditLog';

export const getHakedisler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId, rol } = req.user!;
    const { santiye_id, durum, tip, sayfa = '1', limit = '20' } = req.query;
    const offset = (parseInt(sayfa as string, 10) - 1) * parseInt(limit as string, 10);

    let where = 'WHERE h.tenant_id = $1';
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (santiye_id) { where += ` AND h.santiye_id = $${idx++}`; params.push(santiye_id); }
    if (durum) { where += ` AND h.durum = $${idx++}`; params.push(durum); }
    if (tip) { where += ` AND h.tip = $${idx++}`; params.push(tip); }

    const sc = santiyeKapsamSql(rol, userId, 'h.santiye_id', idx);
    if (sc.sql) {
      where += sc.sql;
      params.push(sc.param);
      idx = sc.nextIdx;
    }

    const countResult = await query(`SELECT COUNT(*) FROM hakedisler h ${where}`, params);

    const result = await query(
      `SELECT h.*,
        s.ad as santiye_adi, s.il as santiye_il,
        k.ad || ' ' || k.soyad as hazirlayan_adi,
        o.ad || ' ' || o.soyad as onaylayan_adi
       FROM hakedisler h
       JOIN santiyeler s ON s.id = h.santiye_id
       JOIN kullanicilar k ON k.id = h.hazırlayan_id
       LEFT JOIN kullanicilar o ON o.id = h.onaylayan_id
       ${where}
       ORDER BY h.olusturuldu DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: { toplam: parseInt(String(countResult.rows[0].count), 10) }
    });
  } catch (error) {
    logger.error('getHakedisler hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const getHakedis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const result = await query(
      `SELECT h.*,
        s.ad as santiye_adi, s.il as santiye_il, s.sozlesme_no,
        k.ad || ' ' || k.soyad as hazirlayan_adi,
        o.ad || ' ' || o.soyad as onaylayan_adi,
        (SELECT json_agg(hk ORDER BY hk.sira) FROM hakedis_kalemleri hk WHERE hk.hakedis_id = h.id) as kalemler
       FROM hakedisler h
       JOIN santiyeler s ON s.id = h.santiye_id
       JOIN kullanicilar k ON k.id = h.hazırlayan_id
       LEFT JOIN kullanicilar o ON o.id = h.onaylayan_id
       WHERE h.id = $1 AND h.tenant_id = $2`,
      [id, tenantId]
    );

    if (!result.rows[0]) {
      res.status(404).json({ success: false, message: 'Hakediş bulunamadı' });
      return;
    }

    if (req.user && !(await userCanAccessSantiye(req.user, result.rows[0].santiye_id))) {
      res.status(403).json({ success: false, message: 'Bu şantiyeye erişim yetkiniz yok' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('getHakedis hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const createHakedis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId, rol } = req.user!;
    const {
      santiye_id, no, tip, donem_baslangic, donem_bitis,
      tutar, kdv_orani = 20, notlar, kalemler = [],
      avans_tutari = 0, kesinti_tutari = 0, cari_id, dis_fatura_ref, fatura_uuid
    } = req.body;

    if (!(await userCanAccessSantiye({ tenantId, userId, rol }, santiye_id))) {
      res.status(403).json({ success: false, message: 'Bu şantiyede hakediş oluşturamazsınız' });
      return;
    }

    const noCheck = await query(
      'SELECT id FROM hakedisler WHERE tenant_id = $1 AND santiye_id = $2 AND no = $3',
      [tenantId, santiye_id, no]
    );
    if (noCheck.rows[0]) {
      res.status(409).json({ success: false, message: 'Bu hakediş numarası zaten kullanılıyor' });
      return;
    }

    const av = Math.round(Number(avans_tutari) || 0);
    const ke = Math.round(Number(kesinti_tutari) || 0);
    const kdv_tutari = Math.round(Number(tutar) * Number(kdv_orani) / 100);
    const toplam_tutar = Math.round(Number(tutar)) + kdv_tutari - ke - av;

    const result = await withTransaction(async (client) => {
      const hakRes = await client.query(
        `INSERT INTO hakedisler
          (tenant_id, santiye_id, no, tip, donem_baslangic, donem_bitis,
           tutar, kdv_orani, kdv_tutari, toplam_tutar, notlar, hazırlayan_id,
           avans_tutari, kesinti_tutari, cari_id, dis_fatura_ref, fatura_uuid)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING *`,
        [tenantId, santiye_id, no, tip, donem_baslangic, donem_bitis,
          tutar, kdv_orani, kdv_tutari, toplam_tutar, notlar, userId,
          av, ke, cari_id || null, dis_fatura_ref || null, fatura_uuid || null]
      );

      const hakedisId = hakRes.rows[0].id;

      for (let i = 0; i < kalemler.length; i++) {
        const k = kalemler[i];
        const rowToplam = k.miktar * k.birim_fiyat;
        await client.query(
          `INSERT INTO hakedis_kalemleri (hakedis_id, poz_no, tanim, birim, miktar, birim_fiyat, toplam, sira)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [hakedisId, k.poz_no, k.tanim, k.birim, k.miktar, k.birim_fiyat, rowToplam, i]
        );
      }

      return hakRes.rows[0];
    });

    if (req.user) {
      void writeAudit(req.user, 'hakedisler', 'INSERT', { kayitId: result.id, yeniDeger: result, req });
    }
    logger.info(`Hakediş oluşturuldu: ${no} (tenant: ${tenantId})`);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    logger.error('createHakedis hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const updateHakedis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const check = await query(
      'SELECT durum, santiye_id FROM hakedisler WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (!check.rows[0]) {
      res.status(404).json({ success: false, message: 'Hakediş bulunamadı' });
      return;
    }
    if (req.user && !(await userCanAccessSantiye(req.user, check.rows[0].santiye_id))) {
      res.status(403).json({ success: false, message: 'Erişim yok' });
      return;
    }
    if (['onaylandi', 'odendi'].includes(check.rows[0].durum)) {
      res.status(403).json({ success: false, message: 'Onaylanmış hakediş değiştirilemez' });
      return;
    }

    const { tutar, kdv_orani, notlar, durum, avans_tutari, kesinti_tutari } = req.body;
    const kdv_tutari = tutar != null && kdv_orani != null ? Math.round(tutar * kdv_orani / 100) : undefined;
    const av = avans_tutari != null ? Math.round(Number(avans_tutari)) : undefined;
    const ke = kesinti_tutari != null ? Math.round(Number(kesinti_tutari)) : undefined;
    let toplam_tutar: number | undefined;
    if (tutar != null && kdv_tutari !== undefined) {
      const t = Math.round(Number(tutar));
      toplam_tutar = t + kdv_tutari - (ke ?? 0) - (av ?? 0);
    }

    const result = await query(
      `UPDATE hakedisler SET
        tutar = COALESCE($3, tutar),
        kdv_orani = COALESCE($4, kdv_orani),
        kdv_tutari = COALESCE($5, kdv_tutari),
        toplam_tutar = COALESCE($6, toplam_tutar),
        notlar = COALESCE($7, notlar),
        durum = COALESCE($8, durum),
        avans_tutari = COALESCE($9, avans_tutari),
        kesinti_tutari = COALESCE($10, kesinti_tutari)
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId, tutar, kdv_orani, kdv_tutari, toplam_tutar, notlar, durum, av, ke]
    );

    if (req.user) void writeAudit(req.user, 'hakedisler', 'UPDATE', { kayitId: id, yeniDeger: result.rows[0], req });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('updateHakedis hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const onaylaHakedis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId, rol } = req.user!;
    const { id } = req.params;
    const { yeni_durum, odeme_tarihi } = req.body;

    const gecerliDurumlar = ['onaylandi', 'odendi', 'itiraz'];
    if (!gecerliDurumlar.includes(yeni_durum)) {
      res.status(400).json({ success: false, message: 'Geçersiz durum' });
      return;
    }

    const row = await query(
      'SELECT santiye_id FROM hakedisler WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (!row.rows[0] || !(await userCanAccessSantiye({ tenantId, userId, rol }, row.rows[0].santiye_id))) {
      res.status(403).json({ success: false, message: 'İşlem için yetki yok' });
      return;
    }

    const result = await query(
      `UPDATE hakedisler SET
        durum = $3,
        onaylayan_id = $4,
        onay_tarihi = NOW(),
        odeme_tarihi = $5
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId, yeni_durum, userId, odeme_tarihi || null]
    );

    if (!result.rows[0]) {
      res.status(404).json({ success: false, message: 'Hakediş bulunamadı' });
      return;
    }

    if (yeni_durum === 'odendi') {
      await query(
        `INSERT INTO nakit_hareketleri
          (tenant_id, santiye_id, tarih, tip, kategori, aciklama, tutar, tutar_try, hakedis_id, kaydeden_id, onaylandi)
         VALUES ($1, $2, $3, 'giris', 'hakedis', $4, $5, $5, $6, $7, true)`,
        [tenantId, result.rows[0].santiye_id, odeme_tarihi || new Date(),
          `Hakediş tahsilatı: ${result.rows[0].no}`,
          result.rows[0].toplam_tutar, id, userId]
      );
    }

    if (req.user) void writeAudit(req.user, 'hakedisler', 'UPDATE', { kayitId: id, yeniDeger: { durum: yeni_durum }, req });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('onaylaHakedis hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};
