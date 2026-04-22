-- Tek seferlik temizlik: eski uygulama eventlerini arşive al, popup odaklı eventleri bırak.
-- Lead tablosuna ve lead not/metinlerine dokunmaz.

CREATE TABLE IF NOT EXISTS public.finskor_analytics_events_archive
(LIKE public.finskor_analytics_events INCLUDING ALL);

INSERT INTO public.finskor_analytics_events_archive
SELECT *
FROM public.finskor_analytics_events
WHERE event NOT LIKE 'landing_%'
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.finskor_analytics_events
WHERE event NOT LIKE 'landing_%';
