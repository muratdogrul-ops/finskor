import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

import logger from './utils/logger';
import { checkDbConnection } from './config/database';
import router from './routes/index';
import { setSocketIO } from './controllers/mesajController';
import { runMigrations } from './utils/migration';
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

/** Sağlık: middleware zincirinden önce — proxy/trailing-slash yönlendirme döngüsü riski yok */
const healthHandler = async (_req: express.Request, res: express.Response): Promise<void> => {
  const dbOk = await checkDbConnection();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    surum: API_SEMA,
    uygulama: 'insaat-erp-backend',
    db: dbOk ? 'connected' : 'error',
  });
};
app.get(['/health', '/health/', '/ready', '/ready/'], healthHandler);

/** Docker / yerel: repo dist → web_dist (aynı portta erp-web.html; index kapalı ki GET / API kalsın) */
const webDistPath = path.join(process.cwd(), 'web_dist');
if (fs.existsSync(webDistPath)) {
  app.use(express.static(webDistPath, { index: false }));
  logger.info(`Statik web_dist: ${webDistPath} (ornek: /erp-web.html)`);
} else {
  logger.warn(`web_dist yok (${webDistPath}) — dist baglanti veya klasor olusturun`);
}

/** React ERP (Vite build: npm run build:docker) → http://127.0.0.1:3000/app/ */
const webErpPath = path.join(process.cwd(), 'web_erp');
if (fs.existsSync(webErpPath) && fs.existsSync(path.join(webErpPath, 'index.html'))) {
  app.use(
    '/app',
    express.static(webErpPath, {
      index: 'index.html',
      fallthrough: true,
    } as Parameters<typeof express.static>[1]),
  );
  app.use('/app', (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    res.sendFile(path.join(webErpPath, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
  logger.info(`Statik web_erp: ${webErpPath} → /app/`);
}

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

// Kök: tarayıcıda sekme açılınca (Sec-Fetch-Dest: document) HTML bilgi; aksi halde JSON (izleme/curl)
const ERP_WEB_PUBLIC = (process.env.PUBLIC_ERP_WEB_URL || 'https://finskor.tr').replace(/\/+$/, '');

app.get('/', (req, res) => {
  const tarayiciSekmesi = req.get('Sec-Fetch-Dest') === 'document';
  if (tarayiciSekmesi) {
    const host = req.get('host') || '127.0.0.1:3000';
    const proto =
      req.secure || String(req.get('x-forwarded-proto') || '').split(',')[0].trim() === 'https'
        ? 'https'
        : 'http';
    const yerelAyniPort = `${proto}://${host}/erp-web.html`;
    const tamErpUrl = `${proto}://${host}/app/`;
    const erpHazir = fs.existsSync(path.join(webDistPath, 'erp-web.html'));
    const tamErpHazir = fs.existsSync(path.join(webErpPath, 'index.html'));
    const tamErpLi = tamErpHazir
      ? `<li><strong>Tam ERP (sol menü, modüller):</strong> <a href="${tamErpUrl}">${tamErpUrl}</a></li>`
      : `<li><strong>Tam ERP:</strong> <code>cd insaat-erp\\insaat-erp-frontend</code> → <code>npm install</code> → <code>npm run build:docker</code> → <code>docker compose up --build -d</code> (ust klasorde)</li>`;
    const yerelSatir = erpHazir
      ? `<li><strong>Yerel (bu makine, API ile aynı port):</strong> <a href="${yerelAyniPort}">${yerelAyniPort}</a> — kisa HTML test; asil arayuz yukaridaki <strong>/app/</strong></li>`
      : `<li><strong>Yerel HTML:</strong> Once repo kokunde <code>npm run build</code>, sonra API konteynerini yeniden baslatin. Sonra <a href="${yerelAyniPort}">${yerelAyniPort}</a> dene.</li><li><strong>Alternatif:</strong> <code>npx serve dist -l 8888</code> → <code>http://127.0.0.1:8888/erp-web.html</code></li>`;
    res.type('html').send(`<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>İnşaat ERP — API</title>
<style>body{font-family:system-ui,sans-serif;max-width:36rem;margin:2rem auto;padding:0 1rem;line-height:1.5;color:#1e293b}
code{background:#f1f5f9;padding:0.15rem 0.35rem;border-radius:4px;font-size:0.9em}
a{color:#4f46e5;font-weight:600}</style></head><body>
<h1>Bu adres API sunucusudur</h1>
<p><strong>Asil program</strong> React arayüzüdür (<code>/app/</code>). <code>erp-web.html</code> sadece hafif test sayfasıdır.</p>
<ul>
  ${tamErpLi}
  ${yerelSatir}
  <li><strong>Canlı (internet):</strong> <a href="${ERP_WEB_PUBLIC}/erp-web.html">${ERP_WEB_PUBLIC}/erp-web.html</a> — baglanmazsa ag / VPN / site kontrolu</li>
</ul>
<p>API: <a href="/meta">/meta</a> · <a href="/health">/health</a> · <code>POST /api/v1/auth/login</code> — Girişte API kökü: <code>${proto}://${host}</code></p>
<p style="font-size:0.9rem;color:#64748b">Sürüm ${API_SEMA}</p>
</body></html>`);
    return;
  }
  const erpHtmlHazir = fs.existsSync(path.join(webDistPath, 'erp-web.html'));
  const erpReactHazir = fs.existsSync(path.join(webErpPath, 'index.html'));
  res.json({
    success: true,
    service: 'Insaat ERP API',
    surum: API_SEMA,
    message: 'REST: /api/v1. Sağlık: GET /health. Tarayıcıda kök açtıysanız HTML bilgi sayfası görünür; curl/izleme için JSON.',
    endpoints: {
      health: '/health',
      ready: '/ready',
      v1: '/api/v1',
      meta: '/meta',
      erpReact: '/app/',
      erpWebYerel: '/erp-web.html',
      erpWebCanliOrnek: `${ERP_WEB_PUBLIC}/erp-web.html`,
    },
    webDist: { path: webDistPath, erpWebHtmlHazir: erpHtmlHazir },
    webErp: { path: webErpPath, indexHazir: erpReactHazir },
  });
});

/** Hangi API süreci çalışıyor testi: tarayıcıda açın */
app.get('/meta', (_req, res) => {
  const erpHtmlHazir = fs.existsSync(path.join(webDistPath, 'erp-web.html'));
  const erpReactHazir = fs.existsSync(path.join(webErpPath, 'index.html'));
  res.json({
    uygulama: 'insaat-erp-backend',
    surum: API_SEMA,
    zaman: new Date().toISOString(),
    uclar: {
      health: '/health',
      ready: '/ready',
      apiV1: '/api/v1',
      login: 'POST /api/v1/auth/login',
      erpWebHtml: '/erp-web.html',
      erpReact: '/app/',
    },
    webDist: { path: webDistPath, erpWebHtmlHazir: erpHtmlHazir },
    webErp: { path: webErpPath, indexHazir: erpReactHazir },
    erpWebCanliOrnek: `${ERP_WEB_PUBLIC}/erp-web.html`,
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

// /api/v1/ için 301 kullanma (bazı proxy’lerde yönlendirme zinciri oluşabiliyor)
app.get('/api/v1/', (_req, res) => {
  res.json({
    success: true,
    service: 'API v1',
    ornek: 'POST /api/v1/auth/login',
  });
});

app.use('/api/v1', router);

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

  await runMigrations();

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
