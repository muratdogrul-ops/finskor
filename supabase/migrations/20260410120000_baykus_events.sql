-- Baykuş: LLM turu ve kullanıcı geri bildirimi (Faz 1).
-- Uygulama: Supabase Dashboard → SQL Editor. Netlify’da SUPABASE_SERVICE_KEY önerilir (RLS bypass).

CREATE TABLE IF NOT EXISTS public.baykus_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL CHECK (event_type IN ('avatar_llm_turn', 'avatar_feedback')),
  request_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_baykus_events_request_id ON public.baykus_events (request_id);
CREATE INDEX IF NOT EXISTS idx_baykus_events_created_at ON public.baykus_events (created_at DESC);

ALTER TABLE public.baykus_events ENABLE ROW LEVEL SECURITY;

-- Açık politika yok: anon/authenticated doğrudan erişemez; service_role REST ile yazar.
