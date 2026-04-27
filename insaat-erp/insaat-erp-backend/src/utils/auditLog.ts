import { query } from '../config/database';
import type { Request } from 'express';
import type { JwtPayload } from '../middleware/auth';
import logger from './logger';

interface LogAuditOpts {
  userId?: string;
  tenantId?: string;
  islem?: string;
  tablo?: string;
  kayitId?: string;
  yeniDeger?: unknown;
  eskiDeger?: unknown;
}

/** logAudit — controller'larla uyumlu nesne imzası */
export async function logAudit(opts: LogAuditOpts): Promise<void> {
  try {
    if (!opts.tenantId) return;
    await query(
      `INSERT INTO audit_log (tenant_id, kullanici_id, tablo, kayit_id, islem, eski_deger, yeni_deger)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        opts.tenantId,
        opts.userId ?? null,
        opts.tablo ?? null,
        opts.kayitId ?? null,
        opts.islem ?? 'INSERT',
        opts.eskiDeger ?? null,
        opts.yeniDeger ?? null,
      ]
    );
  } catch (e) {
    logger.warn('logAudit yazilamadi', e);
  }
}

/**
 * verifySantiyeTenant — şantiyenin tenant'a ait olduğunu doğrular.
 * Geçerliyse true, geçersizse false döner.
 */
export async function verifySantiyeTenant(
  santiyeId: string,
  tenantId: string
): Promise<boolean> {
  try {
    const result = await query(
      'SELECT id FROM santiyeler WHERE id = $1 AND tenant_id = $2',
      [santiyeId, tenantId]
    );
    return result.rows.length > 0;
  } catch (e) {
    logger.warn('verifySantiyeTenant hatası', e);
    return false;
  }
}

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
