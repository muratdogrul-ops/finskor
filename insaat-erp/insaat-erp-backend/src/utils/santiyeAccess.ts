import { query } from '../config/database';
import type { JwtPayload } from '../middleware/auth';

const BROAD_SANTEYE_ROLLERI = new Set(['superadmin', 'admin', 'mudur', 'muhasebe', 'satin_alma']);

export function genisSantiyeRol(rol: string): boolean {
  return BROAD_SANTEYE_ROLLERI.has(rol);
}

export async function userCanAccessSantiye(
  u: Pick<JwtPayload, 'tenantId' | 'userId' | 'rol'>,
  santiyeId: string
): Promise<boolean> {
  if (!santiyeId) return false;
  const t = await query(
    'SELECT 1 AS ok FROM santiyeler WHERE id = $1 AND tenant_id = $2 AND aktif = true',
    [santiyeId, u.tenantId]
  );
  if (!t.rows[0]) return false;
  if (genisSantiyeRol(u.rol)) return true;
  const sk = await query(
    'SELECT 1 FROM santiye_kullanicilar WHERE santiye_id = $1 AND kullanici_id = $2',
    [santiyeId, u.userId]
  );
  return !!sk.rows[0];
}

export function santiyeKapsamSql(
  rol: string,
  userId: string,
  santiyeKolon: string,
  idx: number
): { sql: string; param: string; nextIdx: number } {
  if (genisSantiyeRol(rol)) {
    return { sql: '', param: '', nextIdx: idx };
  }
  return {
    sql: ` AND ${santiyeKolon} IN (SELECT sk.santiye_id FROM santiye_kullanicilar sk WHERE sk.kullanici_id = $${idx})`,
    param: userId,
    nextIdx: idx + 1,
  };
}
