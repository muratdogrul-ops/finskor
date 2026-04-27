import { Request, Response } from 'express';
import { query } from '../config/database';
import logger from '../utils/logger';

export const getCariList = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const r = await query(
      `SELECT id, ad, unvan, vergi_no, tip, telefon, email, aktif, olusturuldu
       FROM cari_hesaplar WHERE tenant_id = $1 AND aktif = true
       ORDER BY ad`,
      [tenantId]
    );
    res.json({ success: true, data: r.rows });
  } catch (e) {
    if ((e as { code?: string }).code === '42P01') {
      res.status(503).json({ success: false, message: 'cari_hesaplar tablosu yok. 004_full_modules.sql uygulayin.' });
      return;
    }
    logger.error('getCariList', e);
    res.status(500).json({ success: false, message: 'Sunucu hatasi' });
  }
};

export const getStokKalemler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const r = await query(
      `SELECT id, kod, ad, birim, aktif FROM stok_kalemleri WHERE tenant_id = $1 AND aktif = true ORDER BY ad`,
      [tenantId]
    );
    res.json({ success: true, data: r.rows });
  } catch (e) {
    if ((e as { code?: string }).code === '42P01') {
      res.status(503).json({ success: false, message: 'stok_kalemleri tablosu yok. 004 migration uygulayin.' });
      return;
    }
    logger.error('getStokKalemler', e);
    res.status(500).json({ success: false, message: 'Sunucu hatasi' });
  }
};

export const getKasaBanka = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const k = await query('SELECT * FROM kasa_hesaplari WHERE tenant_id = $1 AND aktif = true', [tenantId]);
    const b = await query('SELECT * FROM banka_hesaplari WHERE tenant_id = $1 AND aktif = true', [tenantId]);
    res.json({ success: true, data: { kasalar: k.rows, bankalar: b.rows } });
  } catch (e) {
    if ((e as { code?: string }).code === '42P01') {
      res.status(503).json({ success: false, message: 'kasa/banka tablolari yok. 004 migration uygulayin.' });
      return;
    }
    logger.error('getKasaBanka', e);
    res.status(500).json({ success: false, message: 'Sunucu hatasi' });
  }
};
