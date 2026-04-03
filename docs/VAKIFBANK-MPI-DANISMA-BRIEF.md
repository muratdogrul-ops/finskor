# FinSkor — Vakıfbank MPI + VPOS entegrasyonu (dış danışman / başka LLM için brief)

Bu metni **Claude** veya **ChatGPT**’ye yapıştırın; mümkünse **Vakıfbank’ın gönderdiği resmi Sanal POS / MPI dokümanını (PDF)** ayrıca ekleyin veya ilgili bölümlerini aynı sohbete yapıştırın. Bu repoda bankanın tam kılavuz metni **bulunmuyor**; aşağıdaki “Kılavuzla hizalama” bölümü **kodda kullanılan** uç noktalar ve akıştır.

---

## 1) İş hedefi

- Web sitesi (`odeme.html`) üzerinden **kredi kartı** ile ödeme.
- Akış: **MPI Enrollment (VerifyEnrollmentRequest)** → bankadan **ACS URL + PaReq + MD** → tarayıcı **ACS’e POST** → dönüş **TermUrl** (`vakifbank-mpi-term`) → **VPOS Sale** → başarıda **Supabase** müşteri/ödeme + erişim kodu.

---

## 2) Altyapı

| Bileşen | Rol |
|--------|-----|
| **Netlify** | Static site + serverless functions |
| **Supabase** | `customers`, `payments`, vb. + async MPI için `mpi_enroll_jobs` |
| **QuotaGuard Static** (isteğe bağlı ama canlıda sık gerekli) | Sabit çıkış IP → Vakıfbank whitelist |
| **Node** | `https-proxy-agent` + `https` ile proxy; düz çıkışta `fetch` + `AbortSignal.timeout` |

---

## 3) Ortam değişkenleri (Netlify)

Zorunlu / kritik:

- `VAKIF_INIT` = `test` veya `prod`
- `VAKIF_HOST_MERCHANT_ID`, `VAKIF_MERCHANT_PASSWORD`, `VAKIF_HOST_TERMINAL_ID`
- `SITE_URL` = `https://finskor.tr` (sonunda `/` yok)
- `SUPABASE_SERVICE_KEY` (kart async kuyruk + ödeme kaydı için; `mpi_enroll_jobs` RLS anon’a kapalı)

Önemli opsiyoneller:

- `QUOTAGUARDSTATIC_URL` veya `VAKIF_HTTPS_PROXY`
- `VAKIF_MPI_ENROLL_URL_TEST` / `VAKIF_MPI_ENROLL_URL_PROD` (banka farklı URL verdiyse)
- `VAKIF_MPI_START_THREED_FLOW_TEST` / `_PROD` (ACS formundaki TermUrl banka farklı istiyorsa)
- `VAKIF_VPOS_URL_TEST` / `VAKIF_VPOS_URL_PROD` (VPOS için bankanın verdiği tam URL, örn. `:4443`)
- `VAKIF_MPI_SESSION_SECRET`
- `VAKIF_HTTPS_TIMEOUT_MS` (banka HTTP; varsayılan ~55s)
- `SB_HTTPS_TIMEOUT_MS` (Supabase REST; varsayılan ~25s)
- `VAKIF_MPI_ENROLL_INCLUDE_TERMINAL=1` (kılavuz TerminalNo istiyorsa)
- `VAKIF_REQUIRE_EGRESS_PROXY=1`, `VAKIF_PROXY_FAIL_CLOSED=1` (sıkı mod)

---

## 4) Kodda sabit / varsayılan banka URL’leri

**MPI Enrollment (XML POST):**

- Test: `https://inbound.apigatewaytest.vakifbank.com.tr/threeDGateway/Enrollment`
- Canlı: `https://inbound.apigateway.vakifbank.com.tr/threeDGateway/Enrollment`

**startThreeDFlow (TermUrl için varsayılan):**

- Test: `https://inbound.apigatewaytest.vakifbank.com.tr/threeDGateway/startThreeDFlow`
- Canlı: `https://inbound.apigateway.vakifbank.com.tr/threeDGateway/startThreeDFlow`

**VPOS Sale:**

- Test: `https://apiportalprep.vakifbank.com.tr/virtualPos/Vposreq`
- Canlı: `https://apigw.vakifbank.com.tr/virtualPos/Vposreq`

Kod: `netlify/functions/vakif-mpi-shared.js` (`resolveMpiEnrollUrl`, `resolveVposUrl`, `resolveMpiStartThreeDFlowUrl`).

**Port (PDF vs yetkili):** Bazı PDF sürümlerinde test veya eski örnekler **:8443** gösterebilir. **Canlıda banka yetkilisinin yazılı talimatı önceliklidir** — bu projede yetkili **443 / (gerekirse) 4443** demiş; varsayılan kod **portsuz HTTPS = 443** kullanır. **:4443** için tam URL’yi env ile verin (`VAKIF_*_URL_*`, `VAKIF_VPOS_URL_*`). Başka bir LLM “mutlaka 8443 ekleyin” derse, **yetkiliyle çelişiyorsa yetkili + güncel e-posta** esas alın.

**VPOS XML (3D sonrası satış):** `buildVposSaleXml` — enrollment’daki tekil id **`MpiTransactionId`** (+ isteğe bağlı **`VerifyEnrollmentRequestId`**) ile gönderilir; stil: `VAKIF_VPOS_MPI_XML_STYLE` = `both` (varsayılan) \| `mpi_only` \| `verify_only`. **`TransactionDeviceSource`** varsayılan `0` (bankadan kod teyidi); kapatma / özelleştirme: `VAKIF_VPOS_OMIT_TRANSACTION_DEVICE_SOURCE`, `VAKIF_VPOS_TRANSACTION_DEVICE_SOURCE`.

---

## 5) Netlify function uçları

| Uç | Amaç |
|----|------|
| `POST /.netlify/functions/vakifbank-mpi-enroll-worker-background` | Netlify **Background** — MPI enrollment + `mpi_enroll_jobs` güncelleme |
| `GET /.netlify/functions/vakifbank-mpi-enroll-status?jobid=<uuid>` | Poll (Netlify query param anahtarları küçük harfe indirgenebilir → `jobid`) |
| `POST /.netlify/functions/vakifbank-mpi-term` | ACS’ten PARes; VPOS; Supabase; `confirm-payment` |
| `GET /.netlify/functions/mpi-jobs-health` | Supabase `mpi_enroll_jobs` okuma/yazma testi |
| `POST /.netlify/functions/vakifbank-mpi-enroll` | Varsayılan **410** (sync kapalı); `VAKIF_MPI_USE_SYNC_ENROLL=1` ile eski sync |

---

## 6) Async MPI veri modeli (Supabase)

Tablo: `public.mpi_enroll_jobs` (migration: `supabase/migrations/20260403120000_mpi_enroll_jobs.sql`)

- `id` (uuid), `status` (`running` / `done` / `error`), `result_json`, `error_json`, zaman damgaları.
- RLS açık; **service role** ile yazılır.

---

## 7) Zaman çizelgesi (sorun geçmişi — kısa)

1. **Önce:** Güvenlik duvarı / WAF / “Request Rejected” tipi HTML yanıtlar (çoğunlukla **IP whitelist** veya yanlış host/test-canlı uyumsuzluğu).
2. **Sonra:** Netlify **senkron** süre limiti → **504**; bu yüzden **Background Function + poll** tasarımına geçildi.
3. **Poll tarafı:** API Gateway `jobId` → `jobid` küçültmesi yüzünden status **400** dönüyor, istemci sessizce döngüde kalıyordu — **düzeltildi** (`jobid` + sunucuda her iki anahtar).
4. **Supabase:** `https.request` süre sınırı yoktu; PATCH asılı kalınca satır **`running`**’de kalıyordu — **timeout + PATCH başarısızsa throw + worker’da yedek `finishJobErr`** eklendi.
5. **Banka HTTP:** Proxy yolunda timeout vardı; **düz `fetch`** yolunda yoktu — **AbortSignal.timeout** eklendi.

---

## 8) Güncel semptom (ekran)

Ödeme sonrası (poll süresi dolunca) toast:

> «3D kayıt yanıtı gecikti veya sunucu işini tamamlayamadı. Netlify’da vakifbank-mpi-enroll-worker-background loglarına ve Supabase mpi_enroll_jobs satırına bakın.»

**Teşhis için net kontroller:**

- `mpi-jobs-health` çıktısı: `mpi_enroll_jobs_select` ve `mpi_enroll_jobs_insert_delete` = `ok` (bir projede doğrulandı).
- Ödeme denemesi sırasında `mpi_enroll_jobs`: satır oluşuyor mu? `running`’de mi kalıyor? `done` / `error` oluyor mu?
- Netlify log: `vakifbank-mpi-enroll-worker-background` — `MPI enrollment failed`, `MPI_FAIL_JSON`, `finishJobOk başarısız`, `Supabase REST zaman aşımı`, `[vakif-fetch]` satırları.

---

## 9) Vakıfbank kılavuzu ile hizalama (PDF’yi siz ekleyin)

Aşağıdaki başlıklar **tipik** MPI/VPOS dokümanlarıyla örtüşür; sizin PDF’deki bölüm numaraları farklı olabilir. **Lütfen PDF’den şu maddeleri karşılaştırın:**

1. **VerifyEnrollmentRequest** XML şeması: `MerchantId`, `MerchantPassword`, `VerifyEnrollmentRequestId`, `Pan`, `ExpiryDate`, `PurchaseAmount`, `Currency`, `BrandName`, `SuccessUrl`, `FailureUrl` — isteğe bağlı **`TerminalNo`** (bizde env ile).
2. **SuccessUrl / FailureUrl / TermUrl** — HTTPS, bankanın izin verdiği domain; `SITE_URL` ile üretilen callback’ler (`vakifbank-mpi-term`).
3. **Test vs canlı** uçlar — yukarıdaki varsayılan URL’ler bankanın güncel listesiyle **birebir** mi?
4. **Sabit IP / güvenlik duvarı** — çıkış IP’si (QuotaGuard) bankaya **MPI enrollment host’u** için de tanımlı mı?
5. **3D Secure akışı** — PARes sonrası VPOS alanları (`ECI`, `CAVV`, `VerifyEnrollmentRequestId`, `Xid` vb.) kılavuzla uyumlu mu? (Kod: `vakifbank-mpi-term.js`, `buildVposSaleXml`, `parsePares`.)

**Not:** Kod içinde yorum olarak geçen *«kılavuz 5.2.1 / 5.2.2»* ifadesi `vakif-mpi-shared.js` içinde TermUrl açıklamasında kullanılmıştır; **gerçek bölüm numarası** sizin PDF’nize göre doğrulanmalıdır.

---

## 10) Başka LLM’e sorulacak odak sorular (kopyala-yapıştır)

1. Vakıfbank **MPI Enrollment** yanıtında başarı için **zorunlu** XML etiketleri ve örnek başarılı/başarısız gövde nedir? (Bizim parser: `parseMpiEnrollmentResponse`.)
2. **TermUrl** olarak `startThreeDFlow` mu yoksa üye işyeri URL’si mi kullanılmalı? Kılavuzdaki ACS form alanları (`PaReq`, `TermUrl`, `MD`) ile bizim gönderim uyumlu mu?
3. **Test ortamında** whitelist olmadan doğrudan Netlify çıkışı ile enrollment mümkün mü, yoksa test API Gateway de mi IP ister?
4. `PurchaseAmount` formatı (ondalık ayırıcı, para birimi kodu 949) kılavuzla **tam** uyumlu mu?
5. Background function + istemci poll mimarisi yerine bankanın önerdiği **alternatif** (ör. farklı callback, farklı endpoint) var mı?

---

## 11) Ana kaynak dosyalar (repo)

- `netlify/functions/vakif-mpi-shared.js` — URL’ler, XML, parse, `postXml`, `sbRequest`
- `netlify/functions/vakif-fetch.js` — proxy / düz çıkış / timeout
- `netlify/functions/vakifbank-mpi-enroll.js` — `runMpiEnroll`
- `netlify/functions/vakifbank-mpi-enroll-worker-background.js` — arka plan iş + job persist
- `netlify/functions/vakifbank-mpi-enroll-status.js` — poll
- `netlify/functions/vakifbank-mpi-term.js` — PARes + VPOS
- `netlify/functions/mpi-enroll-jobs.js` — Supabase job CRUD
- `netlify/functions/sb-config.js` — Supabase host (`SUPABASE_URL` veya JWT `ref`)
- `odeme.html` — `jobid` ile poll, ~95s üst sınır
- `supabase/migrations/20260403120000_mpi_enroll_jobs.sql`

---

*Bu dosya danışmanlık / ikinci görüş içindir; üretim davranışını tek başına değiştirmez.*
