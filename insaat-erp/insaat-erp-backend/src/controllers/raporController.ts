import { Request, Response } from 'express';

/** Müşteri raporu — stub; PDF/HTML üretimi sonra eklenebilir */
export const getMusteriRaporu = (_req: Request, res: Response): void => {
  res.json({
    success: true,
    data: { baslik: 'Rapor (yer tutucu)', icerik: null, not: 'raporController stub' },
  });
};
