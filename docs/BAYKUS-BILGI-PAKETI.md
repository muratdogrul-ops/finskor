# Baykuş bilgi paketi — tasarım (kontrollü bağlam)

Bu belge, ana program kaynağını modele “komple dökmeden” Baykuş’un ürün ve metodolojiye **dar, sürümlü, denetlenebilir** bağlam almasını tanımlar. Uygulama kodunu tek başına değiştirmez; `avatar-chat` ve isteğe bağlı Supabase/RAG adımları buna göre genişletilir.

## 1. Amaç ve ilkeler

- **Amaç:** Kullanıcı sorusu + analiz JSON’una ek olarak, **onaylı metin parçaları** ile yanıt kalitesini artırmak; halüsinasyonu azaltmak için “resmi özet” sunmak.
- **İlke — kaynak kod yok:** `app.html` / repo tamamı modele gönderilmez (gizlilik, token, yanlış yorum riski).
- **İlke — çift kaynak:** Sayısal iddia için öncelik **o istekteki analiz özeti JSON**; bilgi paketi yalnızca **açıklayıcı çerçeve**.
- **İlke — sürüm:** Paket `version` ile etiketlenir; release notu ile güncellenir.
- **İlke — KVKK:** Pakette kişisel veri, müşteri kodu, ham Findeks metni tutulmaz.

## 2. Bilgi katmanları

| Katman | İçerik | Kaynak | Modele gidiş |
|--------|--------|--------|----------------|
| **L0** | Anlık analiz özeti | Zaten `body.context` | Her LLM turunda |
| **L1** | Ürün / UI özeti (skala, sekmeler, senaryo türleri vb.) | Elle yazılmış kısa metin | Statik veya DB |
| **L2** | İleride: metodoloji özeti (ör. Findeks, 131) | — | **Şimdilik bilgi paketine dahil edilmez** |
| **L3** | Sık sorulan / onaylı Q&A kısa cevapları | İnsan onaylı | `baykus_few_shot_examples` veya ayrı tablo |

L3, mevcut **few-shot** tablosu ile örtüşebilir; isterseniz aynı tabloya `note='bilgi_sorusu'` gibi ayrım veya ayrı `baykus_knowledge_chunks` kullanılır.

**Şu anki ürün kararı (paket içeriği):** Bilgi paketinde **demo** ile ilgili metin **kesinlikle yer almaz**. **L2** tarafında Findeks (nakdi/gayrinakdi) ve **131** özetleri **şimdilik yok**; ileride ayrı onayla eklenebilir.

## 3. Token ve boyut bütçesi (öneri)

- L1 birleşik **hedef ≤ ~1.500–2.500 karakter** (~400–650 token) — L2 eklendiğinde aynı tavan içinde paylaşılır.
- L3 (few-shot çiftleri): mevcut `FINSKOR_AVATAR_FEW_SHOT_MAX` ile sınırlı; asistan cevapları kısaltılmış.
- **Toplam** LLM girdisi (JSON + L1 [+ ileride L2] + few-shot) için üst sınır izlenmeli.

## 4. Enjeksiyon noktaları (mevcut mimariye uyum)

1. **Statik (Faz A — en basit):**  
   - `avatar-chat` içinde `KNOWLEDGE_PACK_JSON` Netlify ortam değişkeni (base64 veya küçük JSON string) **veya** repoda `docs/baykus-knowledge-chunks.json` deploy’da fonksiyonla birlikte paketlenir (`require` ile okunur).  
   - Flag: örn. `FINSKOR_AVATAR_KNOWLEDGE=1`. Kapalıysa davranış bugünkü gibi.

2. **Supabase (Faz B):**  
   - Tablo `baykus_knowledge_chunks`: `id`, `active`, `layer` (L1; ileride L2), `topics[]` veya `tags`, `body_tr`, `sort_order`, `version`.  
   - Okuma: yalnız `service_role`, timeout + boş dizi fallback (few-shot ile aynı desen).

3. **RAG (Faz C — isteğe bağlı):**  
   - `body_tr` için embedding; soruya göre top-k chunk; şimdilik yalnız L1 (L2 sonradan).  
   - pgvector migration ayrı tasarlanır.

## 5. Güncelleme süreci

1. Ürün ekibi L1 metnini `docs/baykus-knowledge-chunks.example.json` yapısına uygun yazar (demo yok; L2 şimdilik yok).  
2. Hukuk / ürün onayı.  
3. Versiyon artırılır (`1.0.1` …).  
4. Deploy veya SQL INSERT.  
5. İsteğe bağlı: A/B — eski paket env’de yedek.

## 6. Yasal / ürün uyarısı (paket dipnotu)

Paket metninde veya sistem prompt ekinde kısa dipnot (Findeks/vergi detayı bilgi paketine konulmadıkça genel cümle yeterli):

> Bu özet genel bilgilendirme içindir; FinSkor çıktısı resmi kredi kararı değildir.

## 7. Sonraki uygulama adımları (kod)

- [ ] `FINSKOR_AVATAR_KNOWLEDGE` + L1 birleşik metin üretimi `avatar-chat.js` içinde (try/catch, kapalı varsayılan; demo/L2 Findeks-131 chunk’ları ekleme).  
- [ ] Üretim `baykus-knowledge-chunks.json` (git’te, küçük) veya env.  
- [ ] İsteğe bağlı: Faz B migration `baykus_knowledge_chunks`.  
- [ ] Loglarda sadece `knowledge_version` hash (PII yok).

---

**Özet:** Ana programı “yüklemek” yerine **L1 özet (+ ileride onaylı L2) + onaylı L3** ile Baykuş’u güçlendirirsiniz; şimdilik pakette demo yok, L2 Findeks/131 yok. Kaynak kod dışarı çıkmaz, token kontrol altında kalır.
