-- FinSkor: Row Level Security açılır; mevcut davranış korunur (anon + authenticated tam erişim).
-- Güvenlik uyarısını (RLS kapalı) giderir. İleride anon politikaları daraltıp admin'i service role / Auth ile taşıyın.
--
-- Uygulama: Supabase Dashboard → SQL Editor → bu dosyanın tamamını çalıştırın.
-- Tablo adı farklıysa veya tablo yoksa ilgili ALTER satırını atlayın.

-- ── RLS etkin ─────────────────────────────────────────
ALTER TABLE IF EXISTS public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ufe_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;

-- ── Politikalar: app.html (anon okuma) + admin.html (anon CRUD) aynı kalır ──
-- service_role RLS'i bypass eder; Netlify fonksiyonlarında SUPABASE_SERVICE_KEY önerilir.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'settings',
    'ufe_rates',
    'customers',
    'analyses',
    'payments',
    'access_codes',
    'leads'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('DROP POLICY IF EXISTS fin_finskor_anon_all ON public.%I', t);
      EXECUTE format('CREATE POLICY fin_finskor_anon_all ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true)', t);
      EXECUTE format('DROP POLICY IF EXISTS fin_finskor_auth_all ON public.%I', t);
      EXECUTE format('CREATE POLICY fin_finskor_auth_all ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END $$;
