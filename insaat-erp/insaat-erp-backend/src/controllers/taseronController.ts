import { Request, Response } from 'express';
import { query } from '../config/database';
import logger from '../utils/logger';

// ════════════════════════════════════════════════════════════════
// TAŞERONLAR
// ════════════════════════════════════════════════════════════════

export const getTaseronlar = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const result = await query(
      `SELECT t.*,
        COUNT(DISTINCT ts.id)  as sozlesme_sayisi,
        COALESCE(SUM(ts.sozlesme_bedeli), 0) as toplam_sozlesme,
        COALESCE(SUM(CASE WHEN ts.durum = 'devam' THEN ts.sozlesme_bedeli END), 0) as aktif_sozlesme
       FROM taseronlar t
       LEFT JOIN taseron_sozlesmeler ts ON ts.taseron_id = t.id
       WHERE t.tenant_id = $1 AND t.aktif = true
       GROUP BY t.id
       ORDER BY t.ad`,
      [tenantId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('getTaseronlar:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const getTaseron = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;
    const result = await query(
      `SELECT t.*,
        (SELECT json_agg(ts ORDER BY ts.sozlesme_tarihi DESC)
         FROM taseron_sozlesmeler ts WHERE ts.taseron_id = t.id) as sozlesmeler
       FROM taseronlar t
       WHERE t.id = $1 AND t.tenant_id = $2`,
      [id, tenantId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ success: false, message: 'Taşeron bulunamadı' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('getTaseron:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const createTaseron = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { ad, vergi_no, telefon, email, adres, yetkili, banka_adi, iban, notlar } = req.body;
    if (!ad?.trim()) {
      res.status(400).json({ success: false, message: 'Taşeron adı zorunlu' });
      return;
    }
    const result = await query(
      `INSERT INTO taseronlar (tenant_id, ad, vergi_no, telefon, email, adres, yetkili, banka_adi, iban, notlar)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [tenantId, ad, vergi_no, telefon, email, adres, yetkili, banka_adi, iban, notlar]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('createTaseron:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const updateTaseron = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;
    const { ad, telefon, email, adres, yetkili, banka_adi, iban, puan, aktif, notlar } = req.body;
    const result = await query(
      `UPDATE taseronlar SET
        ad = COALESCE($3, ad), telefon = COALESCE($4, telefon),
        email = COALESCE($5, email), adres = COALESCE($6, adres),
        yetkili = COALESCE($7, yetkili), banka_adi = COALESCE($8, banka_adi),
        iban = COALESCE($9, iban), puan = COALESCE($10, puan),
        aktif = COALESCE($11, aktif), notlar = COALESCE($12, notlar),
        guncellendi = NOW()
       WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, tenantId, ad, telefon, email, adres, yetkili, banka_adi, iban, puan, aktif, notlar]
    );
    if (!result.rows[0]) {
      res.status(404).json({ success: false, message: 'Taşeron bulunamadı' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('updateTaseron:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ════════════════════════════════════════════════════════════════
// TAŞERON SÖZLEŞMELERİ
// ════════════════════════════════════════════════════════════════

export const getSozlesmeler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { santiye_id, taseron_id, durum } = req.query;

    let where = 'WHERE ts.tenant_id = $1';
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (santiye_id) { where += ` AND ts.santiye_id = $${idx++}`; params.push(santiye_id); }
    if (taseron_id) { where += ` AND ts.taseron_id = $${idx++}`; params.push(taseron_id); }
    if (durum)      { where += ` AND ts.durum = $${idx++}`; params.push(durum); }

    const result = await query(
      `SELECT ts.*,
        t.ad as taseron_adi, t.vergi_no, t.telefon as taseron_tel,
        s.ad as santiye_adi, s.il,
        COALESCE((
          SELECT SUM(th.net_odeme) FROM taseron_hakedis th
          WHERE th.sozlesme_id = ts.id AND th.durum = 'odendi'
        ), 0) as odenen_toplam,
        COALESCE((
          SELECT SUM(th.net_odeme) FROM taseron_hakedis th
          WHERE th.sozlesme_id = ts.id
        ), 0) as hakedis_toplam,
        (SELECT COUNT(*) FROM taseron_hakedis th WHERE th.sozlesme_id = ts.id) as hakedis_sayisi
       FROM taseron_sozlesmeler ts
       JOIN taseronlar t ON t.id = ts.taseron_id
       JOIN santiyeler s ON s.id = ts.santiye_id
       ${where}
       ORDER BY ts.sozlesme_tarihi DESC`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('getSozlesmeler:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const getSozlesme = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;
    const result = await query(
      `SELECT ts.*,
        t.ad as taseron_adi, t.telefon as taseron_tel, t.email as taseron_email,
        t.iban, t.banka_adi,
        s.ad as santiye_adi, s.il,
        (SELECT json_agg(th ORDER BY th.donem_no)
         FROM taseron_hakedis th WHERE th.sozlesme_id = ts.id) as hakedisler
       FROM taseron_sozlesmeler ts
       JOIN taseronlar t ON t.id = ts.taseron_id
       JOIN santiyeler s ON s.id = ts.santiye_id
       WHERE ts.id = $1 AND ts.tenant_id = $2`,
      [id, tenantId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ success: false, message: 'Sözleşme bulunamadı' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('getSozlesme:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const createSozlesme = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const {
      taseron_id, santiye_id, sozlesme_no, is_tanimi, is_grubu,
      sozlesme_bedeli, sozlesme_tarihi, baslangic, bitis,
      odeme_vadesi, avans_tutari, kdv_orani, stopaj_orani, sgk_kesinti_oran, notlar
    } = req.body;

    if (!taseron_id || !santiye_id || !is_tanimi || !sozlesme_bedeli) {
      res.status(400).json({ success: false, message: 'Zorunlu alanlar eksik' });
      return;
    }

    // Taşeron ve şantiye bu tenant'a ait mi?
    const checks = await Promise.all([
      query('SELECT id FROM taseronlar WHERE id = $1 AND tenant_id = $2', [taseron_id, tenantId]),
      query('SELECT id FROM santiyeler WHERE id = $1 AND tenant_id = $2', [santiye_id, tenantId]),
    ]);
    if (!checks[0].rows[0] || !checks[1].rows[0]) {
      res.status(403).json({ success: false, message: 'Geçersiz taşeron veya şantiye' });
      return;
    }

    const result = await query(
      `INSERT INTO taseron_sozlesmeler
        (tenant_id, taseron_id, santiye_id, sozlesme_no, is_tanimi, is_grubu,
         sozlesme_bedeli, sozlesme_tarihi, baslangic, bitis,
         odeme_vadesi, avans_tutari, kdv_orani, stopaj_orani, sgk_kesinti_oran, notlar)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [tenantId, taseron_id, santiye_id, sozlesme_no, is_tanimi, is_grubu,
       sozlesme_bedeli, sozlesme_tarihi, baslangic, bitis,
       odeme_vadesi || 30, avans_tutari || 0, kdv_orani ?? 20, stopaj_orani || 0, sgk_kesinti_oran || 0, notlar]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('createSozlesme:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const updateSozlesme = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;
    const { durum, bitis, notlar } = req.body;
    const result = await query(
      `UPDATE taseron_sozlesmeler SET
        durum = COALESCE($3, durum),
        bitis = COALESCE($4, bitis),
        notlar = COALESCE($5, notlar),
        guncellendi = NOW()
       WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, tenantId, durum, bitis, notlar]
    );
    if (!result.rows[0]) {
      res.status(404).json({ success: false, message: 'Sözleşme bulunamadı' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('updateSozlesme:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ════════════════════════════════════════════════════════════════
// TAŞERON HAKEDİŞLERİ
// ════════════════════════════════════════════════════════════════

export const getHakedisler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { sozlesme_id } = req.params;

    // Sözleşmenin bu tenant'a ait olduğunu doğrula
    const check = await query(
      'SELECT id, sozlesme_bedeli, kdv_orani, stopaj_orani, sgk_kesinti_oran FROM taseron_sozlesmeler WHERE id = $1 AND tenant_id = $2',
      [sozlesme_id, tenantId]
    );
    if (!check.rows[0]) {
      res.status(404).json({ success: false, message: 'Sözleşme bulunamadı' });
      return;
    }

    const result = await query(
      `SELECT * FROM taseron_hakedis WHERE sozlesme_id = $1 ORDER BY donem_no`,
      [sozlesme_id]
    );
    res.json({ success: true, data: result.rows, sozlesme: check.rows[0] });
  } catch (error) {
    logger.error('getHakedisler:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const createHakedis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId } = req.user!;
    const { sozlesme_id } = req.params;
    const { tarih, sozlesme_is, diger_kesinti, notlar } = req.body;

    // Sözleşme bilgilerini çek
    const sozlesme = await query(
      `SELECT ts.*, t.id as taseron_db_id, s.id as santiye_db_id
       FROM taseron_sozlesmeler ts
       JOIN taseronlar t ON t.id = ts.taseron_id
       JOIN santiyeler s ON s.id = ts.santiye_id
       WHERE ts.id = $1 AND ts.tenant_id = $2`,
      [sozlesme_id, tenantId]
    );
    if (!sozlesme.rows[0]) {
      res.status(404).json({ success: false, message: 'Sözleşme bulunamadı' });
      return;
    }
    const sz = sozlesme.rows[0];

    // Son dönem numarasını bul
    const lastDonem = await query(
      'SELECT MAX(donem_no) as son FROM taseron_hakedis WHERE sozlesme_id = $1',
      [sozlesme_id]
    );
    const donem_no = (lastDonem.rows[0].son || 0) + 1;

    // Geçmiş toplamı hesapla
    const gecmisResult = await query(
      'SELECT COALESCE(SUM(sozlesme_is), 0) as toplam FROM taseron_hakedis WHERE sozlesme_id = $1',
      [sozlesme_id]
    );
    const gecmis_toplam = parseInt(gecmisResult.rows[0].toplam);
    const donem_toplam = gecmis_toplam + parseInt(sozlesme_is || 0);

    // Avans kesintisi (avans tutarını dönem sayısına böl)
    const avans_kesinti = sz.avans_tutari > 0 && !sz.avans_odendi
      ? Math.round(sz.avans_tutari * 0.25) // Her hakediş %25 geri al
      : 0;

    // Kesintiler
    const sgk_kesinti = Math.round(parseInt(sozlesme_is || 0) * (sz.sgk_kesinti_oran / 100));
    const stopaj_kesinti = Math.round(parseInt(sozlesme_is || 0) * (sz.stopaj_orani / 100));

    // KDV ve net ödeme
    const toplam_kesinti = avans_kesinti + sgk_kesinti + stopaj_kesinti + parseInt(diger_kesinti || 0);
    const kdv_tutari = Math.round((parseInt(sozlesme_is || 0) - toplam_kesinti) * (sz.kdv_orani / 100));
    const net_odeme = parseInt(sozlesme_is || 0) - toplam_kesinti + kdv_tutari;

    const result = await query(
      `INSERT INTO taseron_hakedis
        (tenant_id, sozlesme_id, donem_no, tarih, sozlesme_is, gecmis_toplam, donem_toplam,
         avans_kesinti, sgk_kesinti, stopaj_kesinti, diger_kesinti, kdv_tutari, net_odeme, notlar)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [tenantId, sozlesme_id, donem_no, tarih || new Date().toISOString().split('T')[0],
       sozlesme_is, gecmis_toplam, donem_toplam,
       avans_kesinti, sgk_kesinti, stopaj_kesinti, diger_kesinti || 0, kdv_tutari, net_odeme, notlar]
    );

    // Nakit çıkışı kaydı oluştur (onaylandığında)
    // addNakitHareketAsync - şimdilik hazır bırakıyoruz

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('createHakedis:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const onaylaHakedis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId } = req.user!;
    const { id } = req.params;
    const { odeme_tarihi } = req.body;

    // Hakediş bu tenant'a ait mi?
    const hakedis = await query(
      `SELECT th.*, ts.santiye_id, ts.sozlesme_no,
        t.ad as taseron_adi
       FROM taseron_hakedis th
       JOIN taseron_sozlesmeler ts ON ts.id = th.sozlesme_id
       JOIN taseronlar t ON t.id = ts.taseron_id
       WHERE th.id = $1 AND th.tenant_id = $2`,
      [id, tenantId]
    );
    if (!hakedis.rows[0]) {
      res.status(404).json({ success: false, message: 'Hakediş bulunamadı' });
      return;
    }
    const h = hakedis.rows[0];

    const yeniDurum = h.durum === 'taslak' ? 'onaylandi' : 'odendi';
    await query(
      `UPDATE taseron_hakedis SET durum = $2, odeme_tarihi = COALESCE($3, odeme_tarihi)
       WHERE id = $1`,
      [id, yeniDurum, odeme_tarihi || null]
    );

    // Ödendi ise nakit çıkışı kaydet
    if (yeniDurum === 'odendi') {
      await query(
        `INSERT INTO nakit_hareketleri
          (tenant_id, santiye_id, tarih, tip, kategori, aciklama, tutar, tutar_try, kaydeden_id, onaylandi)
         VALUES ($1,$2,$3,'cikis','taseron',$4,$5,$5,$6,true)`,
        [tenantId, h.santiye_id, odeme_tarihi || new Date().toISOString().split('T')[0],
         `${h.taseron_adi} - ${h.sozlesme_no || ''} ${h.donem_no}. Hakediş`,
         h.net_odeme, userId]
      );
    }

    res.json({ success: true, mesaj: `Hakediş ${yeniDurum} durumuna getirildi` });
  } catch (error) {
    logger.error('onaylaHakedis:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ════════════════════════════════════════════════════════════════
// EKİPMAN MALİYET
// ════════════════════════════════════════════════════════════════

export const getEkipmanMaliyet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { santiye_id, ekipman_id, yil, ay } = req.query;

    let where = 'WHERE em.tenant_id = $1';
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (santiye_id) { where += ` AND em.santiye_id = $${idx++}`; params.push(santiye_id); }
    if (ekipman_id) { where += ` AND em.ekipman_id = $${idx++}`; params.push(ekipman_id); }
    if (yil)        { where += ` AND EXTRACT(YEAR FROM em.tarih) = $${idx++}`; params.push(yil); }
    if (ay)         { where += ` AND EXTRACT(MONTH FROM em.tarih) = $${idx++}`; params.push(ay); }

    const result = await query(
      `SELECT em.*,
        e.ad as ekipman_adi, e.plaka, e.tip as ekipman_tip,
        s.ad as santiye_adi
       FROM ekipman_maliyet em
       JOIN ekipmanlar e ON e.id = em.ekipman_id
       LEFT JOIN santiyeler s ON s.id = em.santiye_id
       ${where}
       ORDER BY em.tarih DESC`,
      params
    );

    // Özet
    const ozet = await query(
      `SELECT
        tip,
        COUNT(*) as kayit_sayisi,
        SUM(tutar) as toplam
       FROM ekipman_maliyet em ${where}
       GROUP BY tip`,
      params
    );

    res.json({ success: true, data: result.rows, ozet: ozet.rows });
  } catch (error) {
    logger.error('getEkipmanMaliyet:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const addEkipmanMaliyet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, userId } = req.user!;
    const { ekipman_id, santiye_id, tarih, tip, tutar, aciklama } = req.body;

    // Ekipman bu tenant'a ait mi?
    const check = await query(
      'SELECT id FROM ekipmanlar WHERE id = $1 AND tenant_id = $2',
      [ekipman_id, tenantId]
    );
    if (!check.rows[0]) {
      res.status(404).json({ success: false, message: 'Ekipman bulunamadı' });
      return;
    }

    const result = await query(
      `INSERT INTO ekipman_maliyet (tenant_id, ekipman_id, santiye_id, tarih, tip, tutar, aciklama, kaydeden_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [tenantId, ekipman_id, santiye_id, tarih, tip || 'kira', tutar, aciklama, userId]
    );

    // Nakit çıkışı
    if (santiye_id && tutar > 0) {
      const ekipman = await query('SELECT ad FROM ekipmanlar WHERE id = $1', [ekipman_id]);
      await query(
        `INSERT INTO nakit_hareketleri
          (tenant_id, santiye_id, tarih, tip, kategori, aciklama, tutar, tutar_try, kaydeden_id, onaylandi)
         VALUES ($1,$2,$3,'cikis','ekipman',$4,$5,$5,$6,true)`,
        [tenantId, santiye_id, tarih,
         `${ekipman.rows[0]?.ad || 'Ekipman'} - ${tip}`, tutar, userId]
      );
    }

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('addEkipmanMaliyet:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

// ════════════════════════════════════════════════════════════════
// PUANTAJ — şantiye bazında toplu giriş
// ════════════════════════════════════════════════════════════════

export const getPuantajGrid = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { santiye_id, yil, ay } = req.query;

    if (!santiye_id) {
      res.status(400).json({ success: false, message: 'santiye_id gerekli' });
      return;
    }

    // Şantiye bu tenant'a ait mi?
    const check = await query('SELECT id FROM santiyeler WHERE id = $1 AND tenant_id = $2', [santiye_id, tenantId]);
    if (!check.rows[0]) {
      res.status(403).json({ success: false, message: 'Erişim yok' });
      return;
    }

    const now = new Date();
    const y = parseInt(yil as string || String(now.getFullYear()));
    const m = parseInt(ay as string || String(now.getMonth() + 1));
    const gunSayisi = new Date(y, m, 0).getDate();

    // Personel listesi
    const personeller = await query(
      `SELECT p.id, p.ad, p.soyad, p.gorev, p.maas, p.maas_turu
       FROM personel p
       WHERE p.santiye_id = $1 AND p.tenant_id = $2 AND p.aktif = true
       ORDER BY p.ad, p.soyad`,
      [santiye_id, tenantId]
    );

    // O ay puantajları
    const puantajlar = await query(
      `SELECT personel_id, tarih, calisma_saat, fazla_mesai, tatil_mi, yevmiye
       FROM puantaj
       WHERE santiye_id = $1 AND tenant_id = $2
         AND EXTRACT(YEAR FROM tarih) = $3
         AND EXTRACT(MONTH FROM tarih) = $4`,
      [santiye_id, tenantId, y, m]
    );

    // Puantaj map
    const map: Record<string, Record<number, any>> = {};
    for (const p of puantajlar.rows) {
      const gun = new Date(p.tarih).getDate();
      if (!map[p.personel_id]) map[p.personel_id] = {};
      map[p.personel_id][gun] = p;
    }

    res.json({
      success: true,
      data: {
        personeller: personeller.rows,
        puantajlar: map,
        meta: { yil: y, ay: m, gun_sayisi: gunSayisi }
      }
    });
  } catch (error) {
    logger.error('getPuantajGrid:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

export const savePuantajGrid = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.user!;
    const { santiye_id, kayitlar } = req.body;
    // kayitlar: [{personel_id, tarih, calisma_saat, fazla_mesai, tatil_mi}]

    if (!santiye_id || !Array.isArray(kayitlar)) {
      res.status(400).json({ success: false, message: 'Geçersiz veri' });
      return;
    }

    const check = await query('SELECT id FROM santiyeler WHERE id = $1 AND tenant_id = $2', [santiye_id, tenantId]);
    if (!check.rows[0]) {
      res.status(403).json({ success: false, message: 'Erişim yok' });
      return;
    }

    let eklenen = 0;
    for (const k of kayitlar) {
      await query(
        `INSERT INTO puantaj (tenant_id, personel_id, santiye_id, tarih, calisma_saat, fazla_mesai, tatil_mi, yevmiye)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (personel_id, tarih, santiye_id) DO UPDATE SET
           calisma_saat = EXCLUDED.calisma_saat,
           fazla_mesai = EXCLUDED.fazla_mesai,
           tatil_mi = EXCLUDED.tatil_mi,
           yevmiye = EXCLUDED.yevmiye`,
        [tenantId, k.personel_id, santiye_id, k.tarih,
         k.calisma_saat ?? 8, k.fazla_mesai ?? 0, k.tatil_mi ?? false, k.yevmiye ?? 0]
      );
      eklenen++;
    }

    res.json({ success: true, eklenen });
  } catch (error) {
    logger.error('savePuantajGrid:', error);
    res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};
