/**
 * Admin Paneli — Audit Log, Yedekleme ve Kullanıcı Yönetimi
 */
import { Request, Response } from 'express';
import { query } from '../config/database';
import logger from '../utils/logger';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

// ─── AUDIT LOG ────────────────────────────────────────────────────────────────
export const getAuditLog = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const {
      sayfa = '1', limit = '50',
      islem, tablo, kullanici_id,
      baslangic, bitis,
    } = req.query as Record<string, string>;

    const offset = (parseInt(sayfa) - 1) * parseInt(limit);
    const params: unknown[] = [tenantId];
    let idx = 2;
    let where = 'WHERE a.tenant_id = $1';

    if (islem)        { where += ` AND a.islem = $${idx++}`;         params.push(islem); }
    if (tablo)        { where += ` AND a.tablo = $${idx++}`;          params.push(tablo); }
    if (kullanici_id) { where += ` AND a.kullanici_id = $${idx++}`;   params.push(kullanici_id); }
    if (baslangic)    { where += ` AND a.olusturuldu >= $${idx++}`;   params.push(baslangic); }
    if (bitis)        { where += ` AND a.olusturuldu <= $${idx++}`;   params.push(bitis); }

    const [rows, countRes] = await Promise.all([
      query(
        `SELECT a.id, a.tablo, a.islem, a.kayit_id,
                a.eski_deger, a.yeni_deger, a.ip_adresi, a.olusturuldu,
                k.email AS kullanici_email, k.ad AS kullanici_ad, k.rol AS kullanici_rol
         FROM audit_log a
         LEFT JOIN kullanicilar k ON k.id = a.kullanici_id
         ${where}
         ORDER BY a.olusturuldu DESC
         LIMIT ${parseInt(limit)} OFFSET ${offset}`,
        params
      ),
      query(`SELECT COUNT(*) AS toplam FROM audit_log a ${where}`, params),
    ]);

    res.json({
      success: true,
      data: rows.rows,
      meta: {
        toplam: parseInt(countRes.rows[0].toplam),
        sayfa: parseInt(sayfa),
        limit: parseInt(limit),
        toplam_sayfa: Math.ceil(parseInt(countRes.rows[0].toplam) / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error('getAuditLog hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const exportAuditLogCsv = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { baslangic, bitis, islem, tablo } = req.query as Record<string, string>;

    const params: unknown[] = [tenantId];
    let idx = 2;
    let where = 'WHERE a.tenant_id = $1';
    if (baslangic) { where += ` AND a.olusturuldu >= $${idx++}`; params.push(baslangic); }
    if (bitis)     { where += ` AND a.olusturuldu <= $${idx++}`; params.push(bitis); }
    if (islem)     { where += ` AND a.islem = $${idx++}`;        params.push(islem); }
    if (tablo)     { where += ` AND a.tablo = $${idx++}`;        params.push(tablo); }

    const rows = await query(
      `SELECT a.olusturuldu, k.email, k.rol, a.tablo, a.islem, a.kayit_id, a.ip_adresi,
              a.yeni_deger::text AS yeni_deger
       FROM audit_log a
       LEFT JOIN kullanicilar k ON k.id = a.kullanici_id
       ${where}
       ORDER BY a.olusturuldu DESC
       LIMIT 5000`,
      params
    );

    const header = 'Tarih,Kullanici,Rol,Tablo,Islem,Kayit_ID,IP,Deger\n';
    const lines = rows.rows.map(r =>
      [
        r.olusturuldu?.toISOString() ?? '',
        r.email ?? '',
        r.rol ?? '',
        r.tablo ?? '',
        r.islem ?? '',
        r.kayit_id ?? '',
        r.ip_adresi ?? '',
        (r.yeni_deger ?? '').replace(/"/g, '""').replace(/\n/g, ' '),
      ].map(v => `"${v}"`).join(',')
    ).join('\n');

    const csv = header + lines;
    const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\ufeff' + csv); // BOM for Excel UTF-8
  } catch (error) {
    logger.error('exportAuditLogCsv hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ─── YEDEKLEME ────────────────────────────────────────────────────────────────
const BACKUP_DIR = path.join(process.cwd(), 'uploads', 'yedekler');

export const createBackup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Tenant'a ait tüm tablo verilerini JSON olarak topla
    const tablolar = [
      'santiyeler', 'hakedisler', 'faturalar', 'nakit_hareketleri',
      'satinalma_talepleri', 'ekipmanlar', 'personel', 'santiye_gunlukleri',
      'stoklar', 'stok_hareketleri', 'kullanicilar',
    ];

    const yedek: Record<string, unknown[]> = {
      _meta: [{
        olusturuldu: new Date().toISOString(),
        tenant_id: tenantId,
        versiyon: '2.0',
      }] as unknown[],
    };

    for (const tablo of tablolar) {
      try {
        const r = await query(
          `SELECT * FROM ${tablo} WHERE tenant_id = $1`,
          [tenantId]
        );
        yedek[tablo] = r.rows;
      } catch {
        yedek[tablo] = [];
      }
    }

    const dosyaAdi = `yedek-${tenantId.slice(0, 8)}-${Date.now()}.json`;
    const dosyaYolu = path.join(BACKUP_DIR, dosyaAdi);
    fs.writeFileSync(dosyaYolu, JSON.stringify(yedek, null, 2), 'utf-8');

    const stat = fs.statSync(dosyaYolu);

    res.json({
      success: true,
      data: {
        dosya: dosyaAdi,
        boyut_kb: Math.round(stat.size / 1024),
        olusturuldu: new Date().toISOString(),
        tablo_sayisi: tablolar.length,
        kayit_sayisi: tablolar.reduce((s, t) => s + (yedek[t] as unknown[]).length, 0),
      },
    });
  } catch (error) {
    logger.error('createBackup hatası:', error);
    res.status(500).json({ success: false, message: 'Yedekleme başarısız' });
  }
};

export const listBackups = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    if (!fs.existsSync(BACKUP_DIR)) {
      res.json({ success: true, data: [] });
      return;
    }

    const prefix = `yedek-${tenantId.slice(0, 8)}-`;
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        const ts = parseInt(f.replace(prefix, '').replace('.json', ''));
        return {
          dosya: f,
          boyut_kb: Math.round(stat.size / 1024),
          olusturuldu: new Date(ts).toISOString(),
        };
      })
      .sort((a, b) => new Date(b.olusturuldu).getTime() - new Date(a.olusturuldu).getTime())
      .slice(0, 20);

    res.json({ success: true, data: files });
  } catch (error) {
    logger.error('listBackups hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const downloadBackup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { dosya } = req.params;

    // Güvenlik: sadece kendi tenant yedeğini indirebilir
    if (!dosya.startsWith(`yedek-${tenantId.slice(0, 8)}-`) || !dosya.endsWith('.json')) {
      res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      return;
    }

    const dosyaYolu = path.join(BACKUP_DIR, dosya);
    if (!fs.existsSync(dosyaYolu)) {
      res.status(404).json({ success: false, message: 'Yedek bulunamadı' });
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${dosya}"`);
    res.sendFile(dosyaYolu);
  } catch (error) {
    logger.error('downloadBackup hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ─── KULLANICI YÖNETİMİ ───────────────────────────────────────────────────────
export const getKullanicilar = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const rows = await query(
      `SELECT id, email, ad, soyad, rol, aktif, telefon, avatar_url,
              son_giris, olusturuldu
       FROM kullanicilar
       WHERE tenant_id = $1
       ORDER BY olusturuldu`,
      [tenantId]
    );
    res.json({ success: true, data: rows.rows });
  } catch (error) {
    logger.error('getKullanicilar hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const createKullanici = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { email, ad, soyad, sifre, rol, telefon } = req.body as {
      email: string; ad: string; soyad: string; sifre: string;
      rol: string; telefon?: string;
    };

    if (!email || !ad || !soyad || !sifre || !rol) {
      res.status(400).json({ success: false, message: 'email, ad, soyad, sifre ve rol zorunlu' });
      return;
    }

    const mevcutRes = await query(
      'SELECT id FROM kullanicilar WHERE LOWER(email) = LOWER($1) AND tenant_id = $2',
      [email.trim(), tenantId]
    );
    if (mevcutRes.rows.length > 0) {
      res.status(409).json({ success: false, message: 'Bu e-posta adresi zaten kayıtlı' });
      return;
    }

    const hash = await bcrypt.hash(sifre, 12);

    const r = await query(
      `INSERT INTO kullanicilar (tenant_id, email, ad, soyad, sifre_hash, rol, telefon, aktif)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING id, email, ad, soyad, rol, aktif, olusturuldu`,
      [tenantId, email.toLowerCase().trim(), ad, soyad, hash, rol, telefon ?? null]
    );

    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (error) {
    logger.error('createKullanici hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const updateKullanici = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;
    const { ad, soyad, rol, telefon, aktif, sifre } = req.body as {
      ad?: string; soyad?: string; rol?: string;
      telefon?: string; aktif?: boolean; sifre?: string;
    };

    const mevcutRes = await query(
      'SELECT id FROM kullanicilar WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (mevcutRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
      return;
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (ad !== undefined)     { updates.push(`ad = $${idx++}`);     params.push(ad); }
    if (soyad !== undefined)  { updates.push(`soyad = $${idx++}`);  params.push(soyad); }
    if (rol !== undefined)    { updates.push(`rol = $${idx++}`);    params.push(rol); }
    if (telefon !== undefined){ updates.push(`telefon = $${idx++}`);params.push(telefon); }
    if (aktif !== undefined)  { updates.push(`aktif = $${idx++}`);  params.push(aktif); }
    if (sifre)                {
      const hash = await bcrypt.hash(sifre, 12);
      updates.push(`sifre_hash = $${idx++}`);
      params.push(hash);
    }

    if (updates.length === 0) {
      res.status(400).json({ success: false, message: 'Güncellenecek alan yok' });
      return;
    }

    params.push(id, tenantId);
    const r = await query(
      `UPDATE kullanicilar SET ${updates.join(', ')}, guncellendi = NOW()
       WHERE id = $${idx++} AND tenant_id = $${idx}
       RETURNING id, email, ad, soyad, rol, aktif, telefon`,
      params
    );

    res.json({ success: true, data: r.rows[0] });
  } catch (error) {
    logger.error('updateKullanici hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const deleteKullanici = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId } = req.user!;
    const { id } = req.params;

    if (id === userId) {
      res.status(400).json({ success: false, message: 'Kendi hesabınızı silemezsiniz' });
      return;
    }

    const r = await query(
      'DELETE FROM kullanicilar WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    if (r.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
      return;
    }
    res.json({ success: true, message: 'Kullanıcı silindi' });
  } catch (error) {
    logger.error('deleteKullanici hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const getTenantOzet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;

    const [tenantRes, kullaniciRes, santiyeRes, auditRes] = await Promise.all([
      query('SELECT ad, plan, max_santiye, deneme_bitis, olusturuldu FROM tenants WHERE id = $1', [tenantId]),
      query('SELECT rol, COUNT(*) FROM kullanicilar WHERE tenant_id = $1 AND aktif = true GROUP BY rol', [tenantId]),
      query('SELECT durum, COUNT(*) FROM santiyeler WHERE tenant_id = $1 AND aktif = true GROUP BY durum', [tenantId]),
      query('SELECT COUNT(*) AS toplam, MAX(olusturuldu) AS son_islem FROM audit_log WHERE tenant_id = $1', [tenantId]),
    ]);

    res.json({
      success: true,
      data: {
        tenant: tenantRes.rows[0],
        kullanici_dagilimi: kullaniciRes.rows,
        santiye_dagilimi: santiyeRes.rows,
        audit_ozet: auditRes.rows[0],
      },
    });
  } catch (error) {
    logger.error('getTenantOzet hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};
