import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { login } from '../controllers/authController';
import * as santiyeCtrl from '../controllers/santiyeController';
import * as hakedisCtrl from '../controllers/hakedisController';
import * as nakitCtrl from '../controllers/nakitController';
import * as satinalmaCtrl from '../controllers/satinalmaController';
import * as mesajCtrl from '../controllers/mesajController';
import * as ekipmanCtrl from '../controllers/ekipmanController';
import * as personelCtrl from '../controllers/personelController';
import * as faturaCtrl from '../controllers/faturaController';
import * as gunlukCtrl from '../controllers/gunlukController';
import * as fotografCtrl from '../controllers/fotografController';
import * as erpCariCtrl from '../controllers/erpCariController';
import * as raporCtrl from '../controllers/raporController';
import * as portalCtrl from '../controllers/musteriPortalController';
import * as stokCtrl from '../controllers/stokController';
import * as ihaleCtrl from '../controllers/ihaleController';
import * as aiCtrl from '../controllers/aiUyariController';
import * as adminCtrl from '../controllers/adminController';
import * as taseronCtrl from '../controllers/taseronController';

const router = Router();

// ─── AUTH ────────────────────────────────────────────────────────────────────
router.post('/auth/login', login);

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
router.get('/dashboard/kpi', authenticate, santiyeCtrl.getDashboardKpi);

// ─── ŞANTİYELER ──────────────────────────────────────────────────────────────
router.get('/santiyeler',         authenticate, santiyeCtrl.getSantiyeler);
router.post('/santiyeler',        authenticate, requireRole('admin','mudur'), santiyeCtrl.createSantiye);
router.get('/santiyeler/:id',     authenticate, santiyeCtrl.getSantiye);
router.put('/santiyeler/:id',     authenticate, requireRole('admin','mudur'), santiyeCtrl.updateSantiye);
router.delete('/santiyeler/:id',  authenticate, requireRole('admin'), santiyeCtrl.deleteSantiye);
router.get('/santiyeler/:id/musteri-raporu', authenticate, raporCtrl.getMusteriRaporu);

// ─── HAKEDİŞLER ──────────────────────────────────────────────────────────────
router.get('/hakedisler',              authenticate, hakedisCtrl.getHakedisler);
router.get('/hakedisler/:id',          authenticate, hakedisCtrl.getHakedis);
router.post('/hakedisler',             authenticate, requireRole('admin','mudur','muhendis'), hakedisCtrl.createHakedis);
router.put('/hakedisler/:id',          authenticate, requireRole('admin','mudur'), hakedisCtrl.updateHakedis);
router.post('/hakedisler/:id/onayla',  authenticate, requireRole('admin','mudur'), hakedisCtrl.onaylaHakedis);

// ─── FATURALAR ───────────────────────────────────────────────────────────────
router.get('/faturalar/ozet',          authenticate, faturaCtrl.getFaturaOzet);
router.get('/faturalar',               authenticate, faturaCtrl.getFaturalar);
router.get('/faturalar/:id',           authenticate, faturaCtrl.getFatura);
router.post('/faturalar',              authenticate, requireRole('admin','mudur','muhasebe'), faturaCtrl.createFatura);
router.put('/faturalar/:id',           authenticate, requireRole('admin','mudur','muhasebe'), faturaCtrl.updateFatura);
router.post('/faturalar/:id/gib-gonder', authenticate, requireRole('admin','mudur','muhasebe'), faturaCtrl.sendToGib);
router.post('/faturalar/:id/ode',      authenticate, requireRole('admin','mudur','muhasebe'), faturaCtrl.odeFatura);
router.post('/faturalar/:id/iptal',    authenticate, requireRole('admin','mudur'), faturaCtrl.cancelFatura);

// ─── NAKİT AKIŞ ──────────────────────────────────────────────────────────────
router.get('/nakit/hareketler',   authenticate, nakitCtrl.getNakitHareketleri);
router.get('/nakit/analiz',       authenticate, nakitCtrl.getNakitAnaliz);
router.post('/nakit/hareketler',  authenticate, requireRole('admin','mudur','muhasebe'), nakitCtrl.createNakitHareketi);

// ─── SATIN ALMA ──────────────────────────────────────────────────────────────
router.get('/satinalma',              authenticate, satinalmaCtrl.getSatinalmaTalepleri);
router.get('/satinalma/:id',          authenticate, satinalmaCtrl.getSatinalma);
router.post('/satinalma',             authenticate, satinalmaCtrl.createSatinalma);
router.put('/satinalma/:id',          authenticate, satinalmaCtrl.updateSatinalma);
router.post('/satinalma/:id/onayla',  authenticate, requireRole('admin','mudur'), satinalmaCtrl.onaylaSatinalma);

// ─── EKİPMAN ─────────────────────────────────────────────────────────────────
router.get('/ekipmanlar',              authenticate, ekipmanCtrl.getEkipmanlar);
router.get('/ekipmanlar/:id',          authenticate, ekipmanCtrl.getEkipman);
router.post('/ekipmanlar',             authenticate, requireRole('admin','mudur'), ekipmanCtrl.createEkipman);
router.put('/ekipmanlar/:id',          authenticate, requireRole('admin','mudur'), ekipmanCtrl.updateEkipman);
router.post('/ekipmanlar/:id/bakim',   authenticate, ekipmanCtrl.addBakim);

// ─── PERSONEL ────────────────────────────────────────────────────────────────
router.get('/personel',                authenticate, personelCtrl.getPersoneller);
router.get('/personel/:id',            authenticate, personelCtrl.getPersonel);
router.post('/personel',               authenticate, requireRole('admin','mudur'), personelCtrl.createPersonel);
router.put('/personel/:id',            authenticate, requireRole('admin','mudur'), personelCtrl.updatePersonel);
router.post('/personel/puantaj',       authenticate, personelCtrl.addPuantaj);
router.get('/personel/puantaj/rapor',  authenticate, personelCtrl.getPuantajRapor);

// ─── ŞANTİYE GÜNLÜĞÜ ─────────────────────────────────────────────────────────
router.get('/santiyeler/:santiyeId/gunlukler',   authenticate, gunlukCtrl.getGunlukler);
router.post('/santiyeler/:santiyeId/gunlukler',  authenticate, gunlukCtrl.createGunluk);
router.get('/gunlukler/:id',                     authenticate, gunlukCtrl.getGunluk);
router.delete('/gunlukler/:id',                  authenticate, gunlukCtrl.deleteGunluk);
router.get('/gunlukler/:id/fotograflar',         authenticate, fotografCtrl.getGunlukFotograflar);
router.post('/gunlukler/:id/fotograflar',        authenticate, fotografCtrl.uploadGunlukFotograflar);

// ─── FOTOĞRAFLAR ─────────────────────────────────────────────────────────────
router.get('/santiyeler/:santiyeId/fotograflar',  authenticate, fotografCtrl.getFotograflar);
router.post('/santiyeler/:santiyeId/fotograflar', authenticate, fotografCtrl.uploadFotograflar);
router.delete('/fotograflar/:id',                 authenticate, fotografCtrl.deleteFotograf);

// ─── MESAJLAR ────────────────────────────────────────────────────────────────
router.get('/mesajlar/okunmamis',                 authenticate, mesajCtrl.getOkunmamisSayisi);
router.get('/santiyeler/:santiyeId/mesajlar',     authenticate, mesajCtrl.getMesajlar);
router.post('/santiyeler/:santiyeId/mesajlar',    authenticate, mesajCtrl.sendMesaj);

// ─── ERP CARİ / STOK / KASA ─────────────────────────────────────────────────
router.get('/erp/cari',       authenticate, erpCariCtrl.getCariList);
router.get('/erp/stok',       authenticate, erpCariCtrl.getStokKalemler);
router.get('/erp/kasa-banka', authenticate, erpCariCtrl.getKasaBanka);

// ─── STOK / DEPO ─────────────────────────────────────────────────────────────
router.get('/stok',             authenticate, stokCtrl.getStoklar);
router.get('/stok/hareketler',  authenticate, stokCtrl.getStokHareketleri);
router.get('/stok/:id',         authenticate, stokCtrl.getStok);
router.post('/stok',            authenticate, requireRole('admin','mudur','muhendis'), stokCtrl.createStok);
router.put('/stok/:id',         authenticate, requireRole('admin','mudur'), stokCtrl.updateStok);
router.post('/stok/hareket',    authenticate, requireRole('admin','mudur','muhendis','satin_alma'), stokCtrl.addStokHareketi);

// ─── MÜŞTERİ PORTALI ─────────────────────────────────────────────────────────
router.post('/santiyeler/:id/rapor-linki',   authenticate, requireRole('admin','mudur'), portalCtrl.createRaporLinki);
router.get('/santiyeler/:id/rapor-linkleri', authenticate, portalCtrl.getRaporLinkleri);
router.delete('/rapor-linkleri/:linkId',     authenticate, requireRole('admin','mudur'), portalCtrl.deactivateRaporLinki);
router.get('/public/rapor/:token',           portalCtrl.getPublicRapor);

// ─── İHALE / TEKLİF ─────────────────────────────────────────────────────────
router.get('/ihale',           authenticate, ihaleCtrl.getIhaleler);
router.get('/ihale/sablon',    ihaleCtrl.downloadSablon);
router.get('/ihale/:id',       authenticate, ihaleCtrl.getIhale);
router.post('/ihale/parse',    authenticate, ihaleCtrl.parseExcel);
router.post('/ihale/import',   authenticate, ihaleCtrl.importIhale);
router.delete('/ihale/:id',    authenticate, requireRole('admin','mudur'), ihaleCtrl.deleteIhale);

// ─── TAŞERON ─────────────────────────────────────────────────────────────────
router.get('/taseron',                           authenticate, taseronCtrl.getTaseronlar);
router.post('/taseron',                          authenticate, requireRole('admin','mudur'), taseronCtrl.createTaseron);
router.get('/taseron/:id',                       authenticate, taseronCtrl.getTaseron);
router.put('/taseron/:id',                       authenticate, requireRole('admin','mudur'), taseronCtrl.updateTaseron);
// Sözleşmeler
router.get('/taseron-sozlesmeler',               authenticate, taseronCtrl.getSozlesmeler);
router.post('/taseron-sozlesmeler',              authenticate, requireRole('admin','mudur'), taseronCtrl.createSozlesme);
router.get('/taseron-sozlesmeler/:id',           authenticate, taseronCtrl.getSozlesme);
router.put('/taseron-sozlesmeler/:id',           authenticate, requireRole('admin','mudur'), taseronCtrl.updateSozlesme);
// Taşeron hakediş
router.get('/taseron-sozlesmeler/:sozlesme_id/hakedis',     authenticate, taseronCtrl.getHakedisler);
router.post('/taseron-sozlesmeler/:sozlesme_id/hakedis',    authenticate, requireRole('admin','mudur'), taseronCtrl.createHakedis);
router.post('/taseron-hakedis/:id/onayla',       authenticate, requireRole('admin','mudur'), taseronCtrl.onaylaHakedis);
// Ekipman maliyet
router.get('/ekipman-maliyet',                   authenticate, taseronCtrl.getEkipmanMaliyet);
router.post('/ekipman-maliyet',                  authenticate, requireRole('admin','mudur','muhendis'), taseronCtrl.addEkipmanMaliyet);
// Puantaj grid
router.get('/puantaj/grid',                      authenticate, taseronCtrl.getPuantajGrid);
router.post('/puantaj/grid',                     authenticate, taseronCtrl.savePuantajGrid);

// ─── AI UYARI / ANALİTİK ─────────────────────────────────────────────────────
router.get('/ai/uyarilar',      authenticate, aiCtrl.getUyarilar);
router.get('/ai/proje-riskler', authenticate, aiCtrl.getProjeRiskler);
router.get('/ai/ozet',          authenticate, aiCtrl.getAiOzet);

// ─── ADMIN — AUDIT LOG ───────────────────────────────────────────────────────
router.get('/admin/audit-log',         authenticate, requireRole('admin'), adminCtrl.getAuditLog);
router.get('/admin/audit-log/export',  authenticate, requireRole('admin'), adminCtrl.exportAuditLogCsv);

// ─── ADMIN — YEDEKLEME ───────────────────────────────────────────────────────
router.post('/admin/yedek',            authenticate, requireRole('admin'), adminCtrl.createBackup);
router.get('/admin/yedekler',          authenticate, requireRole('admin'), adminCtrl.listBackups);
router.get('/admin/yedekler/:dosya',   authenticate, requireRole('admin'), adminCtrl.downloadBackup);

// ─── ADMIN — KULLANICI YÖNETİMİ ──────────────────────────────────────────────
router.get('/admin/kullanicilar',       authenticate, requireRole('admin'), adminCtrl.getKullanicilar);
router.post('/admin/kullanicilar',      authenticate, requireRole('admin'), adminCtrl.createKullanici);
router.put('/admin/kullanicilar/:id',   authenticate, requireRole('admin'), adminCtrl.updateKullanici);
router.delete('/admin/kullanicilar/:id',authenticate, requireRole('admin'), adminCtrl.deleteKullanici);
router.get('/admin/ozet',              authenticate, requireRole('admin'), adminCtrl.getTenantOzet);

export default router;
