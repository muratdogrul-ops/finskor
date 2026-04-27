import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { aiApi } from '@/services/api'

// ─── TİPLER ──────────────────────────────────────────────────────────────────
interface Uyari {
  id: string
  tip: 'kritik' | 'uyari' | 'bilgi'
  kategori: 'maliyet' | 'gecikme' | 'tahsilat' | 'stok' | 'butce'
  santiye_adi?: string
  baslik: string
  aciklama: string
  deger?: number
  hedef?: number
  sapma_yuzdesi?: number
  oneri: string
  tarih: string
}

interface ProjeRisk {
  santiye_id: string
  santiye_adi: string
  risk_skoru: number
  risk_seviyesi: 'dusuk' | 'orta' | 'yuksek' | 'kritik'
  spi: number | null
  cpi: number | null
  tamamlanma_tahmini: string | null
  gecikme_gun: number
  maliyet_sapma_yuzdesi: number
  tahsilat_bekleyen: number
  uyarilar: string[]
}

interface AiOzet {
  aktif_proje: number
  geciken_proje: number
  ort_ilerleme: number
  maliyet_gerceklesme: number
  vadesi_gecmis_fatura: number
  vadesi_gecmis_tutar: number
  tahsil_bekleyen: number
}

// ─── YARDIMCI BİLEŞENLER ─────────────────────────────────────────────────────
const tipRenk = {
  kritik: { bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700', icon: '🔴', label: 'Kritik' },
  uyari:  { bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', icon: '🟡', label: 'Uyarı' },
  bilgi:  { bg: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700', icon: '🔵', label: 'Bilgi' },
}

const kategoriIcon: Record<string, string> = {
  maliyet: '💰', gecikme: '⏰', tahsilat: '📋', stok: '📦', butce: '🛒',
}

const riskRenk = {
  dusuk:   { bar: 'bg-green-500', text: 'text-green-700', badge: 'bg-green-100 text-green-700' },
  orta:    { bar: 'bg-yellow-500', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' },
  yuksek:  { bar: 'bg-orange-500', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' },
  kritik:  { bar: 'bg-red-500', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
}

const riskEtiket = { dusuk: 'Düşük Risk', orta: 'Orta Risk', yuksek: 'Yüksek Risk', kritik: 'Kritik Risk' }

function fmt(n: number) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n)
}

// ─── UYARI KARTI ─────────────────────────────────────────────────────────────
const UyariKart: React.FC<{ uyari: Uyari }> = ({ uyari }) => {
  const [acik, setAcik] = useState(false)
  const stil = tipRenk[uyari.tip]

  return (
    <div className={`border rounded-xl p-4 ${stil.bg} transition-all`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-xl mt-0.5">{stil.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${stil.badge}`}>
                {stil.label}
              </span>
              <span className="text-xs text-gray-500">
                {kategoriIcon[uyari.kategori]} {uyari.kategori.charAt(0).toUpperCase() + uyari.kategori.slice(1)}
              </span>
              {uyari.santiye_adi && (
                <span className="text-xs text-gray-500 bg-white/70 px-2 py-0.5 rounded-full">
                  📍 {uyari.santiye_adi}
                </span>
              )}
            </div>
            <p className="font-semibold text-gray-900 text-sm leading-snug">{uyari.baslik}</p>
            <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{uyari.aciklama}</p>
            {acik && (
              <div className="mt-3 p-3 bg-white/80 rounded-lg border border-white/60">
                <p className="text-xs font-semibold text-gray-700 mb-1">💡 Önerilen Aksiyon</p>
                <p className="text-sm text-gray-700">{uyari.oneri}</p>
                {uyari.deger !== undefined && (
                  <p className="text-xs text-gray-500 mt-2">
                    Değer: <span className="font-medium">{fmt(uyari.deger)}</span>
                    {uyari.hedef !== undefined && ` / Hedef: ${fmt(uyari.hedef)}`}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => setAcik(!acik)}
          className="flex-shrink-0 text-xs text-gray-500 hover:text-gray-700 bg-white/70 hover:bg-white px-2 py-1 rounded-lg transition-colors"
        >
          {acik ? '▲ Kapat' : '▼ Öneri'}
        </button>
      </div>
    </div>
  )
}

// ─── PROJE RİSK KARTI ────────────────────────────────────────────────────────
const ProjeRiskKart: React.FC<{ proje: ProjeRisk }> = ({ proje }) => {
  const renk = riskRenk[proje.risk_seviyesi]

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-gray-900 text-sm leading-tight flex-1 min-w-0 mr-2">
          {proje.santiye_adi}
        </h3>
        <span className={`flex-shrink-0 text-xs font-medium px-2 py-1 rounded-full ${renk.badge}`}>
          {riskEtiket[proje.risk_seviyesi]}
        </span>
      </div>

      {/* Risk skoru çubuğu */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Risk Skoru</span>
          <span className={`font-bold ${renk.text}`}>{proje.risk_skoru}/100</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${renk.bar}`}
            style={{ width: `${proje.risk_skoru}%` }}
          />
        </div>
      </div>

      {/* KPI Satırı */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-xs text-gray-500">SPI</p>
          <p className={`text-sm font-bold ${proje.spi !== null && proje.spi < 0.8 ? 'text-red-600' : 'text-gray-800'}`}>
            {proje.spi !== null ? proje.spi.toFixed(2) : '—'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-xs text-gray-500">CPI</p>
          <p className={`text-sm font-bold ${proje.cpi !== null && proje.cpi < 0.85 ? 'text-red-600' : 'text-gray-800'}`}>
            {proje.cpi !== null ? proje.cpi.toFixed(2) : '—'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-xs text-gray-500">Gecikme</p>
          <p className={`text-sm font-bold ${proje.gecikme_gun > 30 ? 'text-red-600' : proje.gecikme_gun > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            {proje.gecikme_gun > 0 ? `${proje.gecikme_gun}g` : 'Yok'}
          </p>
        </div>
      </div>

      {/* Tahsilat bekleyen */}
      {proje.tahsilat_bekleyen > 0 && (
        <div className="text-xs text-gray-600 mb-2">
          📋 Tahsilat bekleyen: <span className="font-semibold">{fmt(proje.tahsilat_bekleyen)} ₺</span>
        </div>
      )}

      {/* Tamamlanma tahmini */}
      {proje.tamamlanma_tahmini && (
        <div className="text-xs text-gray-600 mb-2">
          📅 Tahmini bitiş: <span className="font-semibold">{proje.tamamlanma_tahmini}</span>
        </div>
      )}

      {/* Uyarı listesi */}
      {proje.uyarilar.length > 0 && (
        <div className="mt-2 space-y-1">
          {proje.uyarilar.map((u, i) => (
            <div key={i} className="text-xs text-gray-600 flex items-start gap-1">
              <span className="text-amber-500 mt-0.5">⚠</span>
              <span>{u}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── ANA PANEL ───────────────────────────────────────────────────────────────
type Sekme = 'uyarilar' | 'proje-riskler'
type UyariFiltre = 'hepsi' | 'kritik' | 'uyari' | 'bilgi'

export const AiUyarilar: React.FC = () => {
  const [sekme, setSekme] = useState<Sekme>('uyarilar')
  const [filtre, setFiltre] = useState<UyariFiltre>('hepsi')

  const ozetQ = useQuery({
    queryKey: ['ai-ozet'],
    queryFn: () => aiApi.ozet().then(r => r.data.data as AiOzet),
  })
  const uyariQ = useQuery({
    queryKey: ['ai-uyarilar'],
    queryFn: () => aiApi.uyarilar().then(r => r.data as { data: Uyari[]; ozet: Record<string, number> }),
  })
  const riskQ = useQuery({
    queryKey: ['ai-proje-riskler'],
    queryFn: () => aiApi.projeRiskler().then(r => r.data.data as ProjeRisk[]),
    enabled: sekme === 'proje-riskler',
  })

  const ozet = ozetQ.data
  const uyarilar = uyariQ.data?.data ?? []
  const uyariOzet = uyariQ.data?.ozet
  const riskler = riskQ.data ?? []

  const filtreliUyarilar = filtre === 'hepsi'
    ? uyarilar
    : uyarilar.filter(u => u.tip === filtre)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Başlık */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Akıllı Analiz & Uyarılar</h1>
        <p className="text-sm text-gray-500 mt-1">
          Projeleriniz için otomatik risk analizi, maliyet sapması ve gecikme uyarıları
        </p>
      </div>

      {/* KPI Kartları */}
      {ozet && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Aktif Proje', value: ozet.aktif_proje, icon: '🏗️', color: 'text-blue-600' },
            { label: 'Geciken Proje', value: ozet.geciken_proje, icon: '⏰', color: ozet.geciken_proje > 0 ? 'text-red-600' : 'text-green-600' },
            { label: 'Ort. İlerleme', value: `%${ozet.ort_ilerleme}`, icon: '📊', color: 'text-indigo-600' },
            { label: 'Vadesi Geçmiş', value: ozet.vadesi_gecmis_fatura, icon: '📋', color: ozet.vadesi_gecmis_fatura > 0 ? 'text-red-600' : 'text-green-600' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl mb-1">{k.icon}</p>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-gray-500 mt-1">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Uyarı Özet Banner */}
      {uyariOzet && uyariOzet.kritik > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">🚨</span>
          <div>
            <p className="font-semibold text-red-800">
              {uyariOzet.kritik} kritik uyarı dikkat gerektiriyor
            </p>
            <p className="text-sm text-red-600">Aşağıdaki konular ivedi aksiyon gerektirir.</p>
          </div>
        </div>
      )}

      {/* Sekme Seçici */}
      <div className="flex gap-2 border-b border-gray-200">
        {([
          { id: 'uyarilar',      label: '⚠️ Uyarılar', count: uyarilar.length },
          { id: 'proje-riskler', label: '📊 Proje Riski', count: riskler.length },
        ] as Array<{ id: Sekme; label: string; count: number }>).map(s => (
          <button
            key={s.id}
            onClick={() => setSekme(s.id)}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              sekme === s.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {s.label}
            {s.count > 0 && (
              <span className="ml-1.5 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
                {s.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── UYARILAR SEKMESİ ── */}
      {sekme === 'uyarilar' && (
        <div className="space-y-4">
          {/* Filtreler */}
          <div className="flex flex-wrap gap-2">
            {(['hepsi', 'kritik', 'uyari', 'bilgi'] as UyariFiltre[]).map(f => (
              <button
                key={f}
                onClick={() => setFiltre(f)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                  filtre === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f === 'hepsi' ? 'Tümü' : f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== 'hepsi' && uyariOzet && (
                  <span className="ml-1 opacity-75">({uyariOzet[f] ?? 0})</span>
                )}
              </button>
            ))}
          </div>

          {uyariQ.isLoading && (
            <div className="text-center py-12 text-gray-400">Analiz yapılıyor…</div>
          )}

          {!uyariQ.isLoading && filtreliUyarilar.length === 0 && (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-gray-600 font-medium">
                {filtre === 'hepsi' ? 'Şu an aktif uyarı yok' : `${filtre} seviyesinde uyarı yok`}
              </p>
              <p className="text-sm text-gray-400 mt-1">Tüm projeler normal seyrediyor</p>
            </div>
          )}

          <div className="space-y-3">
            {filtreliUyarilar.map(u => (
              <UyariKart key={u.id} uyari={u} />
            ))}
          </div>
        </div>
      )}

      {/* ── PROJE RİSKİ SEKMESİ ── */}
      {sekme === 'proje-riskler' && (
        <div className="space-y-4">
          {/* Açıklama */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <p className="font-medium mb-1">📐 Hesaplama Metodolojisi</p>
            <ul className="space-y-0.5 text-blue-700 list-disc list-inside">
              <li><strong>SPI</strong> (Schedule Performance Index) — Planlanan ilerlemeye karşı gerçekleşen ilerleme. &lt;0.80 = risk.</li>
              <li><strong>CPI</strong> (Cost Performance Index) — Kazanılan değer / gerçek maliyet. &lt;0.85 = risk.</li>
              <li><strong>Risk Skoru</strong> — SPI, CPI, gecikme, vade geçmiş fatura ve maliyet sapmasının ağırlıklı toplamı (0–100).</li>
            </ul>
          </div>

          {riskQ.isLoading && (
            <div className="text-center py-12 text-gray-400">Proje riskleri hesaplanıyor…</div>
          )}

          {!riskQ.isLoading && riskler.length === 0 && (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🏗️</p>
              <p className="text-gray-600 font-medium">Analiz edilecek aktif proje yok</p>
              <p className="text-sm text-gray-400 mt-1">Şantiye ekledikten sonra buraya veri gelir</p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {riskler.map(r => (
              <ProjeRiskKart key={r.santiye_id} proje={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default AiUyarilar
