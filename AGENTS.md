# FinSkor / agent notları

Bu dosya **çalışan uygulama davranışını tek başına değiştirmez**; ekip ve AI için ürün kuralları ve yerleşim önerilerini özetler. Gerçek etki için `app.html` ve ilgili kodda implementasyon gerekir.

## Baykuş (canlı) vs demo analiz sunumu

- Canlı Baykuş / TTS düzenlenirken **demo analiz sunumunu bozma** (`_demoAnalizSunumu`, `window._demoMod`, demo TTS zinciri). Ayrıntı ve kontrol listesi: `.cursor/rules/finskor-baykus-demo-isolation.mdc`.

## Findeks raporu → analiz sayfasında KV / UV tenzili

- **Findeks dosyası yüklüyse**, analiz sayfasında **KV ve UV mali borç** Findeks’ten türetilen kurallara göre **düzeltilmiş** olmalı (parse + recalc ile).
- **Gayrinakdi:** Raporda ve analizde **gösterilmez / dikkate alınmaz**; nakdi odaklı import.
- **Kredi kartı riski:** **Mali borç**; analizde dikkate alınır (genelde **KV**).
- **Metodoloji (özet):** Referans dönem nakdi toplamı için Findeks vade bazlı tablo (ör. **12/2025**); tür kırılımı gerektiğinde rapor tarihli özetten **oransal** uygulama + kullanıcıya kısa uyumluluk notu.

## UI yerleşimi önerisi (Findeks + ÜFE + yıl kartları)

1. Üst şerit: **Findeks** (tarih, özet, PDF).
2. Altında: **ÜFE / enflasyon** tablosu.
3. Altta: **2023–2026** (veya dört yıllık) yıl kartları. Findeks’i yalnızca bir yıl kartının yanına koymak **yanlış yıl eşlemesi** riski yaratır; tercih üst şerit.

## 131 — Ortaklardan alacaklar (hatırlatma)

- Analiz sayfasında ilgili bakiye **sıfırlanmış** kabul; tutar **özkaynak toplamından düşülür**. Kodda uygulanmalıdır.

### Bu düzeltmeyi geri almak (git)

Canlıda sorun çıkarsa, `main`’e alınan **131 / özkaynak tenzili** commit’ini geri almak için (history’yi bozmadan):

```bash
git revert 863a0fe --no-edit
git push origin main
```

Alternatif: Netlify **Deploys** ekranından önceki başarılı deploy’a **Publish** (rollback).

## Supabase RLS

- SQL: `supabase/migrations/20260331120000_enable_rls_finskor.sql` — Dashboard SQL Editor’da çalıştırılır; tabloda RLS açılır, `anon` / `authenticated` için mevcut tam erişim politikaları eklenir (app + admin kırılmadan uyarı kalkar).
- Netlify: `SUPABASE_SERVICE_KEY` ortam değişkeni tanımlayın; `netlify/functions/sb-config.js` önce bunu kullanır.
- Ayrıntı: `supabase/README.md`.

## Lisans / buton mantığı — Nakit akış (gelecek; şimdi uygulanmadı)

- **Nakit akışı modülünü** satın alan kullanıcıda **Nakit akış** butonu **aktif** olmalı.
- Yalnızca **analiz** paketini alan kullanıcıda **Nakit akış** butonu **aktif olmamalı** (pasif veya gizli — ürün kararı).
- Bu ayrım **henüz kodda yok**; ileride ödeme / entitlement ile bağlanacak.
