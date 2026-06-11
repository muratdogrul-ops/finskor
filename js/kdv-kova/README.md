# KDV Kova Kütüphanesi (Sektör + Ürün/Girdi Modeli)

NakitFlow'da **mizan yokken** (beyanname-only yükleme veya projeksiyon dönemleri)
KDV nakit akışını "boş tahmine" bırakmamak için iki katmanlı kütüphane:

- **Kütüphane 1 — Sektör profili:** `sektorler/*.json` (sektör → KDV rejimi, ihracat payı, iade kolu).
- **Kütüphane 2 — Ürün/girdi KDV kova modeli:** her sektörde satış/alış KDV kalemleri, oranları, matrah kaynağı; `kova-hesaplayici.js` ile aylık kovalar dolar.

**Kaynak önceliği:** `MİZAN > BEYANNAME > SEKTÖR+ÜRÜN MODELİ`. Mizan doluysa kütüphane devreye girmez.

> ⚠️ **TÜKETİM UYARISI (NakitFlow/Cursor):** `alisKalemleri` **tek satıra İNDİRGENMEMELİDİR**.
> Her satır KENDİ `kdvOrani` ile işlenir. Örneğin gıda üretiminde **hammadde %1'dir, %20 DEĞİL**;
> sadece ambalaj/enerji/işçilik/katkı %20'dir. Kovaları "hammadde %100 @ %20" gibi tek satıra
> sıkıştırmak indirilecek KDV'yi ve iade/devreden pozisyonunu YANLIŞ hesaplatır. Her zaman
> `KovaHesaplayici.hesapla()` çıktısındaki `urunKirilimi` satırlarını ayrı ayrı kullanın.

## Dosya yapısı
```
kdv-kova-kutuphanesi/
├── README.md
├── sektor-katalog.json           — 21 sektör merkezi liste (uiGrup + altDal)
├── kova-tanim.schema.json        — sektör dosyası JSON Schema
├── urun-sozlugu.json             — ortak ürün/girdi kodları + oranlar
├── kova-hesaplayici.js           — Kütüphane 2: bağımsız hesaplayıcı
├── beyanname-kova-bootstrap.js   — 36 (F satırı) + KDV satırı + motor iade köprüsü
├── aylik-kova-projeksiyon.js     — aylık 391/191/360/190/iade (devreden taşır) [YENİ]
├── kova-ui-esleme.js             — 4 kova UI özeti (ağırlıklı oran) [YENİ]
├── TUKETIM-SOZLESMESI.md         — tüketim kuralları (tek satıra ezme yasak) [YENİ]
├── AYLIK-PROJEKSIYON.md          — aylık projeksiyon spec [YENİ]
├── SEKTOR-DENETIM-RAPORU.md      — 21 sektör denetim + kararlar [YENİ]
├── REVIZYON-NOTU.md              — sürüm değişiklikleri + kaynaklar
├── muhasebe-motoru.js            — (aynı motor) iade/takvim için
├── sektorler/                    — 21 sektör profili (detaylı ürün/girdi reçetesi)
├── ornekler/                     — 7 beyanname-only + uçtan uca örnek
├── test/                         — birim test (202; tek komut: node test/calistir.js)
└── CURSOR_ENTEGRASYON.md         — muhasebe-motoru.js'e bağlama sözleşmesi
```

### 21 sektör (sektor-katalog.json — uiGrup / altDal)
- **gida (8):** gida-toptan-perakende, gida-uretim, gida-uretim-sut, gida-uretim-et,
  un-irmik-uretim, hayvan-yemi-uretim, tarim-isleme, findik-kuruyemis-ihracat
- **imalat (7):** ihracat-agirlikli, makine-imalat, otomotiv-yan-sanayi, kimya-plastik,
  demir-celik-metallurgy, tekstil-konfeksiyon, enerji-yenilenebilir
- **ticaret (2):** genel-ticaret-standart, hammadde-ticaret
- **hizmet (4):** insaat-taahhut-tevkifat, hizmet-tevkifat, lojistik-tasimacilik, turizm-konaklama

Her sektörde alış tarafı ayrı satırlar: ana hammadde + **ambalaj** + **enerji** +
**işçilik/fason** + **nakliye** + yardımcı/kimyasal. `pay` alanı {min,max,tipik}.

## Oran tablosu ve kaynaklar (2026)

| Ürün/girdi | Oran | Dayanak |
|---|---|---|
| Temel gıda (süt, yumurta, et, ekmek, meyve-sebze, baklagil) | %1 | 5189 s.CK (14.02.2022); 2007/13033 BKK (I) sayılı liste |
| Fındık (kabuklu/iç, naturel) yurtiçi | %1 | (I) liste 1. sıra; 5189 sonrası toptan/perakende %1 |
| Canlı hayvan (büyük/küçükbaş, kümes) | %1 | GİB özelgesi; (I) liste |
| Yeme-içme hizmeti (lokanta/kafe) | %10 | 2007/13033 (II) liste 24. sıra |
| Konaklama / sağlık / eğitim hizmeti | %10 | (II) liste |
| İşlenmiş/ÖTV'li gıda, bazı içecekler | %10 | (II) liste; 7346 s.CK (%8→%10, 10.07.2023) |
| Tekstil / hazır giyim / konfeksiyon | %10 | (II) liste; 7346 sonrası %20'ye çıkmadı, %10 korundu |
| Genel mal/hizmet, hammadde, enerji, ambalaj, nakliye | %20 | 2007/13033 m.1 genel oran; 7346 s.CK |
| İhracat (mal/hizmet) | %0 (istisna) | KDVK 11/1-a, 12 |
| **Hayvan yemi, gübre** | **Tam istisna** | **KDVK 13/ı (6663 s.K.)** — indirilecek KDV doğurmaz |
| Net 150 m² altı konut (koşullu) | %1 | (I) liste konut |

### Tevkifat oranları (kısmi)

| İşlem | Oran | Dayanak |
|---|---|---|
| Yapım işleri (KDV dahil ≥ 5.000.000 TL) + müh./mimarlık | 4/10 | KDVGUT I/C-2.1.3.2.1; 35 No.lu Tebliğ (16.02.2021, 3/10→4/10) |
| İşgücü temin hizmeti | 9/10 | KDVGUT I/C-2.1.3.2.5 |
| Makine/teçhizat/taşıt tadil-bakım-onarım | 7/10 | KDVGUT I/C-2.1.3.2 |
| Yük taşıma / nakliye | 2/10 | KDVGUT I/C-2.1.3.2 |
| Demir-çelik mamul ürünler | 5/10 (güncel tebliğle teyit) | KDVGUT I/C-2.1.3.3.8 |
| Metal/plastik/kâğıt/cam hurda ve atık | 7/10 | KDVGUT I/C-2.1.3.3.4 (hurda teslimi 17/4-g istisna) |
| Fason tekstil/konfeksiyon, çanta/ayakkabı dikim | 7/10 | KDVGUT I/C-2.1.3.3.7 |
| Tevkifat alt sınırı (KDV dahil) | ~9.900 TL (2025/26) | Yıllık güncellenir |

> Sayısal eşikler (indirimli oran iade alt sınırı, tevkifat alt sınırı, iade üst
> sınırı) bu kütüphanede DEĞİL, `muhasebe-motoru.js` `VERGI_PARAMETRE` içindedir;
> yıllık tebliğle orada güncellenir.

## Hızlı kullanım
```js
const fs = require("fs");
const H  = require("./kova-hesaplayici.js");
const sektor = JSON.parse(fs.readFileSync("./sektorler/gida-toptan-perakende.json", "utf8"));

const sonuc = H.hesapla(sektor,
  { brutSatis: 2000000, smm: 1400000, faaliyetGideri: 200000 },   // beyanname gelir tablosu
  { mizanVar: false, baslangicDonem: "2026-01", donemSayisi: 12 });

// sonuc.kovalar -> { hesaplanan391, indirilecek191, devreden190, odenecek360, iadePotansiyeli }
// sonuc.urunKirilimi -> hangi ürün ne kadar KDV (şeffaflık)
// sonuc.aylikDagilim -> 12 ay
// sonuc.guvenSkoru = "beyanname_only_urun_model"
```

## Beyanname bootstrap (36 / F satırı + KDV satırı)
Beyannameden gelen **Ödenecek Vergi ve Fonlar (36)**, stopaj ve SGK'yı nakit
çıkışına çevirir; beyannamede KDV satırı varsa sektör tahminini ezer; gerçek
iadeyi motorla hesaplar (164.000 TL alt sınır, mahsup/YMM/teminat):
```js
const B = require("./beyanname-kova-bootstrap.js");
const sektor = JSON.parse(fs.readFileSync("./sektorler/demir-celik-metallurgy.json","utf8"));
const r = B.bootstrap({
  donem: "2026-02",
  gelirTablosu: { brutSatis: 10000000, smm: 7000000, faaliyetGideri: 1000000 },
  kdvBeyani:   { hesaplananKdv, indirilecekKdv, devredenKdv, odenecekKdv }, // (varsa) sektörü ezer
  muhtasar:    { stopaj: 50000 },   // 360
  sgk:         { prim: 80000 },     // 361
}, sektor, { yil: 2026, firma: { tamTasdik: false } });
// r.f36.odenecekVergi36Net  -> dönem net 36 çıkışı
// r.vergiCikislari          -> KDV1(28)/MPHB_STOPAJ(26)/SGK_PRIM(ay sonu) efektif tarihli
// r.iade                    -> motor iadesi (mahsup/nakden/teminat)
// r.iadeGirisleri           -> nakden iade gelecekteki giriş
```

## Test (tek komut)
```
node test/calistir.js     # 202 test, 4 dosya (hepsi geçer)
```
Ayrı ayrı: kova-hesaplayici-testi (19), beyanname-bootstrap-testi (70),
sektor-denetim-testi (21 sektör), ui-projeksiyon-testi (UI eşleme + aylık projeksiyon).

## Kapatılan eksikler (bu sürüm)
- **Tek F satırı (36 toplam) otomatik ayrıştırma:** `beyanname.f36.odenecekVergi`
  verilirse, KDV düşülüp kalan stopaj/SGK olarak bölünür (varsayılan %65/%35,
  `opts.f36BolmeOrani` ile değişir). Stopaj/SGK ayrı geldiyse onlar kullanılır.
- **İhracat tutarı ciro payını ezer:** `beyanname.ihracat` verilirse ihracat payı
  buna göre hesaplanır, kalan satış kalemleri oranlı küçülür (sektör varsayılanı yerine).
- **Müstahsil GV stopajı nakde girer:** `sektor.mustahsilStopaj` tanımlı sektörlerde
  (fındık, tarım) GVK stopajı hesaplanır ve MPHB/stopaj çıkışına eklenir (KDV dışı).
- **5M TL tevkifat işlem eşiği:** yapım işlerinde not + `opts.tevkifatUygula=false`
  ile kapatma; toplulaştırılmış beyannamede fatura-bazlı eşik doğrulanamaz (uyarı).
- **Doküman dosya adları** kanonik isimlerle düzeltildi.

> Bilinçli sınır: `odenecekVergi36Net` mizan F satırıyla **kalibre edilmemiştir**
> (mizan yokken referans yoktur); mizan geldiğinde kütüphane zaten devre dışı kalır.

## Yeni sektör ekleme
`sektorler/` altına `kova-tanim.schema.json`'a uyan JSON ekleyin ve
`sektor-katalog.json`'a kaydını yazın; kod değişmez.

## Yasal uyarı
Sektör profilleri **tipik modeldir**, firma özelinde sapar. Gerçek veri
(mizan/beyanname) geldikçe kütüphane otomatik geri çekilir. Üretim öncesi ve
firma özelinde **mali müşavir/YMM teyidi** alınmalıdır.
