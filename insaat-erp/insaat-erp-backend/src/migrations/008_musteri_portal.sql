-- ── 008_musteri_portal.sql ────────────────────────────────────────────────────
-- Müşteri portalı: login gerektirmeyen paylaşılabilir rapor linkleri

CREATE TABLE IF NOT EXISTS musteri_rapor_linkleri (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  santiye_id          UUID NOT NULL REFERENCES santiyeler(id) ON DELETE CASCADE,
  token               VARCHAR(64) UNIQUE NOT NULL
                        DEFAULT encode(gen_random_bytes(32), 'hex'),
  baslik              VARCHAR(200),
  gecerlilik_tarihi   DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  aktif               BOOLEAN NOT NULL DEFAULT true,
  son_erisim          TIMESTAMPTZ,
  erisim_sayisi       INTEGER NOT NULL DEFAULT 0,
  olusturan_id        UUID REFERENCES kullanicilar(id),
  olusturuldu         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_musteri_link_token
  ON musteri_rapor_linkleri(token)
  WHERE aktif = true;

CREATE INDEX IF NOT EXISTS idx_musteri_link_santiye
  ON musteri_rapor_linkleri(santiye_id, tenant_id);

-- ── Stok / Depo tabloları (009 yerine buraya ekliyoruz) ───────────────────────
CREATE TABLE IF NOT EXISTS stoklar (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id),
  santiye_id   UUID REFERENCES santiyeler(id),
  malzeme_adi  VARCHAR(200) NOT NULL,
  kategori     VARCHAR(100) DEFAULT 'genel',
  birim        VARCHAR(20)  DEFAULT 'ADET',
  mevcut_miktar NUMERIC(12,3) NOT NULL DEFAULT 0,
  minimum_miktar NUMERIC(12,3) DEFAULT 0,
  birim_maliyet NUMERIC(15,2) DEFAULT 0,
  depo_yeri    VARCHAR(100),
  aktif        BOOLEAN NOT NULL DEFAULT true,
  olusturuldu  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  guncellendi  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stok_hareketleri (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id),
  stok_id      UUID NOT NULL REFERENCES stoklar(id) ON DELETE CASCADE,
  santiye_id   UUID REFERENCES santiyeler(id),
  hareket_tipi VARCHAR(20) NOT NULL
                 CHECK (hareket_tipi IN ('giris','cikis','fire','transfer','sayim')),
  miktar       NUMERIC(12,3) NOT NULL,
  onceki_miktar NUMERIC(12,3) NOT NULL DEFAULT 0,
  sonraki_miktar NUMERIC(12,3) NOT NULL DEFAULT 0,
  birim_fiyat  NUMERIC(15,2) DEFAULT 0,
  toplam_tutar NUMERIC(15,2) DEFAULT 0,
  aciklama     TEXT,
  satinalma_id UUID REFERENCES satinalma_talepleri(id),
  kaydeden_id  UUID REFERENCES kullanicilar(id),
  tarih        DATE NOT NULL DEFAULT CURRENT_DATE,
  olusturuldu  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stoklar_tenant   ON stoklar(tenant_id, aktif);
CREATE INDEX IF NOT EXISTS idx_stoklar_santiye  ON stoklar(santiye_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_stok_hareketleri ON stok_hareketleri(stok_id, tarih DESC);
