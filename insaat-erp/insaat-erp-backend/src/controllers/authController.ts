import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { query } from '../config/database';
import logger from '../utils/logger';
import type { JwtPayload } from '../middleware/auth';

/**
 * Giriş: { email, sifre } veya { email, password }
 * kullanicilar.sifre_hash sütunu (bcrypt) beklenir.
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, sifre, password } = req.body as { email?: string; sifre?: string; password?: string };
    const pwd = sifre ?? password;
    if (!email || !pwd) {
      res.status(400).json({ success: false, message: 'email ve sifre gerekli' });
      return;
    }

    const u = await query(
      `SELECT k.id, k.email, k.rol, k.tenant_id, k.aktif, k.sifre_hash
       FROM kullanicilar k
       WHERE LOWER(TRIM(k.email)) = LOWER(TRIM($1))`,
      [String(email).trim()]
    );
    const row = u.rows[0] as {
      id: string;
      email: string;
      rol: string;
      tenant_id: string;
      aktif: boolean;
      sifre_hash: string | null;
    } | undefined;
    if (!row || !row.aktif) {
      res.status(401).json({ success: false, message: 'Geçersiz e-posta veya şifre' });
      return;
    }
    if (!row.sifre_hash) {
      res.status(503).json({ success: false, message: 'Hesap şifre alanı tanımsız. Yöneticiye başvurun.' });
      return;
    }
    const ok = await bcrypt.compare(String(pwd), row.sifre_hash);
    if (!ok) {
      res.status(401).json({ success: false, message: 'Geçersiz e-posta veya şifre' });
      return;
    }

    const t = await query('SELECT id, aktif FROM tenants WHERE id = $1', [row.tenant_id]);
    if (!t.rows[0] || !t.rows[0].aktif) {
      res.status(403).json({ success: false, message: 'Firma hesabı askıda' });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({ success: false, message: 'Sunucu yapılandırması eksik (JWT_SECRET)' });
      return;
    }

    const payload: JwtPayload = {
      userId: row.id,
      tenantId: row.tenant_id,
      rol: row.rol,
      email: row.email,
    };
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    const token = jwt.sign(payload, secret, { expiresIn } as SignOptions);

    res.json({
      success: true,
      data: {
        token,
        user: { id: row.id, email: row.email, rol: row.rol, tenantId: row.tenant_id },
      },
    });
  } catch (e) {
    logger.error('login', e);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};
