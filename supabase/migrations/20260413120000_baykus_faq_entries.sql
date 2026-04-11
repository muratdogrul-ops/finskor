-- Baykuş bilgi bankası (OpenAI olmadan): anahtar kelime eşleşmesi + hazır cevap.
-- Supabase Dashboard → SQL Editor ile çalıştırın.
-- Netlify: FINSKOR_AVATAR_KB=1 ve SUPABASE_SERVICE_KEY
-- RLS açık; anon yok — yalnız service_role REST okur.

CREATE TABLE IF NOT EXISTS public.baykus_faq_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  keywords text NOT NULL,
  answer text NOT NULL,
  note text,
  CONSTRAINT baykus_faq_keywords_len CHECK (char_length(keywords) <= 4000),
  CONSTRAINT baykus_faq_answer_len CHECK (char_length(answer) <= 12000)
);

COMMENT ON COLUMN public.baykus_faq_entries.keywords IS 'Virgül veya noktalı virgül ile ayrılmış tetikleyiciler; kullanıcı sorusu (tr-TR küçük harf) içinde geçen ilk eşleşme kazanır.';

CREATE INDEX IF NOT EXISTS idx_baykus_faq_active_sort
  ON public.baykus_faq_entries (active, sort_order);

ALTER TABLE public.baykus_faq_entries ENABLE ROW LEVEL SECURITY;

-- Örnek / operasyon metinleri: ayrı dosya (tekrar çalıştırmada çoğalmaz)
-- → 20260413120100_baykus_faq_seed.sql
