# Supabase — RLS ve ortam değişkenleri

## Row Level Security (kritik uyarı giderimi)

1. [Supabase Dashboard](https://supabase.com/dashboard) → projeniz → **SQL Editor**.
2. `migrations/20260331120000_enable_rls_finskor.sql` dosyasının içeriğini yapıştırıp **Run**.

Bu betik:

- `settings`, `ufe_rates`, `customers`, `analyses`, `payments`, `access_codes`, `leads` tablolarında **RLS’yi açar**.
- `anon` ve `authenticated` için **mevcut davranışa denk** (tam erişim) politikalar ekler — böylece **app.html** ve **admin.html** kırılmaz.

**Not:** Gerçek kilitleme için ileride `anon` politikalarını daraltıp yönetimi **service role** veya **Supabase Auth** ile yapmanız gerekir. Bu migration önce “RLS kapalı” uyarısını kapatır ve tabloyu politika kontrolüne alır.

## Netlify ortam değişkenleri

Functions içinde `SUPABASE_SERVICE_KEY` kullanımı önerilir (Dashboard → **Settings → API → service_role secret**).

| Değişken | Açıklama |
|----------|----------|
| `SUPABASE_SERVICE_KEY` | Service role JWT (sunucu tarafı; istemciye koymayın). |
| `SUPABASE_URL` | İsteğe bağlı; `https://xxxx.supabase.co` — host çıkarımı için. |
| `SUPABASE_ANON_KEY` | İsteğe bağlı yedek; service key yoksa kullanılır. |

`SUPABASE_SERVICE_KEY` tanımlı değilse fonksiyonlar eskisi gibi anon anahtara düşer (yerel geliştirme uyumu).
