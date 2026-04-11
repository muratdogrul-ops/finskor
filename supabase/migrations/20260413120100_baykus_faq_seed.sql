-- Baykuş bilgi bankası — örnek kayıtlar (operasyon metni).
-- avatar-kb: soru tr-TR küçük harfe çevrilir; keywords virgül veya noktalı virgülle ayrılır;
--   sort_order artan sırada satırlar taranır; bir satırda ilk eşleşen anahtar kelime o cevabı seçer.
-- app.html: yerel çekirdek (_avMatchTextCore) her zaman bilgi bankasından önce çalışır — aynı konuyu
--   hem kodda hem burada tutmayın; ürün metnini Supabase’ten yönetmek istediğiniz satırlar buraya.
-- Her satır note = 'seed:...' ile işaretli; bu dosyayı yeniden çalıştırmak çoğaltmaz (WHERE NOT EXISTS).

-- 1) Ticari / genel bilgi (rakamı koda gömmeyin; duyuru metni site + Baykuş ile uyumlu)
INSERT INTO public.baykus_faq_entries (active, sort_order, keywords, answer, note)
SELECT true, 10,
  'fiyat, ücret, paket, abonelik, ne kadar, satın al, ödeme',
  $faq$
Güncel paketler, kampanyalar ve ödeme seçenekleri finskor.tr üzerinden duyurulur; fiyatlar dönemsel olarak güncellenebilir.

Kurumsal lisans veya paket ayrıntısı için önce sitedeki güncel bilgilere bakın; Baykuş da zaman içinde bu başlıklarla ilgili yanıtları zenginleştirir.

Genel bilgilendirme; bağlayıcı teklif değildir.
$faq$,
  'seed:fiyat-odeme'
WHERE NOT EXISTS (SELECT 1 FROM public.baykus_faq_entries WHERE note = 'seed:fiyat-odeme');

-- 2) Yardım — önce Baykuş + bilgi bankası (mail yönlendirmesi yok)
INSERT INTO public.baykus_faq_entries (active, sort_order, keywords, answer, note)
SELECT true, 20,
  'destek, yardım, yardim, nasıl yaparım, nasil yaparim, takıldım, takildim, çalışmıyor, calismiyor, hata',
  $faq$
Çoğu kullanım ve kavram sorusunda Baykuş ve bilgi bankası yanıtları önce devreye girer; aynı konuyu birkaç farklı kelimeyle sormak eşleşmeyi kolaylaştırır.

Teknik bir aksaklık yaşıyorsanız tarayıcıyı yenilemek, önbelleği temizlemek veya farklı tarayıcı denemek ilk adımlardır. Geri bildirim veya puanlama özellikleri varsa yanıtları iyileştirmek için kullanılır — mail zorunlu değildir.
$faq$,
  'seed:destek'
WHERE NOT EXISTS (SELECT 1 FROM public.baykus_faq_entries WHERE note = 'seed:destek');

-- 3) Hesap ve veri (KVKK — kısa yönlendirme; hukuki metin sitede)
INSERT INTO public.baykus_faq_entries (active, sort_order, keywords, answer, note)
SELECT true, 30,
  'hesabımı sil, hesabi sil, verilerimi sil, kişisel veri, kisisel veri, kvkk hakkım, unutulma',
  $faq$
KVKK kapsamındaki talepler ve hesap kapatma süreçleri, sitede yayımlanan Gizlilik / KVKK metnine göre yürütülür.

Başvuru yöntemi ve süreler o metinde tanımlıdır; kimlik doğrulama gerekebilir. Hukuki ayrıntı için yalnızca sitedeki güncel metne bakınız.
$faq$,
  'seed:kvkk-hesap'
WHERE NOT EXISTS (SELECT 1 FROM public.baykus_faq_entries WHERE note = 'seed:kvkk-hesap');

-- 4) Mobil
INSERT INTO public.baykus_faq_entries (active, sort_order, keywords, answer, note)
SELECT true, 40,
  'mobil, telefon, ios, android, uygulama indir, app store, play store',
  $faq$
FinSkor şu aşamada tarayıcı üzerinden kullanıma göre tasarlanmıştır. Yerel mobil uygulama duyurusu olursa finskor.tr üzerinden paylaşılır.

Masaüstü veya mobil tarayıcıdan tam ekran kullanımı önerilir.
$faq$,
  'seed:mobil'
WHERE NOT EXISTS (SELECT 1 FROM public.baykus_faq_entries WHERE note = 'seed:mobil');

-- 5) Çoklu firma / şube (ürün politikası — metni ihtiyaca göre güncelleyin)
INSERT INTO public.baykus_faq_entries (active, sort_order, keywords, answer, note)
SELECT true, 50,
  'birden fazla firma, çok firma, şube, grup şirket, holding, alt şirket',
  $faq$
Birden fazla tüzel kişi veya şube için kullanım koşulları paket ve lisansınıza bağlıdır. Ayrıntı için sitedeki güncel paket açıklamasına bakın veya Baykuş’a “çoklu firma” benzeri sorularla deneyin.

Aynı oturumda farklı firmalar için ayrı analiz yapıyorsanız firma adı ve yıl kartlarını karıştırmamaya dikkat edin.
$faq$,
  'seed:coklu-firma'
WHERE NOT EXISTS (SELECT 1 FROM public.baykus_faq_entries WHERE note = 'seed:coklu-firma');

-- 6) FinSkor vs banka (kısa hatırlatma — yerel cevaptan farklı kelimelerle yakalanır)
INSERT INTO public.baykus_faq_entries (active, sort_order, keywords, answer, note)
SELECT true, 60,
  'garanti, kesin onay, bankaya sunulur mu, kredi onayı, teklif mektubu',
  $faq$
FinSkor çıktıları eğitim ve iç analiz amaçlı bir model özetidir; bankanın veya üçüncü tarafın kredi / limit kararının yerine geçmez.

Kuruma sunulacak resmi belge ve şartlar her zaman ilgili finans kuruluşunun politikasına tabidir.
$faq$,
  'seed:banka-yerine-gecmez'
WHERE NOT EXISTS (SELECT 1 FROM public.baykus_faq_entries WHERE note = 'seed:banka-yerine-gecmez');

-- 7) Bilgi bankası nasıl çalışır (meta — isteğe bağlı; sık sorulursa açıklar)
INSERT INTO public.baykus_faq_entries (active, sort_order, keywords, answer, note)
SELECT true, 90,
  'bilgi bankası, bilgi bankasi, hazır cevap, otomatik cevap',
  $faq$
Bu kanaldaki yanıtlar, sık sorulan konular için önceden tanımlanmış metinlerden seçilir; tam cümle eşleşmesi aranmaz, sorunuzdaki anahtar kelimelerle eşleştirilir.

Zaman içinde eklenen kayıtlar ve (açıksa) LLM katmanı ile Baykuş yanıtları güncellenir; geri bildirimler kaliteyi iyileştirmeye yardım eder.
$faq$,
  'seed:meta-kb'
WHERE NOT EXISTS (SELECT 1 FROM public.baykus_faq_entries WHERE note = 'seed:meta-kb');
