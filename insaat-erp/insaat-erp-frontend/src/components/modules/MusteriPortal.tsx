/**
 * MusteriPortal — Token ile erişilen PUBLIC rapor sayfası
 * Login gerektirmez. URL: /p/:token
 */
import React, { useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { fmtTL, fmtTarih } from '@/utils/format'
import { Spinner } from '@/components/ui'

const HAVA: Record<string, string> = {
  acik: '☀️', bulutlu: '⛅', yagmurlu: '🌧️', karli: '❄️', sisli: '🌫️', ruzgarli: '💨',
}

const BASE = import.meta.env.VITE_API_URL || '/api/v1'

export const MusteriPortal: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const printRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-rapor', token],
    queryFn: () => axios.get(`${BASE}/public/rapor/${token}`).then(r => r.data.data),
    retry: false,
  })

  if (isLoading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center' }}>
        <Spinner size={40} />
        <div style={{ marginTop: 16, color: '#64748b', fontSize: 14 }}>Rapor yükleniyor...</div>
      </div>
    </div>
  )

  if (error || !data) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ color: '#1e293b', margin: '0 0 8px' }}>Rapor Bulunamadı</h2>
        <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>Bu link geçersiz, süresi dolmuş veya deaktif edilmiş olabilir.</p>
      </div>
    </div>
  )

  const r = data
  const s = r.santiye
  const h = r.hakedis
  const gecenGunler = Math.round((Date.now() - new Date(s.baslangic).getTime()) / 86400000)
  const kalanGunler = Math.round((new Date(s.bitis_planlanan).getTime() - Date.now()) / 86400000)
  const sozlesmeDolu = s.sozlesme_bedel > 0 ? (s.gerceklesen / s.sozlesme_bedel) * 100 : 0

  const handleShare = async () => {
    try { await navigator.clipboard.writeText(window.location.href); alert('Link kopyalandı!') }
    catch { alert(window.location.href) }
  }

  return (
    <>
      {/* Kontrol çubuğu */}
      <div className="no-print" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: '#0f172a', borderBottom: '1px solid rgba(255,255,255,.1)',
        padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ color: '#94a3b8', fontSize: 13 }}>
          <span style={{ color: '#6366f1', fontWeight: 700 }}>FinERP</span>
          {' · '}
          <span style={{ color: '#f1f5f9' }}>{s.firma_adi}</span>
          {' — '}
          <span style={{ color: '#94a3b8' }}>{r.link_baslik || s.ad}</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleShare} style={{
            background: 'rgba(99,102,241,.2)', border: '1px solid rgba(99,102,241,.3)',
            color: '#a5b4fc', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontSize: 13,
          }}>🔗 Linki Kopyala</button>
          <button onClick={() => window.print()} style={{
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
            border: 'none', borderRadius: 8, padding: '7px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 13,
          }}>🖨️ PDF / Yazdır</button>
        </div>
      </div>

      {/* Rapor gövdesi */}
      <div ref={printRef} style={{
        maxWidth: 900, margin: '0 auto', padding: '80px 24px 48px',
        color: '#1e293b', background: '#fff', minHeight: '100vh',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}>

        {/* BAŞLIK */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, borderBottom: '3px solid #6366f1', paddingBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
              {s.firma_adi} — Proje İlerleme Raporu
            </div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#0f172a' }}>{s.ad}</h1>
            <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>
              {s.il}{s.ilce ? `, ${s.ilce}` : ''} &nbsp;·&nbsp;
              {fmtTarih(s.baslangic)} – {fmtTarih(s.bitis_planlanan)}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Rapor Tarihi</div>
            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>{fmtTarih(r.rapor_tarihi)}</div>
            <div style={{ marginTop: 6, fontSize: 11, color: '#94a3b8' }}>
              Geçerlilik: {fmtTarih(r.gecerlilik_tarihi)}
            </div>
            <div style={{
              marginTop: 8, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              background: s.durum === 'devam' ? '#dcfce7' : s.durum === 'tamamlandi' ? '#dbeafe' : '#fef3c7',
              color: s.durum === 'devam' ? '#166534' : s.durum === 'tamamlandi' ? '#1d4ed8' : '#92400e',
            }}>{s.durum === 'devam' ? 'Devam Ediyor' : s.durum === 'tamamlandi' ? 'Tamamlandı' : 'Hazırlık'}</div>
          </div>
        </div>

        {/* KPI KARTLARI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Fiziksel İlerleme', value: `%${s.fiziksel_ilerleme ?? 0}`, color: '#6366f1', bg: '#eef2ff' },
            { label: 'Geçen Gün', value: `${gecenGunler}`, color: '#0284c7', bg: '#e0f2fe', suffix: 'gün' },
            { label: 'Kalan Süre', value: kalanGunler > 0 ? `${kalanGunler}` : 'Süre Doldu', color: kalanGunler < 30 ? '#dc2626' : '#059669', bg: kalanGunler < 30 ? '#fef2f2' : '#f0fdf4', suffix: kalanGunler > 0 ? 'gün' : '' },
            { label: 'Tahsil Edilen', value: fmtTL(h?.odenen ?? 0), color: '#059669', bg: '#f0fdf4' },
          ].map(k => (
            <div key={k.label} style={{ background: k.bg, borderRadius: 12, padding: '16px 18px', borderLeft: `4px solid ${k.color}` }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>
                {k.value}{k.suffix && <span style={{ fontSize: 12, marginLeft: 4 }}>{k.suffix}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* İLERLEME ÇUBUĞU */}
        <div style={{ marginBottom: 32, background: '#f8fafc', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>Proje İlerleme Durumu</div>
              <div style={{ color: '#64748b', fontSize: 12 }}>Sözleşme: {fmtTL(s.sozlesme_bedel ?? 0)} · Gerçekleşen: {fmtTL(s.gerceklesen ?? 0)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Finansal Gerçekleşme</div>
              <div style={{ fontWeight: 700, color: '#6366f1' }}>%{sozlesmeDolu.toFixed(1)}</div>
            </div>
          </div>
          {[
            { label: 'Fiziksel İlerleme', val: s.fiziksel_ilerleme ?? 0, color: 'linear-gradient(90deg,#6366f1,#8b5cf6)' },
            { label: 'Finansal Gerçekleşme', val: Math.min(sozlesmeDolu, 100), color: 'linear-gradient(90deg,#059669,#10b981)' },
          ].map(bar => (
            <div key={bar.label} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                <span>{bar.label}</span><span>%{bar.val.toFixed(1)}</span>
              </div>
              <div style={{ height: 10, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${bar.val}%`, background: bar.color, borderRadius: 5 }} />
              </div>
            </div>
          ))}
        </div>

        {/* HAKEDİŞ ÖZET */}
        {h && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid #e2e8f0' }}>Hakediş Durumu</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Toplam Hakediş', value: fmtTL(h.toplam_tutar), color: '#1e293b' },
                { label: 'Tahsil Edilen', value: fmtTL(h.odenen), color: '#059669' },
                { label: 'Bekleyen', value: fmtTL(h.bekleyen), color: '#d97706' },
              ].map(k => (
                <div key={k.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>
            {h.liste && h.liste.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    {['No', 'Tür', 'Tutar', 'Durum', 'Tarih'].map(c => (
                      <th key={c} style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11 }}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {h.liste.map((hk: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{hk.no}</td>
                      <td style={{ padding: '8px 12px', color: '#64748b' }}>{hk.tip}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{fmtTL(hk.tutar)}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                          background: hk.durum === 'odendi' ? '#dcfce7' : hk.durum === 'onaylandi' ? '#dbeafe' : '#fef3c7',
                          color: hk.durum === 'odendi' ? '#166534' : hk.durum === 'onaylandi' ? '#1d4ed8' : '#92400e',
                        }}>{hk.durum}</span>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#64748b' }}>{fmtTarih(hk.tarih)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* SON GÜNLÜK RAPORLAR */}
        {r.gunluk_raporlar?.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid #e2e8f0' }}>Son Saha Raporları</h2>
            {r.gunluk_raporlar.map((g: any, i: number) => (
              <div key={i} style={{ background: '#f8fafc', borderRadius: 10, padding: 16, marginBottom: 10, borderLeft: `3px solid ${g.gecikme_var_mi ? '#ef4444' : '#6366f1'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>
                      {g.hava_durumu ? HAVA[g.hava_durumu] + ' ' : ''}{g.baslik || fmtTarih(g.tarih)}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: 11, marginLeft: 8 }}>{g.ekleyen_adi}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                    <span style={{ color: '#059669' }}>👷 {g.sahada_personel}</span>
                    <span style={{ color: '#0284c7' }}>🚛 {g.sahada_ekipman}</span>
                    {g.fiziksel_ilerleme != null && <span style={{ color: '#6366f1', fontWeight: 700 }}>%{g.fiziksel_ilerleme}</span>}
                  </div>
                </div>
                {g.icerik && <p style={{ margin: 0, color: '#475569', fontSize: 13, lineHeight: 1.5 }}>{g.icerik}</p>}
                {g.gecikme_var_mi && g.gecikme_nedeni && (
                  <div style={{ marginTop: 8, padding: '6px 10px', background: '#fef2f2', borderRadius: 6, color: '#dc2626', fontSize: 12 }}>⚠️ Gecikme: {g.gecikme_nedeni}</div>
                )}
                {g.risk_notu && (
                  <div style={{ marginTop: 6, padding: '6px 10px', background: '#fefce8', borderRadius: 6, color: '#92400e', fontSize: 12 }}>🔶 Risk: {g.risk_notu}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* FOTOĞRAFLAR */}
        {r.fotograflar?.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid #e2e8f0' }}>Saha Fotoğrafları</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {r.fotograflar.map((f: any, i: number) => (
                <div key={i} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  <img src={f.thumbnail_yolu} alt={f.aciklama || `Fotoğraf ${i + 1}`}
                    style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  <div style={{ padding: '4px 8px', fontSize: 10, color: '#94a3b8', background: '#f8fafc' }}>
                    {fmtTarih(f.tarih)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ALT BİLGİ */}
        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #e2e8f0', marginTop: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>Proje Sorumlusu</div>
            <div style={{ color: '#64748b', fontSize: 13 }}>{s.mudur_adi || '—'}</div>
            {s.mudur_telefon && <div style={{ color: '#64748b', fontSize: 12 }}>📞 {s.mudur_telefon}</div>}
            {s.mudur_email && <div style={{ color: '#6366f1', fontSize: 12 }}>✉️ {s.mudur_email}</div>}
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: '#94a3b8' }}>
            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>{s.firma_adi}</div>
            <div>Bu rapor {fmtTarih(r.rapor_tarihi)} tarihinde oluşturulmuştur.</div>
            <div style={{ marginTop: 4, color: '#6366f1', fontSize: 11, fontWeight: 600 }}>FinERP — İnşaat Yönetim Sistemi</div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          * { color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </>
  )
}

export default MusteriPortal
