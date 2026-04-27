-- ─────────────────────────────────────────────────────────────────────────────
-- 010_muhasebe.sql  —  Muhasebe Çekirdeği
-- Tekdüzen Muhasebe Sistemi (TMS) uyumlu hesap planı + yevmiye defteri
-- ─────────────────────────────────────────────────────────────────────────────

-- Hesap Planı
CREATE TABLE IF NOT EXISTS hesap_plani (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kod          VARCHAR(20) NOT NULL,          -- 100, 102, 120.01 vb.
  ad           TEXT NOT NULL,
  tip          VARCHAR(20) NOT NULL           -- aktif | pasif | gelir | gider | oz_sermaye
               CHECK (tip IN ('aktif','pasif','gelir','gider','oz_sermaye')),
  ust_hesap_id UUID REFERENCES hesap_plani(id),
  aciklama     TEXT,
  aktif        BOOLEAN NOT NULL DEFAULT TRUE,
  olusturuldu  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, kod)
);

CREATE INDEX IF NOT EXISTS idx_hesap_plani_tenant ON hesap_plani(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hesap_plani_kod    ON hesap_plani(tenant_id, kod);

-- Yevmiye Fişleri (başlık)
CREATE TABLE IF NOT EXISTS yevmiye_fisler (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fis_no       VARCHAR(30) NOT NULL,
  tarih        DATE NOT NULL,
  aciklama     TEXT,
  durum        VARCHAR(20) NOT NULL DEFAULT 'taslak'
               CHECK (durum IN ('taslak','onaylandi','iptal')),
  santiye_id   UUID REFERENCES santiyeler(id),
  kaynak_tip   VARCHAR(30),                  -- manuel | hakedis | fatura | nakit vb.
  kaynak_id    UUID,
  olusturan_id UUID REFERENCES kullanicilar(id),
  olusturuldu  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  guncellendi  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, fis_no)
);

CREATE INDEX IF NOT EXISTS idx_yevmiye_tenant ON yevmiye_fisler(tenant_id, tarih);
CREATE INDEX IF NOT EXISTS idx_yevmiye_durum  ON yevmiye_fisler(tenant_id, durum);

-- Yevmiye Satırları (borç/alacak kalemleri)
CREATE TABLE IF NOT EXISTS yevmiye_satirlar (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fis_id       UUID NOT NULL REFERENCES yevmiye_fisler(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hesap_id     UUID NOT NULL REFERENCES hesap_plani(id),
  borc         NUMERIC(18,2) NOT NULL DEFAULT 0,
  alacak       NUMERIC(18,2) NOT NULL DEFAULT 0,
  aciklama     TEXT,
  sira         INTEGER NOT NULL DEFAULT 1,
  CHECK (borc >= 0),
  CHECK (alacak >= 0),
  CHECK (borc > 0 OR alacak > 0)
);

CREATE INDEX IF NOT EXISTS idx_yevmiye_satirlar_fis    ON yevmiye_satirlar(fis_id);
CREATE INDEX IF NOT EXISTS idx_yevmiye_satirlar_hesap  ON yevmiye_satirlar(hesap_id);
CREATE INDEX IF NOT EXISTS idx_yevmiye_satirlar_tenant ON yevmiye_satirlar(tenant_id);

-- ─── Varsayılan Hesap Planı fonksiyonu ───────────────────────────────────────
-- Yeni tenant oluştuğunda veya ilk kurulumda seed etmek için
CREATE OR REPLACE FUNCTION insert_default_hesap_plani(p_tenant_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Zaten varsa işlem yapma
  IF EXISTS (SELECT 1 FROM hesap_plani WHERE tenant_id = p_tenant_id LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO hesap_plani (tenant_id, kod, ad, tip) VALUES
    -- 1 — Dönen Varlıklar
    (p_tenant_id, '1',   'DÖNEN VARLIKLAR',             'aktif'),
    (p_tenant_id, '10',  'Hazır Değerler',              'aktif'),
    (p_tenant_id, '100', 'Kasa',                        'aktif'),
    (p_tenant_id, '102', 'Bankalar',                    'aktif'),
    (p_tenant_id, '108', 'Diğer Hazır Değerler',        'aktif'),
    (p_tenant_id, '12',  'Ticari Alacaklar',            'aktif'),
    (p_tenant_id, '120', 'Alıcılar',                    'aktif'),
    (p_tenant_id, '121', 'Alacak Senetleri',            'aktif'),
    (p_tenant_id, '128', 'Şüpheli Ticari Alacaklar',    'aktif'),
    (p_tenant_id, '15',  'Stoklar',                     'aktif'),
    (p_tenant_id, '150', 'İlk Madde ve Malzeme',        'aktif'),
    (p_tenant_id, '153', 'Ticari Mallar',               'aktif'),
    (p_tenant_id, '159', 'Verilen Sipariş Avansları',   'aktif'),
    (p_tenant_id, '19',  'Diğer Dönen Varlıklar',       'aktif'),
    (p_tenant_id, '191', 'İndirilecek KDV',             'aktif'),
    (p_tenant_id, '195', 'İş Avansları',                'aktif'),
    -- 2 — Duran Varlıklar
    (p_tenant_id, '2',   'DURAN VARLIKLAR',             'aktif'),
    (p_tenant_id, '25',  'Maddi Duran Varlıklar',       'aktif'),
    (p_tenant_id, '253', 'Tesis Makine Cihazlar',       'aktif'),
    (p_tenant_id, '254', 'Taşıtlar',                    'aktif'),
    (p_tenant_id, '257', 'Birikmiş Amortismanlar (-)',   'aktif'),
    -- 3 — Kısa Vadeli Yabancı Kaynaklar
    (p_tenant_id, '3',   'KISA VADELİ YABANCI KAYNAKLAR', 'pasif'),
    (p_tenant_id, '32',  'Ticari Borçlar',              'pasif'),
    (p_tenant_id, '320', 'Satıcılar',                   'pasif'),
    (p_tenant_id, '321', 'Borç Senetleri',              'pasif'),
    (p_tenant_id, '33',  'Diğer Borçlar',               'pasif'),
    (p_tenant_id, '335', 'Personele Borçlar',           'pasif'),
    (p_tenant_id, '36',  'Ödenecek Vergi Fonlar',       'pasif'),
    (p_tenant_id, '360', 'Ödenecek Vergi ve Fonlar',    'pasif'),
    (p_tenant_id, '361', 'Ödenecek Sosyal Güvenlik K.', 'pasif'),
    (p_tenant_id, '38',  'Gelecek Aylara Ait Gelirler', 'pasif'),
    (p_tenant_id, '391', 'Hesaplanan KDV',              'pasif'),
    -- 4 — Uzun Vadeli Yabancı Kaynaklar
    (p_tenant_id, '4',   'UZUN VADELİ YABANCI KAYNAKLAR', 'pasif'),
    (p_tenant_id, '40',  'Banka Kredileri',             'pasif'),
    (p_tenant_id, '400', 'Banka Kredileri',             'pasif'),
    -- 5 — Öz Kaynaklar
    (p_tenant_id, '5',   'ÖZ KAYNAKLAR',                'oz_sermaye'),
    (p_tenant_id, '50',  'Ödenmiş Sermaye',             'oz_sermaye'),
    (p_tenant_id, '500', 'Sermaye',                     'oz_sermaye'),
    (p_tenant_id, '57',  'Geçmiş Yıllar K/Z',           'oz_sermaye'),
    (p_tenant_id, '570', 'Geçmiş Yıllar Karları',       'oz_sermaye'),
    (p_tenant_id, '591', 'Dönem Net Karı',              'oz_sermaye'),
    -- 6 — Gelir Tablosu
    (p_tenant_id, '6',   'GELİR TABLOSU',               'gelir'),
    (p_tenant_id, '60',  'Brüt Satışlar',               'gelir'),
    (p_tenant_id, '600', 'Yurtiçi Satışlar',            'gelir'),
    (p_tenant_id, '601', 'Hakediş Gelirleri',           'gelir'),
    (p_tenant_id, '602', 'Diğer Gelirler',              'gelir'),
    (p_tenant_id, '62',  'Satışların Maliyeti',         'gider'),
    (p_tenant_id, '620', 'Satılan Mal. Maliyeti',       'gider'),
    (p_tenant_id, '622', 'Satılan Hizmet Maliyeti',     'gider'),
    -- 7 — Giderler
    (p_tenant_id, '7',   'GİDERLER',                    'gider'),
    (p_tenant_id, '70',  'Genel Üretim Giderleri',      'gider'),
    (p_tenant_id, '700', 'Genel Üretim Gid. (Yansıtma)','gider'),
    (p_tenant_id, '74',  'Hizmet Üretim Maliyeti',      'gider'),
    (p_tenant_id, '740', 'Hizmet Üretim Maliyeti',      'gider'),
    (p_tenant_id, '76',  'Araştırma Geli. Giderleri',   'gider'),
    (p_tenant_id, '77',  'Genel Yönetim Giderleri',     'gider'),
    (p_tenant_id, '770', 'Genel Yönetim Giderleri',     'gider'),
    (p_tenant_id, '78',  'Finansman Giderleri',         'gider'),
    (p_tenant_id, '780', 'Finansman Giderleri',         'gider');
END;
$$;

-- Demo tenant için seed et
DO $$
DECLARE v_tenant UUID;
BEGIN
  SELECT id INTO v_tenant FROM tenants LIMIT 1;
  IF v_tenant IS NOT NULL THEN
    PERFORM insert_default_hesap_plani(v_tenant);
  END IF;
END;
$$;
