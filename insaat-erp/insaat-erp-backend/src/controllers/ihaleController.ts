import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import path from 'path';
import { query, withTransaction } from '../config/database';
import logger from '../utils/logger';
import { logAudit } from '../utils/auditLog';

// ─── EXCEL PARSE YARDIMCIları ─────────────────────────────────────────────────
const safeNum = (v: unknown): number => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
};
const safeStr = (v: unknown): string => String(v ?? '').trim();
const safeDate = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

// Belirtilen sayfa adını veya indeksini döner (bulamazsa null)
const getSheet = (wb: XLSX.WorkBook, ...names: string[]): XLSX.WorkSheet | null => {
  for (const n of names) {
    if (wb.Sheets[n]) return wb.Sheets[n];
  }
  if (wb.SheetNames[0]) return wb.Sheets[wb.SheetNames[0]];
  return null;
};

// ─── EXCEL ŞABLONUNU OKU ─────────────────────────────────────────────────────
function parseIhaleExcel(filePath: string) {
  const wb = XLSX.readFile(filePath, { cellDates: true });

  // ── 1. Proje Bilgileri ───────────────────────────────────────────────────
  const projSh = wb.Sheets['Proje Bilgileri'] ?? wb.Sheets[wb.SheetNames[0]];
  const projData: Record<string, unknown> = {};
  if (projSh) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(projSh, { header: 1 });
    for (const row of rows) {
      const r = row as unknown[];
      if (!r[0] || !r[1]) continue;
      const key = safeStr(r[0]).toLowerCase().replace(/[\s\/()]/g, '_');
      projData[key] = r[1];
    }
  }

  // ── 2. Metraj Kalemleri ──────────────────────────────────────────────────
  const metrajSh = wb.Sheets['Metraj Kalemleri'] ?? wb.Sheets['Metraj'] ?? null;
  const metrajRows: Array<{
    poz_no: string; is_grubu: string; kalem_adi: string;
    birim: string; miktar: number; birim_fiyat: number;
  }> = [];

  if (metrajSh) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(metrajSh);
    for (const r of rows) {
      const kalem = safeStr(r['Kalem Adı'] ?? r['kalem_adi'] ?? r['Tanim'] ?? r['TANIM'] ?? '');
      if (!kalem) continue;
      metrajRows.push({
        poz_no:      safeStr(r['Poz No'] ?? r['poz_no'] ?? ''),
        is_grubu:    safeStr(r['İş Grubu'] ?? r['is_grubu'] ?? r['Grup'] ?? ''),
        kalem_adi:   kalem,
        birim:       safeStr(r['Birim'] ?? r['birim'] ?? 'm²'),
        miktar:      safeNum(r['Miktar']  ?? r['miktar'] ?? 0),
        birim_fiyat: safeNum(r['Birim Fiyat'] ?? r['birim_fiyat'] ?? r['Fiyat'] ?? 0),
      });
    }
  }

  // ── 3. Maliyet Analizi ───────────────────────────────────────────────────
  const maliyetSh = wb.Sheets['Maliyet Analizi'] ?? wb.Sheets['Maliyet'] ?? null;
  const maliyet: Record<string, number> = {
    malzeme: 0, iscilik: 0, ekipman: 0, taseron: 0, genel_gider: 0, risk_payi: 0,
  };
  if (maliyetSh) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(maliyetSh, { header: 1 });
    for (const row of rows) {
      const r = row as unknown[];
      const k = safeStr(r[0]).toLowerCase();
      const v = safeNum(r[1]);
      if (k.includes('malzeme'))     maliyet.malzeme     = v;
      if (k.includes('işçilik') || k.includes('iscilik')) maliyet.iscilik = v;
      if (k.includes('ekipman'))     maliyet.ekipman     = v;
      if (k.includes('taşeron') || k.includes('taseron')) maliyet.taseron = v;
      if (k.includes('genel'))       maliyet.genel_gider = v;
      if (k.includes('risk'))        maliyet.risk_payi   = v;
    }
  }

  // ── 4. Nakit Akışı ───────────────────────────────────────────────────────
  const nakitSh = wb.Sheets['Nakit Akışı'] ?? wb.Sheets['Nakit Akisi'] ?? wb.Sheets['Nakit'] ?? null;
  const nakitRows: Array<{
    ay_no: number; planlanan_imalat: number;
    tahsilat_yuzdesi: number; gider_yuzdesi: number;
  }> = [];
  if (nakitSh) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(nakitSh);
    let ayNo = 1;
    for (const r of rows) {
      nakitRows.push({
        ay_no:            ayNo++,
        planlanan_imalat: safeNum(r['Planlanan İmalat'] ?? r['planlanan_imalat'] ?? r['Imalat'] ?? 0),
        tahsilat_yuzdesi: safeNum(r['Tahsilat %'] ?? r['tahsilat_yuzdesi'] ?? 90),
        gider_yuzdesi:    safeNum(r['Gider %']    ?? r['gider_yuzdesi']    ?? 80),
      });
    }
  }

  // ── 5. Hakediş Takvimi ───────────────────────────────────────────────────
  const hakedisSh = wb.Sheets['Hakediş Takvimi'] ?? wb.Sheets['Hakedis Takvimi'] ?? wb.Sheets['Hakedis'] ?? null;
  const hakedisRows: Array<{
    donem_no: number; donem_baslangic: string | null; donem_bitis: string | null;
    planlanan_tutar: number; planlanan_yuzde: number;
  }> = [];
  if (hakedisSh) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(hakedisSh);
    let no = 1;
    for (const r of rows) {
      hakedisRows.push({
        donem_no:        no++,
        donem_baslangic: safeDate(r['Başlangıç'] ?? r['Baslangic'] ?? null),
        donem_bitis:     safeDate(r['Bitiş'] ?? r['Bitis'] ?? null),
        planlanan_tutar: safeNum(r['Planlanan Tutar'] ?? r['Tutar'] ?? 0),
        planlanan_yuzde: safeNum(r['Yüzde'] ?? r['Yuzde'] ?? r['%'] ?? 0),
      });
    }
  }

  // ── 6. Risk Senaryoları ──────────────────────────────────────────────────
  const riskSh = wb.Sheets['Risk Senaryoları'] ?? wb.Sheets['Risk'] ?? null;
  const riskData: Record<string, number> = {
    gecikme_gun: 0, fiyat_artis_yuzde: 0, tahsilat_gecikme_gun: 30,
  };
  if (riskSh) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(riskSh, { header: 1 });
    for (const row of rows) {
      const r = row as unknown[];
      const k = safeStr(r[0]).toLowerCase();
      const v = safeNum(r[1]);
      if (k.includes('gecikme_gun') || k.includes('süre gecikme')) riskData.gecikme_gun = v;
      if (k.includes('fiyat'))   riskData.fiyat_artis_yuzde    = v;
      if (k.includes('tahsilat')) riskData.tahsilat_gecikme_gun = v;
    }
  }

  return {
    proje: {
      proje_adi:        safeStr(projData['proje_adı'] ?? projData['proje_adi'] ?? projData['ad'] ?? ''),
      isveren:          safeStr(projData['işveren']   ?? projData['isveren']  ?? ''),
      il:               safeStr(projData['il']        ?? ''),
      ilce:             safeStr(projData['ilçe']      ?? projData['ilce'] ?? ''),
      sozlesme_no:      safeStr(projData['sözleşme_no'] ?? projData['sozlesme_no'] ?? ''),
      ihale_tarihi:     safeDate(projData['ihale_tarihi'] ?? projData['ihale tarihi'] ?? null),
      sozlesme_tarihi:  safeDate(projData['sözleşme_tarihi'] ?? null),
      baslangic_tarihi: safeDate(projData['başlangıç_tarihi'] ?? projData['baslangic_tarihi'] ?? null),
      sure_gun:         safeNum(projData['süre_gün'] ?? projData['sure_gun'] ?? projData['süre'] ?? 0),
      teklif_bedeli:    safeNum(projData['teklif_bedeli'] ?? projData['sözleşme_bedeli'] ?? 0),
      kdv_orani:        safeNum(projData['kdv_oranı'] ?? projData['kdv_orani'] ?? 20),
      notlar:           safeStr(projData['notlar'] ?? ''),
    },
    metrajRows,
    maliyet,
    nakitRows,
    hakedisRows,
    riskData,
  };
}

// ─── NAKIT PROJEKSİYONU HESAPLA ──────────────────────────────────────────────
function hesaplaProj(
  ihaleBedeli: number,
  baslangicTarihi: string | null,
  nakitRows: ReturnType<typeof parseIhaleExcel>['nakitRows']
) {
  let kumulatifImalat = 0;
  let kumulatifNakit  = 0;

  return nakitRows.map((r, i) => {
    const ayTarihi = baslangicTarihi
      ? new Date(new Date(baslangicTarihi).setMonth(new Date(baslangicTarihi).getMonth() + i))
          .toISOString().slice(0, 10)
      : new Date(new Date().setMonth(new Date().getMonth() + i)).toISOString().slice(0, 10);

    const imalat  = r.planlanan_imalat || (ihaleBedeli / Math.max(nakitRows.length, 1));
    kumulatifImalat += imalat;

    const tahsilat = imalat * (r.tahsilat_yuzdesi / 100);
    const gider    = imalat * (r.gider_yuzdesi   / 100);
    const net      = tahsilat - gider;
    kumulatifNakit += net;

    return {
      ay_no:              i + 1,
      ay_tarihi:          ayTarihi,
      planlanan_imalat:   Math.round(imalat),
      imalat_kumulatif:   Math.round(kumulatifImalat),
      tahsilat_yuzdesi:   r.tahsilat_yuzdesi,
      planlanan_tahsilat: Math.round(tahsilat),
      toplam_gider:       Math.round(gider),
      net_nakit:          Math.round(net),
      kumulatif_nakit:    Math.round(kumulatifNakit),
    };
  });
}

// ─── İHALE LİSTESİ ───────────────────────────────────────────────────────────
export const getIhaleler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { durum, sayfa = '1', limit = '20' } = req.query;
    const offset = (parseInt(sayfa as string) - 1) * parseInt(limit as string);

    let where = 'WHERE i.tenant_id = $1';
    const params: unknown[] = [tenantId];
    if (durum) { where += ' AND i.durum = $2'; params.push(durum); }

    const countRes = await query(`SELECT COUNT(*) FROM ihale_projeleri i ${where}`, params);
    const result = await query(
      `SELECT i.*,
         k.ad || ' ' || k.soyad AS yukleyen_adi,
         s.ad AS santiye_adi,
         (SELECT COUNT(*) FROM metraj_kalemleri m WHERE m.ihale_id = i.id) AS kalem_sayisi
       FROM ihale_projeleri i
       LEFT JOIN kullanicilar k ON k.id = i.yukleyen_id
       LEFT JOIN santiyeler   s ON s.id = i.santiye_id
       ${where}
       ORDER BY i.olusturuldu DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: { toplam: parseInt(countRes.rows[0].count) },
    });
  } catch (error) {
    logger.error('getIhaleler hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ─── TEK İHALE DETAY ─────────────────────────────────────────────────────────
export const getIhale = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const [ihale, kalemler, nakit, takvim] = await Promise.all([
      query('SELECT * FROM ihale_projeleri WHERE id = $1 AND tenant_id = $2', [id, tenantId]),
      query('SELECT * FROM metraj_kalemleri WHERE ihale_id = $1 ORDER BY sira', [id]),
      query('SELECT * FROM ihale_nakit_projeksiyonu WHERE ihale_id = $1 ORDER BY ay_no', [id]),
      query('SELECT * FROM ihale_hakedis_takvimi WHERE ihale_id = $1 ORDER BY donem_no', [id]),
    ]);

    if (!ihale.rows[0]) {
      res.status(404).json({ success: false, message: 'İhale bulunamadı' });
      return;
    }

    res.json({
      success: true,
      data: {
        ...ihale.rows[0],
        kalemler: kalemler.rows,
        nakit_projeksiyonu: nakit.rows,
        hakedis_takvimi: takvim.rows,
      },
    });
  } catch (error) {
    logger.error('getIhale hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ─── EXCEL YÜKLE + PARSE EDİP ÖNİZLEME VER ──────────────────────────────────
export const parseExcel = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'Excel dosyası gerekli' });
      return;
    }

    const parsed = parseIhaleExcel(req.file.path);

    // Toplam metraj tutarı
    const metrajToplam = parsed.metrajRows.reduce((s, r) => s + r.miktar * r.birim_fiyat, 0);
    const toplamMaliyet = Object.values(parsed.maliyet).reduce((a, b) => a + b, 0);
    const ihaleBedeli  = parsed.proje.teklif_bedeli || metrajToplam;

    // Projeksiyon hesapla
    const projeksiyon = hesaplaProj(ihaleBedeli, parsed.proje.baslangic_tarihi, parsed.nakitRows);

    res.json({
      success: true,
      message: 'Excel okundu. Önizlemeyi onaylayın.',
      data: {
        dosya_adi: req.file.originalname,
        gecici_yol: req.file.filename,
        proje: {
          ...parsed.proje,
          teklif_bedeli: ihaleBedeli,
        },
        ozet: {
          kalem_sayisi:    parsed.metrajRows.length,
          metraj_toplam:   Math.round(metrajToplam),
          toplam_maliyet:  Math.round(toplamMaliyet),
          brut_kar:        Math.round(ihaleBedeli - toplamMaliyet),
          brut_kar_marji:  ihaleBedeli > 0
            ? parseFloat(((ihaleBedeli - toplamMaliyet) / ihaleBedeli * 100).toFixed(1))
            : 0,
          hakedis_donem:   parsed.hakedisRows.length || 0,
          projeksiyon_ay:  projeksiyon.length,
          min_nakit:       projeksiyon.length ? Math.min(...projeksiyon.map(p => p.kumulatif_nakit)) : 0,
        },
        metraj_ornekleri: parsed.metrajRows.slice(0, 10),
        nakit_projeksiyonu: projeksiyon,
        hakedis_takvimi:  parsed.hakedisRows,
        maliyet:          parsed.maliyet,
        risk:             parsed.riskData,
      },
    });
  } catch (error) {
    logger.error('parseExcel hatası:', error);
    res.status(500).json({ success: false, message: 'Excel okunamadı. Şablon formatını kontrol edin.' });
  }
};

// ─── ONAYLA VE KAYDET ────────────────────────────────────────────────────────
export const importIhale = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId } = req.user!;
    const {
      gecici_yol,
      proje,
      maliyet,
      nakit_projeksiyonu = [],
      hakedis_takvimi    = [],
      metraj_kalemleri   = [],
      santiye_olustur    = true,
    } = req.body;

    if (!proje?.proje_adi) {
      res.status(400).json({ success: false, message: 'Proje adı zorunludur' });
      return;
    }

    const filePath = gecici_yol
      ? path.join(process.cwd(), 'uploads', 'ihale', gecici_yol)
      : null;

    const toplamMaliyet = maliyet
      ? Object.values(maliyet as Record<string, number>).reduce((a: number, b: number) => a + b, 0)
      : null;

    const result = await withTransaction(async (client) => {
      // 1. İhale projesi oluştur
      const ihaleRes = await client.query(
        `INSERT INTO ihale_projeleri
           (tenant_id, yukleyen_id, proje_adi, isveren, il, ilce, sozlesme_no,
            ihale_tarihi, sozlesme_tarihi, baslangic_tarihi, sure_gun, teklif_bedeli, kdv_orani,
            maliyet_malzeme, maliyet_iscilik, maliyet_ekipman, maliyet_taseron,
            maliyet_genel_gider, maliyet_risk_payi, toplam_maliyet,
            durum, kaynak_dosya, notlar)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'aktif',$21,$22)
         RETURNING *`,
        [
          tenantId, userId,
          proje.proje_adi, proje.isveren || null, proje.il || null, proje.ilce || null,
          proje.sozlesme_no || null,
          proje.ihale_tarihi || null, proje.sozlesme_tarihi || null, proje.baslangic_tarihi || null,
          proje.sure_gun || null,
          proje.teklif_bedeli || null, proje.kdv_orani || 20,
          maliyet?.malzeme || null, maliyet?.iscilik || null, maliyet?.ekipman || null,
          maliyet?.taseron || null, maliyet?.genel_gider || null, maliyet?.risk_payi || null,
          toplamMaliyet || null,
          filePath, proje.notlar || null,
        ]
      );

      const ihaleId = ihaleRes.rows[0].id;

      // 2. Metraj kalemlerini toplu ekle
      for (let i = 0; i < metraj_kalemleri.length; i++) {
        const k = metraj_kalemleri[i] as Record<string, unknown>;
        if (!k.kalem_adi) continue;
        await client.query(
          `INSERT INTO metraj_kalemleri
             (tenant_id, ihale_id, poz_no, is_grubu, kalem_adi, birim, miktar, birim_fiyat, sira)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [tenantId, ihaleId, k.poz_no || null, k.is_grubu || null, k.kalem_adi,
           k.birim || null, k.miktar || 0, k.birim_fiyat || 0, i]
        );
      }

      // 3. Nakit akış projeksiyonu
      for (const p of nakit_projeksiyonu as Record<string, unknown>[]) {
        await client.query(
          `INSERT INTO ihale_nakit_projeksiyonu
             (tenant_id, ihale_id, ay_no, ay_tarihi, planlanan_imalat, imalat_kumulatif,
              tahsilat_yuzdesi, planlanan_tahsilat, toplam_gider, net_nakit, kumulatif_nakit)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [tenantId, ihaleId, p.ay_no, p.ay_tarihi,
           p.planlanan_imalat || 0, p.imalat_kumulatif || 0,
           p.tahsilat_yuzdesi || 90, p.planlanan_tahsilat || 0,
           p.toplam_gider || 0, p.net_nakit || 0, p.kumulatif_nakit || 0]
        );
      }

      // 4. Hakediş takvimi
      for (const h of hakedis_takvimi as Record<string, unknown>[]) {
        await client.query(
          `INSERT INTO ihale_hakedis_takvimi
             (tenant_id, ihale_id, donem_no, donem_baslangic, donem_bitis,
              planlanan_tutar, planlanan_yuzde)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [tenantId, ihaleId, h.donem_no, h.donem_baslangic || null,
           h.donem_bitis || null, h.planlanan_tutar || 0, h.planlanan_yuzde || 0]
        );
      }

      // 5. Şantiye otomatik oluştur (isteğe bağlı)
      let santiyeId: string | null = null;
      if (santiye_olustur && proje.proje_adi) {
        const santiyeRes = await client.query(
          `INSERT INTO santiyeler
             (tenant_id, ad, tip, il, ilce, sozlesme_no, baslangic, bitis_planlanan, sozlesme_bedel, durum)
           VALUES ($1,$2,'karma',$3,$4,$5,$6,$7,$8,'planlama')
           RETURNING id`,
          [
            tenantId,
            proje.proje_adi,
            proje.il || null,
            proje.ilce || null,
            proje.sozlesme_no || null,
            proje.baslangic_tarihi || null,
            proje.baslangic_tarihi && proje.sure_gun
              ? new Date(new Date(proje.baslangic_tarihi).setDate(
                  new Date(proje.baslangic_tarihi).getDate() + parseInt(String(proje.sure_gun))
                )).toISOString().slice(0, 10)
              : null,
            proje.teklif_bedeli || null,
          ]
        );
        santiyeId = santiyeRes.rows[0].id;

        // İhaleyi şantiyeyle bağla
        await client.query(
          'UPDATE ihale_projeleri SET santiye_id = $1 WHERE id = $2',
          [santiyeId, ihaleId]
        );
      }

      return { ihaleId, santiyeId, ihale: ihaleRes.rows[0] };
    });

    await logAudit({
      userId,
      tenantId,
      islem: 'INSERT',
      tablo: 'ihale_projeleri',
      kayitId: result.ihaleId,
      yeniDeger: { proje_adi: proje.proje_adi },
    });

    logger.info(`İhale import edildi: ${proje.proje_adi} (tenant: ${tenantId})`);

    res.status(201).json({
      success: true,
      message: santiye_olustur
        ? 'İhale kaydedildi ve şantiye oluşturuldu'
        : 'İhale kaydedildi',
      data: result,
    });
  } catch (error) {
    logger.error('importIhale hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ─── İHALE SİL ───────────────────────────────────────────────────────────────
export const deleteIhale = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId } = req.user!;
    const { id } = req.params;

    const result = await query(
      'DELETE FROM ihale_projeleri WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );

    if ((result.rowCount ?? 0) === 0) {
      res.status(404).json({ success: false, message: 'İhale bulunamadı' });
      return;
    }

    await logAudit({ userId, tenantId, islem: 'DELETE', tablo: 'ihale_projeleri', kayitId: id });
    res.json({ success: true, message: 'İhale silindi' });
  } catch (error) {
    logger.error('deleteIhale hatası:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ─── ÖRNEK EXCEL ŞABLONU İNDİR (stillendirilmiş) ────────────────────────────
export const downloadSablon = async (req: Request, res: Response): Promise<void> => {
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'İnşaatERP';
    wb.created = new Date();

    // ── RENK PALETİ ─────────────────────────────────────────────────────────
    const C = {
      navy:       '1E3A5F',
      blue:       '2563EB',
      lightBlue:  'DBEAFE',
      teal:       '0D9488',
      lightTeal:  'CCFBF1',
      orange:     'EA580C',
      lightOrange:'FFEDD5',
      green:      '16A34A',
      lightGreen: 'DCFCE7',
      red:        'DC2626',
      lightRed:   'FEE2E2',
      gray:       '475569',
      lightGray:  'F1F5F9',
      border:     'CBD5E1',
      white:      'FFFFFF',
      yellow:     'FEF3C7',
    };

    // ── YARDIMCI FONKSİYONLAR ────────────────────────────────────────────────
    const border = (color = C.border): Partial<ExcelJS.Borders> => ({
      top:    { style: 'thin', color: { argb: 'FF' + color } },
      left:   { style: 'thin', color: { argb: 'FF' + color } },
      bottom: { style: 'thin', color: { argb: 'FF' + color } },
      right:  { style: 'thin', color: { argb: 'FF' + color } },
    });

    const fill = (hex: string): ExcelJS.Fill => ({
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: 'FF' + hex },
    });

    const styleHeader = (cell: ExcelJS.Cell, bgHex: string, fgHex = C.white, size = 11) => {
      cell.fill = fill(bgHex);
      cell.font = { bold: true, color: { argb: 'FF' + fgHex }, size };
      cell.border = border(bgHex);
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    };

    const styleLabel = (cell: ExcelJS.Cell) => {
      cell.fill = fill(C.lightGray);
      cell.font = { bold: true, color: { argb: 'FF' + C.gray }, size: 10 };
      cell.border = border();
      cell.alignment = { vertical: 'middle' };
    };

    const styleValue = (cell: ExcelJS.Cell, color?: string) => {
      cell.fill = fill(C.white);
      cell.font = { color: { argb: 'FF' + (color ?? '111827') }, size: 10 };
      cell.border = border();
      cell.alignment = { vertical: 'middle' };
    };

    const styleSection = (cell: ExcelJS.Cell, bgHex: string) => {
      cell.fill = fill(bgHex);
      cell.font = { bold: true, color: { argb: 'FF' + C.white }, size: 10 };
      cell.border = border(bgHex);
      cell.alignment = { vertical: 'middle' };
    };

    const styleTotal = (cell: ExcelJS.Cell) => {
      cell.fill = fill(C.navy);
      cell.font = { bold: true, color: { argb: 'FF' + C.white }, size: 10 };
      cell.border = border(C.navy);
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    };

    const bannerRow = (ws: ExcelJS.Worksheet, text: string, cols: number, bgHex: string) => {
      const row = ws.addRow([text]);
      ws.mergeCells(row.number, 1, row.number, cols);
      const cell = ws.getCell(row.number, 1);
      cell.fill = fill(bgHex);
      cell.font = { bold: true, color: { argb: 'FF' + C.white }, size: 13 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      row.height = 32;
      return row;
    };

    const subBanner = (ws: ExcelJS.Worksheet, text: string, cols: number, bgHex: string) => {
      const row = ws.addRow([text]);
      ws.mergeCells(row.number, 1, row.number, cols);
      const cell = ws.getCell(row.number, 1);
      cell.fill = fill(bgHex);
      cell.font = { bold: true, color: { argb: 'FF' + C.white }, size: 11 };
      cell.alignment = { vertical: 'middle' };
      row.height = 22;
      return row;
    };

    const emptyRow = (ws: ExcelJS.Worksheet) => ws.addRow([]);

    // ════════════════════════════════════════════════════════════════════════
    // SAYFA 1: Proje Bilgileri
    // ════════════════════════════════════════════════════════════════════════
    const ws1 = wb.addWorksheet('Proje Bilgileri');
    ws1.columns = [
      { width: 32 }, { width: 28 }, { width: 4 }, { width: 32 }, { width: 28 },
    ];

    bannerRow(ws1, 'İNŞAAT ERP — İHALE / TEKLIF PROJE ŞABLONU', 5, C.navy);
    const infoRow = ws1.addRow(['Bu şablonu doldurun → ERP\'ye yükleyin → Nakit Akışı ve Karlılık otomatik hesaplanır']);
    ws1.mergeCells(infoRow.number, 1, infoRow.number, 5);
    infoRow.getCell(1).fill = fill(C.lightBlue);
    infoRow.getCell(1).font = { italic: true, color: { argb: 'FF' + C.blue }, size: 10 };
    infoRow.getCell(1).alignment = { horizontal: 'center' };
    infoRow.height = 18;
    emptyRow(ws1);

    // Sol blok — Genel
    const leftFields: [string, string | number, string][] = [
      ['Proje / İhale Adı', '', '* Zorunlu'],
      ['İşveren / İdare', '', ''],
      ['İl', '', ''],
      ['İlçe', '', ''],
      ['Proje Kodu / Sözleşme No', '', ''],
      ['İhale Usulü', 'Açık İhale', 'Açık / Pazarlık / Doğrudan'],
      ['Sözleşme Tipi', 'Götürü Bedel', 'Götürü / Birim Fiyat / Karma'],
      ['Para Birimi', 'TRY', 'TRY / USD / EUR'],
      ['KDV Oranı (%)', 20, ''],
      ['İhale Tarihi', '', 'GG.AA.YYYY'],
      ['Sözleşme Tarihi', '', 'GG.AA.YYYY'],
      ['Başlangıç Tarihi', '', 'GG.AA.YYYY'],
      ['Bitiş Tarihi', '', 'GG.AA.YYYY'],
      ['Süre (Gün)', '', 'Takvim günü'],
      ['İl / İlçe', '', ''],
    ];

    // Sağ blok — Teklif
    const rightFields: [string, string | number, string][] = [
      ['Tahmini İhale Bedeli (TL)', '', 'KDV hariç'],
      ['Bizim Teklif Bedelimiz (TL)', '', 'KDV hariç — * Zorunlu'],
      ['Yaklaşık Maliyet (TL)', '', ''],
      ['Avans Oranı (%)', '', ''],
      ['Kesin Teminat Oranı (%)', 6, ''],
      ['Geçici Teminat Oranı (%)', 3, ''],
      ['Beklenen Hakediş Sayısı', '', ''],
      ['Hakediş Periyodu', 'Aylık', 'Aylık / 2 Aylık / 3 Aylık'],
      ['Banka / Finansman', '', ''],
      ['Brüt Kar Hedefi (%)', '', ''],
      ['Fiziksel Gerçekleşme Hedefi (%)', '', ''],
      ['Notlar', '', ''],
    ];

    const startRow = 4;
    subBanner(ws1, 'PROJE GENEL BİLGİLERİ', 2, C.blue);
    // sağ başlık
    const s1h = ws1.getRow(ws1.rowCount);
    ws1.getCell(s1h.number, 4).value = 'TEKLİF VE SÖZLEŞME BİLGİLERİ';
    styleSection(ws1.getCell(s1h.number, 4), C.teal);
    ws1.mergeCells(s1h.number, 4, s1h.number, 5);

    leftFields.forEach(([label, val, hint], i) => {
      const r = ws1.addRow([label, val, '', i < rightFields.length ? rightFields[i][0] : '', i < rightFields.length ? rightFields[i][1] : '']);
      r.height = 20;
      styleLabel(r.getCell(1));
      styleValue(r.getCell(2));
      r.getCell(3).fill = fill(C.white);
      if (i < rightFields.length) {
        styleLabel(r.getCell(4));
        styleValue(r.getCell(5));
      }
      if (hint) r.getCell(2).note = hint;
    });

    // ════════════════════════════════════════════════════════════════════════
    // SAYFA 2: Metraj Keşif
    // ════════════════════════════════════════════════════════════════════════
    const ws2 = wb.addWorksheet('Metraj Keşif');
    ws2.columns = [
      { width: 6 }, { width: 10 }, { width: 50 }, { width: 8 },
      { width: 12 }, { width: 14 }, { width: 16 }, { width: 12 }, { width: 16 },
    ];
    bannerRow(ws2, 'METRAJ / KEŞİF — İŞ KALEMLERİ', 9, C.navy);
    emptyRow(ws2);

    const metrajHeaders = ['#', 'Poz No', 'İş Kalemi Tanımı', 'Birim', 'Miktar', 'Birim Fiyat (TL)', 'Tutar (TL)', 'KDV (%)', 'Toplam (TL)'];
    const mh = ws2.addRow(metrajHeaders);
    mh.height = 24;
    metrajHeaders.forEach((_, i) => styleHeader(mh.getCell(i + 1), C.blue));

    const metrajGruplar = [
      { grup: 'A — HAZIRLIK VE ALTYAPI', renk: C.teal, kalemler: [
        ['A.01', 'Şantiye kurulumu ve geçici tesisler', 'Götürü', '', ''],
        ['A.02', 'Kazı (makine, serbest zemin, 0–1.5m)', 'm³', '', ''],
        ['A.03', 'Dolgu ve sıkıştırma (granüler)', 'm³', '', ''],
        ['A.04', 'Hafriyat nakli (şantiye dışı)', 'm³', '', ''],
      ]},
      { grup: 'B — TEMEL VE BETONARME', renk: C.blue, kalemler: [
        ['B.01', 'Grobeton (C16/20)', 'm³', '', ''],
        ['B.02', 'Temel betonarme (C25/30, S420)', 'm³', '', ''],
        ['B.03', 'Perde/kolon/kiriş betonarme (C30/37)', 'm³', '', ''],
        ['B.04', 'Döşeme betonarme (C25/30)', 'm³', '', ''],
        ['B.05', 'Çelik donatı (S420)', 'ton', '', ''],
        ['B.06', 'Kalıp imalatı ve sökümü', 'm²', '', ''],
      ]},
      { grup: 'C — YAPI KABUĞU', renk: C.orange, kalemler: [
        ['C.01', 'Tuğla duvar örme', 'm²', '', ''],
        ['C.02', 'Isı yalıtımı (dıştan, 5cm EPS)', 'm²', '', ''],
        ['C.03', 'Su yalıtımı (çatı, bitüm)', 'm²', '', ''],
        ['C.04', 'Çatı çelik konstrüksiyon', 'ton', '', ''],
      ]},
      { grup: 'D — İÇ İMALATLAR', renk: C.gray, kalemler: [
        ['D.01', 'Sıva (iç, alçı)', 'm²', '', ''],
        ['D.02', 'Boya (iç cephe, lateks)', 'm²', '', ''],
        ['D.03', 'Döşeme kaplama (seramik)', 'm²', '', ''],
        ['D.04', 'Alüminyum doğrama', 'm²', '', ''],
      ]},
      { grup: 'E — MEKANİK / ELEKTRİK', renk: C.teal, kalemler: [
        ['E.01', 'Sıhhi tesisat (komple)', 'Götürü', '', ''],
        ['E.02', 'Elektrik tesisatı (komple)', 'Götürü', '', ''],
        ['E.03', 'Asansör (komple)', 'Adet', '', ''],
      ]},
      { grup: 'F — ÇEVRE VE PEYZAJ', renk: C.green, kalemler: [
        ['F.01', 'Çevre düzenleme ve peyzaj', 'Götürü', '', ''],
        ['F.02', 'Parke / yol kaplama', 'm²', '', ''],
      ]},
    ];

    let sira = 1;
    metrajGruplar.forEach(({ grup, renk, kalemler }) => {
      const gr = ws2.addRow([grup]);
      ws2.mergeCells(gr.number, 1, gr.number, 9);
      gr.height = 20;
      styleSection(gr.getCell(1), renk);

      kalemler.forEach(([poz, tanim, birim]) => {
        const r = ws2.addRow([sira++, poz, tanim, birim, '', '', '', 20, '']);
        r.height = 18;
        [1,2,3,4].forEach(c => styleValue(r.getCell(c)));
        styleValue(r.getCell(5)); // miktar — kullanıcı dolduracak
        styleValue(r.getCell(6)); // birim fiyat
        // Tutar formülü
        r.getCell(7).value = { formula: `E${r.number}*F${r.number}` };
        r.getCell(7).fill = fill(C.lightGreen);
        r.getCell(7).font = { color: { argb: 'FF' + C.green } };
        r.getCell(7).border = border();
        r.getCell(7).numFmt = '#,##0.00';
        styleValue(r.getCell(8));
        r.getCell(8).value = 20;
        r.getCell(9).value = { formula: `G${r.number}*(1+H${r.number}/100)` };
        r.getCell(9).fill = fill(C.lightTeal);
        r.getCell(9).font = { bold: true, color: { argb: 'FF' + C.teal } };
        r.getCell(9).border = border();
        r.getCell(9).numFmt = '#,##0.00';
        [5,6].forEach(c => { r.getCell(c).numFmt = '#,##0.00'; });
      });
    });

    // Toplam satırı
    const lastMetraj = ws2.rowCount;
    const toplam = ws2.addRow(['', '', 'GENEL TOPLAM (KDV Dahil)', '', '', '', '', '', '']);
    ws2.mergeCells(toplam.number, 1, toplam.number, 8);
    toplam.height = 24;
    styleTotal(ws2.getCell(toplam.number, 1));
    ws2.getCell(toplam.number, 9).value = { formula: `SUM(I5:I${lastMetraj})` };
    styleTotal(ws2.getCell(toplam.number, 9));
    ws2.getCell(toplam.number, 9).numFmt = '#,##0.00';

    // ════════════════════════════════════════════════════════════════════════
    // SAYFA 3: Maliyet Analizi
    // ════════════════════════════════════════════════════════════════════════
    const ws3 = wb.addWorksheet('Maliyet Analizi');
    ws3.columns = [{ width: 35 }, { width: 20 }, { width: 12 }, { width: 30 }];
    bannerRow(ws3, 'MALİYET ANALİZİ — DETAYLI DAĞILIM', 4, C.navy);
    emptyRow(ws3);

    const maliyetHeaders = ['Maliyet Kalemi', 'Tutar (TL)', 'Oran (%)', 'Açıklama'];
    const mah = ws3.addRow(maliyetHeaders);
    mah.height = 22;
    maliyetHeaders.forEach((_, i) => styleHeader(mah.getCell(i + 1), C.teal));

    const maliyetKalemler: [string, number, string, string][] = [
      ['Malzeme Giderleri', 0, '', 'Yapı malzemeleri, donanım'],
      ['İşçilik Giderleri', 0, '', 'Kadrolu personel SSK dahil'],
      ['Alt Yüklenici / Taşeron', 0, '', 'Hizmet bedelleri'],
      ['Ekipman / Makine Kirası', 0, '', 'İnşaat makineleri'],
      ['Nakliye ve Lojistik', 0, '', ''],
      ['Genel ve İdari Giderler', 0, '', 'Ofis, sigorta, izin'],
      ['Finansman Giderleri', 0, '', 'Kredi faizi, teminat'],
      ['Risk Payı', 0, '', 'Beklenmedik giderler için'],
    ];

    // Row 1=banner, Row 2=empty, Row 3=başlıklar → veri row 4'ten başlar
    const malDataStartRow = 4;
    const malDataEndRow   = malDataStartRow + maliyetKalemler.length - 1;
    maliyetKalemler.forEach(([adi, tutar, , aciklama]) => {
      const r = ws3.addRow([adi, tutar || '', '', aciklama]);
      r.height = 20;
      styleLabel(r.getCell(1));
      styleValue(r.getCell(2)); r.getCell(2).numFmt = '#,##0.00';
      r.getCell(3).value = { formula: `IF(B${r.number}>0,B${r.number}/SUM(B${malDataStartRow}:B${malDataEndRow})*100,"")` };
      r.getCell(3).fill = fill(C.lightTeal); r.getCell(3).border = border();
      r.getCell(3).numFmt = '0.0"%"'; r.getCell(3).font = { color: { argb: 'FF' + C.teal } };
      styleValue(r.getCell(4));
    });

    const malToplam = ws3.addRow(['TOPLAM MALİYET', '', '', '']);
    ws3.mergeCells(malToplam.number, 1, malToplam.number, 1);
    malToplam.height = 22;
    styleTotal(ws3.getCell(malToplam.number, 1));
    ws3.getCell(malToplam.number, 2).value = { formula: `SUM(B${malDataStartRow}:B${malDataEndRow})` };
    styleTotal(ws3.getCell(malToplam.number, 2));
    ws3.getCell(malToplam.number, 2).numFmt = '#,##0.00';

    // Karlılık bloğu
    emptyRow(ws3); emptyRow(ws3);
    subBanner(ws3, 'KARLILIK ÖZETİ', 4, C.orange);
    const karlılikSatirlar: [string, string][] = [
      ['Teklif Bedeli (KDV hariç)', ''],
      ['Toplam Maliyet', ''],
      ['Brüt Kar', ''],
      ['Brüt Kar Marjı (%)', ''],
      ['Fiyat Farkı Beklentisi (+)', ''],
      ['Ek İş Beklentisi (+)', ''],
      ['Kesinti / Ceza Riski (-)', ''],
      ['Net Beklenen Kar', ''],
    ];
    karlılikSatirlar.forEach(([label, val]) => {
      const r = ws3.addRow([label, val]);
      r.height = 20;
      styleLabel(r.getCell(1));
      styleValue(r.getCell(2)); r.getCell(2).numFmt = '#,##0.00';
      ws3.mergeCells(r.number, 3, r.number, 4);
    });

    // ════════════════════════════════════════════════════════════════════════
    // SAYFA 4: Nakit Akış
    // ════════════════════════════════════════════════════════════════════════
    const ws4 = wb.addWorksheet('Nakit Akış');
    const ayCount = 13;
    const ws4Cols: Partial<ExcelJS.Column>[] = [{ width: 28 }];
    for (let i = 0; i < ayCount; i++) ws4Cols.push({ width: 12 });
    ws4Cols.push({ width: 14 });
    ws4.columns = ws4Cols;

    bannerRow(ws4, 'NAKİT AKIŞ PROJEKSİYONU — AYLIK', ayCount + 2, C.navy);
    emptyRow(ws4);

    const ayHeaders = ['KALEM', ...Array.from({ length: ayCount }, (_, i) => `Ay ${i + 1}`), 'TOPLAM'];
    const ayHRow = ws4.addRow(ayHeaders);
    ayHRow.height = 22;
    ayHeaders.forEach((_, i) => styleHeader(ayHRow.getCell(i + 1), C.blue));

    const nakitBolumler = [
      { baslik: 'GELİRLER', renk: C.green, kalemler: ['Hakediş Tahsilatı', 'Avans Tahsilatı', 'Diğer Gelirler'] },
      { baslik: 'GİDERLER', renk: C.red, kalemler: ['Malzeme Giderleri', 'İşçilik Giderleri', 'Alt Yüklenici Ödemeleri', 'Ekipman / Kira', 'Genel Giderler', 'Finansman Giderleri'] },
    ];

    const bolumToplamRows: number[] = [];   // TOPLAM GELİR ve TOPLAM GİDER satır no'ları
    nakitBolumler.forEach(({ baslik, renk, kalemler }) => {
      const br = ws4.addRow([baslik, ...new Array(ayCount + 1).fill('')]);
      ws4.mergeCells(br.number, 1, br.number, ayCount + 2);
      styleSection(br.getCell(1), renk); br.height = 20;

      const kalemStartRow = ws4.rowCount + 1;   // ilk kalem buradan başlayacak

      kalemler.forEach(k => {
        const r = ws4.addRow(['  ' + k, ...new Array(ayCount + 1).fill('')]);
        r.height = 18;
        styleLabel(r.getCell(1));
        for (let c = 2; c <= ayCount + 1; c++) {
          r.getCell(c).fill = fill(C.white); r.getCell(c).border = border();
          r.getCell(c).numFmt = '#,##0';
        }
        const lastCol = ayCount + 2;
        // TOPLAM sütunu = o satırın tüm aylık hücrelerinin toplamı
        const lastMonthCol = String.fromCharCode(65 + ayCount);   // B…N (ayCount=13 → N)
        r.getCell(lastCol).value = { formula: `SUM(B${r.number}:${lastMonthCol}${r.number})` };
        r.getCell(lastCol).fill = fill(C.lightGray); r.getCell(lastCol).border = border();
        r.getCell(lastCol).numFmt = '#,##0'; r.getCell(lastCol).font = { bold: true };
      });

      const kalemEndRow = ws4.rowCount;   // son kalem satırı

      // Bölüm TOPLAM satırı — aralık bazlı SUM (satır-satır toplama değil)
      const tr = ws4.addRow(['TOPLAM ' + baslik, ...new Array(ayCount + 1).fill('')]);
      tr.height = 20;
      styleTotal(tr.getCell(1));
      for (let c = 2; c <= ayCount + 2; c++) {
        const col = String.fromCharCode(64 + c);   // c=2→B … c=15→O
        tr.getCell(c).value = { formula: `SUM(${col}${kalemStartRow}:${col}${kalemEndRow})` };
        tr.getCell(c).fill = fill(renk); tr.getCell(c).border = border();
        tr.getCell(c).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        tr.getCell(c).numFmt = '#,##0';
      }
      bolumToplamRows.push(tr.number);
    });

    // NET NAKİT = TOPLAM GELİRLER - TOPLAM GİDERLER
    emptyRow(ws4);
    const netRow = ws4.addRow(['NET NAKİT (Gelir − Gider)', ...new Array(ayCount + 1).fill('')]);
    netRow.height = 22;
    styleTotal(netRow.getCell(1));
    for (let c = 2; c <= ayCount + 2; c++) {
      const col = String.fromCharCode(64 + c);
      if (bolumToplamRows.length >= 2) {
        netRow.getCell(c).value = { formula: `${col}${bolumToplamRows[0]}-${col}${bolumToplamRows[1]}` };
      }
      netRow.getCell(c).fill = fill(C.navy); netRow.getCell(c).border = border();
      netRow.getCell(c).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      netRow.getCell(c).numFmt = '#,##0';
    }

    // ════════════════════════════════════════════════════════════════════════
    // SAYFA 5: Hakediş Takvimi
    // ════════════════════════════════════════════════════════════════════════
    const ws5 = wb.addWorksheet('Hakediş Takvimi');
    ws5.columns = [{ width: 10 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 10 }, { width: 16 }, { width: 30 }];
    bannerRow(ws5, 'HAKEDİŞ TAKVİMİ', 7, C.navy);
    emptyRow(ws5);

    const hakHeaders = ['Dönem No', 'Başlangıç', 'Bitiş', 'Planlanan Tutar (TL)', 'Yüzde (%)', 'Beklenen Ödeme', 'Notlar'];
    const hh = ws5.addRow(hakHeaders);
    hh.height = 22;
    hakHeaders.forEach((_, i) => styleHeader(hh.getCell(i + 1), C.orange));

    const hakedisOrnek = [
      [1, '2026-01-01', '2026-02-28', '', 25, '', ''],
      [2, '2026-03-01', '2026-04-30', '', 30, '', ''],
      [3, '2026-05-01', '2026-06-30', '', 25, '', ''],
      [4, '2026-07-01', '2026-08-31', '', 20, '', ''],
    ];
    hakedisOrnek.forEach(row => {
      const r = ws5.addRow(row);
      r.height = 20;
      [1,2,3,4,5,6,7].forEach(c => {
        styleValue(r.getCell(c));
        if (c === 4) { r.getCell(c).numFmt = '#,##0.00'; }
        if (c === 5) { r.getCell(c).numFmt = '0.0"%"'; }
      });
    });

    const hakToplam = ws5.addRow(['', '', 'TOPLAM', '', { formula: 'SUM(E4:E7)' }, '', '']);
    hakToplam.height = 22;
    styleTotal(ws5.getCell(hakToplam.number, 1));
    styleTotal(ws5.getCell(hakToplam.number, 3));
    styleTotal(ws5.getCell(hakToplam.number, 5));
    ws5.getCell(hakToplam.number, 5).numFmt = '0.0"%"';

    // ════════════════════════════════════════════════════════════════════════
    // SAYFA 6: Personel ve Ekipman
    // ════════════════════════════════════════════════════════════════════════
    const ws6 = wb.addWorksheet('Personel ve Ekipman');
    ws6.columns = [{ width: 28 }, { width: 8 }, { width: 10 }, { width: 16 }, { width: 16 }, { width: 4 },
                   { width: 28 }, { width: 8 }, { width: 10 }, { width: 14 }, { width: 14 }];
    bannerRow(ws6, 'PERSONEL VE EKİPMAN PLANI', 11, C.navy);
    emptyRow(ws6);

    // Çift başlık
    const ph = ws6.addRow(['PERSONEL PLANI', '', '', '', '', '', 'EKİPMAN PLANI', '', '', '', '']);
    ws6.mergeCells(ph.number, 1, ph.number, 5); ws6.mergeCells(ph.number, 7, ph.number, 11);
    styleSection(ph.getCell(1), C.blue); styleSection(ph.getCell(7), C.orange); ph.height = 22;

    const ph2 = ws6.addRow(['Görev / Pozisyon', 'Adet', 'Süre (Ay)', 'Aylık Maaş (TL)', 'Toplam (TL)', '',
                             'Ekipman Adı', 'Adet', 'Süre (Ay)', 'Aylık Kira (TL)', 'Toplam (TL)']);
    ph2.height = 20;
    [1,2,3,4,5].forEach(c => styleHeader(ph2.getCell(c), C.blue));
    ph2.getCell(6).fill = fill(C.white);
    [7,8,9,10,11].forEach(c => styleHeader(ph2.getCell(c), C.orange));

    const personeller = ['Proje Müdürü','Şantiye Şefi','İnşaat Mühendisi','Mimar','İş Güvenliği Uzmanı','Muhasebeci','Formen','Güvenlik'];
    const ekipmanlar  = ['Ekskavatör / Kepçe','Vinç','Beton Pompası','Kamyon / Damperli','Compaktör / Silindir','Jeneratör','Beton Mikseri','İskele ve Kalıp'];
    const maxRows = Math.max(personeller.length, ekipmanlar.length);

    for (let i = 0; i < maxRows; i++) {
      const rowNum = ws6.rowCount + 1;
      const r = ws6.addRow([
        personeller[i] ?? '', '', '', '', i < personeller.length ? { formula: `B${rowNum}*C${rowNum}*D${rowNum}` } : '',
        '',
        ekipmanlar[i] ?? '', '', '', '', i < ekipmanlar.length ? { formula: `H${rowNum}*I${rowNum}*J${rowNum}` } : '',
      ]);
      r.height = 18;
      [1,2,3,4].forEach(c => { styleLabel(r.getCell(c)); });
      r.getCell(5).fill = fill(C.lightBlue); r.getCell(5).border = border();
      r.getCell(5).numFmt = '#,##0'; r.getCell(5).font = { color: { argb: 'FF' + C.blue } };
      r.getCell(6).fill = fill(C.white);
      [7,8,9,10].forEach(c => { styleLabel(r.getCell(c)); });
      r.getCell(11).fill = fill(C.lightOrange); r.getCell(11).border = border();
      r.getCell(11).numFmt = '#,##0'; r.getCell(11).font = { color: { argb: 'FF' + C.orange } };
      [4,10].forEach(c => { r.getCell(c).numFmt = '#,##0'; });
    }

    // ════════════════════════════════════════════════════════════════════════
    // SAYFA 7: Risk Analizi
    // ════════════════════════════════════════════════════════════════════════
    const ws7 = wb.addWorksheet('Risk Analizi');
    ws7.columns = [{ width: 6 }, { width: 40 }, { width: 18 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 35 }, { width: 16 }];
    bannerRow(ws7, 'RİSK ANALİZİ VE YÖNETİM PLANI', 8, C.navy);
    emptyRow(ws7);

    const riskHeaders = ['#', 'Risk Tanımı', 'Kategori', 'Olasılık (1-5)', 'Etki (1-5)', 'Risk Skoru (O×E)', 'Önlem / Aksiyon', 'Sorumlu'];
    const rh = ws7.addRow(riskHeaders);
    rh.height = 24;
    riskHeaders.forEach((_, i) => styleHeader(rh.getCell(i + 1), C.red));

    const riskler: [number, string, string][] = [
      [1, 'Fiyat artışı — malzeme ve işçilik', 'Finansal'],
      [2, 'İşveren gecikmeli ödeme riski', 'Finansal'],
      [3, 'Kur riski (dövizli ödemeler)', 'Finansal'],
      [4, 'Zemin sürprizi / Ek kazı gerekliliği', 'Teknik'],
      [5, 'Proje süre aşımı', 'Teknik'],
      [6, 'Alt yüklenici uyumsuzluğu', 'Teknik'],
      [7, 'İş kazası / SGK yaptırımı', 'Hukuki'],
      [8, 'Çevre / izin gecikmeleri', 'Hukuki'],
      [9, 'Hava koşulları — mevsimsel', 'Operasyonel'],
      [10, 'Ekipman arıza / temin sorunu', 'Operasyonel'],
      [11, 'Uzman personel kaybı', 'İnsan Kaynakları'],
      [12, 'Rakip firma fiyat baskısı', 'Rekabet'],
      [13, 'Gecikme cezası riski', 'Finansal'],
      [14, 'Teknik şartname uyumsuzluğu', 'Teknik'],
    ];

    riskler.forEach(([no, tanim, kategori]) => {
      const rowNum = ws7.rowCount + 1;
      const r = ws7.addRow([no, tanim, kategori, '', '', { formula: `D${rowNum}*E${rowNum}` }, '', '']);
      r.height = 20;
      styleValue(r.getCell(1)); r.getCell(1).alignment = { horizontal: 'center' };
      styleValue(r.getCell(2));
      // Kategori rengini belirle
      const katRenk: Record<string, string> = {
        'Finansal': C.orange, 'Teknik': C.blue, 'Hukuki': C.red,
        'Operasyonel': C.teal, 'İnsan Kaynakları': C.green, 'Rekabet': C.gray,
      };
      r.getCell(3).fill = fill(katRenk[kategori] ?? C.gray);
      r.getCell(3).font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
      r.getCell(3).border = border(katRenk[kategori] ?? C.gray);
      r.getCell(3).alignment = { horizontal: 'center' };
      [4,5].forEach(c => { styleValue(r.getCell(c)); r.getCell(c).alignment = { horizontal: 'center' }; });
      // Risk skoru formül
      r.getCell(6).fill = fill(C.lightRed); r.getCell(6).border = border();
      r.getCell(6).font = { bold: true, color: { argb: 'FF' + C.red } };
      r.getCell(6).alignment = { horizontal: 'center' };
      styleValue(r.getCell(7));
      styleValue(r.getCell(8)); r.getCell(8).alignment = { horizontal: 'center' };
    });

    // ── DONDUR, YAZDIRMA AYARLARI ────────────────────────────────────────────
    [ws1, ws2, ws3, ws4, ws5, ws6, ws7].forEach(ws => {
      ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];
    });

    // ── BUFFER GÖNDER ────────────────────────────────────────────────────────
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="insaat-erp-ihale-sablonu.xlsx"');

    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error('downloadSablon hatası:', error);
    res.status(500).json({ success: false, message: 'Şablon oluşturulamadı' });
  }
};
