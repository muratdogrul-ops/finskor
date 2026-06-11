# REVİZYON NOTU — v4 → v5 (Ürün/Girdi Reçeteli Yeniden Yazım)

## Özet
- 18 → **21 sektör** (gıda altında yeni üretim dalları: `gida-uretim`, `gida-uretim-sut`, `gida-uretim-et`).
- Her sektörde alış tarafı **tek "hammadde %20" yığını yerine ayrı satırlar**:
  hammadde + **ambalaj** + **enerji** + **işçilik/fason** + **nakliye** + yardımcı/kimyasal.
- `pay` alanları artık **{min, max, tipik}**; SMM payları ~1,0, OPEX ayrı ağırlık (faaliyet gideri).
- Katalog: `uiGrup` (gida/imalat/ticaret/hizmet) + `altDal` (ticaret/uretim/ihracat/tarim/hizmet).
- Testler: **86 geçiyor** (19 hesaplayıcı + 67 bootstrap). Örnek beyannameler yeni reçeteyle güncellendi.

## Oran dayanağı (tüm sektörler ortak)
- Temel/işlenmiş gıda (un, süt, et, **şeker/çikolata/bisküvi**) **%1** — 2007/13033 (I) liste, fasıl 17–19; 5189 s.CK (14.02.2022).
- ÖTV'li/aromalı/gazlı içecek **%10**; yeme-içme hizmeti, konaklama, **tekstil/giyim %10** — (II) liste; 7346 s.CK (10.07.2023, %8→%10).
- Hammadde, ambalaj, enerji, işçilik, nakliye, kimyasal **%20** (genel oran).
- İhracat **%0** (KDVK 11/1-a); **yem & gübre tam istisna** (KDVK 13/ı).

## Sektör sektör değişiklik

### Gıda grubu (uiGrup: gida)
| Sektör | altDal | Ne değişti | Reçete / kaynak |
|---|---|---|---|
| gida-toptan-perakende | ticaret | Saf ticaret; ambalaj minimal, OPEX'te ayrı enerji+nakliye | gıda alış %1 + gıda dışı %20; 29/2 |
| **gida-uretim** (YENİ) | uretim | Genel gıda üretim şablonu; **ambalaj/enerji/işleme/katkı ayrı SMM satırı** | çıktı %1, girdiler %20 → 29/2; (I) liste |
| **gida-uretim-sut** (YENİ) | uretim | Çiğ süt %1 + ambalaj/enerji/soğuk zincir %20 | (I) liste süt; 29/2 |
| **gida-uretim-et** (YENİ) | uretim | Karkas %1 + vakum ambalaj/işleme/baharat %20 | (I) liste et; 29/2 |
| un-irmik-uretim | uretim | Buğday %1 + **çuval/big-bag ambalaj** + öğütme enerjisi ayrı | (I) liste değirmencilik; 29/2 |
| hayvan-yemi-uretim | uretim | Satış 13/ı tam istisna; tahıl %1 + katkı/ambalaj/enerji %20 | KDVK 13/ı; tüm girdi iade |
| tarim-isleme | tarim | Yem+gübre istisna ayrı; ilaç/enerji/nakliye ayrı; **müstahsil GV stopajı** | (I) liste; 13/ı; GVK 94 |
| findik-kuruyemis-ihracat | ihracat | Müstahsil %1 + kavurma işçilik + **kraft/vakum ambalaj** + ihracat lojistiği ayrı | (I) liste; 11/1-a; müstahsil stopaj |

### İmalat grubu (uiGrup: imalat)
| Sektör | Ne değişti | Kaynak |
|---|---|---|
| ihracat-agirlikli | Hammadde + ambalaj + enerji + fason + lojistik ayrı | 11/1-a |
| makine-imalat | Çelik/komponent + sarf + ahşap ambalaj + fason talaşlı imalat ayrı | genel oran; 11/1-a |
| otomotiv-yan-sanayi | Komponent + kaplama sarf + ambalaj + fason ayrı | genel oran; 11/1-a |
| kimya-plastik | Petrokimya/reçine + katalizör + varil ambalaj + enerji ayrı | genel oran; 11/1-a |
| demir-celik-metallurgy | Hurda/cevher + **yüksek ark ocağı enerjisi** + ferroalyaj/elektrot ayrı; mamul **5/10 tevkifat** | KDVGUT 2.1.3.3.8; hurda 7/10 (2.1.3.3.4) |
| tekstil-konfeksiyon | İplik/kumaş %10 + boya/kimyasal %20 + enerji + fason dikim ayrı | (II) liste %10; 29/2 + 11/1-a; fason 7/10 |
| enerji-yenilenebilir | Panel/türbin yatırım + montaj işçilik + kablo/trafo ayrı | genel oran; yatırım → devreden |

### Ticaret grubu (uiGrup: ticaret)
| Sektör | Ne değişti | Kaynak |
|---|---|---|
| genel-ticaret-standart | Ticari mal %20 + ambalaj + OPEX'te enerji/nakliye ayrı | genel oran |
| hammadde-ticaret | Mal %20 + nakliye SMM'de + ambalaj ayrı | genel oran |

### Hizmet grubu (uiGrup: hizmet)
| Sektör | Ne değişti | Kaynak |
|---|---|---|
| insaat-taahhut-tevkifat | Malzeme + taşeron + şantiye enerji + nakliye + ekipman kira ayrı; **4/10 + 5M eşik** | KDVGUT I/C-2.1.3.2.1 |
| hizmet-tevkifat | İşgücü 9/10; sarf SMM + enerji/ulaşım/kira OPEX ayrı; **ücret KDV dışı** notu | KDVGUT I/C-2.1.3.2.5 |
| lojistik-tasimacilik | Akaryakıt + bakım/lastik + paletleme + filo yatırım ayrı; **2/10** | KDVGUT I/C-2.1.3.2 |
| turizm-konaklama | F&B gıda %1 + enerji + temizlik hizmet + amenities + tesis yatırım ayrı | (II) liste %10; 29/2 |

## Bilinçli sınırlar (değişmedi)
- Sektör payları **tipik**tir; firma özelinde sapar (güven alanı + notlar).
- Tevkifatta fatura-bazlı eşik (yapım 5M TL) toplulaştırılmış beyannamede doğrulanamaz (uyarı + `tevkifatUygula`).
- `odenecekVergi36Net` mizan F satırıyla kalibre edilmez (mizan yoksa referans yok; mizan gelince kütüphane devre dışı).
- Müstahsil GV stopajı (%2 borsa) tahminîdir; ürün/borsa durumuna göre değişir.

## Kaynaklar (kısa)
2007/13033 sayılı BKK (I)/(II) sayılı listeler · 5189 s.CK · 7346 s.CK · 51 No.lu KDV Tebliği (yeme-içme) ·
KDVK 11/1-a, 13/ı, 17/4-g, 29/2 · KDVGUT I/C-2 (tevkifat: 4/10, 9/10, 7/10, 5/10, 2/10) · GVK 94 (müstahsil) ·
muhasebe-motoru VERGI_PARAMETRE (indirimli oran iade alt sınırı 2026: 164.000 TL).

> Yasal uyarı: Tipik sektör modelidir; firma özelinde ve üretim öncesi **mali müşavir/YMM teyidi** gerekir.

---

## v5 → v5.1 düzeltmeleri (oran denetimi)

Tüm sektörlerin kova oranları yeniden denetlendi. Bulunan ve düzeltilen hatalar:

| # | Sektör | Hata | Düzeltme | Kaynak |
|---|---|---|---|---|
| 1 | tekstil-konfeksiyon | Fason dikim/işçilik **%20** girilmişti | **%10**'a düzeltildi (`FASON_TEKSTIL_10`) | 2007/13033 (II) liste B/10: fason tekstil/konfeksiyon işleri %10 |
| 2 | hayvan-yemi-uretim | Tüm hammadde tek satır %1 idi | **İstisna (%0, 13/ı: küspe/soya/kepek/balık unu) + tahıl (%1)** ayrımı eklendi | KDVK 13/ı |

Doğrulanıp **doğru** çıkan kritik noktalar (değişmedi):
- **gida-uretim** hammadde **%1** (0.62) + ambalaj/enerji/işçilik/katkı %20 ayrı — zaten doğruydu.
  (NakitFlow'da görülen "hammadde %100 @ %20" tablosu, kütüphanenin değil, kovaları tek satıra
  indirgeyen TÜKETİM tarafının hatasıdır — README tüketim uyarısına bakınız.)
- gida-uretim yurtiçi satış blended ≈ **%2,35** (0.85×%1 + 0.15×%10) — teyit edildi.
- Yem teslimi %0 tam istisna (13/ı); süt/et/un hammaddeleri %1; tekstil iplik/kumaş %10;
  demir-çelik mamul %20 + 5/10 tevkifat; akaryakıt/enerji/ambalaj/kimyasal %20 — teyit edildi.

Etkilenen örnek/test değerleri: yem iadePotansiyeli 379.000 → **370.000**; tekstil örneği
(yeni) iadePotansiyeli **96.000** (fason %10 sonrası devreden pozisyonu).

---

## v5.1 → v5.2 (denetim + köprü + UI eşleme)
- **Sektör denetimi (21/21):** SMM `pay.tipik` toplamı 1,0'a tamamlandı — KDV'siz
  maliyet payı açık `KDVSIZ_GIDER` satırı (oran %0, indirilecek etkisi yok). Satış
  payları 1,0; her satırda `kaynak`; üretimde AMBALAJ+ENERJI (enerji-yenilenebilir notlu muaf).
  Ayrıntı: SEKTOR-DENETIM-RAPORU.md.
- **YENİ `aylik-kova-projeksiyon.js`:** hesapla()'dan aylık 391/191/360/190/iade;
  devreden aylar arası taşınır; rejim bazlı (GENEL / 29-2 / ihracat / tevkifat);
  toMotorGirdi uyumlu. Spec: AYLIK-PROJEKSIYON.md.
- **YENİ `kova-ui-esleme.js`:** 4 kova UI özeti (raw/pack/energy/other + opex),
  ağırlıklı oran Σ(pay×oran)/Σ(pay). "hammadde %100 @ %20" yanlışını gösterir.
- **YENİ `TUKETIM-SOZLESMESI.md`:** alış satırlarını tek satıra ezme yasağı,
  pay.tipik okuma, SMM/OPEX ayrımı, iadePotansiyeli≠nihai iade.
- **Yeni `notlar` alanı** (sektorMeta): tarim/hizmet-tevkifat/enerji/lojistik/turizm
  için KDV'siz pay açıklaması; `istisnaTipi: "kdvsiz"` şemaya eklendi.
- **Yeni örnekler:** un-irmik, tarim-isleme beyanname-only.
- **Testler: 202** (tek komut `node test/calistir.js`). Regresyon korundu:
  yem 370.000 · tekstil 96.000 · fındık 219.300 · gida-uretim hammadde %1.
