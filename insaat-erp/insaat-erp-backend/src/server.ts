import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

import logger from './utils/logger';
import { checkDbConnection } from './config/database';
import router from './routes/index';
import { setSocketIO } from './controllers/mesajController';
import jwt from 'jsonwebtoken';
import { JwtPayload } from './middleware/auth';
import { userCanAccessSantiye } from './utils/santiyeAccess';

/** Yeni 404/health; sadece 2 alan görüyorsanız eski dist veya farklı süreç. */
const API_SEMA = '2';

const app = express();
const httpServer = createServer(app);

function corsOriginsList(): string[] {
  const fromEnv = process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean);
  return fromEnv && fromEnv.length > 0
    ? fromEnv
    : [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost',
      ];
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (origin == null || origin === '' || origin === 'null' || origin === 'file://') {
    return true;
  }
  return corsOriginsList().includes(origin);
}

const io = new SocketServer(httpServer, {
  cors: {
    origin: (o, c) => c(null, isAllowedOrigin(o) ? o || true : false),
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

setSocketIO(io);

if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET zorunlu. Ornek: .env dosyasini doldurun.');
}

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Yetkilendirme gerekli'));
  const secret = process.env.JWT_SECRET;
  if (!secret) return next(new Error('Sunucu yapilandirmasi eksik'));
  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    (socket as unknown as { user: JwtPayload }).user = decoded;
    next();
  } catch {
    next(new Error('Geçersiz token'));
  }
});

io.on('connection', (socket) => {
  const user = (socket as unknown as { user: JwtPayload }).user;
  logger.info(`Socket bağlandı: ${user.email}`);

  socket.on('santiye_katil', async (santiyeId: string) => {
    if (!santiyeId || typeof santiyeId !== 'string') return;
    try {
      const ok = await userCanAccessSantiye(user, santiyeId);
      if (!ok) {
        socket.emit('santiye_erisim', { success: false, message: 'Bu şantiye odasına erişim yok' });
        return;
      }
      await socket.join(`santiye:${santiyeId}`);
      logger.debug(`${user.email} -> santiye:${santiyeId}`);
    } catch (e) {
      logger.error('santiye_katil hatasi', e);
      socket.emit('santiye_erisim', { success: false, message: 'Kontrol basarisiz' });
    }
  });

  socket.on('santiye_ayril', (santiyeId: string) => {
    if (santiyeId) socket.leave(`santiye:${santiyeId}`);
  });

  socket.on('yaziyor', async (data: { santiyeId: string }) => {
    if (!data?.santiyeId) return;
    const ok = await userCanAccessSantiye(user, data.santiyeId);
    if (!ok) return;
    socket.to(`santiye:${data.santiyeId}`).emit('kullanici_yaziyor', {
      userId: user.userId,
      ad: user.email,
    });
  });

  socket.on('disconnect', () => {
    logger.debug(`Socket ayrıldı: ${user.email}`);
  });
});

app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: (origin, callback) => {
    callback(null, isAllowedOrigin(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(compression());

app.use(morgan('combined', {
  stream: { write: (message) => logger.http(message.trim()) }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  message: { success: false, message: 'Çok fazla istek. Lütfen bekleyin.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Çok fazla giriş denemesi.' },
});
app.use('/api/v1/auth/login', authLimiter);

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Kısayol (http://127.0.0.1:3000) ve yarım yollar: router'dan önce, yoksa 404
app.get('/', (_req, res) => {
  res.json({
    success: true,
    service: 'Insaat ERP API',
    surum: API_SEMA,
    message: 'REST: /api/v1. Sağlık: GET /health. Masaüstü uygulama API ayrı çalışır; burası sadece sunucu.',
    endpoints: { health: '/health', v1: '/api/v1', meta: '/meta' },
  });
});

/** Hangi API süreci çalışıyor testi: tarayıcıda açın */
app.get('/meta', (_req, res) => {
  res.json({
    uygulama: 'insaat-erp-backend',
    surum: API_SEMA,
    zaman: new Date().toISOString(),
    uclar: { health: '/health', apiV1: '/api/v1', login: 'POST /api/v1/auth/login' },
  });
});

app.get('/api', (_req, res) => {
  res.redirect(301, '/api/v1');
});

app.get('/api/v1', (_req, res) => {
  res.json({
    success: true,
    service: 'API v1',
    ornek: 'POST /api/v1/auth/login',
  });
});

// Sondaki / ile gelen (tarayıcı / proxy) 404 olmasın
app.get(['/api/v1/', '/health/'], (req, res) => {
  const p = req.path.replace(/\/+$/, '') || '/';
  res.redirect(301, p);
});

app.use('/api/v1', router);

app.get('/health', async (_req, res) => {
  const dbOk = await checkDbConnection();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    surum: API_SEMA,
    uygulama: 'insaat-erp-backend',
    db: dbOk ? 'connected' : 'error',
  });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Sunucu hatası' : err.message,
  });
});

app.use((req, res) => {
  if (req.method === 'GET' && req.path === '/favicon.ico') {
    res.status(204).end();
    return;
  }
  res.status(404).json({
    success: false,
    kod: 'ROTA_YOK',
    sunucu: 'insaat-erp-backend',
    surum: API_SEMA,
    // Eski sürümlerde sadece "Endpoint bulunamadı" kalıyordu; yol bu metin içinde de var.
    message: `Bu yol tanımlı değil: ${req.method} ${req.originalUrl} — dene: GET /meta, GET /health, GET /, POST /api/v1/auth/login`,
    method: req.method,
    path: req.path,
    url: req.originalUrl,
  });
});

const PORT = parseInt(process.env.PORT || '3000', 10);

const start = async () => {
  const dbOk = await checkDbConnection();
  if (!dbOk) {
    logger.error('Veritabanına bağlanılamadı. Sunucu başlatılamıyor.');
    process.exit(1);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info(
      `InsaatERP | surum=${API_SEMA} | Port=${PORT} | Deneme: GET http://127.0.0.1:${PORT}/meta | NODE_ENV=${process.env.NODE_ENV || 'dev'}`
    );
  });
};

start();

process.on('SIGTERM', () => {
  logger.info('SIGTERM alındı. Sunucu kapatılıyor...');
  httpServer.close(() => process.exit(0));
});

export default app;
