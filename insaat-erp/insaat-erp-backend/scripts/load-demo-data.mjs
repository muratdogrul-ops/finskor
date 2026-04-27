import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'insaat_erp',
  user: process.env.DB_USER || 'erp_user',
  password: process.env.DB_PASSWORD,
});

const DEMO_PREFIX = 'DEMO - ';

async function one(client, sql, params = []) {
  const res = await client.query(sql, params);
  return res.rows[0];
}

async function many(client, sql, params = []) {
  const res = await client.query(sql, params);
  return res.rows;
}

async function tableExists(client, tableName) {
  const row = await one(
    client,
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS ok`,
    [tableName],
  );
  return row.ok;
}

async function getTenantAndUser(client) {
  let user = await one(
    client,
    `SELECT k.id AS user_id, k.tenant_id, t.ad AS tenant_ad
     FROM kullanicilar k
     JOIN tenants t ON t.id = k.tenant_id
     WHERE k.email = 'info@finerp.tr'
     LIMIT 1`,
  );

  if (user) return user;

  user = await one(
    client,
    `SELECT k.id AS user_id, k.tenant_id, t.ad AS tenant_ad
     FROM kullanicilar k
     JOIN tenants t ON t.id = k.tenant_id
     WHERE k.rol IN ('admin','superadmin')
     ORDER BY k.olusturuldu
     LIMIT 1`,
  );

  if (!user) {
    throw new Error('Demo verisi için admin kullanıcı bulunamadı.');
  }
  return user;
}

async function cleanExistingDemo(client, tenantId) {
  const demoSantiyeIds = (await many(
    client,
    `SELECT id FROM santiyeler WHERE tenant_id = $1 AND ad LIKE $2`,
    [tenantId, `${DEMO_PREFIX}%`],
  )).map((r) => r.id);

  const demoIhaleIds = (await many(
    client,
    `SELECT id FROM ihale_projeleri WHERE tenant_id = $1 AND proje_adi LIKE $2`,
    [tenantId, `${DEMO_PREFIX}%`],
  )).map((r) => r.id);

  const demoTaseronIds = (await many(
    client,
    `SELECT id FROM taseronlar WHERE tenant_id = $1 AND ad LIKE $2`,
    [tenantId, `${DEMO_PREFIX}%`],
  )).map((r) => r.id);

  const demoEkipmanIds = demoSantiyeIds.length
    ? (await many(client, `SELECT id FROM ekipmanlar WHERE tenant_id = $1 AND santiye_id = ANY($2::uuid[])`, [tenantId, demoSantiyeIds])).map((r) => r.id)
    : [];

  const demoPersonelIds = demoSantiyeIds.length
    ? (await many(client, `SELECT id FROM personel WHERE tenant_id = $1 AND santiye_id = ANY($2::uuid[])`, [tenantId, demoSantiyeIds])).map((r) => r.id)
    : [];

  const demoStokIds = demoSantiyeIds.length
    ? (await many(client, `SELECT id FROM stoklar WHERE tenant_id = $1 AND santiye_id = ANY($2::uuid[])`, [tenantId, demoSantiyeIds])).map((r) => r.id)
    : [];

  const demoHakedisIds = demoSantiyeIds.length
    ? (await many(client, `SELECT id FROM hakedisler WHERE tenant_id = $1 AND santiye_id = ANY($2::uuid[])`, [tenantId, demoSantiyeIds])).map((r) => r.id)
    : [];

  const demoSozlesmeIds = demoTaseronIds.length
    ? (await many(client, `SELECT id FROM taseron_sozlesmeler WHERE tenant_id = $1 AND taseron_id = ANY($2::uuid[])`, [tenantId, demoTaseronIds])).map((r) => r.id)
    : [];

  if (await tableExists(client, 'musteri_rapor_linkleri') && demoSantiyeIds.length) {
    await client.query(`DELETE FROM musteri_rapor_linkleri WHERE tenant_id = $1 AND santiye_id = ANY($2::uuid[])`, [tenantId, demoSantiyeIds]);
  }

  if (await tableExists(client, 'stok_hareketleri') && demoStokIds.length) {
    await client.query(`DELETE FROM stok_hareketleri WHERE tenant_id = $1 AND stok_id = ANY($2::uuid[])`, [tenantId, demoStokIds]);
  }
  if (await tableExists(client, 'stoklar') && demoStokIds.length) {
    await client.query(`DELETE FROM stoklar WHERE tenant_id = $1 AND id = ANY($2::uuid[])`, [tenantId, demoStokIds]);
  }

  if (await tableExists(client, 'taseron_hakedis') && demoSozlesmeIds.length) {
    await client.query(`DELETE FROM taseron_hakedis WHERE tenant_id = $1 AND sozlesme_id = ANY($2::uuid[])`, [tenantId, demoSozlesmeIds]);
  }
  if (await tableExists(client, 'taseron_sozlesmeler') && demoSozlesmeIds.length) {
    await client.query(`DELETE FROM taseron_sozlesmeler WHERE tenant_id = $1 AND id = ANY($2::uuid[])`, [tenantId, demoSozlesmeIds]);
  }
  if (await tableExists(client, 'taseronlar') && demoTaseronIds.length) {
    await client.query(`DELETE FROM taseronlar WHERE tenant_id = $1 AND id = ANY($2::uuid[])`, [tenantId, demoTaseronIds]);
  }

  if (await tableExists(client, 'ekipman_maliyet') && demoEkipmanIds.length) {
    await client.query(`DELETE FROM ekipman_maliyet WHERE tenant_id = $1 AND ekipman_id = ANY($2::uuid[])`, [tenantId, demoEkipmanIds]);
  }
  if (demoEkipmanIds.length) {
    await client.query(`DELETE FROM ekipman_bakimlari WHERE ekipman_id = ANY($1::uuid[])`, [demoEkipmanIds]);
    await client.query(`DELETE FROM ekipmanlar WHERE tenant_id = $1 AND id = ANY($2::uuid[])`, [tenantId, demoEkipmanIds]);
  }

  if (demoPersonelIds.length) {
    await client.query(`DELETE FROM puantaj WHERE tenant_id = $1 AND personel_id = ANY($2::uuid[])`, [tenantId, demoPersonelIds]);
    await client.query(`DELETE FROM personel WHERE tenant_id = $1 AND id = ANY($2::uuid[])`, [tenantId, demoPersonelIds]);
  }

  if (demoSantiyeIds.length) {
    await client.query(`DELETE FROM fotograflar WHERE tenant_id = $1 AND santiye_id = ANY($2::uuid[])`, [tenantId, demoSantiyeIds]);
    await client.query(`DELETE FROM santiye_gunlukleri WHERE tenant_id = $1 AND santiye_id = ANY($2::uuid[])`, [tenantId, demoSantiyeIds]);
    await client.query(`DELETE FROM mesajlar WHERE tenant_id = $1 AND santiye_id = ANY($2::uuid[])`, [tenantId, demoSantiyeIds]);
    await client.query(`DELETE FROM fatura_kalemleri WHERE fatura_id IN (SELECT id FROM faturalar WHERE tenant_id = $1 AND (santiye_id = ANY($2::uuid[]) OR fatura_no LIKE 'DEMO-%'))`, [tenantId, demoSantiyeIds]);
    await client.query(`DELETE FROM faturalar WHERE tenant_id = $1 AND (santiye_id = ANY($2::uuid[]) OR fatura_no LIKE 'DEMO-%')`, [tenantId, demoSantiyeIds]);
    if (demoHakedisIds.length) {
      await client.query(`DELETE FROM hakedis_kalemleri WHERE hakedis_id = ANY($1::uuid[])`, [demoHakedisIds]);
      await client.query(`DELETE FROM hakedisler WHERE tenant_id = $1 AND id = ANY($2::uuid[])`, [tenantId, demoHakedisIds]);
    }
    await client.query(`DELETE FROM satinalma_talepleri WHERE tenant_id = $1 AND santiye_id = ANY($2::uuid[])`, [tenantId, demoSantiyeIds]);
    await client.query(`DELETE FROM nakit_hareketleri WHERE tenant_id = $1 AND (santiye_id = ANY($2::uuid[]) OR aciklama LIKE 'DEMO:%')`, [tenantId, demoSantiyeIds]);
    await client.query(`DELETE FROM nakit_tahminleri WHERE tenant_id = $1 AND santiye_id = ANY($2::uuid[])`, [tenantId, demoSantiyeIds]);
  }

  if (await tableExists(client, 'ihale_hakedis_takvimi') && demoIhaleIds.length) {
    await client.query(`DELETE FROM ihale_hakedis_takvimi WHERE tenant_id = $1 AND ihale_id = ANY($2::uuid[])`, [tenantId, demoIhaleIds]);
    await client.query(`DELETE FROM ihale_nakit_projeksiyonu WHERE tenant_id = $1 AND ihale_id = ANY($2::uuid[])`, [tenantId, demoIhaleIds]);
    await client.query(`DELETE FROM metraj_kalemleri WHERE tenant_id = $1 AND ihale_id = ANY($2::uuid[])`, [tenantId, demoIhaleIds]);
    await client.query(`DELETE FROM ihale_projeleri WHERE tenant_id = $1 AND id = ANY($2::uuid[])`, [tenantId, demoIhaleIds]);
  }

  if (demoSantiyeIds.length) {
    await client.query(`DELETE FROM santiyeler WHERE tenant_id = $1 AND id = ANY($2::uuid[])`, [tenantId, demoSantiyeIds]);
  }
}

async function createDemo(client, tenantId, userId) {
  const santiyeler = [
    {
      key: 'merkez',
      ad: `${DEMO_PREFIX}Ankara Merkez Konutları`,
      tip: 'ustyapi',
      il: 'Ankara',
      ilce: 'Çankaya',
      adres: 'Mustafa Kemal Mah. 2120 Cad. No:12',
      sozlesme: 185000000,
      gerceklesen: 98500000,
      ilerleme: 53,
      baslangic: '2025-02-01',
      bitis: '2026-04-30',
      notlar: 'Satış demosu için oluşturulan ana konut projesi.',
    },
    {
      key: 'altyapi',
      ad: `${DEMO_PREFIX}İzmir OSB Altyapı Etabı`,
      tip: 'altyapi',
      il: 'İzmir',
      ilce: 'Kemalpaşa',
      adres: 'Kemalpaşa OSB 4. Etap',
      sozlesme: 128000000,
      gerceklesen: 74200000,
      ilerleme: 61,
      baslangic: '2025-01-15',
      bitis: '2025-12-31',
      notlar: 'Altyapı, kanal ve yol imalatlarını gösteren demo proje.',
    },
    {
      key: 'otel',
      ad: `${DEMO_PREFIX}Antalya Sahil Otel Renovasyon`,
      tip: 'karma',
      il: 'Antalya',
      ilce: 'Muratpaşa',
      adres: 'Lara Turizm Bölgesi',
      sozlesme: 76000000,
      gerceklesen: 22800000,
      ilerleme: 30,
      baslangic: '2025-04-01',
      bitis: '2026-01-31',
      notlar: 'Renovasyon, taşeron ve hızlı puantaj akışını göstermek için demo.',
    },
  ];

  const santiye = {};
  for (const s of santiyeler) {
    const row = await one(
      client,
      `INSERT INTO santiyeler
        (tenant_id, ad, tip, il, ilce, adres, mudur_id, baslangic, bitis_planlanan,
         sozlesme_no, sozlesme_bedel, gerceklesen, fiziksel_ilerleme, durum, notlar)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'devam',$14)
       RETURNING *`,
      [tenantId, s.ad, s.tip, s.il, s.ilce, s.adres, userId, s.baslangic, s.bitis, `DEMO-SZ-${s.key.toUpperCase()}`, s.sozlesme, s.gerceklesen, s.ilerleme, s.notlar],
    );
    santiye[s.key] = row;
  }

  const ihale = await one(
    client,
    `INSERT INTO ihale_projeleri
      (tenant_id, santiye_id, yukleyen_id, proje_adi, isveren, il, ilce, sozlesme_no,
       ihale_tarihi, sozlesme_tarihi, baslangic_tarihi, sure_gun, teklif_bedeli,
       maliyet_malzeme, maliyet_iscilik, maliyet_ekipman, maliyet_taseron,
       maliyet_genel_gider, maliyet_risk_payi, toplam_maliyet, durum, notlar)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'2025-01-10','2025-01-25','2025-02-01',454,$9,
       $10,$11,$12,$13,$14,$15,$16,'kazanildi',$17)
     RETURNING *`,
    [
      tenantId,
      santiye.merkez.id,
      userId,
      `${DEMO_PREFIX}Ankara Merkez Konutları İhalesi`,
      'Ankara Büyükşehir Belediyesi',
      'Ankara',
      'Çankaya',
      'DEMO-IH-2025-001',
      185000000,
      72000000,
      26000000,
      15500000,
      33000000,
      10500000,
      7000000,
      164000000,
      'Excel şablonundan içe aktarılmış örnek ihale.',
    ],
  );

  const metrajlar = [
    ['01.001', 'Kazı-Dolgu', 'Temel kazısı ve hafriyat nakli', 'm3', 18500, 310],
    ['02.010', 'Betonarme', 'C35 hazır beton temini ve dökümü', 'm3', 7200, 2950],
    ['02.020', 'Betonarme', 'B500C nervürlü demir', 'ton', 1180, 31000],
    ['03.100', 'İnce İşler', 'Alçı sıva ve boya imalatı', 'm2', 42000, 185],
    ['04.050', 'Mekanik', 'Isıtma-soğutma tesisatı', 'daire', 240, 52000],
    ['05.060', 'Elektrik', 'Zayıf ve kuvvetli akım tesisatı', 'daire', 240, 38000],
  ];
  for (let i = 0; i < metrajlar.length; i++) {
    const [poz, grup, ad, birim, miktar, fiyat] = metrajlar[i];
    await client.query(
      `INSERT INTO metraj_kalemleri (tenant_id, ihale_id, poz_no, is_grubu, kalem_adi, birim, miktar, birim_fiyat, sira)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [tenantId, ihale.id, poz, grup, ad, birim, miktar, fiyat, i + 1],
    );
  }

  let kumNakit = 0;
  for (let ay = 1; ay <= 8; ay++) {
    const imalat = Math.round(185000000 * (ay <= 2 ? 0.08 : ay <= 5 ? 0.13 : 0.11));
    const gider = Math.round(imalat * (ay <= 3 ? 0.92 : 0.82));
    const tahsilat = Math.round(imalat * 0.88);
    const net = tahsilat - gider;
    kumNakit += net;
    await client.query(
      `INSERT INTO ihale_nakit_projeksiyonu
        (tenant_id, ihale_id, ay_no, ay_tarihi, planlanan_imalat, imalat_kumulatif,
         planlanan_tahsilat, gider_malzeme, gider_iscilik, gider_ekipman, gider_taseron,
         gider_genel, toplam_gider, net_nakit, kumulatif_nakit)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        tenantId, ihale.id, ay, `2025-${String(ay + 1).padStart(2, '0')}-01`,
        imalat, imalat * ay, tahsilat,
        Math.round(gider * 0.42), Math.round(gider * 0.18), Math.round(gider * 0.10),
        Math.round(gider * 0.22), Math.round(gider * 0.08), gider, net, kumNakit,
      ],
    );
    await client.query(
      `INSERT INTO ihale_hakedis_takvimi
        (tenant_id, ihale_id, donem_no, donem_baslangic, donem_bitis, planlanan_tutar, planlanan_yuzde, beklenen_odeme)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [tenantId, ihale.id, ay, `2025-${String(ay + 1).padStart(2, '0')}-01`, `2025-${String(ay + 1).padStart(2, '0')}-28`, tahsilat, 12.5, `2025-${String(ay + 2).padStart(2, '0')}-15`],
    );
  }

  const hakedis = {};
  for (const h of [
    { key: 'hk1', s: 'merkez', no: 'DEMO-HK-001', tutar: 12500000, durum: 'odendi', bas: '2025-03-01', bit: '2025-03-31' },
    { key: 'hk2', s: 'merkez', no: 'DEMO-HK-002', tutar: 18600000, durum: 'onaylandi', bas: '2025-04-01', bit: '2025-04-30' },
    { key: 'hk3', s: 'altyapi', no: 'DEMO-HK-003', tutar: 14800000, durum: 'incelemede', bas: '2025-04-01', bit: '2025-04-30' },
  ]) {
    const kdv = Math.round(h.tutar * 0.20);
    const row = await one(
      client,
      `INSERT INTO hakedisler
        (tenant_id, santiye_id, no, tip, donem_baslangic, donem_bitis, tutar, kdv_orani,
         kdv_tutari, toplam_tutar, durum, hazırlayan_id, odeme_tarihi, notlar)
       VALUES ($1,$2,$3,'ara',$4,$5,$6,20,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [tenantId, santiye[h.s].id, h.no, h.bas, h.bit, h.tutar, kdv, h.tutar + kdv, h.durum, userId, h.durum === 'odendi' ? '2025-04-18' : null, 'Demo hakediş kaydı'],
    );
    hakedis[h.key] = row;
    for (const [poz, tanim, birim, miktar, fiyat] of [
      ['02.010', 'C35 beton dökümü', 'm3', 820, 2950],
      ['02.020', 'B500C demir imalatı', 'ton', 115, 31000],
      ['03.100', 'İnce işler ilerleme', 'm2', 4500, 185],
    ]) {
      await client.query(
        `INSERT INTO hakedis_kalemleri (hakedis_id, poz_no, tanim, birim, miktar, birim_fiyat, toplam, sira)
         VALUES ($1,$2,$3,$4,$5,$6,$7,1)`,
        [row.id, poz, tanim, birim, miktar, fiyat, Math.round(Number(miktar) * Number(fiyat))],
      );
    }
  }

  const faturalar = [
    { no: 'DEMO-FTR-2025-001', h: 'hk1', s: 'merkez', tarih: '2025-04-05', vade: '2025-05-05', tutar: 12500000, durum: 'odendi', gib: 'basarili' },
    { no: 'DEMO-FTR-2025-002', h: 'hk2', s: 'merkez', tarih: '2025-05-06', vade: '2025-06-05', tutar: 18600000, durum: 'bekliyor', gib: 'gonderildi' },
    { no: 'DEMO-FTR-2025-003', h: 'hk3', s: 'altyapi', tarih: '2025-05-08', vade: '2025-06-07', tutar: 14800000, durum: 'bekliyor', gib: 'taslak' },
  ];
  for (const f of faturalar) {
    const kdv = Math.round(f.tutar * 0.2);
    const fatura = await one(
      client,
      `INSERT INTO faturalar
        (tenant_id, santiye_id, hakedis_id, fatura_no, fatura_tipi, senaryo, fatura_tarihi, vade_tarihi,
         alici_vkn_tckn, alici_unvan, alici_adres, alici_vergi_dairesi, alici_il,
         mal_hizmet_toplam, kdv_toplam, stopaj_toplam, iskonto_toplam, genel_toplam,
         gib_durum, odeme_durumu, odeme_tarihi, doviz, kur, notlar, olusturan_id)
       VALUES ($1,$2,$3,$4,'satis','TICARI',$5,$6,'1234567890','Demo İşveren AŞ',
         'Demo müşteri adresi','Çankaya','Ankara',$7,$8,0,0,$9,$10,$11,$12,'TRY',1,'Demo fatura',$13)
       RETURNING *`,
      [tenantId, santiye[f.s].id, hakedis[f.h].id, f.no, f.tarih, f.vade, f.tutar, kdv, f.tutar + kdv, f.gib, f.durum, f.durum === 'odendi' ? '2025-04-20' : null, userId],
    );
    await client.query(
      `INSERT INTO fatura_kalemleri
        (fatura_id, sira_no, tanim, miktar, birim, birim_fiyat, kdv_orani, stopaj_orani,
         iskonto_orani, kalem_toplam, kdv_tutar, stopaj_tutar, net_tutar)
       VALUES ($1,1,'Demo hakediş hizmet bedeli',1,'ADET',$2,20,0,0,$2,$3,0,$4)`,
      [fatura.id, f.tutar, kdv, f.tutar + kdv],
    );
    await client.query(`UPDATE hakedisler SET fatura_id = $1 WHERE id = $2`, [fatura.id, hakedis[f.h].id]);
  }

  const taseronlar = {};
  for (const t of [
    { key: 'kaba', ad: `${DEMO_PREFIX}Kaya Kaba İnşaat`, vergi: '1112223334', yetkili: 'Serkan Kaya', tel: '0532 111 22 33', puan: 8 },
    { key: 'mekanik', ad: `${DEMO_PREFIX}Akdeniz Mekanik`, vergi: '5556667778', yetkili: 'Derya Akdeniz', tel: '0533 444 55 66', puan: 7 },
    { key: 'elektrik', ad: `${DEMO_PREFIX}Voltaj Elektrik`, vergi: '9998887776', yetkili: 'Mert Aydın', tel: '0535 888 77 66', puan: 9 },
  ]) {
    const row = await one(
      client,
      `INSERT INTO taseronlar
        (tenant_id, ad, vergi_no, telefon, email, yetkili, banka_adi, iban, puan, notlar)
       VALUES ($1,$2,$3,$4,$5,$6,'Demo Bank','TR000000000000000000000000',$7,'Demo taşeron')
       RETURNING *`,
      [tenantId, t.ad, t.vergi, t.tel, `${t.key}@demo-taseron.com`, t.yetkili, t.puan],
    );
    taseronlar[t.key] = row;
  }

  const sozlesme = await one(
    client,
    `INSERT INTO taseron_sozlesmeler
      (tenant_id, taseron_id, santiye_id, sozlesme_no, is_tanimi, is_grubu, sozlesme_bedeli,
       sozlesme_tarihi, baslangic, bitis, odeme_vadesi, avans_tutari, kdv_orani, stopaj_orani,
       sgk_kesinti_oran, durum, notlar)
     VALUES ($1,$2,$3,'DEMO-TS-001','Kaba inşaat ve betonarme işçilikleri','Betonarme',$4,
       '2025-02-10','2025-02-15','2025-09-30',30,1500000,20,3,2,'devam','Demo taşeron sözleşmesi')
     RETURNING *`,
    [tenantId, taseronlar.kaba.id, santiye.merkez.id, 28500000],
  );

  for (const h of [
    { donem: 1, is: 4200000, durum: 'odendi' },
    { donem: 2, is: 5100000, durum: 'onaylandi' },
  ]) {
    const stopaj = Math.round(h.is * 0.03);
    const sgk = Math.round(h.is * 0.02);
    const avans = h.donem === 1 ? 375000 : 375000;
    const kdv = Math.round((h.is - stopaj - sgk - avans) * 0.2);
    const net = h.is - stopaj - sgk - avans + kdv;
    await client.query(
      `INSERT INTO taseron_hakedis
        (tenant_id, sozlesme_id, donem_no, tarih, sozlesme_is, gecmis_toplam, donem_toplam,
         avans_kesinti, sgk_kesinti, stopaj_kesinti, diger_kesinti, kdv_tutari, net_odeme,
         odeme_tarihi, durum, notlar)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11,$12,$13,$14,'Demo taşeron hakedişi')`,
      [tenantId, sozlesme.id, h.donem, `2025-0${h.donem + 3}-25`, h.is, h.donem === 1 ? 0 : 4200000, h.donem === 1 ? h.is : 9300000, avans, sgk, stopaj, kdv, net, h.durum === 'odendi' ? '2025-05-05' : null, h.durum],
    );
  }

  const personelIds = [];
  for (const p of [
    ['Ahmet', 'Yıldız', 'Şantiye Şefi', 85000, 'merkez'],
    ['Elif', 'Kara', 'Saha Mühendisi', 62000, 'merkez'],
    ['Murat', 'Can', 'Kalıp Ustası', 42000, 'merkez'],
    ['Sibel', 'Koç', 'İSG Uzmanı', 58000, 'altyapi'],
    ['Tuncay', 'Demir', 'Makine Operatörü', 46000, 'altyapi'],
    ['Deniz', 'Ateş', 'Elektrik Teknikeri', 39000, 'otel'],
  ]) {
    const row = await one(
      client,
      `INSERT INTO personel (tenant_id, santiye_id, ad, soyad, gorev, departman, ise_giris, maas, maas_turu, sgk_no)
       VALUES ($1,$2,$3,$4,$5,'Saha','2025-01-15',$6,'aylik',$7)
       RETURNING *`,
      [tenantId, santiye[p[4]].id, p[0], p[1], p[2], p[3], `DEMO-SGK-${Math.floor(Math.random() * 900000 + 100000)}`],
    );
    personelIds.push(row);
  }

  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  for (const p of personelIds) {
    for (let gun = 1; gun <= 14; gun++) {
      const d = new Date(y, m, gun);
      const haftaSonu = d.getDay() === 0 || d.getDay() === 6;
      await client.query(
        `INSERT INTO puantaj (tenant_id, personel_id, santiye_id, tarih, calisma_saat, fazla_mesai, tatil_mi, yevmiye)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [tenantId, p.id, p.santiye_id, d.toISOString().slice(0, 10), haftaSonu ? 0 : 8, haftaSonu ? 0 : (gun % 5 === 0 ? 2 : 0), haftaSonu, 0],
      );
    }
  }

  const ekipmanIds = [];
  for (const e of [
    ['Tower Crane Liebherr 250', '06 DEM 101', 'kiralik', 'kule_vinc', 82000, 'ay', 'merkez'],
    ['Beton Pompası Putzmeister', '06 DEM 102', 'ozmal', 'beton_pompasi', 0, 'ay', 'merkez'],
    ['Ekskavatör CAT 330', '35 DEM 201', 'kiralik', 'ekskavator', 145000, 'ay', 'altyapi'],
    ['Jeneratör 400 kVA', '07 DEM 301', 'kiralik', 'jenerator', 38000, 'ay', 'otel'],
  ]) {
    const row = await one(
      client,
      `INSERT INTO ekipmanlar
        (tenant_id, santiye_id, ad, plaka, tip, kategori, kira_bedeli, kira_birimi, durum, verimlilik,
         bakim_periyodu, son_bakim, sonraki_bakim, muayene_tarihi, sigorta_tarihi)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'aktif',80,30,'2025-04-01','2025-05-01','2025-12-31','2025-12-31')
       RETURNING *`,
      [tenantId, santiye[e[6]].id, e[0], e[1], e[2], e[3], e[4], e[5]],
    );
    ekipmanIds.push(row);
  }

  for (const e of ekipmanIds) {
    await client.query(
      `INSERT INTO ekipman_maliyet (tenant_id, ekipman_id, santiye_id, tarih, tip, tutar, aciklama, kaydeden_id)
       VALUES ($1,$2,$3,'2025-05-01','kira',$4,'Demo ekipman kira maliyeti',$5)`,
      [tenantId, e.id, e.santiye_id, Number(e.kira_bedeli || 0), userId],
    );
  }

  for (const st of [
    ['merkez', 'C35 Hazır Beton', 'beton', 'm3', 420, 80, 2950, 'Merkez Depo'],
    ['merkez', 'B500C Demir', 'demir', 'ton', 96, 25, 31000, 'Demir Sahası'],
    ['altyapi', 'HDPE Boru Ø1000', 'altyapi', 'metre', 640, 120, 4200, 'OSB Depo'],
    ['otel', 'Alçıpan Levha', 'ince_isler', 'm2', 1800, 300, 145, 'Lara Depo'],
  ]) {
    const row = await one(
      client,
      `INSERT INTO stoklar
        (tenant_id, santiye_id, malzeme_adi, kategori, birim, mevcut_miktar, minimum_miktar, birim_maliyet, depo_yeri)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [tenantId, santiye[st[0]].id, st[1], st[2], st[3], st[4], st[5], st[6], st[7]],
    );
    await client.query(
      `INSERT INTO stok_hareketleri
        (tenant_id, stok_id, santiye_id, hareket_tipi, miktar, onceki_miktar, sonraki_miktar,
         birim_fiyat, toplam_tutar, aciklama, kaydeden_id, tarih)
       VALUES ($1,$2,$3,'giris',$4,0,$4,$5,$6,'Demo başlangıç stok girişi',$7,'2025-05-01')`,
      [tenantId, row.id, row.santiye_id, row.mevcut_miktar, row.birim_maliyet, Number(row.mevcut_miktar) * Number(row.birim_maliyet), userId],
    );
  }

  for (const sa of [
    ['merkez', 'Seramik 60x60', 'ince_isler', 3200, 'm2', 280, 'Kütahya Seramik', 'onay_bekliyor', true],
    ['altyapi', 'Rögar Kapağı D400', 'altyapi', 180, 'adet', 1750, 'Pik Döküm AŞ', 'siparis', false],
    ['otel', 'VRF İç Ünite', 'mekanik', 48, 'adet', 18500, 'Akdeniz Mekanik', 'beklemede', false],
  ]) {
    await client.query(
      `INSERT INTO satinalma_talepleri
        (tenant_id, santiye_id, talep_no, malzeme_adi, kategori, miktar, birim, tahmini_fiyat,
         toplam_tahmini, tedarikci, acil_mi, gerekli_tarih, durum, talep_eden_id, notlar)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'2025-06-10',$12,$13,'Demo satın alma talebi')`,
      [tenantId, santiye[sa[0]].id, `DEMO-ST-${Math.floor(Math.random() * 9000 + 1000)}`, sa[1], sa[2], sa[3], sa[4], sa[5], Number(sa[3]) * Number(sa[5]), sa[6], sa[8], sa[7], userId],
    );
  }

  const gunlukler = [
    ['merkez', 'Betonarme imalatları devam ediyor', 'C blok 5. kat döşeme demirleri tamamlandı. Beton dökümü için pompa planlandı.', 'acik', 42, 7, 3, 54, false],
    ['altyapi', 'Yağmur suyu hattı ilerlemesi', 'DN1000 boru hattında 180 metre montaj tamamlandı. Trafik güvenliği bariyerleri yenilendi.', 'bulutlu', 28, 5, 2, 62, false],
    ['otel', 'Mekanik şaftlarda gecikme riski', 'Mekanik taşeron ekip sayısını artırmalı. Malzeme sevkiyatında iki günlük gecikme bekleniyor.', 'acik', 24, 4, 1, 31, true],
  ];
  for (const g of gunlukler) {
    const row = await one(
      client,
      `INSERT INTO santiye_gunlukleri
        (tenant_id, santiye_id, tarih, baslik, icerik, hava_durumu, sicaklik, sahada_personel,
         sahada_ekipman, fiziksel_ilerleme, gecikme_var_mi, gecikme_nedeni, risk_notu, is_kalemi, ekleyen_id)
       VALUES ($1,$2,CURRENT_DATE,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [tenantId, santiye[g[0]].id, g[1], g[2], g[3], g[4], g[5], g[6], g[7], g[8], g[8] ? 'Taşeron ve malzeme sevkiyat gecikmesi' : null, g[8] ? 'Tedarik ve ekip planı takip edilmeli' : null, 'Günlük saha raporu', userId],
    );
    await client.query(
      `INSERT INTO fotograflar
        (tenant_id, santiye_id, gunluk_id, yukleyen_id, dosya_adi, dosya_yolu, thumbnail_yolu,
         dosya_boyutu, mime_type, aciklama, konum, etiketler, cekilen_tarih)
       VALUES ($1,$2,$3,$4,$5,$6,$7,245000,'image/jpeg',$8,$9,$10,NOW())`,
      [tenantId, santiye[g[0]].id, row.id, userId, `demo-${g[0]}-saha.jpg`, `/uploads/demo-${g[0]}-saha.jpg`, `/uploads/thumb-demo-${g[0]}-saha.jpg`, `${g[1]} fotoğrafı`, santiye[g[0]].il, ['demo', 'saha']],
    );
  }

  for (const msg of [
    ['merkez', 'DEMO: Hakediş evrakları kontrol edildi, eksik belge görünmüyor.'],
    ['altyapi', 'DEMO: Boru sevkiyatının ikinci partisi sahaya indirildi.'],
    ['otel', 'DEMO: Mekanik taşeron ekip sayısı için toplantı planlandı.'],
  ]) {
    await client.query(
      `INSERT INTO mesajlar (tenant_id, santiye_id, gonderen_id, mesaj) VALUES ($1,$2,$3,$4)`,
      [tenantId, santiye[msg[0]].id, userId, msg[1]],
    );
  }

  for (const n of [
    ['merkez', 'giris', 'hakedis', 'DEMO: Hakediş tahsilatı', 15000000],
    ['merkez', 'cikis', 'taseron', 'DEMO: Taşeron avans ödemesi', 1500000],
    ['altyapi', 'cikis', 'malzeme', 'DEMO: HDPE boru ödemesi', 6200000],
    ['otel', 'cikis', 'ekipman', 'DEMO: Jeneratör kira ödemesi', 38000],
  ]) {
    await client.query(
      `INSERT INTO nakit_hareketleri
        (tenant_id, santiye_id, tarih, tip, kategori, aciklama, tutar, tutar_try, kaydeden_id, onaylandi)
       VALUES ($1,$2,CURRENT_DATE,$3,$4,$5,$6,$6,$7,true)`,
      [tenantId, santiye[n[0]].id, n[1], n[2], n[3], n[4], userId],
    );
  }

  if (await tableExists(client, 'musteri_rapor_linkleri')) {
    await client.query(
      `INSERT INTO musteri_rapor_linkleri (tenant_id, santiye_id, baslik, gecerlilik_tarihi, aktif, olusturan_id)
       VALUES ($1,$2,'DEMO müşteri paylaşım linki',CURRENT_DATE + INTERVAL '30 days',true,$3)`,
      [tenantId, santiye.merkez.id, userId],
    );
  }

  return {
    santiyeler: Object.keys(santiye).length,
    metraj: metrajlar.length,
    personel: personelIds.length,
    ekipman: ekipmanIds.length,
    stok: 4,
    faturalar: faturalar.length,
    taseronlar: Object.keys(taseronlar).length,
  };
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { tenant_id: tenantId, user_id: userId, tenant_ad: tenantAd } = await getTenantAndUser(client);
    console.log(`Demo veri hedefi: ${tenantAd} (${tenantId})`);

    await cleanExistingDemo(client, tenantId);
    const summary = await createDemo(client, tenantId, userId);

    await client.query('COMMIT');
    console.log('Demo veri seti hazır:', summary);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Demo veri yükleme hatası:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
