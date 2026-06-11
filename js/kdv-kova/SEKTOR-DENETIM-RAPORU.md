# SEKTÖR DENETİM RAPORU (21 sektör — v5.2)

Otomatik denetim: `node test/sektor-denetim-testi.js` (yeşil).

## Genel sonuç
| Kontrol | Durum |
|---|---|
| Satış `varsayilanCiroPayi.tipik` toplamı ≈ 1,0 | ✅ 21/21 |
| SMM `pay.tipik` toplamı ≈ 1,0 | ✅ 21/21 (KDV'siz pay açık satırla tamamlandı) |
| Her satırda `kaynak` dolu | ✅ 21/21 |
| Üretim sektörlerinde AMBALAJ + ENERJI ayrı satır | ✅ (enerji-yenilenebilir hariç — notlu muafiyet) |
| `hesapla()` çökmeden çalışır + `urunKirilimi` dolu | ✅ 21/21 |

## SMM 1,0'a tamamlama yöntemi
Birçok sektörde SMM'in bir kısmı **KDV'siz maliyettir** (işçilik ücreti,
amortisman, öz üretim, müstahsil emeği). Bu pay artık açık bir satır olarak
tutulur: `KDVSIZ_GIDER` (kdvOrani **%0**, istisnaTipi `kdvsiz`). Oran %0
olduğundan indirilecek KDV'yi ETKİLEMEZ; yalnızca pay toplamını 1,0 yapar ve
maliyet yapısını şeffaf gösterir.

## Şüpheli/ince ayar adayları — karar ve gerekçe
| Konu | Karar | Gerekçe |
|---|---|---|
| **tarim-isleme** SMM'de ~%32 boşluktu | KDV'siz pay olarak işaretlendi + `notlar` | Öz üretim yem/ot, müstahsil işçilik, amortisman KDV doğurmaz; ayrıca müstahsil GV stopajı `mustahsilStopaj` ile nakte girer (KDV dışı). |
| **hizmet-tevkifat** SMM ~%40 | KDV'siz personel payı ~%60 açık satır + `notlar` | İşgücü temininde maliyetin çoğu ücret (KDV'siz); KDV'li sarf/ekipman ~%40. |
| **enerji-yenilenebilir** AMBALAJ/ENERJI yok | Bilinçli; `notlar` ile muaf | Enerji ÜRETİR (satın almaz), ambalajı yoktur; ana girdi yatırım malları (panel/türbin) %20 → uzun süre devreden. |
| **Tevkifat yalnız %20 satışa** uygulanıyor | Korundu + not | Kısmi tevkifat ağırlıkla genel oranlı (%20) işlemlerde; %10/indirimli oranlı tevkifatlı işlemler nadir ve model dışı. Gerekirse kalem bazında eklenir. |

## v5.1 düzeltmeleri (yeniden doğrulandı)
- **tekstil-konfeksiyon:** fason işçiliği **%10** (II liste B/10) — `FASON_TEKSTIL_10`. ✅
- **hayvan-yemi-uretim:** 13/ı istisna hammadde (%0: küspe/soya/kepek) + tahıl (%1) ayrımı. ✅
- **gida-uretim:** hammadde **%1** (≈%62) + ambalaj/enerji/işçilik %20 — doğru; NakitFlow'daki
  "hammadde %100 @ %20" görüntüsü kütüphane değil TÜKETİM hatasıdır (bkz. TUKETIM-SOZLESMESI.md).

## Oran kaynakları (özet)
2007/13033 (I)/(II) liste · 5189 s.CK (temel gıda %1) · 7346 s.CK (%8→%10) ·
KDVK 11/1-a, 13/ı, 17/4-g, 29/2 · KDVGUT I/C-2 (4/10, 9/10, 7/10, 5/10, 2/10) ·
GVK 94 (müstahsil) · İndirimli oran iade alt sınırı 2026: 164.000 TL.

> Tüm paylar **tipik**tir; firma özelinde sapar (`guven` + `notlar`). Üretim öncesi YMM teyidi şart.
