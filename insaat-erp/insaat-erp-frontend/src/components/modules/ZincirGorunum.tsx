import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { hakedisApi, faturaApi, nakitApi } from '@/services/api'
import { fmtTL, fmtTarih } from '@/utils/format'
import { Spinner } from '@/components/ui'

// ─── TİP ─────────────────────────────────────────────────────────────────────
interface ZincirItem {
  hakedis_id: string
  hakedis_no: string
  santiye_adi: string
  donem_bitis: string
  hakedis_tutar: number
  hakedis_durum: string
  fatura_id?: string
  fatura_no?: string
  fatura_gib?: string
  fatura_odeme?: string
  fatura_vade?: string
  nakit_id?: string
  nakit_tarih?: string
}

// ─── ADIM BADGE ───────────────────────────────────────────────────────────────
const Adim: React.FC<{ no: number; label: string; done: boolean; warn?: boolean; active?: boolean }> = ({ no, label, done, warn, active }) => {
  const color = done ? '#22c55e' : warn ? '#ef4444' : active ? '#f59e0b' : '#475569'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: `${color}22`, border: `2px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color,
      }}>{done ? '✓' : no}</div>
      <div style={{ color, fontSize: 11, marginTop: 4, fontWeight: 600, textAlign: 'center' }}>{label}</div>
    </div>
  )
}

// ─── BAĞLANTICI ───────────────────────────────────────────────────────────────
const Connector: React.FC<{ done: boolean }> = ({ done }) => (
  <div style={{ flex: 0.5, height: 2, background: done ? '#22c55e55' : '#47556955', marginTop: 16, alignSelf: 'flex-start' }} />
)

// ─── ZINCIR SATIRI ────────────────────────────────────────────────────────────
const ZincirSatir: React.FC<{ item: ZincirItem }> = ({ item }) => {
  const [acik, setAcik] = useState(false)

  const adim1 = ['onaylandi', 'odendi'].includes(item.hakedis_durum)
  const adim2 = !!item.fatura_id
  const adim3 = item.fatura_odeme === 'odendi'
  const vadeGecti = !adim3 && item.fatura_vade && new Date(item.fatura_vade) < new Date()

  const genelDurum = adim3 ? '#22c55e' : vadeGecti ? '#ef4444' : adim1 ? '#f59e0b' : '#475569'

  return (
    <div style={{ background: 'rgba(255,255,255,.03)', border: `1px solid ${genelDurum}33`, borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
      {/* Başlık satırı */}
      <div
        style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', cursor: 'pointer', gap: 16 }}
        onClick={() => setAcik(v => !v)}
      >
        {/* Sol: Hakediş bilgisi */}
        <div style={{ flex: 2 }}>
          <span style={{ color: '#a5b4fc', fontWeight: 700, fontSize: 14 }}>{item.hakedis_no}</span>
          <div style={{ color: '#64748b', fontSize: 12 }}>{(item.santiye_adi || '').split(' ').slice(0,4).join(' ')} · {fmtTarih(item.donem_bitis)}</div>
        </div>

        {/* Orta: Tutar */}
        <div style={{ flex: 1.2, textAlign: 'right' }}>
          <div style={{ color: '#00d4aa', fontWeight: 700, fontSize: 15 }}>{fmtTL(item.hakedis_tutar)}</div>
        </div>

        {/* Sağ: Adımlar */}
        <div style={{ flex: 3, display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
          <Adim no={1} label="Onaylandı" done={adim1} active={!adim1 && item.hakedis_durum === 'gonderildi'} />
          <Connector done={adim1} />
          <Adim no={2} label="Fatura" done={adim2} active={adim1 && !adim2} />
          <Connector done={adim2} />
          <Adim no={3} label="Ödeme" done={adim3} warn={!!vadeGecti} active={adim2 && !adim3 && !vadeGecti} />
        </div>

        {/* Ok */}
        <div style={{ color: '#475569', fontSize: 14, transition: 'transform .2s', transform: acik ? 'rotate(180deg)' : 'none' }}>▼</div>
      </div>

      {/* Detay paneli */}
      {acik && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          {/* Hakediş */}
          <div style={{ background: 'rgba(99,102,241,.07)', borderRadius: 8, padding: 12 }}>
            <div style={{ color: '#6366f1', fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>📄 Hakediş</div>
            <div style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 600 }}>{item.hakedis_no}</div>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>{fmtTL(item.hakedis_tutar)}</div>
            <div style={{ marginTop: 6 }}>
              <span style={{
                background: adim1 ? '#22c55e22' : '#f59e0b22',
                color: adim1 ? '#22c55e' : '#f59e0b',
                border: `1px solid ${adim1 ? '#22c55e44' : '#f59e0b44'}`,
                padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
              }}>{item.hakedis_durum}</span>
            </div>
          </div>

          {/* Fatura */}
          <div style={{ background: adim2 ? 'rgba(34,197,94,.05)' : 'rgba(255,255,255,.03)', borderRadius: 8, padding: 12, border: `1px dashed ${adim2 ? '#22c55e33' : 'rgba(255,255,255,.08)'}` }}>
            <div style={{ color: adim2 ? '#22c55e' : '#475569', fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>🧾 Fatura</div>
            {adim2 ? (
              <>
                <div style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 600 }}>{item.fatura_no}</div>
                {item.fatura_vade && <div style={{ color: '#64748b', fontSize: 12 }}>Vade: {fmtTarih(item.fatura_vade)}</div>}
                <div style={{ marginTop: 6 }}>
                  <span style={{ background: '#6366f122', color: '#a5b4fc', border: '1px solid #6366f144', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>{item.fatura_gib || 'taslak'}</span>
                </div>
              </>
            ) : (
              <div style={{ color: '#475569', fontSize: 12, marginTop: 8 }}>
                {adim1 ? '⚠ Fatura oluşturulmadı' : 'Hakediş onayı bekleniyor'}
              </div>
            )}
          </div>

          {/* Ödeme */}
          <div style={{ background: adim3 ? 'rgba(0,212,170,.05)' : vadeGecti ? 'rgba(239,68,68,.05)' : 'rgba(255,255,255,.03)', borderRadius: 8, padding: 12, border: `1px dashed ${adim3 ? '#00d4aa33' : vadeGecti ? '#ef444433' : 'rgba(255,255,255,.08)'}` }}>
            <div style={{ color: adim3 ? '#00d4aa' : vadeGecti ? '#ef4444' : '#475569', fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>💰 Ödeme / Kasa</div>
            {adim3 ? (
              <>
                <div style={{ color: '#00d4aa', fontSize: 13, fontWeight: 600 }}>✓ Tahsil edildi</div>
                {item.nakit_tarih && <div style={{ color: '#64748b', fontSize: 12 }}>Tarih: {fmtTarih(item.nakit_tarih)}</div>}
                {item.nakit_id && <div style={{ color: '#64748b', fontSize: 11 }}>Kasa hareketi oluştu</div>}
              </>
            ) : vadeGecti ? (
              <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>⚠ Vadesi geçti — {fmtTarih(item.fatura_vade!)}</div>
            ) : (
              <div style={{ color: '#475569', fontSize: 12, marginTop: 8 }}>
                {adim2 ? 'Ödeme bekleniyor' : '—'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ANA BİLEŞEN ─────────────────────────────────────────────────────────────
export const ZincirGorunum: React.FC = () => {
  const [filtre, setFiltre] = useState<'hepsi'|'bekleyen'|'vade'|'tamamlandi'>('hepsi')

  const { data: hData, isLoading: hLoading } = useQuery({
    queryKey: ['hakedisler-zincir'],
    queryFn: () => hakedisApi.list({ limit: '100' }).then(r => r.data.data ?? []),
  })
  const { data: fData } = useQuery({
    queryKey: ['faturalar-zincir'],
    queryFn: () => faturaApi.list({ limit: '100' }).then(r => r.data.data ?? []),
  })

  const hakedisler: any[] = hData || []
  const faturalar: any[] = fData || []

  // Fatura map (hakedis_id → fatura)
  const faturaMap = new Map<string, any>()
  faturalar.forEach(f => { if (f.hakedis_id) faturaMap.set(f.hakedis_id, f) })

  const zincir: ZincirItem[] = hakedisler.map(h => {
    const f = faturaMap.get(h.id)
    return {
      hakedis_id: h.id,
      hakedis_no: h.no,
      santiye_adi: h.santiye_adi,
      donem_bitis: h.donem_bitis,
      hakedis_tutar: h.toplam_tutar,
      hakedis_durum: h.durum,
      fatura_id: f?.id,
      fatura_no: f?.fatura_no,
      fatura_gib: f?.gib_durum,
      fatura_odeme: f?.odeme_durumu,
      fatura_vade: f?.vade_tarihi,
      nakit_id: f?.nakit_hareket_id,
    }
  })

  const filtrelendi = zincir.filter(z => {
    if (filtre === 'bekleyen') return ['onaylandi'].includes(z.hakedis_durum) && !z.fatura_id || (z.fatura_id && z.fatura_odeme !== 'odendi' && !(z.fatura_vade && new Date(z.fatura_vade) < new Date()))
    if (filtre === 'vade') return z.fatura_vade && new Date(z.fatura_vade) < new Date() && z.fatura_odeme !== 'odendi'
    if (filtre === 'tamamlandi') return z.fatura_odeme === 'odendi'
    return true
  })

  const toplamBekleyen = zincir.filter(z => z.fatura_odeme !== 'odendi').reduce((s, z) => s + z.hakedis_tutar, 0)
  const toplamTahsil = zincir.filter(z => z.fatura_odeme === 'odendi').reduce((s, z) => s + z.hakedis_tutar, 0)
  const vadeSayisi = zincir.filter(z => z.fatura_vade && new Date(z.fatura_vade) < new Date() && z.fatura_odeme !== 'odendi').length

  return (
    <div style={{ padding: 24, color: '#f1f5f9' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Hakediş → Fatura → Ödeme Zinciri</h1>
        <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 14 }}>Tüm tahsilat sürecini tek ekranda takip edin</p>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Toplam Hakediş', val: `${zincir.length}`, color: '#6366f1' },
          { label: 'Tahsil Bekleyen', val: fmtTL(toplamBekleyen), color: '#f59e0b' },
          { label: 'Tahsil Edilen', val: fmtTL(toplamTahsil), color: '#00d4aa' },
          { label: 'Vadesi Geçmiş', val: `${vadeSayisi} fatura`, color: '#ef4444' },
        ].map(k => (
          <div key={k.label} style={{ background: `${k.color}10`, border: `1px solid ${k.color}30`, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ color: k.color, fontSize: 20, fontWeight: 700 }}>{k.val}</div>
            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtreler */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {([['hepsi','Tümü'],['bekleyen','Bekleyen'],['vade','Vadesi Geçmiş'],['tamamlandi','Tamamlandı']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setFiltre(key)} style={{
            background: filtre === key ? 'rgba(99,102,241,.3)' : 'rgba(255,255,255,.05)',
            border: `1px solid ${filtre === key ? 'rgba(99,102,241,.5)' : 'rgba(255,255,255,.1)'}`,
            color: filtre === key ? '#a5b4fc' : '#94a3b8',
            borderRadius: 8, padding: '6px 16px', cursor: 'pointer', fontSize: 13,
          }}>{label}</button>
        ))}
      </div>

      {/* Liste */}
      {hLoading
        ? <div style={{ textAlign: 'center', padding: 60 }}><Spinner size={32} /></div>
        : filtrelendi.length === 0
          ? <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🔗</div>
              <div>Bu filtrede kayıt yok</div>
            </div>
          : filtrelendi.map(z => <ZincirSatir key={z.hakedis_id} item={z} />)
      }
    </div>
  )
}

export default ZincirGorunum
