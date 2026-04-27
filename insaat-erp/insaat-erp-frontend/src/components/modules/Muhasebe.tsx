import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/services/api'
import toast from 'react-hot-toast'

// ── TYPES ─────────────────────────────────────────────────────────────────────
interface Hesap { id: string; kod: string; ad: string; tip: string; ust_hesap_id?: string; aktif: boolean }
interface FisOzet { id: string; fis_no: string; tarih: string; aciklama: string; durum: string; toplam_borc: string; toplam_alacak: string; satir_sayisi: string; santiye_ad?: string; kaynak_tip: string }
interface FisSatir { id?: string; hesap_id: string; hesap_kod?: string; hesap_ad?: string; borc: number; alacak: number; aciklama: string }
interface MizanRow { kod: string; ad: string; tip: string; donem_borc: string; donem_alacak: string; borc_bakiye: string; alacak_bakiye: string }
interface GelirGiderOzet { toplam_gelir: number; toplam_gider: number; net_kar: number; kar_marji: string }

// ── API ──────────────────────────────────────────────────────────────────────
const api = {
  getHesapPlani:  () => apiClient.get('/muhasebe/hesap-plani').then((r: any) => r.data.data as Hesap[]),
  getFisler:      (p: Record<string, unknown>) => apiClient.get('/muhasebe/fisler', { params: p }).then((r: any) => r.data),
  getFis:         (id: string) => apiClient.get(`/muhasebe/fisler/${id}`).then((r: any) => r.data.data),
  createFis:      (d: Record<string, unknown>) => apiClient.post('/muhasebe/fisler', d).then((r: any) => r.data),
  onaylaFis:      (id: string) => apiClient.post(`/muhasebe/fisler/${id}/onayla`).then((r: any) => r.data),
  iptalFis:       (id: string) => apiClient.post(`/muhasebe/fisler/${id}/iptal`).then((r: any) => r.data),
  getMizan:       (p: Record<string, unknown>) => apiClient.get('/muhasebe/mizan', { params: p }).then((r: any) => r.data),
  getMuavin:      (id: string, p: Record<string, unknown>) => apiClient.get(`/muhasebe/muavin/${id}`, { params: p }).then((r: any) => r.data),
  getGelirGider:  (p: Record<string, unknown>) => apiClient.get('/muhasebe/gelir-gider', { params: p }).then((r: any) => r.data),
  seedHesapPlani: () => apiClient.post('/muhasebe/hesap-plani/seed').then((r: any) => r.data),
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (v: any) => Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const TL  = (v: any) => `₺${fmt(v)}`

const DURUM_BADGE: Record<string, string> = {
  taslak:    '#f59e0b',
  onaylandi: '#10b981',
  iptal:     '#ef4444',
}
const DURUM_TR: Record<string, string> = {
  taslak:    'Taslak',
  onaylandi: 'Onaylı',
  iptal:     'İptal',
}

const TIP_RENKLER: Record<string, string> = {
  aktif:     '#3b82f6',
  pasif:     '#8b5cf6',
  gelir:     '#10b981',
  gider:     '#ef4444',
  oz_sermaye:'#f59e0b',
}
const TIP_TR: Record<string, string> = {
  aktif: 'Aktif', pasif: 'Pasif', gelir: 'Gelir',
  gider: 'Gider', oz_sermaye: 'Öz Sermaye',
}

// ── ANA COMPONENT ─────────────────────────────────────────────────────────────
export const Muhasebe: React.FC = () => {
  const [tab, setTab] = useState<'hesaplar' | 'fisler' | 'mizan' | 'muavin' | 'gelir-gider'>('fisler')

  const tabs = [
    { id: 'fisler',      label: 'Yevmiye Fişleri' },
    { id: 'mizan',       label: 'Mizan' },
    { id: 'gelir-gider', label: 'Gelir/Gider' },
    { id: 'muavin',      label: 'Muavin Defteri' },
    { id: 'hesaplar',    label: 'Hesap Planı' },
  ] as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Başlık */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Muhasebe</h1>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Tekdüzen Muhasebe Sistemi (TMS) uyumlu</p>
        </div>
      </div>

      {/* Sekmeler */}
      <div style={{ display: 'flex', gap: 2, background: '#0b1120', borderRadius: 10, padding: 4, overflowX: 'auto' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap',
              background: tab === t.id ? '#1e3a5f' : 'transparent',
              color: tab === t.id ? '#60a5fa' : '#4b5563',
              transition: 'all .15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* İçerik */}
      {tab === 'fisler'      && <FislerTab />}
      {tab === 'mizan'       && <MizanTab />}
      {tab === 'gelir-gider' && <GelirGiderTab />}
      {tab === 'muavin'      && <MuavinTab />}
      {tab === 'hesaplar'    && <HesaplarTab />}
    </div>
  )
}

// ── YEVMİYE FİŞLERİ SEKMESI ──────────────────────────────────────────────────
const FislerTab: React.FC = () => {
  const qc = useQueryClient()
  const [filtre, setFiltre] = useState({ durum: '', q: '', tarih_bas: '', tarih_bit: '' })
  const [showCreate, setShowCreate] = useState(false)
  const [detayId, setDetayId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['muhasebe-fisler', filtre],
    queryFn: () => api.getFisler(filtre),
  })

  const onayla = useMutation({
    mutationFn: api.onaylaFis,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['muhasebe-fisler'] }); toast.success('Fiş onaylandı') },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  })

  const iptal = useMutation({
    mutationFn: api.iptalFis,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['muhasebe-fisler'] }); toast.success('Fiş iptal edildi') },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  })

  const fisler: FisOzet[] = data?.data || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filtre + Yeni */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Fiş no veya açıklama ara..."
          value={filtre.q}
          onChange={e => setFiltre(f => ({ ...f, q: e.target.value }))}
          style={inputSt}
        />
        <select value={filtre.durum} onChange={e => setFiltre(f => ({ ...f, durum: e.target.value }))} style={selectSt}>
          <option value="">Tüm Durumlar</option>
          <option value="taslak">Taslak</option>
          <option value="onaylandi">Onaylı</option>
          <option value="iptal">İptal</option>
        </select>
        <input type="date" value={filtre.tarih_bas} onChange={e => setFiltre(f => ({ ...f, tarih_bas: e.target.value }))} style={{ ...inputSt, width: 140 }} />
        <input type="date" value={filtre.tarih_bit} onChange={e => setFiltre(f => ({ ...f, tarih_bit: e.target.value }))} style={{ ...inputSt, width: 140 }} />
        <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ Yeni Fiş</button>
      </div>

      {isLoading ? <Spinner /> : (
        <div style={cardSt}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                {['Fiş No', 'Tarih', 'Açıklama', 'Kaynak', 'Borç', 'Alacak', 'Durum', ''].map(h => (
                  <th key={h} style={thSt}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fisler.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#4b5563' }}>Kayıt bulunamadı</td></tr>
              )}
              {fisler.map(f => (
                <tr key={f.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)', cursor: 'pointer' }}
                    onClick={() => setDetayId(f.id)}>
                  <td style={tdSt}><span style={{ color: '#60a5fa', fontWeight: 700 }}>{f.fis_no}</span></td>
                  <td style={tdSt}>{new Date(f.tarih).toLocaleDateString('tr-TR')}</td>
                  <td style={{ ...tdSt, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.aciklama || '—'}</td>
                  <td style={tdSt}><span style={{ fontSize: 10, color: '#6b7280', background: 'rgba(255,255,255,.05)', padding: '2px 6px', borderRadius: 4 }}>{f.kaynak_tip}</span></td>
                  <td style={{ ...tdSt, textAlign: 'right', color: '#3b82f6' }}>{TL(f.toplam_borc)}</td>
                  <td style={{ ...tdSt, textAlign: 'right', color: '#8b5cf6' }}>{TL(f.toplam_alacak)}</td>
                  <td style={tdSt}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, fontWeight: 700,
                      background: `${DURUM_BADGE[f.durum]}22`, color: DURUM_BADGE[f.durum] }}>
                      {DURUM_TR[f.durum]}
                    </span>
                  </td>
                  <td style={tdSt} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {f.durum === 'taslak' && (
                        <button onClick={() => onayla.mutate(f.id)} style={{ ...btnSmSt, background: '#10b98122', color: '#10b981' }}>Onayla</button>
                      )}
                      {f.durum !== 'iptal' && (
                        <button onClick={() => { if (confirm('Fişi iptal etmek istediğinize emin misiniz?')) iptal.mutate(f.id) }}
                          style={{ ...btnSmSt, background: '#ef444422', color: '#ef4444' }}>İptal</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.total > fisler.length && (
            <div style={{ padding: '12px 16px', fontSize: 11, color: '#6b7280', textAlign: 'center' }}>
              Toplam {data.total} kayıt — Daha fazla için filtre kullanın
            </div>
          )}
        </div>
      )}

      {showCreate && <FisOlusturModal onClose={() => setShowCreate(false)} />}
      {detayId && <FisDetayModal id={detayId} onClose={() => setDetayId(null)} />}
    </div>
  )
}

// ── FİŞ OLUŞTUR MODAL ─────────────────────────────────────────────────────────
const FisOlusturModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const qc = useQueryClient()
  const { data: hesaplar = [] } = useQuery({ queryKey: ['hesap-plani'], queryFn: () => api.getHesapPlani() })

  const [tarih, setTarih] = useState(new Date().toISOString().split('T')[0])
  const [aciklama, setAciklama] = useState('')
  const [satirlar, setSatirlar] = useState<FisSatir[]>([
    { hesap_id: '', borc: 0, alacak: 0, aciklama: '' },
    { hesap_id: '', borc: 0, alacak: 0, aciklama: '' },
  ])

  const addSatir = () => setSatirlar(s => [...s, { hesap_id: '', borc: 0, alacak: 0, aciklama: '' }])
  const removeSatir = (i: number) => setSatirlar(s => s.filter((_, idx) => idx !== i))
  const setSatir = (i: number, field: keyof FisSatir, value: any) =>
    setSatirlar(s => s.map((r, idx) => idx === i ? { ...r, [field]: value } : r))

  const toplamBorc   = satirlar.reduce((s, r) => s + (Number(r.borc) || 0), 0)
  const toplamAlacak = satirlar.reduce((s, r) => s + (Number(r.alacak) || 0), 0)
  const dengeli = Math.abs(toplamBorc - toplamAlacak) < 0.01

  const create = useMutation({
    mutationFn: () => api.createFis({ tarih, aciklama, satirlar }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['muhasebe-fisler'] })
      toast.success('Fiş oluşturuldu')
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  })

  const altHesaplar: Hesap[] = useMemo(() =>
    hesaplar.filter((h: Hesap) => h.aktif && /^\d{3,}/.test(h.kod)),
    [hesaplar]
  )

  return (
    <div style={modalOverlaySt} onClick={onClose}>
      <div style={{ ...modalSt, maxWidth: 780, width: '95%' }} onClick={e => e.stopPropagation()}>
        <div style={modalHeaderSt}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>Yeni Yevmiye Fişi</span>
          <button onClick={onClose} style={closeBtnSt}>✕</button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto', maxHeight: '70vh' }}>
          {/* Başlık */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <div>
              <label style={labelSt}>Tarih</label>
              <input type="date" value={tarih} onChange={e => setTarih(e.target.value)} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Açıklama</label>
              <input value={aciklama} onChange={e => setAciklama(e.target.value)} placeholder="Fiş açıklaması" style={inputSt} />
            </div>
          </div>

          {/* Satırlar */}
          <div style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ background: 'rgba(255,255,255,.03)' }}>
                <tr>
                  <th style={thSt}>Hesap</th>
                  <th style={{ ...thSt, textAlign: 'right', width: 120 }}>Borç (₺)</th>
                  <th style={{ ...thSt, textAlign: 'right', width: 120 }}>Alacak (₺)</th>
                  <th style={thSt}>Açıklama</th>
                  <th style={{ ...thSt, width: 32 }}></th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s, i) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,.05)' }}>
                    <td style={{ padding: '6px 8px' }}>
                      <select value={s.hesap_id} onChange={e => setSatir(i, 'hesap_id', e.target.value)} style={selectSt}>
                        <option value="">— Hesap seçin —</option>
                        {altHesaplar.map((h: Hesap) => (
                          <option key={h.id} value={h.id}>{h.kod} — {h.ad}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input type="number" min="0" step="0.01" value={s.borc || ''}
                        onChange={e => setSatir(i, 'borc', parseFloat(e.target.value) || 0)}
                        style={{ ...inputSt, textAlign: 'right' }} placeholder="0.00" />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input type="number" min="0" step="0.01" value={s.alacak || ''}
                        onChange={e => setSatir(i, 'alacak', parseFloat(e.target.value) || 0)}
                        style={{ ...inputSt, textAlign: 'right' }} placeholder="0.00" />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input value={s.aciklama} onChange={e => setSatir(i, 'aciklama', e.target.value)}
                        style={inputSt} placeholder="Açıklama (isteğe bağlı)" />
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                      {satirlar.length > 2 && (
                        <button onClick={() => removeSatir(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>✕</button>
                      )}
                    </td>
                  </tr>
                ))}
                {/* Toplam satırı */}
                <tr style={{ background: 'rgba(255,255,255,.03)', borderTop: '1px solid rgba(255,255,255,.1)' }}>
                  <td style={{ ...tdSt, fontWeight: 700 }}>TOPLAM</td>
                  <td style={{ ...tdSt, textAlign: 'right', color: '#3b82f6', fontWeight: 700 }}>{TL(toplamBorc)}</td>
                  <td style={{ ...tdSt, textAlign: 'right', color: '#8b5cf6', fontWeight: 700 }}>{TL(toplamAlacak)}</td>
                  <td colSpan={2} style={tdSt}>
                    {dengeli
                      ? <span style={{ color: '#10b981', fontSize: 11, fontWeight: 700 }}>✓ Dengeli</span>
                      : <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 700 }}>✗ Fark: {TL(Math.abs(toplamBorc - toplamAlacak))}</span>
                    }
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <button onClick={addSatir} style={{ ...btnSt, alignSelf: 'flex-start', background: 'rgba(255,255,255,.05)', color: '#9ca3af' }}>
            + Satır Ekle
          </button>
        </div>

        <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid rgba(255,255,255,.06)' }}>
          <button onClick={onClose} style={btnSt}>İptal</button>
          <button
            onClick={() => create.mutate()}
            disabled={!dengeli || create.isPending}
            style={{ ...btnPrimary, opacity: (!dengeli || create.isPending) ? .5 : 1 }}
          >
            {create.isPending ? 'Kaydediliyor...' : 'Fişi Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── FİŞ DETAY MODAL ───────────────────────────────────────────────────────────
const FisDetayModal: React.FC<{ id: string; onClose: () => void }> = ({ id, onClose }) => {
  const { data: fis, isLoading } = useQuery({ queryKey: ['fis-detay', id], queryFn: () => api.getFis(id) })

  if (isLoading) return (
    <div style={modalOverlaySt}><div style={{ ...modalSt, padding: 40, textAlign: 'center' }}><Spinner /></div></div>
  )

  return (
    <div style={modalOverlaySt} onClick={onClose}>
      <div style={{ ...modalSt, maxWidth: 700, width: '95%' }} onClick={e => e.stopPropagation()}>
        <div style={modalHeaderSt}>
          <div>
            <span style={{ fontWeight: 800, fontSize: 15 }}>{fis?.fis_no}</span>
            <span style={{ marginLeft: 10, fontSize: 10, padding: '2px 8px', borderRadius: 10,
              background: `${DURUM_BADGE[fis?.durum]}22`, color: DURUM_BADGE[fis?.durum] }}>
              {DURUM_TR[fis?.durum]}
            </span>
          </div>
          <button onClick={onClose} style={closeBtnSt}>✕</button>
        </div>
        <div style={{ padding: '16px 20px', overflow: 'auto', maxHeight: '70vh' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <InfoBox label="Tarih" value={new Date(fis?.tarih).toLocaleDateString('tr-TR')} />
            <InfoBox label="Kaynak" value={fis?.kaynak_tip} />
            <InfoBox label="Şantiye" value={fis?.santiye_ad || '—'} />
          </div>
          {fis?.aciklama && <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>{fis.aciklama}</p>}

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
              {['Hesap Kodu', 'Hesap Adı', 'Açıklama', 'Borç', 'Alacak'].map(h =>
                <th key={h} style={thSt}>{h}</th>)}
            </tr></thead>
            <tbody>
              {fis?.satirlar?.map((s: any) => (
                <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <td style={{ ...tdSt, color: '#60a5fa', fontWeight: 600 }}>{s.hesap_kod}</td>
                  <td style={tdSt}>{s.hesap_ad}</td>
                  <td style={{ ...tdSt, color: '#6b7280' }}>{s.aciklama || '—'}</td>
                  <td style={{ ...tdSt, textAlign: 'right', color: '#3b82f6' }}>{s.borc > 0 ? TL(s.borc) : ''}</td>
                  <td style={{ ...tdSt, textAlign: 'right', color: '#8b5cf6' }}>{s.alacak > 0 ? TL(s.alacak) : ''}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid rgba(255,255,255,.1)', fontWeight: 700 }}>
                <td colSpan={3} style={{ ...tdSt }}>TOPLAM</td>
                <td style={{ ...tdSt, textAlign: 'right', color: '#3b82f6' }}>
                  {TL(fis?.satirlar?.reduce((s: number, r: any) => s + parseFloat(r.borc), 0))}
                </td>
                <td style={{ ...tdSt, textAlign: 'right', color: '#8b5cf6' }}>
                  {TL(fis?.satirlar?.reduce((s: number, r: any) => s + parseFloat(r.alacak), 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── MİZAN SEKMESI ─────────────────────────────────────────────────────────────
const MizanTab: React.FC = () => {
  const yil = new Date().getFullYear()
  const [filtre, setFiltre] = useState({ tarih_bas: `${yil}-01-01`, tarih_bit: `${yil}-12-31` })
  const { data, isLoading } = useQuery({
    queryKey: ['mizan', filtre],
    queryFn: () => api.getMizan(filtre),
  })

  const rows: MizanRow[] = data?.data || []
  const toplam = data?.toplam

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 11, color: '#6b7280' }}>Dönem:</label>
        <input type="date" value={filtre.tarih_bas} onChange={e => setFiltre(f => ({ ...f, tarih_bas: e.target.value }))} style={{ ...inputSt, width: 140 }} />
        <span style={{ color: '#6b7280' }}>—</span>
        <input type="date" value={filtre.tarih_bit} onChange={e => setFiltre(f => ({ ...f, tarih_bit: e.target.value }))} style={{ ...inputSt, width: 140 }} />
      </div>

      {isLoading ? <Spinner /> : rows.length === 0 ? (
        <EmptyMsg text="Seçili dönemde onaylanmış fiş bulunmuyor" />
      ) : (
        <div style={cardSt}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,.04)', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                <th style={thSt}>Kod</th>
                <th style={thSt}>Hesap Adı</th>
                <th style={thSt}>Tip</th>
                <th style={{ ...thSt, textAlign: 'right' }}>Dönem Borç</th>
                <th style={{ ...thSt, textAlign: 'right' }}>Dönem Alacak</th>
                <th style={{ ...thSt, textAlign: 'right' }}>Borç Bakiye</th>
                <th style={{ ...thSt, textAlign: 'right' }}>Alacak Bakiye</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <td style={{ ...tdSt, color: '#60a5fa', fontWeight: 600 }}>{r.kod}</td>
                  <td style={tdSt}>{r.ad}</td>
                  <td style={tdSt}>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 600,
                      background: `${TIP_RENKLER[r.tip]}22`, color: TIP_RENKLER[r.tip] }}>
                      {TIP_TR[r.tip]}
                    </span>
                  </td>
                  <td style={{ ...tdSt, textAlign: 'right' }}>{TL(r.donem_borc)}</td>
                  <td style={{ ...tdSt, textAlign: 'right' }}>{TL(r.donem_alacak)}</td>
                  <td style={{ ...tdSt, textAlign: 'right', color: '#3b82f6', fontWeight: 600 }}>
                    {parseFloat(r.borc_bakiye) > 0 ? TL(r.borc_bakiye) : ''}
                  </td>
                  <td style={{ ...tdSt, textAlign: 'right', color: '#8b5cf6', fontWeight: 600 }}>
                    {parseFloat(r.alacak_bakiye) > 0 ? TL(r.alacak_bakiye) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
            {toplam && (
              <tfoot>
                <tr style={{ borderTop: '2px solid rgba(255,255,255,.15)', fontWeight: 800, background: 'rgba(255,255,255,.03)' }}>
                  <td colSpan={3} style={{ ...tdSt, fontSize: 13 }}>GENEL TOPLAM</td>
                  <td style={{ ...tdSt, textAlign: 'right', color: '#3b82f6' }}>{TL(toplam.donem_borc)}</td>
                  <td style={{ ...tdSt, textAlign: 'right', color: '#8b5cf6' }}>{TL(toplam.donem_alacak)}</td>
                  <td style={{ ...tdSt, textAlign: 'right', color: '#3b82f6' }}>{TL(toplam.borc_bakiye)}</td>
                  <td style={{ ...tdSt, textAlign: 'right', color: '#8b5cf6' }}>{TL(toplam.alacak_bakiye)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}

// ── GELİR-GİDER SEKMESI ──────────────────────────────────────────────────────
const GelirGiderTab: React.FC = () => {
  const yil = new Date().getFullYear()
  const [seciliYil, setSeciliYil] = useState(String(yil))
  const { data, isLoading } = useQuery({
    queryKey: ['gelir-gider', seciliYil],
    queryFn: () => api.getGelirGider({ yil: seciliYil }),
  })

  const ozet: GelirGiderOzet = data?.ozet || { toplam_gelir: 0, toplam_gider: 0, net_kar: 0, kar_marji: '0' }
  const gelirler = data?.data?.gelirler || []
  const giderler = data?.data?.giderler || []
  const aylik: any[] = data?.data?.aylik || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Yıl seçici */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 11, color: '#6b7280' }}>Yıl:</label>
        <select value={seciliYil} onChange={e => setSeciliYil(e.target.value)} style={{ ...selectSt, width: 100 }}>
          {[yil - 1, yil, yil + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {isLoading ? <Spinner /> : (
        <>
          {/* KPI Kartları */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 14 }}>
            <KpiBox label="Toplam Gelir" value={TL(ozet.toplam_gelir)} color="#10b981" />
            <KpiBox label="Toplam Gider" value={TL(ozet.toplam_gider)} color="#ef4444" />
            <KpiBox label="Net Kar/Zarar" value={TL(ozet.net_kar)} color={ozet.net_kar >= 0 ? '#10b981' : '#ef4444'} />
            <KpiBox label="Kar Marjı" value={`%${ozet.kar_marji}`} color="#3b82f6" />
          </div>

          {/* Aylık Grafik (basit bar) */}
          {aylik.length > 0 && (
            <div style={cardSt}>
              <h3 style={cardTitleSt}>Aylık Gelir / Gider</h3>
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 120, padding: '0 8px' }}>
                {aylik.map((a) => {
                  const maxVal = Math.max(...aylik.map(x => Math.max(parseFloat(x.gelir), parseFloat(x.gider))))
                  const gelirH = maxVal > 0 ? (parseFloat(a.gelir) / maxVal * 100) : 0
                  const giderH = maxVal > 0 ? (parseFloat(a.gider) / maxVal * 100) : 0
                  return (
                    <div key={a.ay} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: 100 }}>
                        <div style={{ width: 8, height: `${gelirH}%`, background: '#10b981', borderRadius: '2px 2px 0 0', minHeight: 2 }} title={`Gelir: ${TL(a.gelir)}`} />
                        <div style={{ width: 8, height: `${giderH}%`, background: '#ef4444', borderRadius: '2px 2px 0 0', minHeight: 2 }} title={`Gider: ${TL(a.gider)}`} />
                      </div>
                      <span style={{ fontSize: 9, color: '#4b5563' }}>{a.ay.slice(5)}</span>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 8 }}>
                <span style={{ fontSize: 10, color: '#10b981' }}>█ Gelir</span>
                <span style={{ fontSize: 10, color: '#ef4444' }}>█ Gider</span>
              </div>
            </div>
          )}

          {/* Detay Tablolar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={cardSt}>
              <h3 style={{ ...cardTitleSt, color: '#10b981' }}>Gelir Kalemleri</h3>
              <HesapDetayTablosu rows={gelirler} renk="#10b981" />
            </div>
            <div style={cardSt}>
              <h3 style={{ ...cardTitleSt, color: '#ef4444' }}>Gider Kalemleri</h3>
              <HesapDetayTablosu rows={giderler} renk="#ef4444" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const HesapDetayTablosu: React.FC<{ rows: Record<string,unknown>[]; renk: string }> = ({ rows, renk }) => (
  rows.length === 0
    ? <p style={{ fontSize: 12, color: '#4b5563', padding: 12 }}>Kayıt yok</p>
    : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <th style={thSt}>Kod</th>
          <th style={thSt}>Hesap</th>
          <th style={{ ...thSt, textAlign: 'right' }}>Tutar</th>
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
              <td style={{ ...tdSt, color: '#60a5fa', fontWeight: 600 }}>{r.kod as string}</td>
              <td style={tdSt}>{r.ad as string}</td>
              <td style={{ ...tdSt, textAlign: 'right', color: renk, fontWeight: 600 }}>{TL(r.net_tutar)}</td>
            </tr>
          ))}
        </tbody>
      </table>
)

// ── MUAVİN DEFTERİ SEKMESI ───────────────────────────────────────────────────
const MuavinTab: React.FC = () => {
  const { data: hesaplar = [] } = useQuery({ queryKey: ['hesap-plani'], queryFn: () => api.getHesapPlani() })
  const [hesapId, setHesapId] = useState('')
  const yil = new Date().getFullYear()
  const [filtre, setFiltre] = useState({ tarih_bas: `${yil}-01-01`, tarih_bit: `${yil}-12-31` })

  const { data, isLoading } = useQuery({
    queryKey: ['muavin', hesapId, filtre],
    queryFn: () => api.getMuavin(hesapId, filtre),
    enabled: !!hesapId,
  })

  const altHesaplar: Hesap[] = useMemo(() => hesaplar.filter((h: Hesap) => h.aktif && /^\d{3,}/.test(h.kod)), [hesaplar])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={hesapId} onChange={e => setHesapId(e.target.value)} style={{ ...selectSt, minWidth: 260 }}>
          <option value="">— Hesap Seçin —</option>
          {altHesaplar.map((h: Hesap) => <option key={h.id} value={h.id}>{h.kod} — {h.ad}</option>)}
        </select>
        <input type="date" value={filtre.tarih_bas} onChange={e => setFiltre(f => ({ ...f, tarih_bas: e.target.value }))} style={{ ...inputSt, width: 140 }} />
        <span style={{ color: '#6b7280' }}>—</span>
        <input type="date" value={filtre.tarih_bit} onChange={e => setFiltre(f => ({ ...f, tarih_bit: e.target.value }))} style={{ ...inputSt, width: 140 }} />
      </div>

      {!hesapId && <EmptyMsg text="Muavin defteri görmek için bir hesap seçin" />}
      {hesapId && isLoading && <Spinner />}
      {hesapId && !isLoading && data && (
        <>
          <div style={{ display: 'flex', gap: 12 }}>
            <InfoBox label="Hesap" value={`${data.hesap?.kod} — ${data.hesap?.ad}`} />
            <InfoBox label="Toplam Borç" value={TL(data.toplam?.borc)} />
            <InfoBox label="Toplam Alacak" value={TL(data.toplam?.alacak)} />
            <InfoBox label="Net Bakiye" value={TL((data.toplam?.borc || 0) - (data.toplam?.alacak || 0))} />
          </div>
          {data.data?.length === 0
            ? <EmptyMsg text="Bu hesapta seçili dönemde hareket yok" />
            : (
              <div style={cardSt}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)' }}>
                    {['Tarih', 'Fiş No', 'Açıklama', 'Borç', 'Alacak', 'Kümülatif Bakiye'].map(h =>
                      <th key={h} style={thSt}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {data.data.map((r: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                        <td style={tdSt}>{new Date(r.tarih).toLocaleDateString('tr-TR')}</td>
                        <td style={{ ...tdSt, color: '#60a5fa' }}>{r.fis_no}</td>
                        <td style={{ ...tdSt, color: '#9ca3af', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.aciklama || r.fis_aciklama || '—'}
                        </td>
                        <td style={{ ...tdSt, textAlign: 'right', color: r.borc > 0 ? '#3b82f6' : '#374151' }}>
                          {r.borc > 0 ? TL(r.borc) : ''}
                        </td>
                        <td style={{ ...tdSt, textAlign: 'right', color: r.alacak > 0 ? '#8b5cf6' : '#374151' }}>
                          {r.alacak > 0 ? TL(r.alacak) : ''}
                        </td>
                        <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600,
                          color: parseFloat(r.kumulatif_bakiye) >= 0 ? '#10b981' : '#ef4444' }}>
                          {TL(r.kumulatif_bakiye)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </>
      )}
    </div>
  )
}

// ── HESAP PLANI SEKMESI ───────────────────────────────────────────────────────
const HesaplarTab: React.FC = () => {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [yeniHesap, setYeniHesap] = useState({ kod: '', ad: '', tip: 'aktif', ust_hesap_id: '', aciklama: '' })

  const { data: hesaplar = [], isLoading } = useQuery({
    queryKey: ['hesap-plani'],
    queryFn: () => api.getHesapPlani(),
  })

  const seed = useMutation({
    mutationFn: api.seedHesapPlani,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hesap-plani'] }); toast.success('Standart hesap planı yüklendi') },
    onError:   (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  })

  const createHesap = useMutation({
    mutationFn: () => apiClient.post('/muhasebe/hesap-plani', yeniHesap).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hesap-plani'] })
      toast.success('Hesap eklendi')
      setShowCreate(false)
      setYeniHesap({ kod: '', ad: '', tip: 'aktif', ust_hesap_id: '', aciklama: '' })
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  })

  const grouped = useMemo(() => {
    const map: Record<string, Hesap[]> = {}
    hesaplar.filter((h: Hesap) => h.kod.length === 1).forEach((h: Hesap) => {
      map[h.kod] = hesaplar.filter((c: Hesap) => c.kod.startsWith(h.kod) && c.kod !== h.kod)
    })
    return hesaplar.filter((h: Hesap) => h.kod.length === 1).map((h: Hesap) => ({ grup: h, alt: map[h.kod] || [] }))
  }, [hesaplar])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {hesaplar.length === 0 && (
          <button onClick={() => seed.mutate()} disabled={seed.isPending} style={btnPrimary}>
            {seed.isPending ? 'Yükleniyor...' : '📥 Standart Hesap Planını Yükle'}
          </button>
        )}
        <button onClick={() => setShowCreate(s => !s)} style={btnSt}>+ Hesap Ekle</button>
      </div>

      {showCreate && (
        <div style={{ ...cardSt, padding: 16 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#e2e8f0' }}>Yeni Hesap</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelSt}>Kod</label>
              <input value={yeniHesap.kod} onChange={e => setYeniHesap(h => ({ ...h, kod: e.target.value }))} style={inputSt} placeholder="120.01" />
            </div>
            <div>
              <label style={labelSt}>Hesap Adı</label>
              <input value={yeniHesap.ad} onChange={e => setYeniHesap(h => ({ ...h, ad: e.target.value }))} style={inputSt} placeholder="Hesap adı" />
            </div>
            <div>
              <label style={labelSt}>Tip</label>
              <select value={yeniHesap.tip} onChange={e => setYeniHesap(h => ({ ...h, tip: e.target.value }))} style={selectSt}>
                <option value="aktif">Aktif</option>
                <option value="pasif">Pasif</option>
                <option value="gelir">Gelir</option>
                <option value="gider">Gider</option>
                <option value="oz_sermaye">Öz Sermaye</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowCreate(false)} style={btnSt}>İptal</button>
            <button onClick={() => createHesap.mutate()} disabled={createHesap.isPending || !yeniHesap.kod || !yeniHesap.ad} style={btnPrimary}>
              Ekle
            </button>
          </div>
        </div>
      )}

      {isLoading ? <Spinner /> : hesaplar.length === 0 ? (
        <EmptyMsg text="Hesap planı boş. Standart planı yükleyin veya manuel ekleyin." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {grouped.map(({ grup, alt }: { grup: Hesap; alt: Hesap[] }) => (
            <div key={grup.id} style={cardSt}>
              <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: alt.length ? '1px solid rgba(255,255,255,.06)' : 'none' }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: TIP_RENKLER[grup.tip] }}>{grup.kod}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{grup.ad}</span>
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: `${TIP_RENKLER[grup.tip]}22`, color: TIP_RENKLER[grup.tip], marginLeft: 'auto' }}>
                  {TIP_TR[grup.tip]}
                </span>
                <span style={{ fontSize: 11, color: '#4b5563' }}>{alt.length} alt hesap</span>
              </div>
                {alt.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <tbody>
                    {alt.map((h: Hesap) => (
                      <tr key={h.id} style={{ borderBottom: '1px solid rgba(255,255,255,.03)' }}>
                        <td style={{ padding: '7px 14px 7px 28px', color: '#60a5fa', fontWeight: 600, width: 100 }}>{h.kod}</td>
                        <td style={{ padding: '7px 8px', color: h.aktif ? '#d1d5db' : '#4b5563' }}>{h.ad}</td>
                        <td style={{ padding: '7px 8px' }}>
                          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 8, background: `${TIP_RENKLER[h.tip]}15`, color: TIP_RENKLER[h.tip] }}>
                            {TIP_TR[h.tip]}
                          </span>
                        </td>
                        {!h.aktif && <td style={{ padding: '7px 8px' }}><span style={{ fontSize: 9, color: '#6b7280' }}>Pasif</span></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── YARDIMCI COMPONENTLER ─────────────────────────────────────────────────────
const InfoBox: React.FC<{ label: string; value: any }> = ({ label, value }) => (
  <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '8px 14px', minWidth: 100 }}>
    <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginTop: 2 }}>{value}</div>
  </div>
)

const KpiBox: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ background: '#0b1120', border: `1px solid ${color}22`, borderRadius: 10, padding: '14px 18px' }}>
    <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
  </div>
)

const Spinner: React.FC = () => (
  <div style={{ textAlign: 'center', padding: 40 }}>
    <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,.1)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
  </div>
)

const EmptyMsg: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#4b5563', fontSize: 13 }}>{text}</div>
)

// ── ORTAK STİLLER ─────────────────────────────────────────────────────────────
const inputSt: React.CSSProperties = {
  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 7, padding: '8px 12px', color: '#e2e8f0', fontSize: 12, width: '100%',
}
const selectSt: React.CSSProperties = {
  ...inputSt, cursor: 'pointer',
}
const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 4,
}
const thSt: React.CSSProperties = {
  padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700,
  color: '#6b7280', textTransform: 'uppercase', letterSpacing: .5, whiteSpace: 'nowrap',
}
const tdSt: React.CSSProperties = {
  padding: '9px 12px', color: '#d1d5db',
}
const cardSt: React.CSSProperties = {
  background: '#0b1120', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, overflow: 'hidden',
}
const cardTitleSt: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: '#e2e8f0', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.06)', margin: 0,
}
const btnPrimary: React.CSSProperties = {
  background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 7,
  padding: '9px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap',
}
const btnSt: React.CSSProperties = {
  background: 'rgba(255,255,255,.07)', color: '#9ca3af', border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 7, padding: '9px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap',
}
const btnSmSt: React.CSSProperties = {
  border: 'none', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700,
}
const modalOverlaySt: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16,
}
const modalSt: React.CSSProperties = {
  background: '#0f1624', border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 14, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,.5)',
}
const modalHeaderSt: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.07)',
}
const closeBtnSt: React.CSSProperties = {
  background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 16, padding: 4,
}
