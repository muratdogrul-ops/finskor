-- Yerel / ilk kurulum: demo firma + admin (sifre: 1234)
-- E-posta info@finerp.tr yoksa eklenir; varsa dokunulmaz.

INSERT INTO tenants (id, ad, plan, max_santiye, aktif)
VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  'Demo (yerel)',
  'temel',
  50,
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO kullanicilar (id, tenant_id, email, ad, soyad, rol, sifre_hash, aktif)
SELECT
  '22222222-2222-2222-2222-222222222222'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  'info@finerp.tr',
  'Demo',
  'Yönetici',
  'admin',
  '$2a$12$vSOH0mX1LxfYAgJTdWfAkehh7I6IUTJMbGXgs.7TITircYrsxutgu',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM kullanicilar k WHERE LOWER(TRIM(k.email)) = LOWER(TRIM('info@finerp.tr'))
)
AND EXISTS (
  SELECT 1 FROM tenants t WHERE t.id = '11111111-1111-1111-1111-111111111111'::uuid
);
