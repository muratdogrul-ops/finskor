-- ════════════════════════════════════════════════════════════════════════════
-- Migration 009: Taşeron Sözleşme, Hakediş & Puantaj Güncellemeleri
-- ════════════════════════════════════════════════════════════════════════════

-- ─── TAŞERONLAR ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS taseronlar (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ad              VARCHAR(200) NOT NULL,
  vergi_no        VARCHAR(20),
  telefon         VARCHAR(20),
  email           VARCHAR(100),
  adres           TEXT,
  yetkili         VARCHAR(150),
  banka_adi       VARCHAR(100),
  iban            VARCHAR(50),
  puan            SMALLINT DEFAULT 5 CHECK (puan BETWEEN 1 AND 10),
  aktif           BOOLEAN NOT NULL DEFAULT true,
  notlar          TEXT,
  olusturuldu     TIMESTAMP NOT NULL DEFAULT NOW(),
  guncellendi     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taseronlar_tenant ON taseronlar(tenant_id);

-- ─── TAŞERON SÖZLEŞMELERİ ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS taseron_sozlesmeler (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  taseron_id      UUID NOT NULL REFERENCES taseronlar(id) ON DELETE CASCADE,
  santiye_id      UUID NOT NULL REFERENCES santiyeler(id) ON DELETE CASCADE,
  sozlesme_no     VARCHAR(100),
  is_tanimi       TEXT NOT NULL,
  is_grubu        VARCHAR(100),  -- Örn: "Betonarme", "Çelik Konstrüksiyon"
  sozlesme_bedeli BIGINT NOT NULL DEFAULT 0,
  sozlesme_tarihi DATE NOT NULL,
  baslangic       DATE,
  bitis           DATE,
  odeme_vadesi    SMALLINT DEFAULT 30,
  avans_tutari    BIGINT NOT NULL DEFAULT 0,
  avans_odendi    BOOLEAN NOT NULL DEFAULT false,
  kdv_orani       SMALLINT NOT NULL DEFAULT 20,
  stopaj_orani    SMALLINT NOT NULL DEFAULT 0,
  sgk_kesinti_oran SMALLINT NOT NULL DEFAULT 0,
  durum           VARCHAR(20) NOT NULL DEFAULT 'devam'
                  CHECK (durum IN ('taslak','devam','tamamlandi','iptal')),
  notlar          TEXT,
  olusturuldu     TIMESTAMP NOT NULL DEFAULT NOW(),
  guncellendi     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ts_sozlesme_tenant    ON taseron_sozlesmeler(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ts_sozlesme_santiye   ON taseron_sozlesmeler(santiye_id);
CREATE INDEX IF NOT EXISTS idx_ts_sozlesme_taseron   ON taseron_sozlesmeler(taseron_id);

-- ─── TAŞERON HAKEDİŞLERİ ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS taseron_hakedis (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sozlesme_id     UUID NOT NULL REFERENCES taseron_sozlesmeler(id) ON DELETE CASCADE,
  donem_no        SMALLINT NOT NULL DEFAULT 1,
  tarih           DATE NOT NULL DEFAULT CURRENT_DATE,
  -- İş miktarları
  sozlesme_is     BIGINT NOT NULL DEFAULT 0,  -- Bu döneme ait iş tutarı
  gecmis_toplam   BIGINT NOT NULL DEFAULT 0,  -- Önceki dönem kümülatifleri
  donem_toplam    BIGINT NOT NULL DEFAULT 0,  -- Kümülatif toplam
  -- Kesintiler
  avans_kesinti   BIGINT NOT NULL DEFAULT 0,
  sgk_kesinti     BIGINT NOT NULL DEFAULT 0,
  stopaj_kesinti  BIGINT NOT NULL DEFAULT 0,
  diger_kesinti   BIGINT NOT NULL DEFAULT 0,
  -- Hesaplanan
  kdv_tutari      BIGINT NOT NULL DEFAULT 0,
  net_odeme       BIGINT NOT NULL DEFAULT 0,
  -- Durum
  odeme_tarihi    DATE,
  durum           VARCHAR(20) NOT NULL DEFAULT 'taslak'
                  CHECK (durum IN ('taslak','onaylandi','odendi')),
  notlar          TEXT,
  olusturuldu     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ts_hakedis_tenant   ON taseron_hakedis(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ts_hakedis_sozlesme ON taseron_hakedis(sozlesme_id);

-- ─── PUANTAJ TABLOSU — varsa kolon ekle ──────────────────────────────────────
-- puantaj tablosu 001_schema.sql'de oluşturulmuş olabilir; eksik kolonları ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'puantaj' AND column_name = 'taseron_id'
  ) THEN
    ALTER TABLE puantaj ADD COLUMN taseron_id UUID REFERENCES taseronlar(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'puantaj' AND column_name = 'yevmiye'
  ) THEN
    ALTER TABLE puantaj ADD COLUMN yevmiye INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'puantaj' AND column_name = 'ucret_turu'
  ) THEN
    ALTER TABLE puantaj ADD COLUMN ucret_turu VARCHAR(20) DEFAULT 'aylik'
      CHECK (ucret_turu IN ('aylik','gunluk','saatlik'));
  END IF;
END
$$;

-- ─── EKİPMAN MALİYET GÜNLÜĞÜ — varsa tabloyu oluştur ─────────────────────────
CREATE TABLE IF NOT EXISTS ekipman_maliyet (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ekipman_id      UUID NOT NULL REFERENCES ekipmanlar(id) ON DELETE CASCADE,
  santiye_id      UUID REFERENCES santiyeler(id),
  tarih           DATE NOT NULL DEFAULT CURRENT_DATE,
  tip             VARCHAR(20) NOT NULL DEFAULT 'kira'
                  CHECK (tip IN ('kira','yakit','bakim','sigorta','amortisman','diger')),
  tutar           BIGINT NOT NULL DEFAULT 0,
  aciklama        TEXT,
  kaydeden_id     UUID REFERENCES kullanicilar(id),
  olusturuldu     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ekipman_maliyet_ekipman ON ekipman_maliyet(ekipman_id);
CREATE INDEX IF NOT EXISTS idx_ekipman_maliyet_tenant  ON ekipman_maliyet(tenant_id);

-- ─── MİGRASYON KAYDINI İŞARETLE ─────────────────────────────────────────────
INSERT INTO schema_migrations(version)
VALUES ('009_taseron')
ON CONFLICT DO NOTHING;
