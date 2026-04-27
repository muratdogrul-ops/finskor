import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { faturaApi } from '@/services/api'
import { Fatura, FaturaOzet, FaturaKalem } from '@/types'
import { fmtTL, fmtTarih as fmtDate } from '@/utils/format'

// ─── GİB DURUM BADGE ─────────────────────────────────────────────────────────
const GibDurumBadge: React.FC<{ durum: Fatura['gib_durum'] }> = ({ durum }) => {
  const cfg: Record<string, { label: string; color: string }> = {
    taslak:     { label: 'Taslak',     color: '#64748b' },
    gonderildi: { label: 'Gönderildi', color: '#f59e0b' },
    basarili:   { label: 'GİB Kabul',  color: '#22c55e' },
    hata:       { label: 'Hata',       color: '#ef4444' },
    iptal:      { label: 'İptal',      color: '#991b1b' },
  }
  const c = cfg[durum] ?? { label: durum, color: '#64748b' }
  return (
    <span style={{
      background: c.color + '22', color: c.color,
      border: `1px solid ${c.color}44`,
      padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
    }}>{c.label}</span>
  )
}

// ─── ÖDEME DURUM BADGE ────────────────────────────────────────────────────────
const OdemeDurumBadge: React.FC<{ durum?: string; vade?: string }> = ({ durum, vade }) => {
  const vadesiGecti = durum !== 'odendi' && vade && new Date(vade) < new Date()
  if (durum === 'odendi') return <span style={{ background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>✓ Ödendi</span>
  if (vadesiGecti) return <span style={{ background: '#ef444422', color: '#ef4444', border: '1px solid #ef444444', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>⚠ Vadesi Geçti</span>
  return <span style={{ background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>Bekliyor</span>
}

// ─── ÖDEME AL MODAL ───────────────────────────────────────────────────────────
const OdemeModal: React.FC<{ fatura: Fatura; onClose: () => void }> = ({ fatura, onClose }) => {
  const qc = useQueryClient()
  const [tarih, setTarih] = useState(new Date().toISOString().slice(0, 10))
  const [not, setNot] = useState('')
  const inp: React.CSSProperties = { background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, padding: '8px 12px', color: '#f1f5f9', fontSize: 14, width: '100%' }

  const mut = useMutation({
    mutationFn: () => faturaApi.ode(fatura.id, { odeme_tarihi: tarih, odeme_notu: not }),
    onSuccess: () => {
      toast.success('Ödeme kaydedildi, kasa hareketi oluşturuldu')
      qc.invalidateQueries({ queryKey: ['faturalar'] })
      qc.invalidateQueries({ queryKey: ['fatura-ozet'] })
      qc.invalidateQueries({ queryKey: ['nakit'] })
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Ödeme kaydedilemedi'),
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1e2a3a', borderRadius: 16, padding: 28, width: 420, border: '1px solid rgba(255,255,255,.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ color: '#f1f5f9', margin: 0 }}>Ödeme Al</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ background: 'rgba(0,212,170,.06)', border: '1px solid rgba(0,212,170,.15)', borderRadius: 10, padding: 14, marginBottom: 18 }}>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>Fatura: <strong style={{ color: '#f1f5f9' }}>{fatura.fatura_no}</strong></div>
          <div style={{ color: '#00d4aa', fontSize: 22, fontWeight: 700, marginTop: 4 }}>{fmtTL(fatura.genel_toplam)}</div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>Ödeme Tarihi</label>
          <input type="date" style={inp} value={tarih} onChange={e => setTarih(e.target.value)} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>Not (isteğe bağlı)</label>
          <input style={inp} value={not} onChange={e => setNot(e.target.value)} placeholder="Banka havalesi, çek vb." />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', color: '#94a3b8', borderRadius: 8, padding: '9px 18px', cursor: 'pointer' }}>Vazgeç</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending} style={{ background: 'linear-gradient(135deg,#00d4aa,#0ea5e9)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', cursor: 'pointer', fontWeight: 600 }}>
            {mut.isPending ? 'Kaydediliyor...' : '✓ Ödemeyi Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── YENİ FATURA FORMU ───────────────────────────────────────────────────────
const YeniFaturaForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    fatura_no: `FTR-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
    fatura_tipi: 'satis',
    senaryo: 'TICARI',
    fatura_tarihi: new Date().toISOString().slice(0, 10),
    vade_tarihi: '',
    alici_unvan: '',
    alici_vkn_tckn: '',
    alici_vergi_dairesi: '',
    alici_adres: '',
    notlar: '',
  })
  const [kalemler, setKalemler] = useState<Partial<FaturaKalem>[]>([
    { tanim: '', miktar: 1, birim: 'ADET', birim_fiyat: 0, kdv_orani: 20, stopaj_orani: 0, iskonto_orani: 0 }
  ])

  const toplamlar = kalemler.reduce((acc, k) => {
    const brut = (k.miktar ?? 1) * (k.birim_fiyat ?? 0)
    const isk = brut * ((k.iskonto_orani ?? 0) / 100)
    const net = brut - isk
    const kdv = net * ((k.kdv_orani ?? 20) / 100)
    const stopaj = net * ((k.stopaj_orani ?? 0) / 100)
    acc.mal_hizmet += net
    acc.kdv += kdv
    acc.stopaj += stopaj
    acc.genel += net + kdv - stopaj
    return acc
  }, { mal_hizmet: 0, kdv: 0, stopaj: 0, genel: 0 })

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => faturaApi.create(data),
    onSuccess: () => {
      toast.success('Fatura oluşturuldu')
      qc.invalidateQueries({ queryKey: ['faturalar'] })
      qc.invalidateQueries({ queryKey: ['fatura-ozet'] })
      onClose()
    },
    onError: () => toast.error('Fatura oluşturulamadı'),
  })

  const addKalem = () => setKalemler(k => [...k, {
    tanim: '', miktar: 1, birim: 'ADET', birim_fiyat: 0, kdv_orani: 20, stopaj_orani: 0, iskonto_orani: 0
  }])
  const removeKalem = (i: number) => setKalemler(k => k.filter((_, idx) => idx !== i))
  const updateKalem = (i: number, field: string, val: unknown) =>
    setKalemler(k => k.map((item, idx) => idx === i ? { ...item, [field]: val } : item))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!kalemler.some(k => k.tanim && (k.birim_fiyat ?? 0) > 0)) {
      toast.error('En az bir geçerli kalem giriniz')
      return
    }
    mutation.mutate({ ...form, kalemler })
  }

  const inp: React.CSSProperties = {
    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 8, padding: '8px 12px', color: '#f1f5f9', fontSize: 14, width: '100%',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      zIndex: 999, padding: '24px 16px', overflowY: 'auto',
    }}>
      <div style={{
        background: '#1e2a3a', borderRadius: 16, padding: 32,
        width: '100%', maxWidth: 860, border: '1px solid rgba(255,255,255,.1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ color: '#f1f5f9', margin: 0, fontSize: 20 }}>Yeni Fatura</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 22 }}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          {/* Üst bilgiler */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>Fatura No *</label>
              <input style={inp} value={form.fatura_no} onChange={e => setForm(f => ({ ...f, fatura_no: e.target.value }))} required />
            </div>
            <div>
              <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>Fatura Tarihi *</label>
              <input type="date" style={inp} value={form.fatura_tarihi} onChange={e => setForm(f => ({ ...f, fatura_tarihi: e.target.value }))} required />
            </div>
            <div>
              <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>Vade Tarihi</label>
              <input type="date" style={inp} value={form.vade_tarihi} onChange={e => setForm(f => ({ ...f, vade_tarihi: e.target.value }))} />
            </div>
            <div>
              <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>Tip</label>
              <select style={inp} value={form.fatura_tipi} onChange={e => setForm(f => ({ ...f, fatura_tipi: e.target.value }))}>
                <option value="satis">Satış</option>
                <option value="alis">Alış</option>
                <option value="iade">İade</option>
              </select>
            </div>
            <div>
              <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>Senaryo</label>
              <select style={inp} value={form.senaryo} onChange={e => setForm(f => ({ ...f, senaryo: e.target.value }))}>
                <option value="TICARI">Ticari</option>
                <option value="TEMEL">Temel</option>
                <option value="IHRACAT">İhracat</option>
                <option value="KAMU">Kamu</option>
              </select>
            </div>
          </div>

          {/* Alıcı bilgileri */}
          <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 12px', fontWeight: 600, textTransform: 'uppercase' }}>Alıcı Bilgileri</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>Unvan / Ad Soyad</label>
                <input style={inp} value={form.alici_unvan} onChange={e => setForm(f => ({ ...f, alici_unvan: e.target.value }))} placeholder="Firma unvanı veya ad soyad" />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>VKN / TC Kimlik No</label>
                <input style={inp} value={form.alici_vkn_tckn} onChange={e => setForm(f => ({ ...f, alici_vkn_tckn: e.target.value }))} placeholder="10 veya 11 haneli" maxLength={11} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>Vergi Dairesi</label>
                <input style={inp} value={form.alici_vergi_dairesi} onChange={e => setForm(f => ({ ...f, alici_vergi_dairesi: e.target.value }))} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>Adres</label>
                <input style={inp} value={form.alici_adres} onChange={e => setForm(f => ({ ...f, alici_adres: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Kalemler */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p style={{ color: '#94a3b8', fontSize: 12, margin: 0, fontWeight: 600, textTransform: 'uppercase' }}>Fatura Kalemleri</p>
              <button type="button" onClick={addKalem} style={{
                background: 'rgba(99,102,241,.2)', color: '#818cf8', border: '1px solid rgba(99,102,241,.3)',
                borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12,
              }}>+ Kalem Ekle</button>
            </div>
            {kalemler.map((k, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1.5fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                <div>
                  {i === 0 && <label style={{ color: '#64748b', fontSize: 11, display: 'block', marginBottom: 2 }}>Tanım</label>}
                  <input style={inp} value={k.tanim ?? ''} onChange={e => updateKalem(i, 'tanim', e.target.value)} placeholder="Hizmet / mal tanımı" required />
                </div>
                <div>
                  {i === 0 && <label style={{ color: '#64748b', fontSize: 11, display: 'block', marginBottom: 2 }}>Miktar</label>}
                  <input type="number" style={inp} value={k.miktar ?? 1} min={0} step="any" onChange={e => updateKalem(i, 'miktar', parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  {i === 0 && <label style={{ color: '#64748b', fontSize: 11, display: 'block', marginBottom: 2 }}>Birim</label>}
                  <select style={inp} value={k.birim ?? 'ADET'} onChange={e => updateKalem(i, 'birim', e.target.value)}>
                    {['ADET', 'M2', 'M3', 'TON', 'KG', 'MT', 'SAAT', 'GUN', 'AY'].map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  {i === 0 && <label style={{ color: '#64748b', fontSize: 11, display: 'block', marginBottom: 2 }}>Birim Fiyat (₺)</label>}
                  <input type="number" style={inp} value={k.birim_fiyat ?? 0} min={0} step="any" onChange={e => updateKalem(i, 'birim_fiyat', parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  {i === 0 && <label style={{ color: '#64748b', fontSize: 11, display: 'block', marginBottom: 2 }}>KDV %</label>}
                  <select style={inp} value={k.kdv_orani ?? 20} onChange={e => updateKalem(i, 'kdv_orani', parseFloat(e.target.value))}>
                    {[0, 1, 10, 20].map(r => <option key={r} value={r}>%{r}</option>)}
                  </select>
                </div>
                <div>
                  {i === 0 && <label style={{ color: '#64748b', fontSize: 11, display: 'block', marginBottom: 2 }}>Stopaj %</label>}
                  <input type="number" style={inp} value={k.stopaj_orani ?? 0} min={0} max={100} step="any" onChange={e => updateKalem(i, 'stopaj_orani', parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  {i === 0 && <label style={{ color: '#64748b', fontSize: 11, display: 'block', marginBottom: 2 }}>İsk. %</label>}
                  <input type="number" style={inp} value={k.iskonto_orani ?? 0} min={0} max={100} step="any" onChange={e => updateKalem(i, 'iskonto_orani', parseFloat(e.target.value) || 0)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  {kalemler.length > 1 && (
                    <button type="button" onClick={() => removeKalem(i)} style={{
                      background: 'rgba(239,68,68,.15)', color: '#ef4444', border: 'none',
                      borderRadius: 6, padding: '8px 10px', cursor: 'pointer', fontSize: 14,
                    }}>✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Toplamlar */}
          <div style={{ background: 'rgba(0,212,170,.05)', border: '1px solid rgba(0,212,170,.15)', borderRadius: 10, padding: 16, marginBottom: 20, textAlign: 'right' }}>
            <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 4 }}>Mal/Hizmet Toplam: <strong style={{ color: '#f1f5f9' }}>{fmtTL(toplamlar.mal_hizmet)}</strong></div>
            <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 4 }}>KDV Toplam: <strong style={{ color: '#f1f5f9' }}>{fmtTL(toplamlar.kdv)}</strong></div>
            {toplamlar.stopaj > 0 && <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 4 }}>Stopaj: <strong style={{ color: '#ef4444' }}>-{fmtTL(toplamlar.stopaj)}</strong></div>}
            <div style={{ color: '#00d4aa', fontSize: 16, fontWeight: 700, borderTop: '1px solid rgba(255,255,255,.1)', paddingTop: 8, marginTop: 4 }}>
              Genel Toplam: {fmtTL(toplamlar.genel)}
            </div>
          </div>

          {/* Notlar */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>Notlar</label>
            <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.notlar} onChange={e => setForm(f => ({ ...f, notlar: e.target.value }))} />
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{
              background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
              color: '#94a3b8', borderRadius: 8, padding: '10px 20px', cursor: 'pointer',
            }}>İptal</button>
            <button type="submit" disabled={mutation.isPending} style={{
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
              border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontWeight: 600,
            }}>{mutation.isPending ? 'Kaydediliyor...' : 'Fatura Oluştur'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── FATURALAR ANA EKRAN ──────────────────────────────────────────────────────
export const Faturalar: React.FC = () => {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<string>('')
  const [odemeModal, setOdemeModal] = useState<Fatura | null>(null)

  const { data: ozetData } = useQuery<{ data: FaturaOzet }>({
    queryKey: ['fatura-ozet'],
    queryFn: () => faturaApi.ozet().then(r => r.data),
  })
  const ozet = ozetData?.data

  const { data, isLoading } = useQuery<{ data: Fatura[] }>({
    queryKey: ['faturalar', filter],
    queryFn: () => faturaApi.list(filter ? { gib_durum: filter } : {}).then(r => r.data),
  })
  const faturalar = data?.data ?? []

  const gibGonderMutation = useMutation({
    mutationFn: (id: string) => faturaApi.gibGonder(id),
    onSuccess: () => {
      toast.success("GİB'e gönderildi")
      qc.invalidateQueries({ queryKey: ['faturalar'] })
      qc.invalidateQueries({ queryKey: ['fatura-ozet'] })
    },
    onError: () => toast.error('Gönderme başarısız'),
  })

  const iptalMutation = useMutation({
    mutationFn: ({ id, neden }: { id: string; neden: string }) => faturaApi.iptal(id, neden),
    onSuccess: () => {
      toast.success('Fatura iptal edildi')
      qc.invalidateQueries({ queryKey: ['faturalar'] })
      qc.invalidateQueries({ queryKey: ['fatura-ozet'] })
    },
    onError: () => toast.error('İptal başarısız'),
  })

  const kpiStyle = (color: string): React.CSSProperties => ({
    background: `${color}15`, border: `1px solid ${color}30`,
    borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 120,
  })

  return (
    <div style={{ padding: 24, color: '#f1f5f9' }}>
      {showForm && <YeniFaturaForm onClose={() => setShowForm(false)} />}
      {odemeModal && <OdemeModal fatura={odemeModal} onClose={() => setOdemeModal(null)} />}

      {/* Başlık */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>e-Fatura / Ödeme Takibi</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 14 }}>
            GİB entegrasyon altyapısı hazır — entegratör seçimi ile canlıya alınır
          </p>
        </div>
        <button onClick={() => setShowForm(true)} style={{
          background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
          border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontWeight: 600,
        }}>+ Yeni Fatura</button>
      </div>

      {/* KPI Kartları */}
      {ozet && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={kpiStyle('#00d4aa')}>
            <div style={{ color: '#00d4aa', fontSize: 26, fontWeight: 700 }}>{fmtTL(Number((ozet as any).tahsil_bekleyen_toplam || 0))}</div>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Tahsil Bekleyen</div>
            <div style={{ color: '#00d4aa', fontSize: 11 }}>{(ozet as any).odeme_bekliyor ?? '—'} fatura</div>
          </div>
          <div style={kpiStyle('#ef4444')}>
            <div style={{ color: '#ef4444', fontSize: 26, fontWeight: 700 }}>{(ozet as any).vadesi_gecmis ?? 0}</div>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Vadesi Geçmiş</div>
          </div>
          <div style={kpiStyle('#22c55e')}>
            <div style={{ color: '#22c55e', fontSize: 26, fontWeight: 700 }}>{(ozet as any).odenen ?? 0}</div>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Ödenen Fatura</div>
          </div>
          <div style={kpiStyle('#6366f1')}>
            <div style={{ color: '#6366f1', fontSize: 26, fontWeight: 700 }}>{ozet.toplam}</div>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Toplam Fatura</div>
          </div>
          <div style={kpiStyle('#64748b')}>
            <div style={{ color: '#94a3b8', fontSize: 26, fontWeight: 700 }}>{ozet.taslak}</div>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Taslak</div>
            <div style={{ color: '#64748b', fontSize: 11 }}>{fmtTL(Number(ozet.taslak_toplam))}</div>
          </div>
        </div>
      )}

      {/* Entegratör Bilgi Bandı */}
      <div style={{
        background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.2)',
        borderRadius: 10, padding: '12px 16px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 20 }}>🔌</span>
        <div>
          <div style={{ color: '#a5b4fc', fontWeight: 600, fontSize: 13 }}>Entegratör Bağlantısı Bekleniyor</div>
          <div style={{ color: '#64748b', fontSize: 12 }}>
            Şu an mock mod aktif. Logo, Paraşüt, eBill, Mikro gibi bir entegratör seçildiğinde
            faturalar gerçek GİB sistemine iletilecek.
          </div>
        </div>
      </div>

      {/* Filtre */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['', 'taslak', 'gonderildi', 'basarili', 'hata', 'iptal'].map(d => (
          <button key={d} onClick={() => setFilter(d)} style={{
            background: filter === d ? 'rgba(99,102,241,.3)' : 'rgba(255,255,255,.05)',
            border: `1px solid ${filter === d ? 'rgba(99,102,241,.5)' : 'rgba(255,255,255,.1)'}`,
            color: filter === d ? '#a5b4fc' : '#94a3b8',
            borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13,
          }}>
            {d === '' ? 'Tümü' : d === 'taslak' ? 'Taslak' : d === 'gonderildi' ? 'Gönderildi'
              : d === 'basarili' ? 'GİB Kabul' : d === 'hata' ? 'Hatalı' : 'İptal'}
          </button>
        ))}
      </div>

      {/* Tablo */}
      <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
              {['Fatura No', 'Tarih / Vade', 'Alıcı', 'Şantiye', 'Toplam', 'GİB', 'Ödeme', 'İşlem'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>Yükleniyor...</td></tr>
            )}
            {!isLoading && faturalar.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🧾</div>
                <div>Henüz fatura yok</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Hakediş onaylandığında otomatik oluşturabilir veya Yeni Fatura butonunu kullanabilirsiniz</div>
              </td></tr>
            )}
            {faturalar.map(f => (
              <tr key={f.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)', background: (f as any).odeme_durumu !== 'odendi' && f.vade_tarihi && new Date(f.vade_tarihi) < new Date() ? 'rgba(239,68,68,.04)' : 'transparent' }}>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ color: '#a5b4fc', fontWeight: 600, fontSize: 13 }}>{f.fatura_no}</span>
                  <div style={{ color: '#64748b', fontSize: 11 }}>{f.fatura_tipi === 'satis' ? 'Satış' : f.fatura_tipi === 'alis' ? 'Alış' : 'İade'} / {f.senaryo}</div>
                  {f.hakedis_no && <div style={{ color: '#6366f1', fontSize: 11 }}>Hakediş: {f.hakedis_no}</div>}
                </td>
                <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 13 }}>
                  {fmtDate(f.fatura_tarihi)}
                  {f.vade_tarihi && <div style={{ color: (f as any).odeme_durumu !== 'odendi' && new Date(f.vade_tarihi) < new Date() ? '#ef4444' : '#64748b', fontSize: 11 }}>Vade: {fmtDate(f.vade_tarihi)}</div>}
                </td>
                <td style={{ padding: '12px 16px', color: '#f1f5f9', fontSize: 13 }}>
                  {f.alici_unvan || '—'}
                  {f.alici_vkn_tckn && <div style={{ color: '#64748b', fontSize: 11 }}>VKN: {f.alici_vkn_tckn}</div>}
                </td>
                <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 13 }}>{f.santiye_adi || '—'}</td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: '#00d4aa', fontSize: 14 }}>
                  {fmtTL(f.genel_toplam)}
                  <div style={{ color: '#64748b', fontSize: 11 }}>KDV dahil</div>
                </td>
                <td style={{ padding: '12px 16px' }}><GibDurumBadge durum={f.gib_durum} /></td>
                <td style={{ padding: '12px 16px' }}><OdemeDurumBadge durum={(f as any).odeme_durumu} vade={f.vade_tarihi} /></td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(f as any).odeme_durumu !== 'odendi' && f.gib_durum !== 'iptal' && (
                      <button
                        onClick={() => setOdemeModal(f)}
                        title="Ödeme Al"
                        style={{
                          background: 'rgba(0,212,170,.15)', color: '#00d4aa',
                          border: '1px solid rgba(0,212,170,.3)', borderRadius: 6,
                          padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        }}>Ödeme Al</button>
                    )}
                    {(f.gib_durum === 'taslak' || f.gib_durum === 'hata') && (
                      <button
                        onClick={() => gibGonderMutation.mutate(f.id)}
                        disabled={gibGonderMutation.isPending}
                        title="GİB'e Gönder"
                        style={{
                          background: 'rgba(34,197,94,.15)', color: '#22c55e',
                          border: '1px solid rgba(34,197,94,.3)', borderRadius: 6,
                          padding: '4px 10px', cursor: 'pointer', fontSize: 12,
                        }}>Gönder</button>
                    )}
                    {f.gib_durum !== 'iptal' && (
                      <button
                        onClick={() => {
                          const neden = window.prompt('İptal nedeni (isteğe bağlı):') ?? ''
                          iptalMutation.mutate({ id: f.id, neden })
                        }}
                        title="İptal Et"
                        style={{
                          background: 'rgba(239,68,68,.12)', color: '#ef4444',
                          border: '1px solid rgba(239,68,68,.25)', borderRadius: 6,
                          padding: '4px 10px', cursor: 'pointer', fontSize: 12,
                        }}>İptal</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
