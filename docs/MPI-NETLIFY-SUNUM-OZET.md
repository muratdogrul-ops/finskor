# FinSkor — Vakıfbank MPI / Netlify teşhis ve geliştirme özeti

**Amaç:** Bu belge, canlı ortamda yaşanan ödeme (MPI + arka plan worker) ve Netlify teşhis sürecinde yapılanları özetler; başka bir asistan veya ekip ile paylaşıma uygundur.  
**Not:** **HTTP 502** yanıtının bir kısmı **Vakıfbank / API gateway** kaynaklıdır; uygulama tarafı tam sonuç üretemez — banka ve üye işyeri doğrulaması gerekir.

---

## 1. Kısa bağlam

| Öğe | Açıklama |
|-----|----------|
| Site | `finskor.tr` (Netlify) |
| Ödeme akışı | Kart → `vakifbank-mpi-enroll-worker-background` (POST, **202**) → job store (Blobs veya Supabase) → `vakifbank-mpi-enroll-status` (GET, **200** + JSON) → 3D ACS |
| Çıkış IP | QuotaGuard (`QUOTAGUARDSTATIC_URL` / `vakif-fetch`) — kullanıcı tarafında **doğrulandı** |
| Netlify | **Prod / canlı**; `VAKIF_INIT=prod` ve canlı üye işyeri bilgileri ile uyum beklenir |

---

## 2. Yaşanan sorunlar (özet)

1. **Tarayıcıda HTTP 502** — Netlify fonksiyon süre limiti (özellikle ücretsiz planda ~10 sn toplam) veya uzun banka/proxy yanıt süresi.
2. **`vakif-connectivity-probe`** — Çoklu veya uzun prob + limit → **502**; kısa mod, `?ping=1`, statik `finskor-connectivity-yardim.json` ile sınırlandırıldı.
3. **`ip-egress`** — Hata durumunda bilerek **502** dönülüyordu → **200 + JSON** (`ok: false`) olacak şekilde değiştirildi.
4. **Job poll zaman aşımı (~95 sn)** — Worker bazen daha geç bitiyor; kullanıcıda “süre doldu” mesajı; job sonradan **banka HTTP 502** ile hata kaydı oluşabiliyor.
5. **Status JSON:** `"Banka iletişim hatası (HTTP 502)."` — Bu, **Netlify’un 502 sayfası değil**; sunucunun bankadan aldığı **HTTP status 502**’nin işlenmiş hali.
6. **Netlify loglarında yalnızca 202** — Background worker için **beklenen**; asıl teşhis **log metni** (`MPI enrollment failed`, `MPI_FAIL_JSON`, `[mpi-worker]`).

---

## 3. Repoda yapılan başlıca kod / yapılandırma işleri

- **MPI paylaşılan / term / enroll:** Oturum çerezi, PaRes, ECI, proxy timeout, XML/parse iyileştirmeleri (`vakif-mpi-shared`, `vakifbank-mpi-term`, `vakif-fetch`).
- **Job kuyruğu:** Varsayılan **Netlify Blobs**; `MPI_ENROLL_JOB_STORE=supabase` ile geri alma; background’da `event` + PAT / `SITE_ID` ile Blob erişimi (`mpi-enroll-jobs.js`).
- **Worker / status:** `insertRunningJob`, `finishJobOk/Err`, konsol logları (`[mpi-worker]`, `[mpi-enroll-status]`).
- **`vakif-connectivity-probe`:** Paralel prob, kısa timeout, **varsayılan kısa mod** (~9 sn tavan, ücretsiz Netlify 502 riskini azaltmak için); **`VAKIF_CONNECTIVITY_LONG=1`** ile uzun mod; **`?ping=1`**; **`?full=1`** yalnız uzun modda; iç hata için mümkün olduğunca JSON.
- **`vakif-ping`:** Sıfır bağımlılık, “fonksiyonlar ayakta mı?” testi.
- **`ip-egress`:** Timeout, ipify + ifconfig yedek, hatalarda **200 + JSON** (Chrome genel 502 yerine).
- **`netlify.toml`:** `vakifbank-mpi-enroll-worker-background` **timeout 900** sn; connectivity-probe **60** sn; `ip-egress` **26** sn; vb.
- **`odeme.html`:** MPI **işlem numarası** ve durum özeti (Ağ sekmesi olmadan teşhis); timeout mesajında status URL ipucu.
- **Statik:** `finskor-connectivity-yardim.json` (UTF-8 Türkçe, `taban_ornek`).
- **`.env.example`:** Blobs, PAT, connectivity uzun mod, rollback notları.

---

## 4. Teşhis URL’leri (kontrol listesi)

| URL / dosya | Ne için |
|-------------|---------|
| `/.netlify/functions/vakif-ping` | Fonksiyon altyapısı |
| `/.netlify/functions/vakif-connectivity-probe?ping=1` | Probe fonksiyonu (hızlı) |
| `/.netlify/functions/vakif-connectivity-probe` | Kısa banka probu (varsayılan) |
| `/.netlify/functions/vakif-connectivity-probe?full=1` | Tam prob — **yalnız** `VAKIF_CONNECTIVITY_LONG=1` + yeterli function süresi |
| `/.netlify/functions/ip-egress` | Çıkış IPv4 (QuotaGuard doğrulaması) |
| `/.netlify/functions/mpi-jobs-health` | Blob / Supabase job store sağlığı |
| `/.netlify/functions/vakifbank-mpi-enroll-status?jobid=UUID` | Belirli işin sonucu |
| `/finskor-connectivity-yardim.json` | Statik talimat (fonksiyon yok) |

---

## 5. Önemli ortam değişkenleri (Netlify)

- **Canlı MPI:** `VAKIF_INIT=prod`, merchant/terminal/şifre, `SITE_URL=https://finskor.tr`
- **Proxy:** `QUOTAGUARDSTATIC_URL` (veya `VAKIF_HTTPS_PROXY`)
- **Job store:** `MPI_ENROLL_JOB_STORE` (varsayılan blobs); Blobs için `NETLIFY_AUTH_TOKEN` (PAT)
- **Uzun connectivity:** `VAKIF_CONNECTIVITY_LONG=1`, isteğe `VAKIF_CONNECTIVITY_PROBE_MS`, `VAKIF_CONNECTIVITY_RACE_MS`

---

## 6. Çözümü uygulama tarafında kilitleyen nokta

- **`vakifbank-mpi-enroll-status`** dönen:  
  `{"ok":false,"message":"Banka iletişim hatası (HTTP 502).","mpiStatus":null}`  
  → **Enrollment** sırasında bankanın döndürdüğü **HTTP 502**.  
- **Çıkış IP doğru** ve **Netlify prod** olsa bile gateway bakımı, yanlış endpoint, WAF, üye işyeri–host eşleşmesi veya geçici banka tarafı bu kodu üretebilir.

**Önerilen eylem:**  
`vakifbank-mpi-enroll-worker-background` loglarında **`MPI_FAIL_JSON`** / **`MPI enrollment failed`** / **`httpStatus: 502`** satırlarını alıp **Vakıfbank** ile paylaşmak (tarih-saat, üye işyeri, enrollment URL).

---

## 7. Sunum slaytlarına bölme önerisi (kopyala-yapıştır)

1. **Başlık:** FinSkor — Vakıfbank MPI + Netlify  
2. **Akış:** Tarayıcı → Worker (202) → Blob/DB → Status (200) → 3D  
3. **Sorunlar:** 502 ayrımı (Netlify vs banka JSON)  
4. **Yapılanlar:** Tablo: probe, ip-egress, job store, worker timeout, odeme teşhis  
5. **Kalan risk:** Banka HTTP 502 — banka iletişimi  
6. **Sonraki adım:** Log çıktısı + Vakıfbank ticket  

---

## 8. Repo / dal

- GitHub: `muratdogrul-ops/finskor` (push edilen `main`; son commit’ler bu dosyayla uyumlu olmalıdır).

---

*Bu özet, sohbet ve repodaki uygulanan değişikliklere dayanır; canlı ortamda her zaman son deploy ve Netlify env ekranı ile doğrulama yapılmalıdır.*
