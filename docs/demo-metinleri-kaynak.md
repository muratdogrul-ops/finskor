# FinSkor — Demo metinleri (kurumsal dil kaynağı)

Bu dosya **`app.html` içindeki demo metinlerinin** tek yerden gözden geçirilmesi içindir.  
**Word / Google Docs / Notion**’a kopyalayıp koordinatörle düzenleyin; kesin metinleri onayladıktan sonra geliştirici `app.html` içindeki ilgili satırlara aktarır.

## Nasıl kullanılır?

1. Aşağıdaki tabloları seçip **Google Doküman veya Word**’e yapıştırın.
2. İsterseniz Document’te **Tablo → Öneri / İzlenen değişiklikler** (Word) veya **Öneriler** (Google) açın.
3. **“Kurumsal öneri (taslak)”** sütununu doldurun; orijinali koruyun veya `—` bırakın.
4. HTML kullanımı: Kodda vurgular için `<b>...</b>` kullanılıyor; TTS okurken kelime vurgusu verir. Öneride de aynı yapıyı sürdürün veya düz metin verip geliştiricinin etiketlemesini isteyin.
5. **Dinamik alanlar** (ör. `finVal`, `notVal`) değiştirilemez; yalnızca sabit cümle kısımları düzenlenir.

**Kaynak dosya:** `app.html`  
**Son içerik senkronu:** repo ile birlikte güncellenmeli (bu dokümandaki “Mevcut metin” satırları teslim anındaki koddur).

---

## A — Giriş ekranı (`#loginScreen`)

| ID | Kanal | Mevcut metin | Kurumsal öneri (taslak) |
|----|--------|----------------|-------------------------|
| demoBtnLogin | Buton | Demoyu Baykuş AI ile yap | |
| demo_alt | Alt satır | Kayıt gerekmez · Kendi verilerinizle arayüzü deneyin | |
| guvenlik_baslik | Kutu başlık | Güvenlik | |
| guvenlik_metin | Kutu metin | Veriler bilgisayarınızda kalır. | |

---

## B — Üst demo bandı (`#demoBanner`)

| ID | Kanal | Mevcut metin | Kurumsal öneri (taslak) |
|----|--------|----------------|-------------------------|
| banner_title | Başlık | DEMO MODU | |
| banner_desc | Açıklama | Kendi verinizle deneyin · Sonuç önizlemesi kilitli; paket penceresinden satın alın · Kayıt/PDF kapalı \| Demo süresi: 7:00 kaldı | |
| banner_btn | Buton | Satın Al | |
| geri_sayim_canli | JS ile güncellenir | Demo süresi: `d:kk` kaldı | |

Not: İlk yüklemede süre **7:00** gösterilir (`_demoSure = 7 * 60` saniye).

---

## C — Demo sonuç / paket katmanı (`#demoPaketOverlay`, `#demoTeklifPopup`)

| ID | Kanal | Mevcut metin | Kurumsal öneri (taslak) |
|----|--------|----------------|-------------------------|
| demoPaketOverlayTitle | Başlık | Analiz Sonucu | |
| demo_popup_label_not | Etiket | Kredi notu | |
| demo_popup_label_teminat | Etiket | Teminat şartı | |
| demo_popup_note | Dipnot | Kredi notunu artırmak için paket fiyatlarını incele. | |
| demo_popup_btn | Buton | Paketleri İncele | |
| demoTeklifPopupTitle | Başlık | Kurumsal teklif | |
| demoTeklifPopup_metin | Paragraf | Teklif için iletişim: | |
| demoTeklifMailTitle | Başlık | E-posta gönder | |
| demoTeklifMail_aciklama | Paragraf | Adınızı ve cep telefonunuzu yazın; talep doğrudan ekibimize e-posta ile iletilir. | |

---

## D — Bilgi turu (`demoBaslat` → `_bsoy`, sesli tur)

| Adım | Gecikme (ms) | Mevcut metin (HTML ile) | Kurumsal öneri (taslak) |
|------|----------------|-------------------------|-------------------------|
| Açılış TTS | 300 | Merhaba, ben Baykuş. | |
| 1 — Analiz yılı | 3000 | Sağ üstte **Analiz Yılı**; varsayılan **iki bin yirmi dört**. Karşılaştırma için iki yılı birlikte yükleyin. | |
| 2 — Bilanço dönemi | 10300 | **Bilanço dönemi**: Mart, Haziran, Eylül veya yıl sonu Aralık. Ara dönemde gelir tablosu yıllıklaştırılır. | |
| 3 — Firma tipi | 18700 | **Firma tipi**: Pazarlama, üretim veya taahhüt — oran eşikleri buna göre hesaplanır. | |
| 4 — Mali veri | 26180 | **Mali veri**: Analiz yılı **iki bin yirmi dört** ile önceki yıl **iki bin yirmi üç** kartları dolu olmalı. | |
| 5 — Yükleme | 34280 | **Excel mizan**, **PDF beyanname** ve **PDF mizan** yükleyebilirsiniz. Aynı yıl kartına hem mizan hem geçici vergi beyannamesi yüklenebilir. Kartı açmak için **çift tıklayın**. | |
| 6a — Subjektif | 47520 | **Subjektif Faktörler** — toplam notun **otuz puanlık** payı buradan gelir. | |
| 6b — Otomatik/manuel | zincir | **Otomatik** olarak atanabilir veya **manuel** doldurabilirsiniz. | |
| 6c — Analiz Et | zincir | **Analiz Et** ile devam edin. | |

---

## E — Analiz sonrası sesli sunum (`_demoAnalizSunumu`)

### E1 — Sonuç özeti (dinamik)

Şablon (sabit + değişken):

`Finansal yetmiş beş üzerinden {finVal} puan; subjektif otuz üzerinden {subjVal}. Not {notVal}. {notYorum}Teminat: {teminatVal}.`

| Alan | Açıklama |
|------|-----------|
| finVal, subjVal, notVal, teminatVal | Ekrandan okunur; metin sabitleri düzenlenebilir. |
| notYorum | `_ratingRiskVoiceSuffix(notVal)` ile eklenir (CCC/D vb.). |

### E2 — Sabit adımlar

| Adım | Gecikme (ms) | Mevcut metin | Kurumsal öneri (taslak) |
|------|----------------|--------------|-------------------------|
| Skala | 13800 | Skalada firmanın notu işaretli; AAA dan D ye on kademe. Teminat koşulları kademeye göre değişir. | |
| Oranlar | 21200 | On sekiz finansal oran; yeşil iyi, sarı orta, kırmızı risk. | |
| Öneriler | 26800 | Zayıf alanlar ve iyileştirme önerileri; PDF raporda da yer alır. | |
| Özet tablo | 32200 | Özet tabloda aktif ile pasif toplamı dengelenir. | |
| Senaryo giriş | 38200 | Senaryoda sermaye, vade, kâr ve ciro ile simülasyon; puan ve not anlık hesaplanır. | |

### E3 — Senaryo zinciri

| ID | Mevcut metin | Kurumsal öneri (taslak) |
|----|----------------|-------------------------|
| KV simülasyon | KV borcunun yüzde yetmiş beşi kırk sekiz ay vadeyle kapatıldığında senaryo puanı ve not canlı güncellenir. | |
| Otomatik senaryo | Otomatik senaryo, notu yükseltmeye uygun sermaye, vade ve satış kombinasyonlarını dener. | |
| Kapanış | Bankanın firmanızı nasıl gördüğünü önceden bilmek görüşmede avantajdır. Üst banttaki **Satın Al** ile tam sürüme geçin. Demo sunumu burada bitti. | |

---

## F — Uyarı ve kısıt mesajları (toast)

| Tetikleyici | Mevcut metin | Kurumsal öneri (taslak) |
|-------------|----------------|-------------------------|
| Son 1 dk (`_demoKalan === 60`) | Demo süreniz 1 dakika içinde dolacak. Satın alarak devam edin. | |
| Süre doldu (`demoCik`) | Demo süreniz doldu. Satın alarak tüm özelliklere erişin. | |
| Kısıtlı özellik (`_demoKisitKontrol`) | Bu özellik demo modunda devre dışı. Satın alarak tüm özelliklere erişin. | |

---

## Checklist — koda aktarım

- [ ] `app.html` içinde doğru `_bsoy('...')` / HTML blokları güncellendi  
- [ ] Banner / giriş metinleri güncellendi  
- [ ] Dinamik şablonda süslü tırnak / kaçış karakterleri kontrol edildi  
- [ ] Üretimde demo turu sesli olarak bir kez baştan sona dinlendi  

---

*Bu doküman proje içi iş akışı içindir; müşteriye gönderilen PDF değildir.*
