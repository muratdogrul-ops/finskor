import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { authenticate, requireSantiyeAccess } from '../middleware/auth';
import { login } from '../controllers/authController';
import * as santiye from '../controllers/santiyeController';
import * as hakedis from '../controllers/hakedisController';
import * as nakit from '../controllers/nakitController';
import * as satinalma from '../controllers/satinalmaController';
import * as mesaj from '../controllers/mesajController';
import * as erpCari from '../controllers/erpCariController';

const uploadDir = path.join(process.cwd(), 'uploads', 'mesajlar');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

const r = Router();

r.post('/auth/login', login);

r.get('/santiyeler/dashboard/kpi', authenticate, santiye.getDashboardKpi);
r.get('/santiyeler', authenticate, santiye.getSantiyeler);
r.post('/santiyeler', authenticate, santiye.createSantiye);
r.get('/santiyeler/:santiyeId', authenticate, requireSantiyeAccess, santiye.getSantiye);
r.put('/santiyeler/:santiyeId', authenticate, requireSantiyeAccess, santiye.updateSantiye);
r.delete('/santiyeler/:santiyeId', authenticate, requireSantiyeAccess, santiye.deleteSantiye);

r.get('/hakedisler', authenticate, hakedis.getHakedisler);
r.get('/hakedisler/:id', authenticate, hakedis.getHakedis);
r.post('/hakedisler', authenticate, requireSantiyeAccess, hakedis.createHakedis);
r.put('/hakedisler/:id', authenticate, hakedis.updateHakedis);
r.post('/hakedisler/:id/onay', authenticate, hakedis.onaylaHakedis);

r.get('/nakit-hareketleri', authenticate, nakit.getNakitHareketleri);
r.get('/nakit-analiz', authenticate, nakit.getNakitAnaliz);
r.post('/nakit-hareketleri', authenticate, requireSantiyeAccess, nakit.createNakitHareketi);

r.get('/satinalma', authenticate, satinalma.getSatinalmaTalepleri);
r.get('/satinalma/:id', authenticate, satinalma.getSatinalma);
r.post('/satinalma', authenticate, requireSantiyeAccess, satinalma.createSatinalma);
r.put('/satinalma/:id', authenticate, satinalma.updateSatinalma);
r.post('/satinalma/:id/onay', authenticate, satinalma.onaylaSatinalma);

r.get('/mesajlar/okunmamis', authenticate, mesaj.getOkunmamisSayisi);
r.get('/mesajlar/:santiyeId', authenticate, requireSantiyeAccess, mesaj.getMesajlar);
r.post('/mesajlar/:santiyeId', authenticate, requireSantiyeAccess, upload.single('dosya'), mesaj.sendMesaj);

r.get('/erp/cari', authenticate, erpCari.getCariList);
r.get('/erp/stok', authenticate, erpCari.getStokKalemler);
r.get('/erp/kasa-banka', authenticate, erpCari.getKasaBanka);

export default r;
