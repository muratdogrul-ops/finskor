import { Request, Response } from 'express';
import { query, withTransaction } from '../config/database';
import logger from '../utils/logger';

// ─── STOK LİSTESİ ────────────────────────────────────────────────────────────
export const getStoklar = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { santiye_id, kategori, dusuk_stok } = req.query;

    let where = 'WHERE s.tenant_id = $1 AND s.aktif = true';
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (santiye_id) { where += ` AND s.santiye_id = $${idx++}`; params.push(santiye_id); }
    if (kategori)   { where += ` AND s.kategori = $${idx++}`; params.push(kategori); }
    if (dusuk_stok === 'true') { where += ` AND s.mevcut_miktar <= s.minimum_miktar`; }

    const result = await query(
      `SELECT s.*, sy.ad AS santiye_adi,
              (s.mevcut_miktar * s.birim_maliyet) AS toplam_deger
       FROM stoklar s
       LEFT JOIN santiyeler sy ON sy.id = s.santiye_id
       ${where}
       ORDER BY s.malzeme_adi`,
      params
    );

    const ozet = await query(
      `SELECT
         COUNT(*) AS toplam_kalem,
         COUNT(*) FILTER (WHERE mevcut_miktar <= minimum_miktar AND minimum_miktar > 0) AS kritik_stok,
         COALESCE(SUM(mevcut_miktar * birim_maliyet), 0) AS toplam_stok_degeri
       FROM stoklar WHERE tenant_id = $1 AND aktif = true`,
      [tenantId]
    );

    res.json({ success: true, data: result.rows, ozet: ozet.rows[0] });
  } catch (error) {
    logger.error('getStoklar hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ─── TEK STOK + HAREKETLERİ ───────────────────────────────────────────────────
export const getStok = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const stokRes = await query(
      'SELECT s.*, sy.ad AS santiye_adi FROM stoklar s LEFT JOIN santiyeler sy ON sy.id = s.santiye_id WHERE s.id = $1 AND s.tenant_id = $2',
      [id, tenantId]
    );
    if (!stokRes.rows[0]) { res.status(404).json({ success: false, message: 'Stok bulunamadı' }); return; }

    const hareketRes = await query(
      `SELECT h.*, k.ad || ' ' || k.soyad AS kaydeden_adi
       FROM stok_hareketleri h
       LEFT JOIN kullanicilar k ON k.id = h.kaydeden_id
       WHERE h.stok_id = $1
       ORDER BY h.tarih DESC, h.olusturuldu DESC
       LIMIT 50`,
      [id]
    );

    res.json({ success: true, data: { ...stokRes.rows[0], hareketler: hareketRes.rows } });
  } catch (error) {
    logger.error('getStok hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ─── STOK OLUŞTUR ─────────────────────────────────────────────────────────────
export const createStok = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { malzeme_adi, kategori, birim, minimum_miktar, birim_maliyet, santiye_id, depo_yeri } = req.body;

    if (!malzeme_adi) { res.status(400).json({ success: false, message: 'Malzeme adı zorunlu' }); return; }

    const result = await query(
      `INSERT INTO stoklar
         (tenant_id, santiye_id, malzeme_adi, kategori, birim,
          minimum_miktar, birim_maliyet, depo_yeri)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [tenantId, santiye_id || null, malzeme_adi,
       kategori || 'genel', birim || 'ADET',
       minimum_miktar || 0, birim_maliyet || 0, depo_yeri || null]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('createStok hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ─── STOK HAREKETİ EKLE (giriş / çıkış / fire / sayım) ──────────────────────
export const addStokHareketi = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId } = req.user!;
    const { stok_id, hareket_tipi, miktar, birim_fiyat, aciklama, santiye_id, tarih } = req.body;

    if (!stok_id || !hareket_tipi || !miktar) {
      res.status(400).json({ success: false, message: 'stok_id, hareket_tipi, miktar zorunlu' });
      return;
    }

    const gecerliTipler = ['giris', 'cikis', 'fire', 'transfer', 'sayim'];
    if (!gecerliTipler.includes(hareket_tipi)) {
      res.status(400).json({ success: false, message: 'Geçersiz hareket tipi' });
      return;
    }

    const result = await withTransaction(async (client) => {
      const stokRes = await client.query(
        'SELECT mevcut_miktar FROM stoklar WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
        [stok_id, tenantId]
      );
      if (!stokRes.rows[0]) throw new Error('Stok bulunamadı');

      const onceki = parseFloat(stokRes.rows[0].mevcut_miktar);
      const adet   = parseFloat(String(miktar));

      let sonraki: number;
      if (hareket_tipi === 'giris')   sonraki = onceki + adet;
      else if (hareket_tipi === 'sayim') sonraki = adet;       // sayımda direkt set
      else                             sonraki = Math.max(0, onceki - adet);

      const toplam = (birim_fiyat || 0) * adet;

      await client.query(
        'UPDATE stoklar SET mevcut_miktar = $2, guncellendi = NOW() WHERE id = $1',
        [stok_id, sonraki]
      );

      const h = await client.query(
        `INSERT INTO stok_hareketleri
           (tenant_id, stok_id, santiye_id, hareket_tipi, miktar,
            onceki_miktar, sonraki_miktar, birim_fiyat, toplam_tutar,
            aciklama, kaydeden_id, tarih)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [tenantId, stok_id, santiye_id || null, hareket_tipi, adet,
         onceki, sonraki, birim_fiyat || 0, toplam,
         aciklama || null, userId, tarih || new Date().toISOString().slice(0, 10)]
      );

      return h.rows[0];
    });

    logger.info(`Stok hareketi: ${hareket_tipi} ${miktar} (stok: ${stok_id})`);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    logger.error('addStokHareketi hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ─── STOK GÜNCELLE ───────────────────────────────────────────────────────────
export const updateStok = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;
    const { malzeme_adi, kategori, birim, minimum_miktar, birim_maliyet, depo_yeri } = req.body;

    const result = await query(
      `UPDATE stoklar SET
         malzeme_adi   = COALESCE($3, malzeme_adi),
         kategori      = COALESCE($4, kategori),
         birim         = COALESCE($5, birim),
         minimum_miktar = COALESCE($6, minimum_miktar),
         birim_maliyet = COALESCE($7, birim_maliyet),
         depo_yeri     = COALESCE($8, depo_yeri),
         guncellendi   = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId, malzeme_adi, kategori, birim, minimum_miktar, birim_maliyet, depo_yeri]
    );
    if (!result.rows[0]) { res.status(404).json({ success: false, message: 'Stok bulunamadı' }); return; }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('updateStok hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ─── STOK HAREKETLERİ RAPORU ─────────────────────────────────────────────────
export const getStokHareketleri = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { santiye_id, tip, tarih_bas, tarih_bit, sayfa = '1', limit = '30' } = req.query;
    const offset = (parseInt(sayfa as string) - 1) * parseInt(limit as string);

    let where = 'WHERE h.tenant_id = $1';
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (santiye_id)  { where += ` AND h.santiye_id = $${idx++}`; params.push(santiye_id); }
    if (tip)         { where += ` AND h.hareket_tipi = $${idx++}`; params.push(tip); }
    if (tarih_bas)   { where += ` AND h.tarih >= $${idx++}`; params.push(tarih_bas); }
    if (tarih_bit)   { where += ` AND h.tarih <= $${idx++}`; params.push(tarih_bit); }

    const result = await query(
      `SELECT h.*, s.malzeme_adi, s.birim, k.ad || ' ' || k.soyad AS kaydeden_adi
       FROM stok_hareketleri h
       JOIN stoklar s ON s.id = h.stok_id
       LEFT JOIN kullanicilar k ON k.id = h.kaydeden_id
       ${where}
       ORDER BY h.tarih DESC, h.olusturuldu DESC
       LIMIT $${idx} OFFSET $${idx+1}`,
      [...params, limit, offset]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('getStokHareketleri hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};
