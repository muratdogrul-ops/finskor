# FinSkor / NakitFlow — Mali veri import (PDF, Excel, 2023)

## Dosyalar (sırayla yüklenir)

| Dosya | Rol |
|-------|-----|
| `js/finskor-mali-import-prep.js` | Hesap listesi (`HESAPLAR`), özkaynak toplamı, enflasyon kuralları |
| `js/finskor-mali-import-core.js` | PDF/Excel okuma, hesap kodu → `key` eşlemesi |
| `js/finskor-mali-import-nakit.js` | NakitFlow açılış bilanço + gelir tablosu aktarımı |

`nakit_akis.html` ve FinSkor `app.html` bu üç script’i kullanır.

---

## Giriş noktaları

**NakitFlow:** `FinSkorMaliImport.parseFile(file, year)` → `applyParsedToOpeningBalance` / `mapToOpening`.

**FinSkor analiz:** `parseMizanExcel` / `parseMizanPDF` → `importState.parsed` → `hesapToplamlar(year)`.

`year` = Açılış sayfasındaki **mali kapanış yılı** (ör. 2023 PDF için **2023** seçin).

---

## Excel — iki format

### 1) Mizan tablosu (`mizanRowlariIsle`)

- Satırlar: **Hesap kodu** (100–699) + Borç/Alacak + **Borç/Alacak bakiyesi**
- Aktif 100–299: borç bakiyesi
- Pasif 300–591: alacak bakiyesi (590/591 dönem kar/zarar dahil)
- Gelir 600–699: gelir/alacak, gider/borç
- Eşleme: `KOD_TO_KEY` (`finskor-mali-import-core.js`)

### 2) Spread / bilanço detay (`spreadRowlariIsle`)

- Başlıkta yıl sütunları: **2022, 2023, 2024, 2025** (A=kod, D/G/J/M örnek düzen)
- `hedefYil` sütunundaki tutarlar toplanır
- 3 haneli kod satırları (`100` … `699`)

---

## PDF — iki format

### 1) Kurumlar beyannamesi (`mizanTextIsleBeyanname`)

- Satırlar: `. A. Hazır Değerler` + tutarlar (çok sütunlu olabilir)
- **Enflasyon düzeltmeli** beyan: metinde `Enflasyon Düzeltmesi Sonrası` geçer
- Son sütun = cari dönem (enflasyon sonrası); **0,00 geçerli**
- Özkaynak **F. Dönem Net Karı** → `donemNetKarBilanco` (bilanço)
- Gelir tablosu **Dönem Net Karı veya Zararı** → yalnızca `donemNetKarGelir` (gelir özeti)

**2023 DKC örneği (enflasyon sonrası):**

| Kalem | Tutar |
|-------|------:|
| Aktif / Pasif toplam | 362.427.160 |
| Bilanço dönem net kar | **0** |
| Gelir tablosu dönem net | **1.073.213** |
| Geçmiş yıl zararları (58) | **2.598.555** |

Eski hata: gelir neti özkaynağa tekrar eklenince pasif +1.073.213 → dosya farkı.

**Düzeltme (`maliInflationBeyanDetected`):** Enflasyon beyan’da özkaynak toplamına **yalnızca** `donemNetKarBilanco` eklenir; gelir neti eklenmez.

### 2) Tablo mizan PDF (`mizanTextIsleMizan` + koordinat)

- `120 ALICILAR` gibi kod + açıklama
- Metin öncelikli, koordinat yedek

Format seçimi: `mizanTabloSayisi >= 25` ve açık beyanname başlığı yoksa → mizan; aksi halde beyanname.

---

## Ortak hesaplama (`finskor-mali-import-prep.js`)

```
ozKaynak = ödenmişSermaye + sermayeYedek + karYedek + geçmişKar
         + dönemNet (bilanço/enflasyon kuralı)
         − geçmişZarar
         − ortakAlacak131 tenzili

pasifToplam = kvYKToplam + uvYKToplam + ozKaynak
aktifToplam = donenVarlik + duranVarlik
```

`hesapToplamlarOnObject(d, year)` → `maliNormalizeDonemNetForOzkaynak` → `finSkorOzKaynakVePasif`.

---

## NakitFlow açılış (`finskor-mali-import-nakit.js`)

`mapToOpening` → kutular:

- `bank` ← hazır değerler  
- `ar`, `ap`, `inventory`, `mdv`, `otherAssets`, `otherLiab`  
- `kvMaliBorclar`, `uvMaliBorclar` → krediler  
- `capital` ← ödenmiş sermaye + yedekler (enflasyon beyan’da **explicit**)  
- `openingRetainedEarnings` ← geçmiş kar − geçmiş zarar + **bilanço** dönem net  

Enflasyon beyan’da devreden dönem net = `donemNetKarBilanco` (0 olabilir); gelir neti yalnızca **Referans Gelir** KPI’da (`donemNetKarGelir`).

---

## Kullanım notları

1. Beyanname PDF’si hangi yılsa, açılışta **o yılı** seçin (2023 dosyası → **2023**).  
2. Import log: `📐 Enflasyon düzeltmeli bilanço` → düzeltme aktif.  
3. **DOSYA FARK** ≈ 0 ve **AÇILIŞ KUTULARI FARK** ≈ 0 beklenir.  
4. Excel mizan: 590/591 hesapları normal okunur; enflasyon kuralı yalnızca beyanname bayrağında devreye girer.

---

## Ana fonksiyonlar (hızlı referans)

| Fonksiyon | Dosya |
|-----------|--------|
| `parseMizanExcel` / `parseMizanPDF` | core |
| `mizanTextIsleBeyanname` | core |
| `mizanRowlariIsle` / `spreadRowlariIsle` | core |
| `maliInflationBeyanDetected` | prep |
| `maliEffectiveDonemNetForOzKaynak` | prep |
| `hesapToplamlarOnObject` | prep |
| `FinSkorMaliImport.mapToOpening` | nakit |
| `mapRetainedFromMizan` | nakit |
