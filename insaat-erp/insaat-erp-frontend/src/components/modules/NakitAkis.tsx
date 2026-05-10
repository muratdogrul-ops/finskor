import React, { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { nakitApi, santiyeApi } from '@/services/api'
import { Card, KpiCard, Badge, PageHeader, Button, Table, Modal, FormInput, EmptyState, Spinner } from '@/components/ui'
import { fmtTL } from '@/utils/format'
import type { Santiye } from '@/types'
import toast from 'react-hot-toast'

function resolveNakitFlowSrc(): string {
  const u = import.meta.env.VITE_NAKITFLOW_URL?.trim()
  if (u) return u
  return '/nakit_akis.html'
}

export const NakitAkis: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('view') === 'finskor' ? 'finskor' : 'erp'

  const setView = (v: 'erp' | 'finskor') => {
    const next = new URLSearchParams(searchParams)
    if (v === 'finskor') next.set('view', 'finskor')
    else next.delete('view')
    setSearchParams(next, { replace: true })
  }

  const iframeSrc = useMemo(() => resolveNakitFlowSrc(), [])

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#64748b', marginRight: 4 }}>Görünüm:</span>
        <button
          type="button"
          onClick={() => setView('erp')}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,.12)',
            background: view === 'erp' ? 'rgba(14,165,233,.22)' : 'rgba(255,255,255,.04)',
            color: '#e2e8f0',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          Şantiye nakit özeti
        </button>
        <button
          type="button"
          onClick={() => setView('finskor')}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,.12)',
            background: view === 'finskor' ? 'rgba(14,165,233,.22)' : 'rgba(255,255,255,.04)',
            color: '#e2e8f0',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          FinSkor NakitFlow
        </button>
        {view === 'finskor' && (
          <a
            href={iframeSrc}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginLeft: 'auto', fontSize: 12, color: '#38bdf8', fontWeight: 600 }}
          >
            Yeni sekmede aç ↗
          </a>
        )}
      </div>

      {view === 'finskor' ? (
        <div
          style={{
            border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 12,
            overflow: 'hidden',
            height: 'min(85vh, 920px)',
            background: '#060810',
          }}
        >
          <iframe title="FinSkor NakitFlow" src={iframeSrc} style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} />
        </div>
      ) : (
        <NakitAkisErpBody />
      )}
    </div>
  )
}

const NakitAkisErpBody: React.FC = () => {
  const qc = useQueryClient()
  const [yil] = useState(new Date().getFullYear().toString())
  const [modal, setModal] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['nakit-analiz', yil],
    queryFn: () => nakitApi.analiz({ yil }).then(r => r.data.data),
  })

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>
  if (!data) return <EmptyState icon="💰" title="Veri yüklenemedi" />

  const { ytd, aylik, tahminler } = data
  const ayAdlari = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

  return (
    <div>
      <PageHeader title="Nakit Akış Yönetimi" sub={`${yil} yılı`}
        action={<Button onClick={() => setModal(true)}>+ Hareket Ekle</Button>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        <KpiCard label="Toplam Tahsilat (YTD)" value={fmtTL(ytd?.toplam_tahsilat || 0)} color="#00d4aa" />
        <KpiCard label="Toplam Gider (YTD)" value={fmtTL(ytd?.toplam_gider || 0)} color="#ef4444" />
        <KpiCard label="Net Nakit Pozisyonu" value={fmtTL(ytd?.net_nakit || 0)} color="#60a5fa" />
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 16 }}>Aylık Nakit Akışı – {yil}</div>
        {aylik.length === 0 ? (
          <EmptyState icon="📊" title="Henüz veri yok" sub="İlk nakit hareketini ekleyin" />
        ) : (
          <div>
            {aylik.map((a: any) => {
              const max = Math.max(...aylik.map((x: any) => Math.max(x.tahsilat || 0, x.gider || 0)))
              return (
                <div key={a.ay} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ color: '#6b7280', fontSize: 11, width: 28, textAlign: 'right' }}>{ayAdlari[a.ay - 1]}</span>
                  <div style={{ flex: 1, display: 'flex', gap: 3, height: 20, alignItems: 'center' }}>
                    <div style={{ flex: max > 0 ? (a.tahsilat || 0) / max : 0, background: '#00d4aa', borderRadius: 3, height: '100%', minWidth: 2 }} />
                    <div style={{ flex: max > 0 ? (a.gider || 0) / max : 0, background: '#ef4444', borderRadius: 3, height: '100%', minWidth: 2 }} />
                  </div>
                  <span style={{ color: '#00d4aa', fontSize: 11, width: 60, textAlign: 'right' }}>{fmtTL(a.tahsilat || 0)}</span>
                  <span style={{ color: '#ef4444', fontSize: 11, width: 60, textAlign: 'right' }}>{fmtTL(a.gider || 0)}</span>
                  <span style={{ color: (a.net || 0) >= 0 ? '#60a5fa' : '#f59e0b', fontSize: 11, width: 60, textAlign: 'right', fontWeight: 700 }}>
                    {fmtTL(a.net || 0)}
                  </span>
                </div>
              )
            })}
            <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'flex-end' }}>
              {[['#00d4aa', 'Tahsilat'], ['#ef4444', 'Gider'], ['#60a5fa', 'Net']].map(([c, l]) => (
                <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6b7280' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block' }} />{l}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {tahminler.length > 0 && (
        <Card noPad>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.07)', fontWeight: 700, fontSize: 13 }}>
            6 Aylık Nakit Akış Tahmini
          </div>
          <Table
            columns={[
              { key: 'ay', label: 'Ay', render: r => <span style={{ fontWeight: 700 }}>{new Date(r.ay).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</span> },
              { key: 'tahmini_tahsilat', label: 'Tahmini Tahsilat', render: r => <span style={{ color: '#00d4aa' }}>{fmtTL(r.tahmini_tahsilat)}</span> },
              { key: 'tahmini_gider', label: 'Tahmini Gider', render: r => <span style={{ color: '#ef4444' }}>{fmtTL(r.tahmini_gider)}</span> },
              { key: 'net', label: 'Tahmini Net', render: r => {
                const net = (r.tahmini_tahsilat || 0) - (r.tahmini_gider || 0)
                return <span style={{ color: net >= 0 ? '#60a5fa' : '#f59e0b', fontWeight: 700 }}>{fmtTL(net)}</span>
              }},
              { key: 'durum', label: 'Durum', render: r => {
                const net = (r.tahmini_tahsilat || 0) - (r.tahmini_gider || 0)
                return <Badge text={net > 0 ? 'onaylandi' : 'incelemede'} />
              }},
            ]}
            data={tahminler.map((t: any, i: number) => ({ ...t, id: String(i) })) as Array<{ id: string; ay: string; tahmini_tahsilat: number; tahmini_gider: number }>}
          />
        </Card>
      )}
      <Modal open={modal} onClose={() => setModal(false)} title="Nakit Hareketi Ekle">
        <YeniNakitForm onClose={() => { setModal(false); qc.invalidateQueries({ queryKey: ['nakit-analiz', yil] }) }} />
      </Modal>
    </div>
  )
}

const YeniNakitForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { data: sData } = useQuery({ queryKey: ['santiyeler'], queryFn: () => santiyeApi.list().then(r => r.data.data) })
  const santiyeler: Santiye[] = sData || []
  const [f, setF] = useState({
    santiye_id: '', tarih: new Date().toISOString().slice(0, 10),
    tip: 'giris', kategori: '', aciklama: '', tutar: '', belge_no: '',
  })

  const KATEGORILER_GIRIS = ['Hakediş Tahsilatı', 'Avans', 'Teminat Geliri', 'Diğer']
  const KATEGORILER_CIKIS = ['Malzeme', 'İşçilik', 'Ekipman Kirası', 'Taşeron', 'Genel Gider', 'KDV Ödemesi', 'SGK', 'Diğer']

  const mut = useMutation({
    mutationFn: () => nakitApi.create({ ...f, tutar: Number(f.tutar), tutar_try: Number(f.tutar) }),
    onSuccess: () => { toast.success('Hareket eklendi'); onClose() },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  })

  return (
    <div>
      <FormInput label="Şantiye" value={f.santiye_id} onChange={v => setF(p => ({ ...p, santiye_id: v }))}
        options={[{ value: '', label: 'Genel (Şantiyesiz)' }, ...santiyeler.map(s => ({ value: s.id, label: s.ad }))]} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormInput label="Tarih *" value={f.tarih} onChange={v => setF(p => ({ ...p, tarih: v }))} type="date" />
        <FormInput label="Tip" value={f.tip} onChange={v => setF(p => ({ ...p, tip: v, kategori: '' }))}
          options={[{ value: 'giris', label: '💰 Tahsilat/Giriş' }, { value: 'cikis', label: '💸 Ödeme/Çıkış' }]} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormInput label="Kategori *" value={f.kategori} onChange={v => setF(p => ({ ...p, kategori: v }))}
          options={[{ value: '', label: 'Seçiniz' }, ...(f.tip === 'giris' ? KATEGORILER_GIRIS : KATEGORILER_CIKIS).map(k => ({ value: k, label: k }))]} />
        <FormInput label="Tutar (TL) *" value={f.tutar} onChange={v => setF(p => ({ ...p, tutar: v }))} type="number" placeholder="0" />
      </div>
      <FormInput label="Açıklama *" value={f.aciklama} onChange={v => setF(p => ({ ...p, aciklama: v }))} placeholder="Ör: Ocak hakediş ödemesi" required />
      <FormInput label="Belge No" value={f.belge_no} onChange={v => setF(p => ({ ...p, belge_no: v }))} placeholder="Fatura / dekont no" />
      <Button onClick={() => mut.mutate()} loading={mut.isPending} style={{ width: '100%', justifyContent: 'center' }}>
        Hareketi Kaydet
      </Button>
    </div>
  )
}
