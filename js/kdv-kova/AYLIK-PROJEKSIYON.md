# AYLIK KDV PROJEKSİYONU

`aylik-kova-projeksiyon.js` → `aylikKovaProjeksiyon(sektor, gelirYillik, opts)`

hesapla() çıktısından **aylık 391/191/360/190/iade** üretir; devredeni aylar
arasında taşır; rejim bazlı dallanır; motor iade fonksiyonlarını uygular.

## Girdi
```js
aylikKovaProjeksiyon(sektor, { brutSatis, smm, faaliyetGideri, ihracat? }, {
  baslangicDonem: "2026-01", donemSayisi: 12,
  aylikAgirliklar: [..],          // sezon eğrisi (normalize edilir)
  seri: { "2026-01": {gelirTablosu}, ... },  // aylık ayrı gelir (yıllık yerine)
  yil: 2026, firma: { tamTasdik, his },
  mahsubaAdayBorclarAylik: { "2026-03": 50000 },
});
```

## Rejim dallanması
| Rejim (`iadeBaglantisi.tur`) | Davranış |
|---|---|
| GENEL | Klasik: net>0 → 360 ödenecek; net<0 → 190 devreden (sonraki aya). |
| INDIRIMLI_ORAN_29_2 | Kümülatif yüklenilen/hesaplanan; yıllık **alt sınır (164.000 TL)** sonrası mahsuben iade; alt sınır kadar devreden kalır. |
| IHRACAT_11_1_A / TAM_ISTISNA_13_I | Devreden → `iadeIhracat` (mahsup + nakden, `nakdenGecikmeAy` gecikmeli giriş). |
| TEVKIFAT | (devreden + tevkifEdilen) → `iadeTevkifat` (mahsup + nakden). |

## Çıktı
```js
{
  rejim, motorRejim, tur,
  aylik: [ { donem, hesaplanan391, indirilecek191, odenecek360, devreden190, iade } ],
  toplam: { hesaplanan391, indirilecek191, odenecek360, iadeNakden },
  donemTutarlari: { KDV1: { "2026-03": 50000, ... } },   // toMotorGirdi uyumlu
  iadeler: [ { donem, tahsilDonem, tutar, tur, yontem } ],
}
```

## NakitFlow entegrasyonu
NakitFlow'un `buildKdvSchedule` yerine:
1. `aylikKovaProjeksiyon(...)` çağır.
2. `donemTutarlari`'yı `muhasebe-motoru.vergiTakvimiNakitKalemleri()` ile
   **efektif tarihli** (hafta sonu/mali tatil kaymalı) çıkışa çevir.
3. `iadeler`'i (nakden) `tahsilDonem` tarihinde GİRİŞ olarak ekle.
4. **29/2 mahsuben:** `iade.mahsuben` → `FinSkorKovaBridge.buildVergi36NonKdvCash(..., { aylikProj })`
   ile aynı dönemin brüt SGK/stopaj nakit çıkışından düşülür (önce 361, sonra 360).
5. Tarih bazında 5Y projeksiyona merge et.

## Doğrulama
- GENEL: 12 ay `odenecek360` toplamı ≈ yıllık tek-dönem `odenecek360` (test mevcut).
- 29/2: gıda üretimde aylık ödenecek 0, devreden alt sınıra (164.000) yakınsar.
- İhracat: aylık nakden iade `tahsilDonem` gecikmeli (sektör `nakdenGecikmeAy`).
