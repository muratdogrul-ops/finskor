/** Para ve tarih biçimleme — ERP arayüzü */

export const durumLabel: Record<string, string> = {
  aktif: 'Aktif',
  pasif: 'Pasif',
  tamamlandi: 'Tamamlandı',
  devam: 'Devam',
  bekliyor: 'Bekliyor',
  onaylandi: 'Onaylandı',
  reddedildi: 'Reddedildi',
}

export const durumColor: Record<string, string> = {
  aktif: 'green',
  tamamlandi: 'green',
  onaylandi: 'green',
  devam: 'blue',
  bekliyor: 'amber',
  pasif: 'amber',
  reddedildi: 'red',
}

export function progColor(value: number): string {
  if (value >= 80) return '#22c55e'
  if (value >= 50) return '#eab308'
  return '#ef4444'
}

export function fmtTL(n: number | string | null | undefined): string {
  const x = typeof n === 'string' ? parseFloat(n) : Number(n ?? 0)
  if (Number.isNaN(x)) return '₺0'
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(x)
}

export function fmtSayi(n: number | string | null | undefined): string {
  const x = typeof n === 'string' ? parseFloat(n) : Number(n ?? 0)
  if (Number.isNaN(x)) return '0'
  return new Intl.NumberFormat('tr-TR').format(x)
}

export function fmtTarih(iso: string | Date | null | undefined): string {
  if (!iso) return '—'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtNeSaatOnce(iso: string | Date | null | undefined): string {
  if (!iso) return '—'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const diff = Date.now() - d.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Az önce'
  if (m < 60) return `${m} dk önce`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h} sa önce`
  return fmtTarih(d)
}

export function initials(ad?: string | null, soyad?: string | null): string {
  const a = (ad || '').trim().charAt(0)
  const s = (soyad || '').trim().charAt(0)
  return (a + s || a || '?').toUpperCase()
}

export function avatarColor(seed: string): string {
  const colors = ['#6366f1', '#8b5cf6', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899']
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return colors[h % colors.length]
}
