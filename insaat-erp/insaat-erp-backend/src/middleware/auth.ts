import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import logger from '../utils/logger';
import { userCanAccessSantiye } from '../utils/santiyeAccess';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  rol: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Yetkilendirme token\'ı bulunamadı' });
      return;
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET tanımlanmamış');

    const decoded = jwt.verify(token, secret) as JwtPayload;

    const result = await query(
      'SELECT id, aktif, tenant_id FROM kullanicilar WHERE id = $1',
      [decoded.userId]
    );

    if (!result.rows[0] || !result.rows[0].aktif) {
      res.status(401).json({ success: false, message: 'Hesap aktif değil' });
      return;
    }

    const tenantResult = await query(
      'SELECT id, aktif FROM tenants WHERE id = $1',
      [decoded.tenantId]
    );

    if (!tenantResult.rows[0] || !tenantResult.rows[0].aktif) {
      res.status(403).json({ success: false, message: 'Firma hesabı askıya alınmış' });
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, message: 'Token süresi dolmuş', code: 'TOKEN_EXPIRED' });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ success: false, message: 'Geçersiz token' });
      return;
    }
    logger.error('Auth middleware hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Giriş yapılmamış' });
      return;
    }
    if (!roles.includes(req.user.rol)) {
      res.status(403).json({
        success: false,
        message: `Bu işlem için yetkiniz yok. Gerekli rol: ${roles.join(' veya ')}`
      });
      return;
    }
    next();
  };
};

/**
 * :santiyeId veya (once json parse sonrasi) body.santiye_id ile: once tenant+aktif santi, sonra dar rolde atama.
 */
export const requireSantiyeAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Giriş yapılmamış' });
      return;
    }

    const santiyeId = req.params.santiyeId || (req.body && req.body.santiye_id);
    if (!santiyeId || typeof santiyeId !== 'string') {
      next();
      return;
    }

    const ok = await userCanAccessSantiye(req.user, santiyeId);
    if (!ok) {
      res.status(403).json({ success: false, message: 'Bu şantiyeye erişim yetkiniz yok' });
      return;
    }
    next();
  } catch (error) {
    logger.error('Şantiye erişim kontrolü hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};
