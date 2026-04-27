import { Request, Response } from 'express';
import { Server as SocketServer } from 'socket.io';
import { query } from '../config/database';
import logger from '../utils/logger';
import path from 'path';
import { genisSantiyeRol, userCanAccessSantiye } from '../utils/santiyeAccess';

let io: SocketServer;
export const setSocketIO = (socketIO: SocketServer) => { io = socketIO; };

export const getMesajlar = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId, rol } = req.user!;
    const { santiyeId } = req.params;
    if (!(await userCanAccessSantiye({ tenantId, userId, rol: rol! }, santiyeId))) {
      res.status(403).json({ success: false, message: 'Bu şantiye mesajlarına erişim yok' });
      return;
    }
    const { sayfa = '1', limit = '50' } = req.query;
    const offset = (parseInt(sayfa as string, 10) - 1) * parseInt(limit as string, 10);

    const result = await query(
      `SELECT m.*,
        k.ad || ' ' || k.soyad as gonderen_adi,
        k.avatar_url as gonderen_avatar,
        k.rol as gonderen_rol,
        EXISTS(SELECT 1 FROM mesaj_okunmalar mo WHERE mo.mesaj_id = m.id AND mo.kullanici_id = $3) as okundu
       FROM mesajlar m
       JOIN kullanicilar k ON k.id = m.gonderen_id
       WHERE m.santiye_id = $1 AND m.tenant_id = $2 AND m.silinmis = false
       ORDER BY m.olusturuldu DESC
       LIMIT $4 OFFSET $5`,
      [santiyeId, tenantId, userId, limit, offset]
    );

    const okunmamisIds = result.rows.filter(m => !m.okundu).map(m => m.id);
    if (okunmamisIds.length > 0) {
      await query(
        `INSERT INTO mesaj_okunmalar (mesaj_id, kullanici_id)
         SELECT unnest($1::uuid[]), $2
         ON CONFLICT DO NOTHING`,
        [okunmamisIds, userId]
      );
    }

    res.json({ success: true, data: result.rows.reverse() });
  } catch (error) {
    logger.error('getMesajlar hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const sendMesaj = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId, rol } = req.user!;
    const { santiyeId } = req.params;
    if (!(await userCanAccessSantiye({ tenantId, userId, rol: rol! }, santiyeId))) {
      res.status(403).json({ success: false, message: 'Mesaj gondermek icin yetki yok' });
      return;
    }
    const { mesaj } = req.body;
    const dosya = req.file;
    if (!mesaj && !dosya) {
      res.status(400).json({ success: false, message: 'Mesaj veya dosya gerekli' });
      return;
    }
    let dosyaUrl: string | null = null;
    let dosyaTip: string | null = null;
    if (dosya) {
      dosyaUrl = `/uploads/mesajlar/${dosya.filename}`;
      dosyaTip = dosya.mimetype.startsWith('image/') ? 'fotograf' : 'belge';
    }
    const result = await query(
      `INSERT INTO mesajlar (tenant_id, santiye_id, gonderen_id, mesaj, dosya_url, dosya_tip)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tenantId, santiyeId, userId, mesaj || null, dosyaUrl, dosyaTip]
    );
    const kullaniciResult = await query(
      'SELECT ad, soyad, avatar_url, rol FROM kullanicilar WHERE id = $1',
      [userId]
    );
    const yeniMesaj = {
      ...result.rows[0],
      gonderen_adi: `${kullaniciResult.rows[0].ad} ${kullaniciResult.rows[0].soyad}`,
      gonderen_avatar: kullaniciResult.rows[0].avatar_url,
      gonderen_rol: kullaniciResult.rows[0].rol,
      okundu: true,
    };
    if (io) io.to(`santiye:${santiyeId}`).emit('yeni_mesaj', yeniMesaj);
    res.status(201).json({ success: true, data: yeniMesaj });
  } catch (error) {
    logger.error('sendMesaj hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const getOkunmamisSayisi = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId, rol } = req.user!;
    const scopeNarrow = !genisSantiyeRol(rol!);
    const result = await query(
      `SELECT m.santiye_id, COUNT(*) as okunmamis
       FROM mesajlar m
       WHERE m.tenant_id = $1
         AND m.silinmis = false
         AND m.gonderen_id != $2
         ${scopeNarrow
        ? 'AND m.santiye_id IN (SELECT sk.santiye_id FROM santiye_kullanicilar sk WHERE sk.kullanici_id = $3)'
        : ''}
         AND NOT EXISTS (SELECT 1 FROM mesaj_okunmalar mo WHERE mo.mesaj_id = m.id AND mo.kullanici_id = $2)
       GROUP BY m.santiye_id`,
      scopeNarrow ? [tenantId, userId, userId] : [tenantId, userId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('getOkunmamisSayisi hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};
