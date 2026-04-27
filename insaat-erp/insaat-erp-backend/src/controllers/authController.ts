import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { query } from '../config/database';
import logger from '../utils/logger';
import type { JwtPayload } from '../middleware/auth';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, sifre, password } = req.body as { email?: string; sifre?: string; password?: string };
    const pwd = sifre ?? password;
    if (!email || !pwd) {
      res.status(400).json({ success: false, message: 'email ve sifre gerekli' });
      return;
    }

    // Kullanıcıyı çek
    const uResult = await query(
      `SELECT k.id, k.email, k.ad, k.soyad, k.rol, k.tenant_id, k.aktif, k.sifre_hash, k.avatar_url
       FROM kullanicilar k
       WHERE LOWER(TRIM(k.email)) = LOWER(TRIM($1))`,
      [String(email).trim()]
    );
    const row = uResult.rows[0] as {
      id: string; email: string; ad: string; soyad: string;
      rol: string; tenant_id: string; aktif: boolean;
      sifre_hash: string | null; avatar_url: string | null;
    } | undefined;

    if (!row || !row.aktif) {
      res.status(401).json({ success: false, message: 'Geçersiz e-posta veya şifre' });
      return;
    }
    if (!row.sifre_hash) {
      res.status(503).json({ success: false, message: 'Hesap şifre tanımsız. Yöneticiye başvurun.' });
      return;
    }
    const ok = await bcrypt.compare(String(pwd), row.sifre_hash);
    if (!ok) {
      res.status(401).json({ success: false, message: 'Geçersiz e-posta veya şifre' });
      return;
    }

    // Tenant bilgisi
    const tResult = await query(
      'SELECT id, ad, logo_url, plan, max_santiye, aktif FROM tenants WHERE id = $1',
      [row.tenant_id]
    );
    const tenant = tResult.rows[0] as {
      id: string; ad: string; logo_url: string | null;
      plan: string; max_santiye: number; aktif: boolean;
    } | undefined;

    if (!tenant || !tenant.aktif) {
      res.status(403).json({ success: false, message: 'Firma hesabı askıda' });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({ success: false, message: 'JWT_SECRET eksik' });
      return;
    }

    const payload: JwtPayload = {
      userId: row.id,
      tenantId: row.tenant_id,
      rol: row.rol,
      email: row.email,
    };
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    const accessToken = jwt.sign(payload, secret, { expiresIn } as SignOptions);

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken: accessToken, // aynı token kullanılır (refresh mekanizması eklenince değişir)
        kullanici: {
          id: row.id,
          ad: row.ad,
          soyad: row.soyad,
          email: row.email,
          rol: row.rol,
          avatar_url: row.avatar_url,
          tenant_id: row.tenant_id,
          tenantId: row.tenant_id,
          tenant_ad: tenant.ad,
          tenant_logo: tenant.logo_url,
          plan: tenant.plan,
          max_santiye: tenant.max_santiye,
        },
      },
    });
  } catch (e) {
    logger.error('login hatası:', e);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};
