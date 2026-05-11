-- Demo tenant icin ornek santiye (liste bos gorunmesin)
-- Tenant/kullanici: 011_demo_seed ile ayni sabit UUID'ler

INSERT INTO santiyeler (
  id,
  tenant_id,
  ad,
  tip,
  il,
  ilce,
  baslangic,
  bitis_planlanan,
  sozlesme_bedel,
  gerceklesen,
  fiziksel_ilerleme,
  durum,
  mudur_id,
  aktif
)
SELECT
  '33333333-3333-3333-3333-333333333333'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  'Demo Santiye - Ornek Proje',
  'ustyapi',
  'Ankara',
  'Cankaya',
  '2026-01-01'::date,
  '2026-12-31'::date,
  10000000,
  2500000,
  25,
  'devam',
  '22222222-2222-2222-2222-222222222222'::uuid,
  true
WHERE EXISTS (SELECT 1 FROM tenants WHERE id = '11111111-1111-1111-1111-111111111111'::uuid)
  AND NOT EXISTS (SELECT 1 FROM santiyeler WHERE id = '33333333-3333-3333-3333-333333333333'::uuid);
