# LinkedIn Olcum Kurulumu (FinSkor)

Bu dokuman, uygulama ici demo ve teklif aksiyonlarini LinkedIn kampanya verileriyle eslestirmek icin minimum kurulumu ozetler.

## 1) Netlify ortam degiskeni

- Netlify site ayarlarinda `LINKEDIN_PARTNER_ID` degiskenini ekleyin (yalnizca rakam).
- Yeni deploy alin.
- `build.js` bu degeri kullanarak `dist/app.html` icine Insight Tag'i enjekte eder.

## 2) Uygulama icinde olculen olaylar

`app.html` tarafinda asagidaki aksiyonlar track edilir:

- `demo_start_click`
- `demo_result_overlay_shown`
- `demo_package_click`
- `demo_contact_modal_open`
- `demo_contact_submit_success`
- `demo_offer_email_popup_open`
- `demo_offer_submit_success`
- `demo_offer_phone_click`
- `demo_offer_mailto_fallback`

Ek olarak URL uzerindeki UTM parametreleri yakalanir ve local/session storage'da tutulur.

### Supabase'e olay kaydi (admin ozeti icin)

Uygulama icindeki olaylar ayrica `/.netlify/functions/finskor-analytics` uzerinden `public.finskor_analytics_events` tablosuna yazilir.

- Migrasyon dosyasi: `supabase/migrations/20260421120000_finskor_analytics_events.sql`
- Admin paneli: `admin.html` -> **Attribution Ozeti**

## 3) Lead tarafinda kaynak takibi

Asagidaki Netlify function'lar artik `attribution` verisini kabul eder:

- `/.netlify/functions/contact-form`
- `/.netlify/functions/kurumsal-teklif`

Bu bilgi e-posta icerigine ve Supabase `leads.notlar` alanina yazilir.

## 4) LinkedIn Campaign Manager onerisi

- Campaign objective: `Website Conversions` veya `Lead Generation`
- Sütun seti:
  - Impressions
  - Clicks
  - CTR
  - Leads
  - Cost per Lead
  - Conversion Rate

## 5) UTM standardi (onerilen)

- `utm_source=linkedin`
- `utm_medium=paid_social`
- `utm_campaign=<kampanya_adi>`
- `utm_content=<kreatif_adi>`
- `utm_term=<opsiyonel_hedefleme>`

Bu standart ile "47 sonuc" degerinin click mi lead mi oldugu CRM ve kampanya panelinde ayni dilde takip edilir.
