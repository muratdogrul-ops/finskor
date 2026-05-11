/**
 * API satırları gevşek tiplenir; alanlar modül içinde kullanıldıkça genişletilir.
 * Böylece eksik alan tanımı yüzünden derleme kırılmaz.
 */

export type DashboardKpi = Record<string, number> & {
  toplam_sozlesme?: number
  toplam_gerceklesen?: number
  aktif_santiye?: number
}

export type Santiye = Record<string, unknown> & { id: string; ad: string }

export type Hakedis = Record<string, unknown> & { id: string }

export type SatinalmaTalep = Record<string, unknown> & { id: string }

export type Ekipman = Record<string, unknown> & { id: string }

export type Personel = Record<string, unknown> & { id: string }

export type SantiyeGunluk = Record<string, unknown> & { id: string }

export type FaturaKalem = Record<string, unknown>

export type Fatura = Record<string, unknown> & { id: string }

export type FaturaOzet = Record<string, unknown>
