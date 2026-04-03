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

## Vakıfbank kart ödemesi (MPI arka plan + poll)

Kartla 3D başlatma **Netlify Background Function** + `mpi_enroll_jobs` tablosu kullanır; tabloda RLS açık ve **anon için politika yok** — yalnızca **service role** REST ile yazabilir.

1. SQL Editor’da `migrations/20260403120000_mpi_enroll_jobs.sql` dosyasını çalıştırın (`public.mpi_enroll_jobs`).
2. Netlify ortamında **`SUPABASE_SERVICE_KEY`** zorunlu (anon ile INSERT reddedilir, ödeme sayfası poll’da takılır).
3. Deploy sonrası ödeme: `odeme.html` → `/.netlify/functions/vakifbank-mpi-enroll-worker-background` + `vakifbank-mpi-enroll-status`.

**Teşhis:** Production sitede `/.netlify/functions/mpi-jobs-health` adresine GET atın. `mpi_enroll_jobs_select` ve `mpi_enroll_jobs_insert_delete` ikisi de `ok` olmalı; değilse `hint` ve `supabase_api_host` alanlarına bakın.
