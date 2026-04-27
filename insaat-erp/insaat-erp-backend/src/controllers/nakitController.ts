import { Request, Response } from 'express';
import { query } from '../config/database';
import logger from '../utils/logger';
import { genisSantiyeRol, userCanAccessSantiye } from '../utils/santiyeAccess';
import { writeAudit } from '../utils/auditLog';

function nakitHareketWhere(
  tenantId: string,
  yil: string,
  userId: string,
  rol: string,
  santiye_id?: string
): { where: string; params: unknown[] } {
  const params: unknown[] = [tenantId, yil];
  let w = 'WHERE tenant_id = $1 AND EXTRACT(YEAR FROM tarih) = $2::int';
  let idx = 3;
  if (santiye_id) {
    w += ` AND santiye_id = $${idx++}`;
    params.push(santiye_id);
  }
  if (!genisSantiyeRol(rol)) {
    w += ` AND santiye_id IN (SELECT sk.santiye_id FROM santiye_kullanicilar sk WHERE sk.kullanici_id = $${idx++})`;
    params.push(userId);
  }
  return { where: w, params };
}

export const getNakitHareketleri = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId, rol } = req.user!;
    const { santiye_id, baslangic, bitis, tip, kategori, sayfa = '1', limit = '50' } = req.query;
    const offset = (parseInt(sayfa as string, 10) - 1) * parseInt(limit as string, 10);

    let where = 'WHERE nh.tenant_id = $1';
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (santiye_id) { where += ` AND nh.santiye_id = $${idx++}`; params.push(santiye_id); }
    if (baslangic) { where += ` AND nh.tarih >= $${idx++}`; params.push(baslangic); }
    if (bitis) { where += ` AND nh.tarih <= $${idx++}`; params.push(bitis); }
    if (tip) { where += ` AND nh.tip = $${idx++}`; params.push(tip); }
    if (kategori) { where += ` AND nh.kategori = $${idx++}`; params.push(kategori); }

    if (!genisSantiyeRol(rol)) {
      where += ` AND nh.santiye_id IN (SELECT sk.santiye_id FROM santiye_kullanicilar sk WHERE sk.kullanici_id = $${idx++})`;
      params.push(userId);
    }

    const countResult = await query(`SELECT COUNT(*) FROM nakit_hareketleri nh ${where}`, params);
    const limIdx = params.length + 1;
    const result = await query(
      `SELECT nh.*, s.ad as santiye_adi, k.ad || ' ' || k.soyad as kaydeden_adi
       FROM nakit_hareketleri nh
       LEFT JOIN santiyeler s ON s.id = nh.santiye_id
       LEFT JOIN kullanicilar k ON k.id = nh.kaydeden_id
       ${where}
       ORDER BY nh.tarih DESC, nh.olusturuldu DESC
       LIMIT $${limIdx} OFFSET $${limIdx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: { toplam: parseInt(String(countResult.rows[0].count), 10) }
    });
  } catch (error) {
    logger.error('getNakitHareketleri hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const getNakitAnaliz = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId, rol } = req.user!;
    const { yil = new Date().getFullYear().toString(), santiye_id } = req.query;
    const y = String(yil);
    const { where, params: p0 } = nakitHareketWhere(tenantId, y, userId, rol, santiye_id as string | undefined);

    const aylikResult = await query(
      `SELECT
        EXTRACT(MONTH FROM tarih)::int as ay,
        SUM(CASE WHEN tip = 'giris' THEN tutar_try ELSE 0 END) as tahsilat,
        SUM(CASE WHEN tip = 'cikis' THEN tutar_try ELSE 0 END) as gider,
        SUM(CASE WHEN tip = 'giris' THEN tutar_try ELSE -tutar_try END) as net
       FROM nakit_hareketleri
       ${where}
       GROUP BY EXTRACT(MONTH FROM tarih)
       ORDER BY ay`,
      p0
    );

    const ytdResult = await query(
      `SELECT
        SUM(CASE WHEN tip = 'giris' THEN tutar_try ELSE 0 END) as toplam_tahsilat,
        SUM(CASE WHEN tip = 'cikis' THEN tutar_try ELSE 0 END) as toplam_gider,
        SUM(CASE WHEN tip = 'giris' THEN tutar_try ELSE -tutar_try END) as net_nakit
       FROM nakit_hareketleri
       ${where}`,
      p0
    );

    const kategoriResult = await query(
      `SELECT kategori, tip, SUM(tutar_try) as toplam, COUNT(*) as adet
       FROM nakit_hareketleri
       ${where}
       GROUP BY kategori, tip
       ORDER BY toplam DESC`,
      p0
    );

    const santiyeSub = genisSantiyeRol(rol)
      ? ''
      : ` AND s.id IN (SELECT sk.santiye_id FROM santiye_kullanicilar sk WHERE sk.kullanici_id = $3)`;
    const sp = genisSantiyeRol(rol) ? [tenantId, y] : [tenantId, y, userId];
    const santiyeResult = await query(
      `SELECT s.id, s.ad,
        SUM(CASE WHEN nh.tip = 'giris' THEN nh.tutar_try ELSE 0 END) as tahsilat,
        SUM(CASE WHEN nh.tip = 'cikis' THEN nh.tutar_try ELSE 0 END) as gider
       FROM santiyeler s
       LEFT JOIN nakit_hareketleri nh ON nh.santiye_id = s.id
         AND nh.tenant_id = $1 AND EXTRACT(YEAR FROM nh.tarih) = $2::int
       WHERE s.tenant_id = $1 AND s.aktif = true${santiyeSub}
       GROUP BY s.id, s.ad
       ORDER BY tahsilat DESC`,
      sp
    );

    const tahminResult = await query(
      `SELECT
        DATE_TRUNC('month', ay) as ay,
        SUM(CASE WHEN tip = 'giris' THEN tahmini_tutar ELSE 0 END) as tahmini_tahsilat,
        SUM(CASE WHEN tip = 'cikis' THEN tahmini_tutar ELSE 0 END) as tahmini_gider
       FROM nakit_tahminleri
       WHERE tenant_id = $1 AND ay >= DATE_TRUNC('month', NOW())
         AND ay < DATE_TRUNC('month', NOW()) + INTERVAL '6 months'
       GROUP BY DATE_TRUNC('month', ay)
       ORDER BY ay`,
      [tenantId]
    );

    res.json({
      success: true,
      data: {
        aylik: aylikResult.rows,
        ytd: ytdResult.rows[0],
        kategoriler: kategoriResult.rows,
        santiyeler: santiyeResult.rows,
        tahminler: tahminResult.rows,
      }
    });
  } catch (error) {
    logger.error('getNakitAnaliz hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const createNakitHareketi = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId, rol } = req.user!;
    const { santiye_id, tarih, tip, kategori, aciklama, tutar, para_birimi = 'TRY', kur = 1, belge_no, hakedis_id, satinalma_id } = req.body;

    if (santiye_id) {
      if (!(await userCanAccessSantiye({ tenantId, userId, rol }, santiye_id))) {
        res.status(403).json({ success: false, message: 'Bu şantiyeye hareket kaydı ekleyemezsiniz' });
        return;
      }
    } else if (!genisSantiyeRol(rol)) {
      res.status(403).json({ success: false, message: 'Genel (şantiyesiz) nakit sadece yönetim rollerine açık' });
      return;
    }

    const tutar_try = Math.round(Number(tutar) * Number(kur));
    const result = await query(
      `INSERT INTO nakit_hareketleri
        (tenant_id, santiye_id, tarih, tip, kategori, aciklama, tutar, para_birimi, kur, tutar_try, belge_no, hakedis_id, satinalma_id, kaydeden_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [tenantId, santiye_id || null, tarih, tip, kategori, aciklama, tutar, para_birimi, kur, tutar_try, belge_no, hakedis_id, satinalma_id, userId]
    );
    if (req.user) void writeAudit(req.user, 'nakit_hareketleri', 'INSERT', { kayitId: result.rows[0].id, yeniDeger: result.rows[0], req });
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('createNakitHareketi hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};
