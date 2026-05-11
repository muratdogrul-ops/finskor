import { Request, Response } from 'express';

export const getGunlukFotograflar = (_req: Request, res: Response): void => {
  res.json({ success: true, data: [], message: 'günlük fotoğrafları: yer tutucu' });
};

export const uploadGunlukFotograflar = (_req: Request, res: Response): void => {
  res.status(501).json({ success: false, message: 'Fotoğraf yükleme henüz bağlanmadı' });
};

export const getFotograflar = (_req: Request, res: Response): void => {
  res.json({ success: true, data: [], message: 'fotoğraflar: yer tutucu' });
};

export const uploadFotograflar = (_req: Request, res: Response): void => {
  res.status(501).json({ success: false, message: 'Şantiye fotoğraf yükleme henüz bağlanmadı' });
};

export const deleteFotograf = (_req: Request, res: Response): void => {
  res.status(501).json({ success: false, message: 'Fotoğraf silme henüz bağlanmadı' });
};
