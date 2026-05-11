import { Request, Response } from 'express';

/** Geçici stub — modül tamamlanınca gerçek implementasyon eklenecek */
const empty = (_req: Request, res: Response): void => {
  res.json({ success: true, data: [], message: 'ekipman: yer tutucu' });
};

export const getEkipmanlar = empty;
export const getEkipman = (_req: Request, res: Response): void => {
  res.status(404).json({ success: false, message: 'Ekipman bulunamadı (stub)' });
};
export const createEkipman = (_req: Request, res: Response): void => {
  res.status(501).json({ success: false, message: 'Ekipman oluşturma henüz bağlanmadı' });
};
export const updateEkipman = (_req: Request, res: Response): void => {
  res.status(501).json({ success: false, message: 'Ekipman güncelleme henüz bağlanmadı' });
};
export const addBakim = (_req: Request, res: Response): void => {
  res.status(501).json({ success: false, message: 'Bakım kaydı henüz bağlanmadı' });
};
