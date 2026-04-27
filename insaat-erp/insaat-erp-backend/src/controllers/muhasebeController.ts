import { Request, Response } from 'express';
import { query, withTransaction } from '../config/database';
import { logger } from '../utils/logger';

// ── YARDIMCI ─────────────────────────────────────────────────────────────────
const nextFisNo = async (tenantId: string): Promise<string> => {
  const r = await query(
    `SELECT COUNT(*) + 1 AS sira FROM yevmiye_fisler WHERE tenant_id = $1`,
    [tenantId]
  );
  const year = new Date().getFullYear();
  return `FIS-${year}-${String(r.rows[0].sira).padStart(5, '0')}`;
};

// ── HESAP PLANI ───────────────────────────────────────────────────────────────
export const getHesapPlani = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { aktif } = req.query;

    const rows = await query(
      `SELECT h.id, h.kod, h.ad, h.tip, h.ust_hesap_id, h.aciklama, h.aktif,
              u.kod AS ust_kod, u.ad AS ust_ad,
              (SELECT COUNT(*) FROM yevmiye_satirlar ys
               WHERE ys.hesap_id = h.id AND ys.tenant_id = $1) AS hareket_sayisi
       FROM hesap_plani h
       LEFT JOIN hesap_plani u ON u.id = h.ust_hesap_id
       WHERE h.tenant_id = $1
         ${aktif !== undefined ? `AND h.aktif = ${aktif === 'true'}` : ''}
       ORDER BY h.kod`,
      [tenantId]
    );

    res.json({ success: true, data: rows.rows });
  } catch (err) {
    logger.error('getHesapPlani hatası:', err);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const createHesap = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { kod, ad, tip, ust_hesap_id, aciklama } = req.body;
    if (!kod || !ad || !tip) {
      res.status(400).json({ success: false, message: 'kod, ad ve tip zorunludur' });
      return;
    }
    const r = await query(
      `INSERT INTO hesap_plani (tenant_id, kod, ad, tip, ust_hesap_id, aciklama)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [tenantId, kod.trim(), ad.trim(), tip, ust_hesap_id || null, aciklama || null]
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(400).json({ success: false, message: 'Bu hesap kodu zaten mevcut' });
    } else {
      logger.error('createHesap hatası:', err);
      res.status(500).json({ success: false, message: 'Sunucu hatası' });
    }
  }
};

export const updateHesap = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;
    const { ad, aciklama, aktif } = req.body;
    const r = await query(
      `UPDATE hesap_plani SET ad = COALESCE($1,ad),
         aciklama = COALESCE($2,aciklama), aktif = COALESCE($3,aktif)
       WHERE id = $4 AND tenant_id = $5 RETURNING *`,
      [ad, aciklama, aktif, id, tenantId]
    );
    if (!r.rows.length) { res.status(404).json({ success: false, message: 'Hesap bulunamadı' }); return; }
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    logger.error('updateHesap hatası:', err);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ── YEVMİYE FİŞLERİ ──────────────────────────────────────────────────────────
export const getFisler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { durum, tarih_bas, tarih_bit, santiye_id, q, limit = '50', offset = '0' } = req.query;

    const where: string[] = ['f.tenant_id = $1'];
    const params: any[] = [tenantId];
    let p = 2;

    if (durum)      { where.push(`f.durum = $${p++}`);                      params.push(durum); }
    if (tarih_bas)  { where.push(`f.tarih >= $${p++}`);                     params.push(tarih_bas); }
    if (tarih_bit)  { where.push(`f.tarih <= $${p++}`);                     params.push(tarih_bit); }
    if (santiye_id) { where.push(`f.santiye_id = $${p++}`);                 params.push(santiye_id); }
    if (q)          { where.push(`(f.fis_no ILIKE $${p} OR f.aciklama ILIKE $${p})`); params.push(`%${q}%`); p++; }

    const rows = await query(
      `SELECT f.id, f.fis_no, f.tarih, f.aciklama, f.durum, f.kaynak_tip, f.olusturuldu,
              s.ad AS santiye_ad,
              COALESCE(SUM(ys.borc), 0) AS toplam_borc,
              COALESCE(SUM(ys.alacak), 0) AS toplam_alacak,
              COUNT(ys.id) AS satir_sayisi
       FROM yevmiye_fisler f
       LEFT JOIN santiyeler s ON s.id = f.santiye_id
       LEFT JOIN yevmiye_satirlar ys ON ys.fis_id = f.id
       WHERE ${where.join(' AND ')}
       GROUP BY f.id, s.ad
       ORDER BY f.tarih DESC, f.fis_no DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, parseInt(limit as string), parseInt(offset as string)]
    );

    const total = await query(
      `SELECT COUNT(*) FROM yevmiye_fisler f WHERE ${where.join(' AND ')}`,
      params
    );

    res.json({ success: true, data: rows.rows, total: parseInt(total.rows[0].count) });
  } catch (err) {
    logger.error('getFisler hatası:', err);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const getFis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const fis = await query(
      `SELECT f.*, s.ad AS santiye_ad,
              k.ad || ' ' || k.soyad AS olusturan_ad
       FROM yevmiye_fisler f
       LEFT JOIN santiyeler s ON s.id = f.santiye_id
       LEFT JOIN kullanicilar k ON k.id = f.olusturan_id
       WHERE f.id = $1 AND f.tenant_id = $2`,
      [id, tenantId]
    );
    if (!fis.rows.length) { res.status(404).json({ success: false, message: 'Fiş bulunamadı' }); return; }

    const satirlar = await query(
      `SELECT ys.*, h.kod AS hesap_kod, h.ad AS hesap_ad, h.tip AS hesap_tip
       FROM yevmiye_satirlar ys
       JOIN hesap_plani h ON h.id = ys.hesap_id
       WHERE ys.fis_id = $1
       ORDER BY ys.sira`,
      [id]
    );

    res.json({ success: true, data: { ...fis.rows[0], satirlar: satirlar.rows } });
  } catch (err) {
    logger.error('getFis hatası:', err);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const createFis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, id: userId } = req.user!;
    const { tarih, aciklama, santiye_id, kaynak_tip, kaynak_id, satirlar } = req.body;

    if (!tarih || !satirlar?.length) {
      res.status(400).json({ success: false, message: 'Tarih ve en az bir satır zorunludur' });
      return;
    }

    // Denge kontrolü
    const toplamBorc   = satirlar.reduce((s: number, r: any) => s + (parseFloat(r.borc) || 0), 0);
    const toplamAlacak = satirlar.reduce((s: number, r: any) => s + (parseFloat(r.alacak) || 0), 0);
    if (Math.abs(toplamBorc - toplamAlacak) > 0.01) {
      res.status(400).json({
        success: false,
        message: `Borç (${toplamBorc.toFixed(2)}) = Alacak (${toplamAlacak.toFixed(2)}) eşit olmalıdır`
      });
      return;
    }

    const result = await withTransaction(async (client) => {
      const fisNo = await nextFisNo(tenantId);
      const fis = await client.query(
        `INSERT INTO yevmiye_fisler
           (tenant_id, fis_no, tarih, aciklama, santiye_id, kaynak_tip, kaynak_id, olusturan_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [tenantId, fisNo, tarih, aciklama, santiye_id || null, kaynak_tip || 'manuel', kaynak_id || null, userId]
      );
      const fisId = fis.rows[0].id;

      for (let i = 0; i < satirlar.length; i++) {
        const s = satirlar[i];
        await client.query(
          `INSERT INTO yevmiye_satirlar (fis_id, tenant_id, hesap_id, borc, alacak, aciklama, sira)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [fisId, tenantId, s.hesap_id, parseFloat(s.borc) || 0, parseFloat(s.alacak) || 0, s.aciklama || null, i + 1]
        );
      }
      return fis.rows[0];
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    logger.error('createFis hatası:', err);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const onaylaFis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const r = await query(
      `UPDATE yevmiye_fisler SET durum = 'onaylandi', guncellendi = NOW()
       WHERE id = $1 AND tenant_id = $2 AND durum = 'taslak' RETURNING *`,
      [id, tenantId]
    );
    if (!r.rows.length) {
      res.status(400).json({ success: false, message: 'Fiş bulunamadı veya zaten onaylı' });
      return;
    }
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    logger.error('onaylaFis hatası:', err);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const iptalFis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const r = await query(
      `UPDATE yevmiye_fisler SET durum = 'iptal', guncellendi = NOW()
       WHERE id = $1 AND tenant_id = $2 AND durum != 'iptal' RETURNING *`,
      [id, tenantId]
    );
    if (!r.rows.length) {
      res.status(400).json({ success: false, message: 'Fiş bulunamadı' });
      return;
    }
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    logger.error('iptalFis hatası:', err);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ── MİZAN (Deneme Bilançosu) ──────────────────────────────────────────────────
export const getMizan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { tarih_bas, tarih_bit } = req.query;

    const rows = await query(
      `SELECT
         h.kod, h.ad, h.tip,
         COALESCE(SUM(ys.borc),   0) AS donem_borc,
         COALESCE(SUM(ys.alacak), 0) AS donem_alacak,
         COALESCE(SUM(ys.borc),   0) - COALESCE(SUM(ys.alacak), 0) AS bakiye,
         CASE
           WHEN h.tip IN ('aktif','gider') THEN
             GREATEST(COALESCE(SUM(ys.borc),0) - COALESCE(SUM(ys.alacak),0), 0)
           ELSE 0
         END AS borc_bakiye,
         CASE
           WHEN h.tip IN ('pasif','gelir','oz_sermaye') THEN
             GREATEST(COALESCE(SUM(ys.alacak),0) - COALESCE(SUM(ys.borc),0), 0)
           ELSE 0
         END AS alacak_bakiye
       FROM hesap_plani h
       JOIN yevmiye_satirlar ys ON ys.hesap_id = h.id
       JOIN yevmiye_fisler f ON f.id = ys.fis_id
       WHERE h.tenant_id = $1 AND f.durum = 'onaylandi'
         ${tarih_bas ? `AND f.tarih >= '${tarih_bas}'` : ''}
         ${tarih_bit ? `AND f.tarih <= '${tarih_bit}'` : ''}
       GROUP BY h.id, h.kod, h.ad, h.tip
       HAVING (SUM(ys.borc) > 0 OR SUM(ys.alacak) > 0)
       ORDER BY h.kod`,
      [tenantId]
    );

    const toplam = {
      donem_borc:    rows.rows.reduce((s, r) => s + parseFloat(r.donem_borc), 0),
      donem_alacak:  rows.rows.reduce((s, r) => s + parseFloat(r.donem_alacak), 0),
      borc_bakiye:   rows.rows.reduce((s, r) => s + parseFloat(r.borc_bakiye), 0),
      alacak_bakiye: rows.rows.reduce((s, r) => s + parseFloat(r.alacak_bakiye), 0),
    };

    res.json({ success: true, data: rows.rows, toplam });
  } catch (err) {
    logger.error('getMizan hatası:', err);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ── MUAVİN DEFTERİ ────────────────────────────────────────────────────────────
export const getMuavin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { hesap_id } = req.params;
    const { tarih_bas, tarih_bit } = req.query;

    const hesap = await query(
      `SELECT kod, ad, tip FROM hesap_plani WHERE id = $1 AND tenant_id = $2`,
      [hesap_id, tenantId]
    );
    if (!hesap.rows.length) { res.status(404).json({ success: false, message: 'Hesap bulunamadı' }); return; }

    const rows = await query(
      `SELECT
         f.tarih, f.fis_no, f.aciklama AS fis_aciklama,
         ys.aciklama, ys.borc, ys.alacak,
         SUM(ys.borc - ys.alacak) OVER (ORDER BY f.tarih, f.fis_no, ys.sira) AS kumulatif_bakiye
       FROM yevmiye_satirlar ys
       JOIN yevmiye_fisler f ON f.id = ys.fis_id
       WHERE ys.hesap_id = $1 AND ys.tenant_id = $2 AND f.durum = 'onaylandi'
         ${tarih_bas ? `AND f.tarih >= '${tarih_bas}'` : ''}
         ${tarih_bit ? `AND f.tarih <= '${tarih_bit}'` : ''}
       ORDER BY f.tarih, f.fis_no, ys.sira`,
      [hesap_id, tenantId]
    );

    const toplam = {
      borc:   rows.rows.reduce((s, r) => s + parseFloat(r.borc), 0),
      alacak: rows.rows.reduce((s, r) => s + parseFloat(r.alacak), 0),
    };

    res.json({ success: true, hesap: hesap.rows[0], data: rows.rows, toplam });
  } catch (err) {
    logger.error('getMuavin hatası:', err);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ── GELİR-GİDER RAPORU ───────────────────────────────────────────────────────
export const getGelirGider = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { tarih_bas, tarih_bit, yil } = req.query;

    const bas = tarih_bas || (yil ? `${yil}-01-01` : `${new Date().getFullYear()}-01-01`);
    const bit = tarih_bit || (yil ? `${yil}-12-31` : `${new Date().getFullYear()}-12-31`);

    const rows = await query(
      `SELECT
         h.kod, h.ad, h.tip,
         COALESCE(SUM(ys.borc),   0) AS toplam_borc,
         COALESCE(SUM(ys.alacak), 0) AS toplam_alacak,
         CASE
           WHEN h.tip = 'gelir' THEN COALESCE(SUM(ys.alacak),0) - COALESCE(SUM(ys.borc),0)
           WHEN h.tip = 'gider' THEN COALESCE(SUM(ys.borc),0)   - COALESCE(SUM(ys.alacak),0)
           ELSE 0
         END AS net_tutar
       FROM hesap_plani h
       JOIN yevmiye_satirlar ys ON ys.hesap_id = h.id
       JOIN yevmiye_fisler f ON f.id = ys.fis_id
       WHERE h.tenant_id = $1 AND h.tip IN ('gelir','gider')
         AND f.durum = 'onaylandi'
         AND f.tarih BETWEEN $2 AND $3
       GROUP BY h.id, h.kod, h.ad, h.tip
       HAVING (SUM(ys.borc) > 0 OR SUM(ys.alacak) > 0)
       ORDER BY h.tip DESC, h.kod`,
      [tenantId, bas, bit]
    );

    const gelirler = rows.rows.filter(r => r.tip === 'gelir');
    const giderler = rows.rows.filter(r => r.tip === 'gider');
    const toplamGelir = gelirler.reduce((s, r) => s + parseFloat(r.net_tutar), 0);
    const toplamGider = giderler.reduce((s, r) => s + parseFloat(r.net_tutar), 0);

    // Aylık özet
    const aylik = await query(
      `SELECT
         TO_CHAR(f.tarih,'YYYY-MM') AS ay,
         SUM(CASE WHEN h.tip = 'gelir' THEN ys.alacak - ys.borc  ELSE 0 END) AS gelir,
         SUM(CASE WHEN h.tip = 'gider' THEN ys.borc   - ys.alacak ELSE 0 END) AS gider
       FROM yevmiye_satirlar ys
       JOIN yevmiye_fisler f ON f.id = ys.fis_id
       JOIN hesap_plani h ON h.id = ys.hesap_id
       WHERE h.tenant_id = $1 AND h.tip IN ('gelir','gider')
         AND f.durum = 'onaylandi' AND f.tarih BETWEEN $2 AND $3
       GROUP BY ay ORDER BY ay`,
      [tenantId, bas, bit]
    );

    res.json({
      success: true,
      data: { gelirler, giderler, aylik: aylik.rows },
      ozet: {
        toplam_gelir: toplamGelir,
        toplam_gider: toplamGider,
        net_kar: toplamGelir - toplamGider,
        kar_marji: toplamGelir > 0 ? ((toplamGelir - toplamGider) / toplamGelir * 100).toFixed(1) : '0',
      },
      donem: { bas, bit },
    });
  } catch (err) {
    logger.error('getGelirGider hatası:', err);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ── HESAP PLANI SEED ──────────────────────────────────────────────────────────
export const seedHesapPlani = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    await query(`SELECT insert_default_hesap_plani($1)`, [tenantId]);
    res.json({ success: true, message: 'Standart hesap planı yüklendi' });
  } catch (err) {
    logger.error('seedHesapPlani hatası:', err);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};
