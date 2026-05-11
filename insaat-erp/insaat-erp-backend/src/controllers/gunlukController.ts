import { Request, Response } from 'express';

export const getGunlukler = (_req: Request, res: Response): void => {
  res.json({ success: true, data: [], message: 'günlükler: yer tutucu' });
};

export const createGunluk = (_req: Request, res: Response): void => {
  res.status(501).json({ success: false, message: 'Günlük oluşturma henüz bağlanmadı' });
};

export const getGunluk = (_req: Request, res: Response): void => {
  res.status(404).json({ success: false, message: 'Günlük bulunamadı (stub)' });
};

export const deleteGunluk = (_req: Request, res: Response): void => {
  res.status(501).json({ success: false, message: 'Günlük silme henüz bağlanmadı' });
};
