-- 001: Temel multi-tenant şema (002/003 sonrası 004 ve diğer migration'lar için)
-- tenants tablosu yoksa 004 ve sonrası çalışmaz.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad           VARCHAR(300) NOT NULL,
  logo_url     TEXT,
  plan         VARCHAR(40) NOT NULL DEFAULT 'temel',
  max_santiye  INTEGER NOT NULL DEFAULT 50,
  aktif        BOOLEAN NOT NULL DEFAULT true,
  olusturuldu  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kullanicilar (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email        VARCHAR(255) NOT NULL,
  ad           VARCHAR(100),
  soyad        VARCHAR(100),
  rol          VARCHAR(40) NOT NULL,
  sifre_hash   TEXT,
  avatar_url   TEXT,
  telefon      VARCHAR(40),
  aktif        BOOLEAN NOT NULL DEFAULT true,
  olusturuldu  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS santiyeler (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ad                VARCHAR(300) NOT NULL,
  tip               VARCHAR(40),
  il                VARCHAR(80),
  ilce              VARCHAR(80),
  adres             TEXT,
  koordinat_lat     DOUBLE PRECISION,
  koordinat_lng     DOUBLE PRECISION,
  mudur_id          UUID REFERENCES kullanicilar(id),
  baslangic         DATE,
  bitis_planlanan   DATE,
  bitis_gercek      DATE,
  sozlesme_no       VARCHAR(80),
  sozlesme_bedel    BIGINT NOT NULL DEFAULT 0,
  gerceklesen       BIGINT NOT NULL DEFAULT 0,
  fiziksel_ilerleme INTEGER NOT NULL DEFAULT 0,
  durum             VARCHAR(40) NOT NULL DEFAULT 'devam',
  notlar            TEXT,
  aktif             BOOLEAN NOT NULL DEFAULT true,
  olusturuldu       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS santiye_kullanicilar (
  santiye_id    UUID NOT NULL REFERENCES santiyeler(id) ON DELETE CASCADE,
  kullanici_id  UUID NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
  yetki         VARCHAR(40) NOT NULL DEFAULT 'uye',
  PRIMARY KEY (santiye_id, kullanici_id)
);

CREATE TABLE IF NOT EXISTS satinalma_talepleri (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  santiye_id       UUID NOT NULL REFERENCES santiyeler(id) ON DELETE CASCADE,
  talep_no         VARCHAR(80) NOT NULL,
  malzeme_adi      VARCHAR(300) NOT NULL,
  kategori         VARCHAR(100),
  miktar           NUMERIC(18,4) NOT NULL DEFAULT 0,
  birim            VARCHAR(30) NOT NULL DEFAULT 'adet',
  tahmini_fiyat    NUMERIC(18,4),
  toplam_tahmini   NUMERIC(18,4),
  tedarikci        VARCHAR(200),
  tedarikci_tel    VARCHAR(40),
  acil_mi          BOOLEAN NOT NULL DEFAULT false,
  gerekli_tarih    DATE,
  notlar           TEXT,
  talep_eden_id    UUID NOT NULL REFERENCES kullanicilar(id),
  onaylayan_id     UUID REFERENCES kullanicilar(id),
  onay_tarihi      TIMESTAMPTZ,
  durum            VARCHAR(40) NOT NULL DEFAULT 'onay_bekliyor',
  gercek_fiyat     NUMERIC(18,4),
  gercek_toplam    NUMERIC(18,4),
  teslim_tarihi    DATE,
  fatura_no        VARCHAR(80),
  olusturuldu      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hakedisler (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  santiye_id       UUID NOT NULL REFERENCES santiyeler(id) ON DELETE CASCADE,
  no               VARCHAR(80) NOT NULL,
  tip              VARCHAR(40) NOT NULL,
  donem_baslangic  DATE,
  donem_bitis      DATE,
  tutar            BIGINT NOT NULL DEFAULT 0,
  kdv_orani        INTEGER NOT NULL DEFAULT 20,
  kdv_tutari       BIGINT NOT NULL DEFAULT 0,
  toplam_tutar     BIGINT NOT NULL DEFAULT 0,
  notlar           TEXT,
  hazirlayan_id    UUID NOT NULL REFERENCES kullanicilar(id),
  onaylayan_id     UUID REFERENCES kullanicilar(id),
  durum            VARCHAR(40) NOT NULL DEFAULT 'taslak',
  onay_tarihi      TIMESTAMPTZ,
  odeme_tarihi     DATE,
  olusturuldu      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, santiye_id, no)
);

CREATE TABLE IF NOT EXISTS hakedis_kalemleri (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hakedis_id   UUID NOT NULL REFERENCES hakedisler(id) ON DELETE CASCADE,
  poz_no       VARCHAR(80),
  tanim        TEXT,
  birim        VARCHAR(30),
  miktar       NUMERIC(18,4),
  birim_fiyat  NUMERIC(18,4),
  toplam       NUMERIC(18,4),
  sira         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS santiye_gunlukleri (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  santiye_id          UUID NOT NULL REFERENCES santiyeler(id) ON DELETE CASCADE,
  ekleyen_id          UUID NOT NULL REFERENCES kullanicilar(id),
  tarih               DATE NOT NULL DEFAULT CURRENT_DATE,
  baslik              VARCHAR(300),
  icerik              TEXT,
  hava_durumu         VARCHAR(80),
  sicaklik            VARCHAR(40),
  sahada_personel     INTEGER,
  sahada_ekipman      INTEGER,
  fiziksel_ilerleme   INTEGER,
  gecikme_var_mi      BOOLEAN,
  gecikme_nedeni      TEXT,
  risk_notu           TEXT,
  olusturuldu         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fotograflar (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  santiye_id       UUID NOT NULL REFERENCES santiyeler(id) ON DELETE CASCADE,
  gunluk_id        UUID REFERENCES santiye_gunlukleri(id) ON DELETE SET NULL,
  thumbnail_yolu   TEXT,
  dosya_yolu       TEXT,
  aciklama         TEXT,
  olusturuldu      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mesajlar (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  santiye_id   UUID NOT NULL REFERENCES santiyeler(id) ON DELETE CASCADE,
  gonderen_id  UUID NOT NULL REFERENCES kullanicilar(id),
  mesaj        TEXT,
  dosya_url    TEXT,
  dosya_tip    VARCHAR(40),
  silinmis     BOOLEAN NOT NULL DEFAULT false,
  olusturuldu  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mesaj_okunmalar (
  mesaj_id      UUID NOT NULL REFERENCES mesajlar(id) ON DELETE CASCADE,
  kullanici_id  UUID NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
  PRIMARY KEY (mesaj_id, kullanici_id)
);

CREATE TABLE IF NOT EXISTS nakit_hareketleri (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  santiye_id     UUID REFERENCES santiyeler(id) ON DELETE SET NULL,
  tarih          DATE NOT NULL DEFAULT CURRENT_DATE,
  tip            VARCHAR(20) NOT NULL,
  kategori       VARCHAR(80),
  aciklama       TEXT,
  tutar          BIGINT NOT NULL DEFAULT 0,
  para_birimi    VARCHAR(3) NOT NULL DEFAULT 'TRY',
  kur            NUMERIC(18,6) NOT NULL DEFAULT 1,
  tutar_try      BIGINT NOT NULL DEFAULT 0,
  belge_no       VARCHAR(80),
  hakedis_id     UUID REFERENCES hakedisler(id) ON DELETE SET NULL,
  satinalma_id   UUID REFERENCES satinalma_talepleri(id) ON DELETE SET NULL,
  kaydeden_id    UUID REFERENCES kullanicilar(id),
  onaylandi      BOOLEAN NOT NULL DEFAULT false,
  olusturuldu    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ekipmanlar (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  santiye_id       UUID REFERENCES santiyeler(id) ON DELETE SET NULL,
  ad               VARCHAR(300) NOT NULL,
  durum            VARCHAR(40) NOT NULL DEFAULT 'aktif',
  aktif            BOOLEAN NOT NULL DEFAULT true,
  sonraki_bakim    DATE,
  olusturuldu      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ekipman_bakimlari (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ekipman_id   UUID NOT NULL REFERENCES ekipmanlar(id) ON DELETE CASCADE,
  tarih        DATE NOT NULL DEFAULT CURRENT_DATE,
  aciklama     TEXT,
  maliyet      NUMERIC(18,2) DEFAULT 0,
  olusturuldu  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS personel (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  santiye_id   UUID NOT NULL REFERENCES santiyeler(id) ON DELETE CASCADE,
  ad           VARCHAR(100),
  soyad        VARCHAR(100),
  aktif        BOOLEAN NOT NULL DEFAULT true,
  olusturuldu  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS puantaj (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  personel_id    UUID NOT NULL REFERENCES personel(id) ON DELETE CASCADE,
  santiye_id     UUID NOT NULL REFERENCES santiyeler(id) ON DELETE CASCADE,
  tarih          DATE NOT NULL,
  calisma_saat   NUMERIC(6,2) NOT NULL DEFAULT 0,
  fazla_mesai    NUMERIC(6,2) NOT NULL DEFAULT 0,
  tatil_mi       BOOLEAN NOT NULL DEFAULT false,
  yevmiye        NUMERIC(12,2) NOT NULL DEFAULT 0,
  olusturuldu    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id             BIGSERIAL PRIMARY KEY,
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kullanici_id   UUID REFERENCES kullanicilar(id),
  tablo          VARCHAR(120),
  kayit_id       VARCHAR(80),
  islem          VARCHAR(40),
  eski_deger     JSONB,
  yeni_deger     JSONB,
  olusturuldu    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_santiyeler_tenant ON santiyeler(tenant_id) WHERE aktif = true;
CREATE INDEX IF NOT EXISTS idx_hakedisler_tenant ON hakedisler(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nakit_tenant ON nakit_hareketleri(tenant_id, tarih DESC);
