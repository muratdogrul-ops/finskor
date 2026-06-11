# TÜKETİM SÖZLEŞMESİ (NakitFlow / Cursor)

Bu kütüphaneyi tüketen her kod (NakitFlow, köprü, UI) aşağıdaki kurallara uymak
ZORUNDADIR. Aksi halde indirilecek KDV, iade ve devreden pozisyonu yanlış çıkar.

## 1. `alisKalemleri` asla tek satıra indirgenmez
Her alış satırı KENDİ `kdvOrani` ve `pay.tipik` ile işlenir.
- **YANLIŞ:** "hammadde %100 @ %20" (tüm SMM'i tek satıra ezmek).
- **DOĞRU:** gıda üretiminde hammadde **%1** (≈%62), ambalaj **%20** (≈%12),
  enerji **%20** (≈%10), işçilik/katkı **%20**, KDV'siz pay **%0**.
- Neden: gıda hammaddesi %1'dir; tek %20 satırı indirilecek KDV'yi şişirir/bozar.

## 2. `pay` her zaman `{ min, max, tipik }`
Tüketici kod `pay.tipik` OKUR; objeyi sayı sanmaz.
```js
const pay = (typeof k.pay === "object") ? k.pay.tipik : k.pay;
```

## 3. SMM ile OPEX ayrı tabanlar
- `matrahKaynagi: "satMaliyet"` → **SMM** tabanı (pay toplamı ≈ 1,0; KDV'siz pay dahil).
- `matrahKaynagi: "faalGider"` veya `kovaTipi: "OPEX"` → **faaliyet gideri** tabanı.
- OPEX payları SMM kovalarına KARIŞMAZ; ayrı `opexRate` olarak işlenir
  (OPEX toplamı 1,0 olmak zorunda değildir; kalanı KDV'siz ücret/amortismandır).

## 4. 4 kova (raw/pack/energy/other) yalnızca UI ÖZETİdir
Gerçek hesap `urunKirilimi` + `KovaHesaplayici.hesapla()` çıktısıdır.
4 kova özeti için `kova-ui-esleme.js` → `esle(sektor)` kullan; her kovanın
**ağırlıklı oranı** Σ(pay.tipik×oran)/Σ(pay.tipik) ile hesaplanır.
UI'da raw kovasının oranı gıda üretiminde **%1**'dir, %20 değil.

## 5. `iadePotansiyeli` ≠ nihai iade
`hesapla().kovalar.iadePotansiyeli` ham devreden potansiyelidir.
Nihai iade (29/2 alt sınır 164.000 TL, ihracat mahsup/YMM/teminat) yalnızca
`beyanname-kova-bootstrap.js` veya `aylik-kova-projeksiyon.js` içinden
`muhasebe-motoru` iade fonksiyonlarıyla uygulanır.

## 6. Kaynak önceliği değişmez
`MİZAN > BEYANNAME (KDV satırı) > SEKTÖR+ÜRÜN MODELİ`.
Mizan doluysa kütüphane çağrılmaz (`mizanVar:true` → `devrede:false`).

## Doğru tüketim örneği
```js
const H = require("./kova-hesaplayici.js");
const r = H.hesapla(sektor, { brutSatis, smm, faaliyetGideri }, {});
// UI özetine indir (rapor amaçlı):
const ui = require("./kova-ui-esleme.js").esle(sektor); // {raw,pack,energy,other,opex}
// Nakit akışa: bootstrap veya aylık projeksiyon
const proj = require("./aylik-kova-projeksiyon.js")
  .aylikKovaProjeksiyon(sektor, { brutSatis, smm, faaliyetGideri }, { yil: 2026 });
mergeIntoCashFlow(proj.donemTutarlari, proj.iadeler);
```
