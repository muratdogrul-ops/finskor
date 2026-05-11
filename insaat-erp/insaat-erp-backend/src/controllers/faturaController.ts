import { Request, Response } from 'express';

export const getFaturaOzet = (_req: Request, res: Response): void => {
  res.json({
    success: true,
    data: { bekleyen: 0, odenen: 0, geciken: 0, toplam_tutar: 0 },
    message: 'fatura özet: yer tutucu',
  });
};

export const getFaturalar = (_req: Request, res: Response): void => {
  res.json({ success: true, data: [], meta: { toplam: 0 }, message: 'faturalar: yer tutucu' });
};

export const getFatura = (_req: Request, res: Response): void => {
  res.status(404).json({ success: false, message: 'Fatura bulunamadı (stub)' });
};

export const createFatura = (_req: Request, res: Response): void => {
  res.status(501).json({ success: false, message: 'Fatura oluşturma henüz bağlanmadı' });
};

export const updateFatura = (_req: Request, res: Response): void => {
  res.status(501).json({ success: false, message: 'Fatura güncelleme henüz bağlanmadı' });
};

export const sendToGib = (_req: Request, res: Response): void => {
  res.status(501).json({ success: false, message: 'GİB gönderim henüz bağlanmadı' });
};

export const odeFatura = (_req: Request, res: Response): void => {
  res.status(501).json({ success: false, message: 'Fatura ödeme henüz bağlanmadı' });
};

export const cancelFatura = (_req: Request, res: Response): void => {
  res.status(501).json({ success: false, message: 'Fatura iptal henüz bağlanmadı' });
};
