import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { stokApi } from '@/services/api'
import { fmtTL } from '@/utils/format'
import { Spinner } from '@/components/ui'

// ─── TİPLER ──────────────────────────────────────────────────────────────────
interface Stok {
  id: string; malzeme_adi: string; kategori: string; birim: string
  mevcut_miktar: number; minimum_miktar: number; birim_maliyet: number
  toplam_deger: number; depo_yeri?: string; santiye_adi?: string
}

const KATEGORİLER = ['genel', 'beton', 'celik', 'asfalt', 'boya', 'elektrik', 'tesisat', 'kaba_insaat', 'ince_isler', 'ekipman_malzeme']

// ─── STOK KARTLARI ───────────────────────────────────────────────────────────
const StokKart: React.FC<{ stok: Stok; onHareket: (s: Stok) => void }> = ({ stok, onHareket }) => {
  const kritik = stok.mevcut_miktar <= stok.minimum_miktar && stok.minimum_miktar > 0
  const oran = stok.minimum_miktar > 0 ? Math.min((stok.mevcut_miktar / stok.minimum_miktar) * 100, 100) : 100

  return (
    <div style={{
      background: kritik ? 'rgba(239,68,68,.06)' : 'rgba(255,255,255,.03)',
      border: `1px solid ${kritik ? 'rgba(239,68,68,.3)' : 'rgba(255,255,255,.08)'}`,
      borderRadius: 12, padding: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 14 }}>{stok.malzeme_adi}</div>
          <div style={{ color: '#64748b', fontSize: 12 }}>
            {stok.kategori} {stok.depo_yeri ? `· ${stok.depo_yeri}` : ''}
          </div>
        </div>
        {kritik && <span style={{ background: '#ef444422', color: '#ef4444', border: '1px solid #ef444444', borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>⚠ Kritik</span>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ color: kritik ? '#ef4444' : '#00d4aa', fontSize: 22, fontWeight: 700 }}>
          {stok.mevcut_miktar.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
        </span>
        <span style={{ color: '#64748b', fontSize: 13 }}>{stok.birim}</span>
      </div>

      {stok.minimum_miktar > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ height: 6, background: 'rgba(255,255,255,.08)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${oran}%`, background: kritik ? '#ef4444' : '#00d4aa', borderRadius: 3, transition: 'width .3s' }} />
          </div>
          <div style={{ color: '#475569', fontSize: 11, marginTop: 3 }}>Min: {stok.minimum_miktar} {stok.birim}</div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#64748b', fontSize: 12 }}>
          {stok.birim_maliyet > 0 && <span>₺{stok.birim_maliyet.toLocaleString('tr-TR')} / {stok.birim} · </span>}
          <span style={{ color: '#94a3b8' }}>Toplam: {fmtTL(stok.toplam_deger)}</span>
        </div>
        <button onClick={() => onHareket(stok)} style={{
          background: 'rgba(99,102,241,.2)', color: '#a5b4fc',
          border: '1px solid rgba(99,102,241,.3)', borderRadius: 6,
          padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
        }}>+ Hareket</button>
      </div>
    </div>
  )
}

// ─── HAREKET MODAL ────────────────────────────────────────────────────────────
const HareketModal: React.FC<{ stok: Stok; onClose: () => void }> = ({ stok, onClose }) => {
  const qc = useQueryClient()
  const [tip, setTip] = useState('giris')
  const [miktar, setMiktar] = useState('')
  const [fiyat, setFiyat] = useState(String(stok.birim_maliyet || ''))
  const [aciklama, setAciklama] = useState('')
  const [tarih, setTarih] = useState(new Date().toISOString().slice(0, 10))

  const inp: React.CSSProperties = { background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, padding: '8px 12px', color: '#f1f5f9', fontSize: 14, width: '100%', boxSizing: 'border-box' }

  const mut = useMutation({
    mutationFn: () => stokApi.addHareket({ stok_id: stok.id, hareket_tipi: tip, miktar: parseFloat(miktar), birim_fiyat: parseFloat(fiyat) || 0, aciklama, tarih }),
    onSuccess: () => { toast.success('Hareket kaydedildi'); qc.invalidateQueries({ queryKey: ['stok'] }); onClose() },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Hata'),
  })

  const TipRenk: Record<string, string> = { giris: '#22c55e', cikis: '#f59e0b', fire: '#ef4444', sayim: '#6366f1', transfer: '#0ea5e9' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1e2a3a', borderRadius: 16, padding: 28, width: 420, border: '1px solid rgba(255,255,255,.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ color: '#f1f5f9', margin: 0, fontSize: 16 }}>Stok Hareketi</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>

        <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div style={{ color: '#f1f5f9', fontWeight: 600 }}>{stok.malzeme_adi}</div>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>Mevcut: {stok.mevcut_miktar} {stok.birim}</div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 6 }}>Hareket Tipi</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['giris','cikis','fire','sayim','transfer'] as const).map(t => (
              <button key={t} onClick={() => setTip(t)} style={{
                background: tip === t ? `${TipRenk[t]}22` : 'rgba(255,255,255,.05)',
                border: `1px solid ${tip === t ? TipRenk[t] + '66' : 'rgba(255,255,255,.1)'}`,
                color: tip === t ? TipRenk[t] : '#94a3b8',
                borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                textTransform: 'capitalize',
              }}>{t === 'giris' ? 'Giriş' : t === 'cikis' ? 'Çıkış' : t === 'fire' ? 'Fire' : t === 'sayim' ? 'Sayım' : 'Transfer'}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>
            {tip === 'sayim' ? 'Sayım Sonucu' : 'Miktar'} ({stok.birim}) *
          </label>
          <input type="number" style={inp} value={miktar} onChange={e => setMiktar(e.target.value)} placeholder="0" min={0} step="any" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>Birim Fiyat (₺)</label>
            <input type="number" style={inp} value={fiyat} onChange={e => setFiyat(e.target.value)} placeholder="0" min={0} step="any" />
          </div>
          <div>
            <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>Tarih</label>
            <input type="date" style={inp} value={tarih} onChange={e => setTarih(e.target.value)} />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>Açıklama</label>
          <input style={inp} value={aciklama} onChange={e => setAciklama(e.target.value)} placeholder="İsteğe bağlı..." />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', color: '#94a3b8', borderRadius: 8, padding: '9px 16px', cursor: 'pointer' }}>Vazgeç</button>
          <button onClick={() => { if (!miktar) { toast.error('Miktar giriniz'); return; } mut.mutate() }} disabled={mut.isPending}
            style={{ background: `linear-gradient(135deg,${TipRenk[tip]},${TipRenk[tip]}aa)`, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontWeight: 600 }}>
            {mut.isPending ? 'Kaydediliyor...' : '✓ Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── YENİ STOK FORMU ──────────────────────────────────────────────────────────
const YeniStokForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const qc = useQueryClient()
  const [f, setF] = useState({ malzeme_adi: '', kategori: 'genel', birim: 'ADET', minimum_miktar: '', birim_maliyet: '', depo_yeri: '' })
  const inp: React.CSSProperties = { background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, padding: '8px 12px', color: '#f1f5f9', fontSize: 14, width: '100%', boxSizing: 'border-box' }

  const mut = useMutation({
    mutationFn: () => stokApi.create({ ...f, minimum_miktar: parseFloat(f.minimum_miktar) || 0, birim_maliyet: parseFloat(f.birim_maliyet) || 0 }),
    onSuccess: () => { toast.success('Malzeme eklendi'); qc.invalidateQueries({ queryKey: ['stok'] }); onClose() },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Hata'),
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1e2a3a', borderRadius: 16, padding: 28, width: 480, border: '1px solid rgba(255,255,255,.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ color: '#f1f5f9', margin: 0 }}>Yeni Malzeme / Stok Kalemi</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>Malzeme Adı *</label>
            <input style={inp} value={f.malzeme_adi} onChange={e => setF(p => ({ ...p, malzeme_adi: e.target.value }))} placeholder="Örn: Çimento 42.5N, Demir Φ12..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>Kategori</label>
              <select style={inp} value={f.kategori} onChange={e => setF(p => ({ ...p, kategori: e.target.value }))}>
                {KATEGORİLER.map(k => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>Birim</label>
              <select style={inp} value={f.birim} onChange={e => setF(p => ({ ...p, birim: e.target.value }))}>
                {['ADET','KG','TON','M2','M3','MT','LİTRE','TORBA','PALET'].map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>Min. Stok</label>
              <input type="number" style={inp} value={f.minimum_miktar} onChange={e => setF(p => ({ ...p, minimum_miktar: e.target.value }))} placeholder="0" min={0} step="any" />
            </div>
            <div>
              <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>Birim Maliyet (₺)</label>
              <input type="number" style={inp} value={f.birim_maliyet} onChange={e => setF(p => ({ ...p, birim_maliyet: e.target.value }))} placeholder="0" min={0} step="any" />
            </div>
          </div>
          <div>
            <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>Depo Yeri</label>
            <input style={inp} value={f.depo_yeri} onChange={e => setF(p => ({ ...p, depo_yeri: e.target.value }))} placeholder="Örn: A Blok depo, Saha deposu..." />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', color: '#94a3b8', borderRadius: 8, padding: '9px 16px', cursor: 'pointer' }}>Vazgeç</button>
          <button onClick={() => { if (!f.malzeme_adi.trim()) { toast.error('Malzeme adı zorunlu'); return; } mut.mutate() }} disabled={mut.isPending}
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', cursor: 'pointer', fontWeight: 600 }}>
            {mut.isPending ? 'Kaydediliyor...' : '+ Malzeme Ekle'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ANA BİLEŞEN ─────────────────────────────────────────────────────────────
export const StokDepo: React.FC = () => {
  const [hareketStok, setHareketStok] = useState<Stok | null>(null)
  const [yeniForm, setYeniForm] = useState(false)
  const [filtre, setFiltre] = useState<'hepsi'|'kritik'>('hepsi')
  const [arama, setArama] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['stok'],
    queryFn: () => stokApi.list().then(r => r.data),
  })

  const stoklar: Stok[] = data?.data ?? []
  const ozet = data?.ozet

  const gorunenler = stoklar
    .filter(s => filtre === 'kritik' ? s.mevcut_miktar <= s.minimum_miktar && s.minimum_miktar > 0 : true)
    .filter(s => !arama || s.malzeme_adi.toLowerCase().includes(arama.toLowerCase()))

  return (
    <div style={{ padding: 24, color: '#f1f5f9' }}>
      {hareketStok && <HareketModal stok={hareketStok} onClose={() => setHareketStok(null)} />}
      {yeniForm && <YeniStokForm onClose={() => setYeniForm(false)} />}

      {/* Başlık */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Stok / Depo Takibi</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 14 }}>Malzeme giriş-çıkış ve stok seviyesi yönetimi</p>
        </div>
        <button onClick={() => setYeniForm(true)} style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 }}>+ Malzeme Ekle</button>
      </div>

      {/* KPI */}
      {ozet && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Toplam Kalem', val: ozet.toplam_kalem, color: '#6366f1' },
            { label: 'Kritik Stok', val: ozet.kritik_stok, color: '#ef4444' },
            { label: 'Stok Değeri', val: fmtTL(Number(ozet.toplam_stok_degeri)), color: '#00d4aa' },
          ].map(k => (
            <div key={k.label} style={{ background: `${k.color}10`, border: `1px solid ${k.color}30`, borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ color: k.color, fontSize: 22, fontWeight: 700 }}>{k.val}</div>
              <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtre + Arama */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center' }}>
        {([['hepsi','Tümü'],['kritik','Kritik Stok']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setFiltre(key)} style={{
            background: filtre === key ? 'rgba(99,102,241,.3)' : 'rgba(255,255,255,.05)',
            border: `1px solid ${filtre === key ? 'rgba(99,102,241,.5)' : 'rgba(255,255,255,.1)'}`,
            color: filtre === key ? '#a5b4fc' : '#94a3b8',
            borderRadius: 8, padding: '6px 16px', cursor: 'pointer', fontSize: 13,
          }}>{label}</button>
        ))}
        <input
          style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '7px 14px', color: '#f1f5f9', fontSize: 13, flex: 1, maxWidth: 260 }}
          placeholder="Malzeme ara..." value={arama} onChange={e => setArama(e.target.value)}
        />
      </div>

      {/* Grid */}
      {isLoading
        ? <div style={{ textAlign: 'center', padding: 60 }}><Spinner size={32} /></div>
        : gorunenler.length === 0
          ? <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📦</div>
              <div>{filtre === 'kritik' ? 'Kritik stok yok' : 'Henüz malzeme eklenmemiş'}</div>
            </div>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {gorunenler.map(s => <StokKart key={s.id} stok={s} onHareket={setHareketStok} />)}
            </div>
      }
    </div>
  )
}

export default StokDepo
