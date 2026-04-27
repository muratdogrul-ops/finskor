import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { dashboardApi } from '@/services/api'
import { KpiCard, Card, Badge, ProgressBar, Spinner, EmptyState } from '@/components/ui'
import { fmtTL, fmtNeSaatOnce, progColor } from '@/utils/format'
import { DashboardKpi } from '@/types'

export const Dashboard: React.FC = () => {
  const navigate = useNavigate()

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-kpi'],
    queryFn: () => dashboardApi.getKpi().then(r => r.data.data),
    refetchInterval: 60_000,
  })

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <Spinner size={32} />
    </div>
  )

  if (error || !data) return (
    <EmptyState icon="⚠️" title="Veriler yüklenemedi" sub="Sunucu bağlantısını kontrol edin" />
  )

  const { kpi, nakit_akisi, uyarilar } = data as { kpi: DashboardKpi; nakit_akisi: any[]; uyarilar: any[] }

  const tamamlanmaPct = kpi.toplam_sozlesme > 0
    ? Math.round((kpi.toplam_gerceklesen / kpi.toplam_sozlesme) * 100)
    : 0

  return (
    <div>
      {/* KPI Grid */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
        <KpiCard
          label="Toplam Taahhüt"
          value={fmtTL(kpi.toplam_sozlesme)}
          sub={`${kpi.aktif_santiye} aktif şantiye`}
          color="#60a5fa" change={12}
          onClick={() => navigate('/santiyeler')}
        />
        <KpiCard
          label="Gerçekleşen İş"
          value={fmtTL(kpi.toplam_gerceklesen)}
          sub={`%${tamamlanmaPct} tamamlandı`}
          color="#00d4aa" change={8}
        />
        <KpiCard
          label="Bekleyen Hakediş"
          value={fmtTL(kpi.bekleyen_hakedis)}
          sub="tahsil edilmedi"
          color="#f59e0b"
          onClick={() => navigate('/hakedisler')}
        />
        <KpiCard
          label="Ort. Fiziksel"
          value={`%${kpi.ort_fiziksel}`}
          sub="tüm şantiyeler"
          color="#a78bfa" change={3}
        />
        <KpiCard
          label="Onay Bekleyen"
          value={kpi.bekleyen_satinalma}
          sub="satın alma talebi"
          color="#f87171"
          onClick={() => navigate('/satinalma')}
        />
        <KpiCard
          label="Bakımda Ekipman"
          value={kpi.bakimda_ekipman}
          sub="servis bekliyor"
          color="#fb923c"
          onClick={() => navigate('/ekipmanlar')}
        />
      </div>

      {/* Charts Row */}
      <div className="dash-charts" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Nakit Akış Mini Grafik */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: '#e2e8f0' }}>
            Son 6 Ay Nakit Akışı
          </div>
          {nakit_akisi.length > 0 ? (
            <div>
              {nakit_akisi.slice(-6).map((ay: any, i: number) => {
                const max = Math.max(...nakit_akisi.map((a: any) => Math.max(a.giris || 0, a.cikis || 0)))
                return (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ color: '#6b7280', fontSize: 11 }}>
                        {['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'][ay.ay - 1]}
                      </span>
                      <span style={{ color: '#00d4aa', fontSize: 11, fontWeight: 700 }}>
                        {fmtTL(ay.giris || 0)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 3, height: 6 }}>
                      <div style={{
                        flex: max > 0 ? (ay.giris || 0) / max : 0,
                        background: '#00d4aa', borderRadius: 3,
                        transition: 'flex 0.5s ease'
                      }} />
                      <div style={{
                        flex: max > 0 ? (ay.cikis || 0) / max : 0,
                        background: '#ef4444', borderRadius: 3,
                        transition: 'flex 0.5s ease'
                      }} />
                    </div>
                  </div>
                )
              })}
              <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#6b7280' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#00d4aa', display: 'inline-block' }} />Tahsilat
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#6b7280' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} />Gider
                </span>
              </div>
            </div>
          ) : (
            <div style={{ color: '#4b5563', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
              Henüz nakit hareketi yok
            </div>
          )}
        </Card>

        {/* Uyarılar */}
        <div>
          <Card style={{ background: 'rgba(245,158,11,.07)', borderColor: 'rgba(245,158,11,.2)' }}>
            <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
              </svg>
              Uyarılar & Hatırlatmalar
            </div>
            {uyarilar.length > 0 ? (
              uyarilar.map((u: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <div style={{ color: '#e2e8f0', fontSize: 12 }}>{u.mesaj}</div>
                    <div style={{ color: '#6b7280', fontSize: 10, marginTop: 2 }}>{fmtNeSaatOnce(u.tarih)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: '#6b7280', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>
                ✓ Aktif uyarı yok
              </div>
            )}
          </Card>

          {/* Hızlı erişim */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
            {[
              { label: 'Hakediş Ekle', path: '/hakedisler', icon: '📄', color: '#60a5fa' },
              { label: 'Satın Alma', path: '/satinalma', icon: '🛒', color: '#00d4aa' },
              { label: 'Mesajlar', path: '/mesajlar', icon: '💬', color: '#a78bfa' },
              { label: 'Nakit Akışı', path: '/nakit', icon: '💰', color: '#f59e0b' },
            ].map(item => (
              <button key={item.path} onClick={() => navigate(item.path)} style={{
                background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)',
                borderRadius: 10, padding: '12px', cursor: 'pointer', textAlign: 'left',
                transition: 'all .15s', color: '#f1f5f9'
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')}
              >
                <div style={{ fontSize: 18, marginBottom: 4 }}>{item.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: item.color }}>{item.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 767px) {
          .dash-charts { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .kpi-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  )
}
