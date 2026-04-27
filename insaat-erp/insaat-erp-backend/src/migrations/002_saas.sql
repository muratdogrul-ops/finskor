-- 002: SaaS / RLS (planlama)
-- Uygulama: tenant uygulama katmaninda (JWT + sorgu WHERE tenant_id) zorunlu.
-- Gelecekte RLS: app.current_tenant = tenant_id session ve policy once migration ile test.
SELECT 1;
