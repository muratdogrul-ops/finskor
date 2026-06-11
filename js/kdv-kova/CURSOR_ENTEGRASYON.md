# CURSOR ENTEGRASYON SÖZLEŞMESİ

Bu kütüphane `muhasebe-motoru.js` ile uyumludur. Zincir:

```
beyanname gelir tablosu + sektör → kova-hesaplayici → toMotorGirdi → muhasebe-motoru → nakit kalemleri
```

## 1. Kaynak önceliği (DEĞİŞMEZ)
```
MİZAN > BEYANNAME > SEKTÖR+ÜRÜN MODELİ
```
- Mizan varsa: `H.hesapla(..., { mizanVar:true })` → `devrede:false`. **Kütüphaneyi kullanma**, NakitFlow gerçek 360.03/190/191'i mizandan alsın.
- Beyanname dönemi varsa: o dönemin gerçek beyan değerleri sektör tahminini ezer (NakitFlow tarafında dönem bazında uygula).
- Aksi halde: sektör+ürün modeli.

## 2. Uçtan uca kullanım
```js
const fs = require("fs");
const H = require("./kova-hesaplayici.js");
const M = require("./muhasebe-motoru.js");

const sektor = JSON.parse(fs.readFileSync("./sektorler/ihracat-agirlikli.json","utf8"));

// 1) Kovaları beyannameden türet
const sonuc = H.hesapla(sektor,
  { brutSatis: 12000000, smm: 8000000, faaliyetGideri: 1500000 },
  { mizanVar: false, baslangicDonem: "2026-01", donemSayisi: 12 });

if (!sonuc.devrede) { /* mizan var: kütüphaneyi atla */ }

// 2) Motor girdisine çevir
const girdi = H.toMotorGirdi(sonuc);
// girdi.donemTutarlari = { KDV1: { '2026-01': odenecek, ... } }
// girdi.iadeler        = [ { donem, tutar, tur } ]

// 3) Motorla doğru EFEKTİF tarihli nakit çıkışlarını üret (tatil/mali tatil kaymalı)
const kdvCikislari = M.vergiTakvimiNakitKalemleri(girdi.donemTutarlari);
//   -> [ { tip:'KDV1', donem, tarih:'YYYY-MM-DD', tutar:negatif, yon:'CIKIS' } ]

// 4) İade girişlerini sektör gecikmesiyle ileri tarihe koy
const iadeGirisleri = girdi.iadeler.map(it => {
  const gAy = (sektor.iadeBaglantisi.nakdenGecikmeAy) || 0;
  const td = H.donemEkle(it.donem, gAy);
  const [yy, aa] = td.split("-").map(Number);
  return { tip:"KDV_IADE", donem: it.donem,
           tarih: M.fmt(M.yukumlulukGunu("KDV1", yy, aa-1).efektif),
           tutar: it.tutar, yon:"GIRIS", iadeTuru: it.tur };
});

// 5) NakitFlow 5Y projeksiyonuna tarih bazında MERGE et
mergeIntoCashFlow([...kdvCikislari, ...iadeGirisleri]);
```

## 3. Şeffaflık etiketleri
- Her dönem `guvenSkoru: "beyanname_only_urun_model"` taşır → nakit akışında
  "tahmin" rozeti göster.
- `sonuc.urunKirilimi` → hangi ürün/girdi ne kadar KDV ürettiğini gösterir
  (kullanıcı modeli denetleyebilsin).
- `sonuc.notlar` → açılış devreden 0 varsayımı, tevkifat, 29/2 alt sınır uyarıları.

## 4. Override
Kullanıcı sektör ciro payını değiştirebilir:
```js
H.hesapla(sektor, beyanname, { urunAgirliklariOverride: { TEMEL_GIDA: 0.9, GENEL_MAL: 0.02 } });
```

## 5. Sınırlar (YAPMA)
- ERP, e-Fatura/GİB gönderimi, veritabanı: bu kütüphanenin işi değil.
- Sayısal eşikleri kodda sabitleme; `muhasebe-motoru.js` `VERGI_PARAMETRE`'den oku.
- Mizan varken kütüphaneyi çağırma.

## 6. Beyanname bootstrap (36 / F satırı) — önerilen giriş noktası
`beyanname-kova-bootstrap.js` tek çağrıda hem KDV kovasını hem 36'yı (Ödenecek
Vergi + stopaj + SGK) üretir ve motor iadesini bağlar:
```js
const B = require("./beyanname-kova-bootstrap.js");
const r = B.bootstrap(beyanname, sektor, { yil:2026, firma, mizanVar:false });
if (!r.devrede) { /* mizan var */ }
mergeIntoCashFlow([...r.vergiCikislari, ...r.iadeGirisleri]);
// r.f36.odenecekVergi36Net dönem 36 net çıkışı; r.kovalar KDV kovaları
```
Öncelik: `kdvBeyani` (beyan KDV satırı) varsa sektör tahminini EZER.

## 7. KARMA rejim eşlemesi
Motorun `kdvUzlastir`/iade fonksiyonları `GENEL | IHRACAT_ISTISNASI |
INDIRIMLI_ORAN` bekler. Sektör `kdvRejimi: "KARMA"` olanlarda eşleme
`iadeBaglantisi.motorRejim` alanından alınır (bootstrap bunu otomatik kullanır).
13/ı tam istisna (`tur: "TAM_ISTISNA_13_I"`) iade prosedüründe ihracat gibi
(mahsup + nakden) işlenir.

## 8. Kovaları tek satıra İNDİRGEMEYİN
`alisKalemleri` her biri kendi `kdvOrani` ile işlenir. Gıda üretiminde hammadde **%1**, ambalaj/enerji/işçilik **%20**. Tek 'hammadde %20' satırına sıkıştırmak indirilecek KDV'yi ve iade/devreden pozisyonunu yanlış verir. `hesapla().urunKirilimi` satırlarını ayrı kullanın.

## 9. Aylık projeksiyon ve UI eşleme (v5.2)
- Nakit akış için: `aylik-kova-projeksiyon.js` → `aylikKovaProjeksiyon(sektor, gelir, opts)`
  → `donemTutarlari` + `iadeler` → `muhasebe-motoru.vergiTakvimiNakitKalemleri` ile efektif tarihli merge. (AYLIK-PROJEKSIYON.md)
- UI 4 kova özeti için: `kova-ui-esleme.js` → `esle(sektor)` (ağırlıklı oran; raw gıda üretiminde %1).
- Tüm tüketim kuralları: TUKETIM-SOZLESMESI.md (alış satırlarını tek satıra EZME).
