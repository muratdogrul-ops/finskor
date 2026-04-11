-- Baykuş LLM: onaylı few-shot örnekleri (Faz 1 — vektör/RAG yok).
-- Supabase Dashboard → SQL Editor ile çalıştırın.
-- Netlify: FINSKOR_AVATAR_FEW_SHOT=1 ve SUPABASE_SERVICE_KEY (önerilir).
-- RLS açık; anon/authenticated politikası yok — yalnız service_role REST okur.

CREATE TABLE IF NOT EXISTS public.baykus_few_shot_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  user_message text NOT NULL,
  assistant_message text NOT NULL,
  note text,
  CONSTRAINT baykus_few_shot_user_len CHECK (char_length(user_message) <= 2000),
  CONSTRAINT baykus_few_shot_asst_len CHECK (char_length(assistant_message) <= 8000)
);

CREATE INDEX IF NOT EXISTS idx_baykus_few_shot_active_sort
  ON public.baykus_few_shot_examples (active, sort_order);

ALTER TABLE public.baykus_few_shot_examples ENABLE ROW LEVEL SECURITY;

-- Örnek satır eklemek (isteğe bağlı; Dashboard Table Editor ile de eklenebilir):
-- INSERT INTO public.baykus_few_shot_examples (active, sort_order, user_message, assistant_message, note)
-- VALUES (
--   true,
--   0,
--   'Kredi notumu nasıl yükseltirim?',
--   'Özetle üç alana bakın: borç/özkaynak ve likidite (bilanço), kârlılık ve kısa vadeli banka borcunun satışlara oranı, ayrıca subjektif faktörler (30 puana kadar). FinSkor’da Senaryo Analizi ile somut adımların nota etkisini deneyebilirsiniz. Banka kararı yerine geçmez; genel bilgilendirme.',
--   'şablon'
-- );
