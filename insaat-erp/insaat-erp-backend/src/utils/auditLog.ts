import { query } from '../config/database';
import type { Request } from 'express';
import type { JwtPayload } from '../middleware/auth';
import logger from './logger';

export async function writeAudit(
  user: JwtPayload | undefined,
  tablo: string,
  islem: 'INSERT' | 'UPDATE' | 'DELETE',
  options: { kayitId?: string; yeniDeger?: unknown; eskiDeger?: unknown; req?: Request }
): Promise<void> {
  try {
    if (!user?.tenantId) return;
    const ip = options.req?.ip;
    const ua = options.req?.get?.('user-agent') ?? null;
    await query(
      `INSERT INTO audit_log (tenant_id, kullanici_id, tablo, kayit_id, islem, eski_deger, yeni_deger, ip_adresi, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::inet, $9)`,
      [
        user.tenantId,
        user.userId,
        tablo,
        options.kayitId ?? null,
        islem,
        options.eskiDeger ?? null,
        options.yeniDeger ?? null,
        typeof ip === 'string' && ip.length > 0 ? ip : null,
        ua,
      ]
    );
  } catch (e) {
    logger.warn('audit_log yazilamadi', e);
  }
}
