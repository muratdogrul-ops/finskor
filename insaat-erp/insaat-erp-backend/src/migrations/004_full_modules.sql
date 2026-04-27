-- 004: Cari, stok, kasa/banka, hakedis genisletmesi (001 sonrasi)

-- --- Cari (temel) ---
CREATE TABLE IF NOT EXISTS cari_hesaplar (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ad              VARCHAR(300) NOT NULL,
  unvan           VARCHAR(300),
  vergi_no        VARCHAR(20),
  vergi_dairesi   VARCHAR(100),
  tip             VARCHAR(20) NOT NULL DEFAULT 'diger' CHECK (tip IN ('musteri','tedarikci','alt_yuklenici','diger')),
  telefon         VARCHAR(40),
  email           VARCHAR(150),
  notlar          TEXT,
  aktif           BOOLEAN NOT NULL DEFAULT true,
  olusturuldu     TIMESTAMP NOT NULL DEFAULT NOW(),
  guncellendi     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cari_tenant ON cari_hesaplar(tenant_id);

CREATE TABLE IF NOT EXISTS depolar (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  santiye_id    UUID REFERENCES santiyeler(id) ON DELETE SET NULL,
  ad            VARCHAR(200) NOT NULL,
  aciklama      TEXT,
  aktif         BOOLEAN NOT NULL DEFAULT true,
  olusturuldu   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_depo_tenant ON depolar(tenant_id);

CREATE TABLE IF NOT EXISTS stok_kalemleri (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kod           VARCHAR(50),
  ad            VARCHAR(300) NOT NULL,
  birim         VARCHAR(30) NOT NULL DEFAULT 'adet',
  notlar        TEXT,
  aktif         BOOLEAN NOT NULL DEFAULT true,
  olusturuldu   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stok_kalem_t ON stok_kalemleri(tenant_id);

CREATE TABLE IF NOT EXISTS stok_hareketleri (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  depo_id       UUID NOT NULL REFERENCES depolar(id) ON DELETE CASCADE,
  stok_kalem_id UUID NOT NULL REFERENCES stok_kalemleri(id) ON DELETE CASCADE,
  tip           VARCHAR(10) NOT NULL CHECK (tip IN ('giris','cikis','sayim')),
  miktar        DECIMAL(15,3) NOT NULL,
  aciklama      TEXT,
  belge_no      VARCHAR(80),
  hakedis_id    UUID REFERENCES hakedisler(id) ON DELETE SET NULL,
  kaydeden_id   UUID NOT NULL REFERENCES kullanicilar(id),
  olusturuldu   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stok_har_depo ON stok_hareketleri(depo_id, olusturuldu DESC);

CREATE TABLE IF NOT EXISTS kasa_hesaplari (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ad            VARCHAR(200) NOT NULL,
  doviz         VARCHAR(3) NOT NULL DEFAULT 'TRY',
  aciklama      TEXT,
  aktif         BOOLEAN NOT NULL DEFAULT true,
  olusturuldu   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS banka_hesaplari (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ad            VARCHAR(200) NOT NULL,
  iban          VARCHAR(34),
  doviz         VARCHAR(3) NOT NULL DEFAULT 'TRY',
  sube          VARCHAR(120),
  aciklama      TEXT,
  aktif         BOOLEAN NOT NULL DEFAULT true,
  olusturuldu   TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE hakedisler
  ADD COLUMN IF NOT EXISTS avans_tutari BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kesinti_tutari BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fatura_uuid UUID,
  ADD COLUMN IF NOT EXISTS dis_fatura_ref VARCHAR(80),
  ADD COLUMN IF NOT EXISTS cari_id UUID REFERENCES cari_hesaplar(id) ON DELETE SET NULL;
