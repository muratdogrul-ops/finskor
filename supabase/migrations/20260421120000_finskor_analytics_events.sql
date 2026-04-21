-- FinSkor ürün içi ölçüm (demo / paket / iletişim adımları)
-- Uygulama: Supabase Dashboard → SQL Editor → çalıştırın.
-- Netlify fonksiyonu service_role ile yazar; anon doğrudan okuyamaz (admin paneli service_role ile okunabilir — şu an admin anon kullanıyorsa aşağıdaki politikalar eklenir).

CREATE TABLE IF NOT EXISTS public.finskor_analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event text NOT NULL,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  attribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  page text,
  referrer text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_finskor_analytics_events_created_at ON public.finskor_analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finskor_analytics_events_event ON public.finskor_analytics_events (event);

ALTER TABLE public.finskor_analytics_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'finskor_analytics_events') THEN
    EXECUTE 'DROP POLICY IF EXISTS fin_finskor_anon_all ON public.finskor_analytics_events';
    EXECUTE 'CREATE POLICY fin_finskor_anon_all ON public.finskor_analytics_events FOR ALL TO anon USING (true) WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS fin_finskor_auth_all ON public.finskor_analytics_events';
    EXECUTE 'CREATE POLICY fin_finskor_auth_all ON public.finskor_analytics_events FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;
