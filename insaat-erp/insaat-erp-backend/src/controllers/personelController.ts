import { Request, Response } from 'express';

const emptyList = (_req: Request, res: Response): void => {
  res.json({ success: true, data: [], meta: { toplam: 0 }, message: 'personel: yer tutucu' });
};

export const getPersoneller = emptyList;
export const getPersonel = (_req: Request, res: Response): void => {
  res.status(404).json({ success: false, message: 'Personel bulunamadı (stub)' });
};
export const createPersonel = (_req: Request, res: Response): void => {
  res.status(501).json({ success: false, message: 'Personel oluşturma henüz bağlanmadı' });
};
export const updatePersonel = (_req: Request, res: Response): void => {
  res.status(501).json({ success: false, message: 'Personel güncelleme henüz bağlanmadı' });
};
export const addPuantaj = (_req: Request, res: Response): void => {
  res.status(501).json({ success: false, message: 'Puantaj henüz bağlanmadı' });
};
export const getPuantajRapor = (_req: Request, res: Response): void => {
  res.json({ success: true, data: [], message: 'puantaj rapor: yer tutucu' });
};
