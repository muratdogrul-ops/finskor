// ── Bu dosya tüm kalan modüllerin temel yapısını içerir ──────────────────────
import React, { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { santiyeApi, hakedisApi, satinalmaApi, ekipmanApi, personelApi, nakitApi, gunlukApi, faturaApi, musteriPortalApi } from '@/services/api'
import { Card, KpiCard, Badge, ProgressBar, PageHeader, Button, Table, Modal, FormInput, EmptyState, Spinner } from '@/components/ui'
import { fmtTL, fmtTarih, fmtSayi, progColor, durumLabel, initials, avatarColor } from '@/utils/format'
import type { Santiye, Hakedis, SatinalmaTalep, Ekipman, Personel as PersonelType, SantiyeGunluk } from '@/types'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════════════════
// ŞANTİYELER
// ═══════════════════════════════════════════════════════════════════════════
const initialSantiyeForm = { ad: '', tip: 'ustyapi', il: '', ilce: '', sozlesme_bedel: '', baslangic: '', bitis_planlanan: '', notlar: '' }

export const Santiyeler: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [modalAcik, setModalAcik] = useState(false)
  const [form, setForm] = useState(initialSantiyeForm)

  const { data, isLoading } = useQuery({ queryKey: ['santiyeler'], queryFn: () => santiyeApi.list().then(r => r.data.data) })
  const santiyeler: Santiye[] = data || []

  const olusturMutation = useMutation({
    mutationFn: (d: typeof initialSantiyeForm) => santiyeApi.create({
      ...d,
      sozlesme_bedel: d.sozlesme_bedel ? parseFloat(d.sozlesme_bedel) : 0,
    }),
    onSuccess: () => {
      toast.success('Şantiye oluşturuldu')
      queryClient.invalidateQueries({ queryKey: ['santiyeler'] })
      setModalAcik(false)
      setForm(initialSantiyeForm)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Şantiye oluşturulamadı')
    },
  })

  const handleSubmit = () => {
    if (!form.ad.trim()) return toast.error('Şantiye adı zorunlu')
    if (!form.il.trim()) return toast.error('İl zorunlu')
    if (!form.baslangic) return toast.error('Başlangıç tarihi zorunlu')
    if (!form.bitis_planlanan) return toast.error('Bitiş tarihi zorunlu')
    olusturMutation.mutate(form)
  }

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>

  return (
    <div>
      <PageHeader title="Şantiye Yönetimi" sub={`${santiyeler.length} şantiye`}
        action={<Button onClick={() => setModalAcik(true)}>+ Yeni Şantiye</Button>}
      />

      <Modal open={modalAcik} onClose={() => setModalAcik(false)} title="Yeni Şantiye Ekle">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormInput label="Şantiye Adı *" value={form.ad} onChange={v => setForm(f => ({ ...f, ad: v }))} placeholder="Örn: Ankara Konut Projesi" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ color: '#9ca3af', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Tip *</div>
              <select value={form.tip} onChange={e => setForm(f => ({ ...f, tip: e.target.value }))}
                style={{ width: '100%', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '8px 10px', color: '#f1f5f9', fontSize: 13 }}>
                <option value="ustyapi">Üstyapı</option>
                <option value="altyapi">Altyapı</option>
                <option value="karma">Karma</option>
              </select>
            </div>
            <FormInput label="İl *" value={form.il} onChange={v => setForm(f => ({ ...f, il: v }))} placeholder="Örn: Ankara" />
          </div>
          <FormInput label="İlçe" value={form.ilce} onChange={v => setForm(f => ({ ...f, ilce: v }))} placeholder="İsteğe bağlı" />
          <FormInput label="Sözleşme Bedeli (₺)" value={form.sozlesme_bedel} onChange={v => setForm(f => ({ ...f, sozlesme_bedel: v }))} placeholder="Örn: 5000000" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormInput label="Başlangıç Tarihi *" value={form.baslangic} onChange={v => setForm(f => ({ ...f, baslangic: v }))} placeholder="YYYY-AA-GG" />
            <FormInput label="Planlanan Bitiş *" value={form.bitis_planlanan} onChange={v => setForm(f => ({ ...f, bitis_planlanan: v }))} placeholder="YYYY-AA-GG" />
          </div>
          <FormInput label="Notlar" value={form.notlar} onChange={v => setForm(f => ({ ...f, notlar: v }))} placeholder="İsteğe bağlı notlar" />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="secondary" onClick={() => setModalAcik(false)}>Vazgeç</Button>
            <Button onClick={handleSubmit} disabled={olusturMutation.isPending}>
              {olusturMutation.isPending ? 'Kaydediliyor…' : 'Şantiye Oluştur'}
            </Button>
          </div>
        </div>
      </Modal>

      {santiyeler.length === 0 ? (
        <EmptyState icon="🏗️" title="Henüz şantiye yok" sub="İlk şantiyenizi ekleyin"
          action={<Button onClick={() => setModalAcik(true)}>Şantiye Ekle</Button>}
        />
      ) : (
        santiyeler.map(s => (
          <div key={s.id} onClick={() => navigate(`/santiyeler/${s.id}`)}
            style={{
              background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)',
              borderRadius: 12, padding: 16, marginBottom: 10, cursor: 'pointer',
              transition: 'border-color .2s'
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,212,170,.3)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,.07)')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{s.ad}</div>
                <div style={{ color: '#6b7280', fontSize: 11 }}>
                  📍 {s.il} &nbsp;•&nbsp; 👤 {s.mudur_adi || '—'} &nbsp;•&nbsp;
                  📅 {fmtTarih(s.baslangic)} – {fmtTarih(s.bitis_planlanan)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <Badge text={s.tip} />
                <Badge text={s.durum} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#6b7280', fontSize: 10 }}>Sözleşme</div>
                  <div style={{ color: '#60a5fa', fontWeight: 700 }}>{fmtTL(s.sozlesme_bedel)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#6b7280', fontSize: 10 }}>Gerçekleşen</div>
                  <div style={{ color: '#00d4aa', fontWeight: 700 }}>{fmtTL(s.gerceklesen)}</div>
                </div>
                <span style={{ color: '#6b7280' }}>›</span>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ color: '#6b7280', fontSize: 11 }}>Fiziksel İlerleme</span>
                <span style={{ fontWeight: 700, fontSize: 11 }}>%{s.fiziksel_ilerleme}</span>
              </div>
              <ProgressBar value={s.fiziksel_ilerleme} height={8} />
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ─── RAPOR LİNK BUTONU ────────────────────────────────────────────────────────
const RaporLinkButton: React.FC<{ santiyeId: string }> = ({ santiyeId }) => {
  const [loading, setLoading] = React.useState(false)

  const handleCreate = async () => {
    setLoading(true)
    try {
      const res = await musteriPortalApi.createLink(santiyeId, { gun: 30 })
      const token = res.data?.data?.token
      if (token) {
        const url = `${window.location.origin}/p/${token}`
        await navigator.clipboard.writeText(url)
        toast.success('Müşteri linki oluşturuldu ve kopyalandı! (30 gün geçerli)')
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Link oluşturulamadı')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button size="sm" variant="secondary" onClick={handleCreate} loading={loading}>
      🔗 Müşteri Linki
    </Button>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ŞANTİYE DETAY
// ═══════════════════════════════════════════════════════════════════════════
export const SantiyeDetay: React.FC = () => {
  const navigate = useNavigate()
  const id = window.location.pathname.split('/').pop()!
  const [activeTab, setActiveTab] = useState<'gelismeler'|'gunluk'|'fotograflar'|'genel'|'yazismalar'>('gelismeler')
  const { data, isLoading } = useQuery({ queryKey: ['santiye', id], queryFn: () => santiyeApi.get(id).then(r => r.data.data) })
  const s: Santiye | undefined = data

  if (isLoading || !s) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>

  const tabs = [
    ['gelismeler','📰 Gelişmeler'],
    ['gunluk','📋 Günlük'],
    ['fotograflar','📷 Fotoğraflar'],
    ['genel','📊 Genel'],
    ['yazismalar','💬 Yazışmalar'],
  ] as const

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <Button variant="secondary" size="sm" onClick={() => navigate('/santiyeler')}>← Geri</Button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{s.ad}</div>
          <div style={{ color: '#6b7280', fontSize: 11 }}>📍 {s.il} • 👤 {s.mudur_adi || '—'} • <Badge text={s.durum} /></div>
        </div>
        <Button size="sm" onClick={() => navigate(`/rapor/${id}`)}>📄 Müşteri Raporu</Button>
        <RaporLinkButton santiyeId={id} />
      </div>

      <div className="tab-scroll" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: 4, width: 'fit-content', minWidth: '100%' }}>
          {tabs.map(([tab, label]) => (
            <button key={tab} onClick={() => {
              setActiveTab(tab)
              if (tab === 'yazismalar') navigate(`/mesajlar/${id}`)
            }} style={{
              padding: '8px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: activeTab === tab ? '#00d4aa' : 'transparent',
              color: activeTab === tab ? '#000' : '#6b7280', fontWeight: 600, fontSize: 12,
              whiteSpace: 'nowrap', flexShrink: 0
            }}>{label}</button>
          ))}
        </div>
      </div>

      {activeTab === 'gelismeler' && <GelismelerTab santiye={s} santiyeId={id} />}
      {activeTab === 'gunluk' && <GunlukRaporTab santiyeId={id} />}

      {activeTab === 'genel' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 16 }}>
            <KpiCard label="Sözleşme" value={fmtTL(s.sozlesme_bedel)} color="#60a5fa" />
            <KpiCard label="Gerçekleşen" value={fmtTL(s.gerceklesen)} color="#00d4aa" />
            <KpiCard label="Kalan İş" value={fmtTL(s.sozlesme_bedel - s.gerceklesen)} color="#94a3b8" />
            <KpiCard label="Tamamlanma" value={`%${s.fiziksel_ilerleme}`} color="#a78bfa" />
            <KpiCard label="Personel" value={s.personel_sayisi || 0} color="#34d399" />
            <KpiCard label="Fotoğraf" value={s.fotograf_sayisi || 0} color="#fb923c" />
          </div>
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Fiziksel İlerleme</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#6b7280', fontSize: 12 }}>Tamamlanma</span>
              <span style={{ fontWeight: 700 }}>%{s.fiziksel_ilerleme}</span>
            </div>
            <ProgressBar value={s.fiziksel_ilerleme} height={16} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: '#6b7280' }}>
              <span>Başlangıç: {fmtTarih(s.baslangic)}</span>
              <span>Planlanan bitiş: {fmtTarih(s.bitis_planlanan)}</span>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'fotograflar' && <FotograflarTab santiyeId={id} />}
    </div>
  )
}

// ─── GELİŞMELER TAB ──────────────────────────────────────────────────────────
const GelismelerTab: React.FC<{ santiye: Santiye; santiyeId: string }> = ({ santiye, santiyeId }) => {
  const qc = useQueryClient()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const { data: fotograflar } = useQuery({
    queryKey: ['fotograflar', santiyeId],
    queryFn: () => import('@/services/api').then(m => m.fotografApi.list(santiyeId).then(r => r.data.data ?? []))
  })
  const { data: hakedisData } = useQuery({
    queryKey: ['hakedisler', santiyeId],
    queryFn: () => hakedisApi.list({ santiye_id: santiyeId }).then(r => r.data.data ?? [])
  })
  const { data: satinalmaData } = useQuery({
    queryKey: ['satinalma', santiyeId],
    queryFn: () => satinalmaApi.list({ santiye_id: santiyeId }).then(r => r.data.data ?? [])
  })
  const { data: nakitData } = useQuery({
    queryKey: ['nakit-hareketleri', santiyeId],
    queryFn: () => nakitApi.hareketler({ santiye_id: santiyeId, limit: '20' }).then(r => r.data.data ?? [])
  })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    setUploading(true)
    try {
      const fd = new FormData()
      Array.from(e.target.files).forEach(f => fd.append('fotograflar', f))
      await import('@/services/api').then(m => m.fotografApi.upload(santiyeId, fd))
      qc.invalidateQueries({ queryKey: ['fotograflar', santiyeId] })
      qc.invalidateQueries({ queryKey: ['santiye', santiyeId] })
      toast.success('Fotoğraflar yüklendi!')
    } catch { toast.error('Yükleme başarısız') }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  // Aktiviteleri birleştir ve tarihe göre sırala
  type AktiviteItem = { tarih: string; tip: string; baslik: string; aciklama: string; renk: string; ikon: string }
  const aktiviteler: AktiviteItem[] = [
    ...((hakedisData as Hakedis[] | undefined) || []).map(h => ({
      tarih: h.olusturuldu, tip: 'hakedis', ikon: '📄',
      baslik: `Hakediş: ${h.no}`,
      aciklama: `${fmtTL(h.toplam_tutar)} — ${durumLabel[h.durum] || h.durum}`,
      renk: h.durum === 'odendi' ? '#00d4aa' : h.durum === 'onaylandi' ? '#60a5fa' : '#f59e0b',
    })),
    ...((satinalmaData as SatinalmaTalep[] | undefined) || []).map(s => ({
      tarih: s.olusturuldu, tip: 'satinalma', ikon: '🛒',
      baslik: `Satın Alma: ${s.malzeme_adi}`,
      aciklama: `${fmtTL(s.toplam_tahmini || 0)} — ${durumLabel[s.durum] || s.durum}`,
      renk: s.durum === 'teslim_edildi' ? '#00d4aa' : s.acil_mi ? '#ef4444' : '#a78bfa',
    })),
    ...((nakitData as any[] | undefined) || []).map(n => ({
      tarih: n.tarih, tip: 'nakit', ikon: n.tip === 'giris' ? '💰' : '💸',
      baslik: `${n.tip === 'giris' ? 'Tahsilat' : 'Ödeme'}: ${n.kategori}`,
      aciklama: `${fmtTL(n.tutar)} — ${n.aciklama || ''}`,
      renk: n.tip === 'giris' ? '#00d4aa' : '#ef4444',
    })),
  ].sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime()).slice(0, 30)

  const resimler: any[] = (fotograflar as any[] | undefined) || []

  return (
    <div>
      {/* ── Özet Kartları ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 20 }}>
        <KpiCard label="İlerleme" value={`%${santiye.fiziksel_ilerleme}`} color="#a78bfa" />
        <KpiCard label="Gerçekleşen" value={fmtTL(santiye.gerceklesen)} color="#00d4aa" />
        <KpiCard label="Tahsilat" value={fmtTL(santiye.tahsil_edilen || 0)} color="#60a5fa" />
        <KpiCard label="Fotoğraf" value={santiye.fotograf_sayisi || 0} color="#fb923c" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
        {/* ── Sol: Aktivite akışı ── */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: '#e2e8f0' }}>Son Gelişmeler</div>
          {aktiviteler.length === 0 ? (
            <Card><div style={{ color: '#4b5563', textAlign: 'center', padding: 24, fontSize: 13 }}>Henüz aktivite yok. Hakediş, satın alma veya nakit hareketi ekleyin.</div></Card>
          ) : (
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 18, top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,.07)' }} />
              {aktiviteler.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 14, position: 'relative' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0, zIndex: 1,
                    background: 'rgba(255,255,255,.06)', border: `2px solid ${a.renk}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                  }}>{a.ikon}</div>
                  <div style={{
                    flex: 1, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)',
                    borderRadius: 10, padding: '10px 14px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: 12, color: '#e2e8f0' }}>{a.baslik}</span>
                      <span style={{ fontSize: 10, color: '#4b5563' }}>{fmtTarih(a.tarih)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: a.renk }}>{a.aciklama}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Sağ: Fotoğraflar ── */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: '#e2e8f0' }}>Saha Fotoğrafları</div>
          <label style={{
            border: '2px dashed rgba(255,255,255,.1)', borderRadius: 10, padding: '14px 10px',
            textAlign: 'center', cursor: 'pointer', display: 'block', marginBottom: 12,
            transition: 'all .2s',
          }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#00d4aa')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)')}
          >
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleUpload} />
            <div style={{ fontSize: 20, marginBottom: 4 }}>📷</div>
            <div style={{ color: '#6b7280', fontSize: 11 }}>{uploading ? 'Yükleniyor...' : 'Fotoğraf Ekle'}</div>
          </label>

          {resimler.length === 0 ? (
            <div style={{ color: '#4b5563', textAlign: 'center', fontSize: 12, padding: '16px 0' }}>Henüz fotoğraf yok</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6 }}>
              {resimler.map((f: any) => (
                <div key={f.id} onClick={() => setLightbox(`/uploads/${f.dosya_yolu}`)}
                  style={{
                    aspectRatio: '1', borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                    background: 'rgba(255,255,255,.06)', position: 'relative',
                  }}
                >
                  <img src={`/uploads/${f.thumbnail_yolu || f.dosya_yolu}`} alt={f.aciklama || f.dosya_adi}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  {f.aciklama && (
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: 'linear-gradient(transparent,rgba(0,0,0,.7))',
                      padding: '8px 6px 4px', fontSize: 9, color: '#fff',
                    }}>{f.aciklama}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, cursor: 'zoom-out',
        }}>
          <img src={lightbox} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}

// ─── GÜNLÜK RAPOR TAB ────────────────────────────────────────────────────────
const HAVA_IKON: Record<string, string> = {
  acik: '☀️', bulutlu: '⛅', yagmurlu: '🌧️', karli: '❄️', sisli: '🌫️', ruzgarli: '💨'
}

const initGunluk = {
  tarih: new Date().toISOString().slice(0, 10),
  baslik: '',
  icerik: '',
  hava_durumu: 'acik',
  sicaklik: '',
  sahada_personel: '0',
  sahada_ekipman: '0',
  fiziksel_ilerleme: '',
  gecikme_var_mi: false,
  gecikme_nedeni: '',
  risk_notu: '',
  is_kalemi: '',
}

// ─── GÜNLÜK FOTOĞRAF SATIRI ───────────────────────────────────────────────────
const GunlukFotoRow: React.FC<{ gunlukId: string }> = ({ gunlukId }) => {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const { data } = useQuery({
    queryKey: ['gunluk-foto', gunlukId],
    queryFn: () => gunlukApi.getFotolar(gunlukId).then(r => r.data.data ?? []) as Promise<Array<{ id: string; thumbnail_yolu: string; dosya_yolu: string }>>,
    staleTime: 60_000,
  })
  const fotolar = data ?? []

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      await gunlukApi.uploadFotolar(gunlukId, files)
      toast.success(`${files.length} fotoğraf yüklendi`)
      qc.invalidateQueries({ queryKey: ['gunluk-foto', gunlukId] })
    } catch {
      toast.error('Fotoğraf yüklenemedi')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {fotolar.map(f => (
        <a key={f.id} href={f.dosya_yolu} target="_blank" rel="noreferrer">
          <img
            src={f.thumbnail_yolu}
            alt=""
            style={{ width: 56, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(255,255,255,.1)', cursor: 'pointer' }}
            onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
          />
        </a>
      ))}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        style={{
          background: 'rgba(245,158,11,.1)', color: '#f59e0b',
          border: '1px dashed rgba(245,158,11,.4)', borderRadius: 6,
          padding: '4px 10px', cursor: 'pointer', fontSize: 12,
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        {uploading ? '⏳' : '📷'} {uploading ? 'Yükleniyor...' : 'Fotoğraf Ekle'}
      </button>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
    </div>
  )
}

const GunlukRaporTab: React.FC<{ santiyeId: string }> = ({ santiyeId }) => {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(initGunluk)

  const { data, isLoading } = useQuery({
    queryKey: ['gunlukler', santiyeId],
    queryFn: () => gunlukApi.list(santiyeId).then(r => r.data.data ?? [])
  })
  const gunlukler: SantiyeGunluk[] = (data as SantiyeGunluk[] | undefined) || []

  const mut = useMutation({
    mutationFn: () => gunlukApi.create(santiyeId, {
      ...form,
      sicaklik: form.sicaklik ? Number(form.sicaklik) : null,
      sahada_personel: Number(form.sahada_personel),
      sahada_ekipman: Number(form.sahada_ekipman),
      fiziksel_ilerleme: form.fiziksel_ilerleme ? Number(form.fiziksel_ilerleme) : null,
    }),
    onSuccess: () => {
      toast.success('Günlük rapor kaydedildi')
      qc.invalidateQueries({ queryKey: ['gunlukler', santiyeId] })
      qc.invalidateQueries({ queryKey: ['santiye', santiyeId] })
      setModal(false)
      setForm({ ...initGunluk, tarih: new Date().toISOString().slice(0, 10) })
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  })

  const silMut = useMutation({
    mutationFn: (id: string) => gunlukApi.delete(id),
    onSuccess: () => { toast.success('Silindi'); qc.invalidateQueries({ queryKey: ['gunlukler', santiyeId] }) },
  })

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>Saha Günlük Raporları</div>
        <Button onClick={() => setModal(true)}>+ Günlük Rapor Ekle</Button>
      </div>

      {gunlukler.length === 0 ? (
        <EmptyState icon="📋" title="Henüz günlük rapor yok"
          sub="Her gün saha durumunu, hava koşullarını ve ilerlemeyi kaydedin"
          action={<Button onClick={() => setModal(true)}>İlk Raporu Ekle</Button>}
        />
      ) : (
        <div>
          {gunlukler.map(g => (
            <div key={g.id} style={{
              background: 'rgba(255,255,255,.03)', border: `1px solid ${g.gecikme_var_mi ? 'rgba(239,68,68,.3)' : 'rgba(255,255,255,.07)'}`,
              borderRadius: 12, padding: 16, marginBottom: 12,
            }}>
              {/* Başlık satırı */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 22 }}>{g.hava_durumu ? HAVA_IKON[g.hava_durumu] : '📋'}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>
                        {g.baslik || new Date(g.tarih).toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: 11 }}>
                        {fmtTarih(g.tarih)} &nbsp;•&nbsp; {g.ekleyen_adi}
                        {g.sicaklik != null && ` &nbsp;•&nbsp; ${g.sicaklik}°C`}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ background: 'rgba(0,212,170,.1)', color: '#00d4aa', borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>
                    👷 {g.sahada_personel} kişi
                  </span>
                  <span style={{ background: 'rgba(96,165,250,.1)', color: '#60a5fa', borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>
                    🚛 {g.sahada_ekipman} ekipman
                  </span>
                  {g.fiziksel_ilerleme != null && (
                    <span style={{ background: 'rgba(167,139,250,.1)', color: '#a78bfa', borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>
                      %{g.fiziksel_ilerleme} tamamlandı
                    </span>
                  )}
                  {g.gecikme_var_mi && (
                    <span style={{ background: 'rgba(239,68,68,.1)', color: '#ef4444', borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>
                      ⚠️ Gecikme
                    </span>
                  )}
                  <button onClick={() => silMut.mutate(g.id)} style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: 13 }}>✕</button>
                </div>
              </div>

              {/* Notlar */}
              {g.icerik && <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6, lineHeight: 1.5 }}>{g.icerik}</div>}
              {g.is_kalemi && <div style={{ color: '#60a5fa', fontSize: 11 }}>🔨 {g.is_kalemi}</div>}

              {/* Risk / gecikme notu */}
              {g.gecikme_nedeni && (
                <div style={{ background: 'rgba(239,68,68,.06)', borderRadius: 6, padding: '6px 10px', marginTop: 8, fontSize: 11, color: '#f87171' }}>
                  Gecikme: {g.gecikme_nedeni}
                </div>
              )}
              {g.risk_notu && (
                <div style={{ background: 'rgba(245,158,11,.06)', borderRadius: 6, padding: '6px 10px', marginTop: 6, fontSize: 11, color: '#f59e0b' }}>
                  Risk: {g.risk_notu}
                </div>
              )}

              {/* Fotoğraf satırı */}
              <GunlukFotoRow gunlukId={g.id} />
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Günlük Saha Raporu">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormInput label="Tarih *" value={form.tarih} onChange={v => setForm(p => ({ ...p, tarih: v }))} type="date" />
            <FormInput label="Başlık" value={form.baslik} onChange={v => setForm(p => ({ ...p, baslik: v }))} placeholder="Ör: Temel beton dökümü" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormInput label="Hava Durumu" value={form.hava_durumu} onChange={v => setForm(p => ({ ...p, hava_durumu: v }))}
              options={[{value:'acik',label:'☀️ Açık'},{value:'bulutlu',label:'⛅ Bulutlu'},{value:'yagmurlu',label:'🌧️ Yağmurlu'},{value:'karli',label:'❄️ Karlı'},{value:'sisli',label:'🌫️ Sisli'},{value:'ruzgarli',label:'💨 Rüzgarlı'}]} />
            <FormInput label="Sıcaklık (°C)" value={form.sicaklik} onChange={v => setForm(p => ({ ...p, sicaklik: v }))} type="number" placeholder="Ör: 18" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <FormInput label="Sahada Personel" value={form.sahada_personel} onChange={v => setForm(p => ({ ...p, sahada_personel: v }))} type="number" />
            <FormInput label="Sahada Ekipman" value={form.sahada_ekipman} onChange={v => setForm(p => ({ ...p, sahada_ekipman: v }))} type="number" />
            <FormInput label="Fiziksel İlerleme %" value={form.fiziksel_ilerleme} onChange={v => setForm(p => ({ ...p, fiziksel_ilerleme: v }))} type="number" placeholder="0-100" />
          </div>
          <FormInput label="Bugün Yapılan İşler" value={form.is_kalemi} onChange={v => setForm(p => ({ ...p, is_kalemi: v }))} placeholder="Ör: B2 kat kolonları kalıba alındı" />
          <FormInput label="Genel Notlar" value={form.icerik} onChange={v => setForm(p => ({ ...p, icerik: v }))} placeholder="Gün özeti, gözlemler..." />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="gecikme" checked={form.gecikme_var_mi}
              onChange={e => setForm(p => ({ ...p, gecikme_var_mi: e.target.checked }))} />
            <label htmlFor="gecikme" style={{ color: '#f87171', fontSize: 12, fontWeight: 600 }}>⚠️ Gecikme var</label>
          </div>
          {form.gecikme_var_mi && (
            <FormInput label="Gecikme Nedeni" value={form.gecikme_nedeni} onChange={v => setForm(p => ({ ...p, gecikme_nedeni: v }))} placeholder="Ör: Beton temin edilemedi" />
          )}
          <FormInput label="Risk Notu" value={form.risk_notu} onChange={v => setForm(p => ({ ...p, risk_notu: v }))} placeholder="Ör: Yağış devam ederse yüzey kaplama ertelenecek" />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setModal(false)}>Vazgeç</Button>
            <Button onClick={() => mut.mutate()} loading={mut.isPending}>Raporu Kaydet</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── FOTOĞRAFLAR TAB ─────────────────────────────────────────────────────────
const FotograflarTab: React.FC<{ santiyeId: string }> = ({ santiyeId }) => {
  const qc = useQueryClient()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const { data } = useQuery({
    queryKey: ['fotograflar', santiyeId],
    queryFn: () => import('@/services/api').then(m => m.fotografApi.list(santiyeId).then(r => r.data.data))
  })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    setUploading(true)
    try {
      const fd = new FormData()
      Array.from(e.target.files).forEach(f => fd.append('fotograflar', f))
      await import('@/services/api').then(m => m.fotografApi.upload(santiyeId, fd))
      qc.invalidateQueries({ queryKey: ['fotograflar', santiyeId] })
      toast.success('Fotoğraflar yüklendi!')
    } catch { toast.error('Yükleme başarısız') }
    finally { setUploading(false) }
  }

  return (
    <div>
      <label style={{
        border: '2px dashed rgba(255,255,255,.1)', borderRadius: 12, padding: 28,
        textAlign: 'center', cursor: 'pointer', display: 'block', marginBottom: 16,
        transition: 'all .2s'
      }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = '#00d4aa')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)')}
      >
        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleUpload} />
        <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
        <div style={{ color: '#6b7280', fontSize: 13 }}>
          {uploading ? 'Yükleniyor...' : 'Fotoğraf yüklemek için tıklayın'}
        </div>
        <div style={{ color: '#4b5563', fontSize: 11, marginTop: 3 }}>JPG, PNG, HEIC</div>
      </label>

      {data?.length === 0 ? (
        <EmptyState icon="📷" title="Henüz fotoğraf yok" sub="Sahadan ilk fotoğrafı yükleyin" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10 }}>
          {(data || []).map((f: any) => (
            <div key={f.id} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,.08)' }}>
              <img src={f.thumbnail_yolu || f.dosya_yolu} alt={f.aciklama || f.dosya_adi}
                style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <div style={{ padding: '7px 9px', background: 'rgba(0,0,0,.4)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.aciklama || f.dosya_adi}
                </div>
                <div style={{ fontSize: 10, color: '#6b7280' }}>{fmtTarih(f.olusturuldu)} • {f.yukleyen_adi}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// HAKEDİŞLER
// ═══════════════════════════════════════════════════════════════════════════
export const Hakedisler: React.FC = () => {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [modal, setModal] = useState(false)
  const { data, isLoading } = useQuery({ queryKey: ['hakedisler'], queryFn: () => hakedisApi.list().then(r => r.data) })
  const hakedisler: Hakedis[] = data?.data || []

  const onayla = useMutation({
    mutationFn: ({ id, durum }: { id: string; durum: string }) =>
      hakedisApi.onayla(id, { yeni_durum: durum }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hakedisler'] }); toast.success('Hakediş güncellendi') },
    onError: () => toast.error('İşlem başarısız'),
  })

  const faturaOlusturMut = useMutation({
    mutationFn: (id: string) => hakedisApi.faturaOlustur(id),
    onSuccess: (res) => {
      toast.success('Fatura taslağı oluşturuldu')
      qc.invalidateQueries({ queryKey: ['hakedisler'] })
      qc.invalidateQueries({ queryKey: ['faturalar'] })
      if (res.data?.data?.id) navigate('/faturalar')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Fatura oluşturulamadı'),
  })

  const bekleyen = hakedisler.filter(h => !['onaylandi','odendi'].includes(h.durum))
  const bekleyenTutar = bekleyen.reduce((s, h) => s + h.toplam_tutar, 0)
  const tahsilEdilen = hakedisler.filter(h => h.durum === 'odendi').reduce((s, h) => s + h.toplam_tutar, 0)
  const onaylandi = hakedisler.filter(h => h.durum === 'onaylandi')

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>

  return (
    <div>
      <PageHeader title="Hakediş Yönetimi" action={<Button onClick={() => setModal(true)}>+ Yeni Hakediş</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 16 }}>
        <KpiCard label="Bekleyen Tahsilat" value={fmtTL(bekleyenTutar)} sub={`${bekleyen.length} kalem`} color="#f59e0b" />
        <KpiCard label="Fatura Bekliyor" value={`${onaylandi.filter(h => !h.fatura_id).length}`} sub="onaylı, faturasız" color="#6366f1" />
        <KpiCard label="Tahsil Edilen" value={fmtTL(tahsilEdilen)} color="#00d4aa" />
      </div>

      {/* Fatura oluşturulacaklar bandı */}
      {onaylandi.filter(h => !h.fatura_id).length > 0 && (
        <div style={{ background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.25)', borderRadius: 10, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>📋</span>
          <span style={{ color: '#a5b4fc', fontSize: 13 }}>
            {onaylandi.filter(h => !h.fatura_id).length} onaylı hakediş için fatura oluşturulmayı bekliyor
          </span>
        </div>
      )}

      <Card noPad>
        <Table
          columns={[
            { key: 'no', label: 'Hakediş No', render: r => <span style={{ fontWeight: 700 }}>{r.no}</span> },
            { key: 'santiye_adi', label: 'Şantiye', render: r => <span style={{ color: '#94a3b8' }}>{(r.santiye_adi || '').split(' ').slice(0,3).join(' ')}</span> },
            { key: 'donem_bitis', label: 'Tarih', render: r => fmtTarih(r.donem_bitis) },
            { key: 'toplam_tutar', label: 'Tutar', render: r => <span style={{ color: '#60a5fa', fontWeight: 700 }}>{fmtTL(r.toplam_tutar)}</span> },
            { key: 'durum', label: 'Durum', render: r => <Badge text={r.durum} /> },
            { key: 'fatura', label: 'Fatura', render: r => r.fatura_id
              ? <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 600 }}>✓ Kesildi</span>
              : r.durum === 'onaylandi'
                ? <span style={{ color: '#f59e0b', fontSize: 12 }}>Bekliyor</span>
                : <span style={{ color: '#475569', fontSize: 12 }}>—</span>
            },
            { key: 'actions', label: 'İşlem', render: r => (
              <div style={{ display: 'flex', gap: 6 }}>
                {r.durum === 'gonderildi' && (
                  <Button size="sm" onClick={() => onayla.mutate({ id: r.id, durum: 'onaylandi' })}>Onayla</Button>
                )}
                {r.durum === 'onaylandi' && !r.fatura_id && (
                  <Button size="sm" variant="secondary"
                    loading={faturaOlusturMut.isPending}
                    onClick={() => faturaOlusturMut.mutate(r.id)}>
                    Fatura Oluştur
                  </Button>
                )}
                {r.durum === 'onaylandi' && r.fatura_id && (
                  <Button size="sm" variant="secondary" onClick={() => navigate('/faturalar')}>Faturaya Git</Button>
                )}
              </div>
            )}
          ]}
          data={hakedisler}
          emptyText="Henüz hakediş yok"
        />
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} title="Yeni Hakediş">
        <YeniHakedisForm onClose={() => { setModal(false); qc.invalidateQueries({ queryKey: ['hakedisler'] }) }} />
      </Modal>
    </div>
  )
}

const YeniHakedisForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { data: sData } = useQuery({ queryKey: ['santiyeler'], queryFn: () => santiyeApi.list().then(r => r.data.data) })
  const santiyeler: Santiye[] = sData || []
  const [f, setF] = useState({ santiye_id: '', no: '', tip: 'ara', donem_baslangic: '', donem_bitis: '', tutar: '', notlar: '' })

  const mut = useMutation({
    mutationFn: () => hakedisApi.create({ ...f, tutar: Number(f.tutar) }),
    onSuccess: () => { toast.success('Hakediş oluşturuldu'); onClose() },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  })

  return (
    <div>
      <FormInput label="Şantiye" value={f.santiye_id} onChange={v => setF(p => ({ ...p, santiye_id: v }))}
        options={[{ value: '', label: 'Seçiniz' }, ...santiyeler.map(s => ({ value: s.id, label: s.ad }))]} required />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormInput label="Hakediş No" value={f.no} onChange={v => setF(p => ({ ...p, no: v }))} required />
        <FormInput label="Tip" value={f.tip} onChange={v => setF(p => ({ ...p, tip: v }))}
          options={[{value:'ara',label:'Ara'},{value:'kesin',label:'Kesin'},{value:'ek_is',label:'Ek İş'},{value:'fiyat_farki',label:'Fiyat Farkı'}]} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormInput label="Dönem Başlangıç" value={f.donem_baslangic} onChange={v => setF(p => ({ ...p, donem_baslangic: v }))} type="date" required />
        <FormInput label="Dönem Bitiş" value={f.donem_bitis} onChange={v => setF(p => ({ ...p, donem_bitis: v }))} type="date" required />
      </div>
      <FormInput label="Tutar (TL)" value={f.tutar} onChange={v => setF(p => ({ ...p, tutar: v }))} type="number" required />
      <FormInput label="Notlar" value={f.notlar} onChange={v => setF(p => ({ ...p, notlar: v }))} />
      <Button onClick={() => mut.mutate()} loading={mut.isPending} style={{ width: '100%', justifyContent: 'center' }}>
        Hakediş Oluştur
      </Button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SATIN ALMA
// ═══════════════════════════════════════════════════════════════════════════
export const Satinalma: React.FC = () => {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const { data, isLoading } = useQuery({ queryKey: ['satinalma'], queryFn: () => satinalmaApi.list().then(r => r.data) })
  const talepler: SatinalmaTalep[] = data?.data || []
  const ozet = data?.ozet

  const onayla = useMutation({
    mutationFn: ({ id, durum }: { id: string; durum: string }) => satinalmaApi.onayla(id, durum),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['satinalma'] }); toast.success('Talep güncellendi') },
  })

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>

  return (
    <div>
      <PageHeader title="Satın Alma & Tedarik" action={<Button onClick={() => setModal(true)}>+ Talep Oluştur</Button>} />
      {ozet?.onay_bekleyen > 0 && (
        <div style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, color: '#f59e0b', fontSize: 12 }}>
          ⚠️ {ozet.onay_bekleyen} talep onay bekliyor — Toplam: {fmtTL(ozet.bekleyen_tutar)}
        </div>
      )}
      <Card noPad>
        <Table
          columns={[
            { key: 'talep_no', label: 'Talep No', render: r => <span style={{ fontWeight: 700, color: r.acil_mi ? '#ef4444' : '#f1f5f9' }}>{r.acil_mi ? '🔴 ' : ''}{r.talep_no}</span> },
            { key: 'malzeme_adi', label: 'Malzeme', render: r => <span>{r.malzeme_adi}</span> },
            { key: 'santiye_adi', label: 'Şantiye', render: r => <span style={{ color: '#94a3b8', fontSize: 11 }}>{(r.santiye_adi || '').split(' ').slice(0,2).join(' ')}</span> },
            { key: 'toplam_tahmini', label: 'Tutar', render: r => <span style={{ color: '#60a5fa', fontWeight: 700 }}>{r.toplam_tahmini ? fmtTL(r.toplam_tahmini) : '—'}</span> },
            { key: 'durum', label: 'Durum', render: r => <Badge text={r.durum} /> },
            { key: 'actions', label: 'İşlem', render: r => (
              r.durum === 'onay_bekliyor' ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button size="sm" onClick={() => onayla.mutate({ id: r.id, durum: 'onaylandi' })}>Onayla</Button>
                  <Button size="sm" variant="danger" onClick={() => onayla.mutate({ id: r.id, durum: 'iptal' })}>İptal</Button>
                </div>
              ) : r.durum === 'onaylandi' ? (
                <Button size="sm" variant="secondary" onClick={() => onayla.mutate({ id: r.id, durum: 'siparis' })}>Siparişe Al</Button>
              ) : r.durum === 'siparis' ? (
                <Button size="sm" variant="secondary" onClick={() => onayla.mutate({ id: r.id, durum: 'teslim_edildi' })}>Teslim Alındı</Button>
              ) : null
            )}
          ]}
          data={talepler}
          emptyText="Henüz satın alma talebi yok"
        />
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} title="Satın Alma Talebi">
        <YeniSatinalmaForm onClose={() => { setModal(false); qc.invalidateQueries({ queryKey: ['satinalma'] }) }} />
      </Modal>
    </div>
  )
}

const YeniSatinalmaForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { data: sData } = useQuery({ queryKey: ['santiyeler'], queryFn: () => santiyeApi.list().then(r => r.data.data) })
  const santiyeler: Santiye[] = sData || []
  const [f, setF] = useState({ santiye_id: '', malzeme_adi: '', miktar: '', birim: 'm³', tahmini_fiyat: '', tedarikci: '', acil_mi: false, notlar: '' })

  const mut = useMutation({
    mutationFn: () => satinalmaApi.create({ ...f, miktar: Number(f.miktar), tahmini_fiyat: f.tahmini_fiyat ? Number(f.tahmini_fiyat) : undefined }),
    onSuccess: () => { toast.success('Talep oluşturuldu'); onClose() },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  })

  return (
    <div>
      <FormInput label="Şantiye" value={f.santiye_id} onChange={v => setF(p => ({ ...p, santiye_id: v }))}
        options={[{ value: '', label: 'Seçiniz' }, ...santiyeler.map(s => ({ value: s.id, label: s.ad }))]} required />
      <FormInput label="Malzeme Adı" value={f.malzeme_adi} onChange={v => setF(p => ({ ...p, malzeme_adi: v }))} required />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: 10 }}>
        <FormInput label="Miktar" value={f.miktar} onChange={v => setF(p => ({ ...p, miktar: v }))} type="number" required />
        <FormInput label="Birim" value={f.birim} onChange={v => setF(p => ({ ...p, birim: v }))}
          options={['m³','ton','adet','metre','kg','m²'].map(b => ({ value: b, label: b }))} />
        <FormInput label="Birim Fiyat (TL)" value={f.tahmini_fiyat} onChange={v => setF(p => ({ ...p, tahmini_fiyat: v }))} type="number" />
      </div>
      <FormInput label="Tedarikçi" value={f.tedarikci} onChange={v => setF(p => ({ ...p, tedarikci: v }))} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <input type="checkbox" checked={f.acil_mi} onChange={e => setF(p => ({ ...p, acil_mi: e.target.checked }))} id="acil" />
        <label htmlFor="acil" style={{ color: '#f59e0b', fontSize: 12, fontWeight: 600 }}>🔴 Acil talep</label>
      </div>
      <Button onClick={() => mut.mutate()} loading={mut.isPending} style={{ width: '100%', justifyContent: 'center' }}>
        Talep Oluştur
      </Button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// EKİPMANLAR
// ═══════════════════════════════════════════════════════════════════════════
export const Ekipmanlar: React.FC = () => {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const { data, isLoading } = useQuery({ queryKey: ['ekipmanlar'], queryFn: () => ekipmanApi.list().then(r => r.data) })
  const ekipmanlar: Ekipman[] = data?.data || []
  const uyari = data?.uyari_sayisi || 0

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>

  return (
    <div>
      <PageHeader title="Ekipman & Makine Yönetimi" sub={`${ekipmanlar.length} ekipman`}
        action={<Button onClick={() => setModal(true)}>+ Ekipman Ekle</Button>} />
      {uyari > 0 && (
        <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, color: '#ef4444', fontSize: 12 }}>
          🔧 {uyari} ekipmanın bakım tarihi yaklaşıyor
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
        {ekipmanlar.map(e => (
          <Card key={e.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{e.ad}</div>
              <Badge text={e.durum} />
            </div>
            <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>🚗 {e.plaka} &nbsp;•&nbsp; <Badge text={e.tip} /></div>
            <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 10 }}>📍 {e.santiye_il || '—'} — {(e.santiye_adi || '').split(' ').slice(0,2).join(' ')}</div>
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ color: '#6b7280', fontSize: 10 }}>Verimlilik</span>
                <span style={{ fontSize: 11, fontWeight: 700 }}>%{e.verimlilik}</span>
              </div>
              <ProgressBar value={e.verimlilik} />
            </div>
            {e.sonraki_bakim && (
              <div style={{ color: '#f59e0b', fontSize: 10 }}>🔧 Sonraki Bakım: {fmtTarih(e.sonraki_bakim)}</div>
            )}
          </Card>
        ))}
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title="Ekipman Ekle">
        <YeniEkipmanForm onClose={() => { setModal(false); qc.invalidateQueries({ queryKey: ['ekipmanlar'] }) }} />
      </Modal>
    </div>
  )
}

const YeniEkipmanForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { data: sData } = useQuery({ queryKey: ['santiyeler'], queryFn: () => santiyeApi.list().then(r => r.data.data) })
  const santiyeler: Santiye[] = sData || []
  const [f, setF] = useState({ santiye_id: '', ad: '', tip: 'ozmal', kategori: '', marka: '', model: '', plaka: '' })

  const mut = useMutation({
    mutationFn: () => ekipmanApi.create(f),
    onSuccess: () => { toast.success('Ekipman eklendi'); onClose() },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  })

  return (
    <div>
      <FormInput label="Şantiye" value={f.santiye_id} onChange={v => setF(p => ({ ...p, santiye_id: v }))}
        options={[{value:'',label:'Seçiniz'},...santiyeler.map(s => ({value:s.id,label:s.ad}))]} />
      <FormInput label="Ekipman Adı *" value={f.ad} onChange={v => setF(p => ({ ...p, ad: v }))} placeholder="Ör: CAT 320 Ekskavatör" required />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormInput label="Tip" value={f.tip} onChange={v => setF(p => ({ ...p, tip: v }))}
          options={[{value:'ozmal',label:'Öz Mal'},{value:'kiralik',label:'Kiralık'},{value:'leasin',label:'Leasing'}]} />
        <FormInput label="Kategori" value={f.kategori} onChange={v => setF(p => ({ ...p, kategori: v }))} placeholder="Ör: İş Makinesi" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <FormInput label="Marka" value={f.marka} onChange={v => setF(p => ({ ...p, marka: v }))} />
        <FormInput label="Model" value={f.model} onChange={v => setF(p => ({ ...p, model: v }))} />
        <FormInput label="Plaka" value={f.plaka} onChange={v => setF(p => ({ ...p, plaka: v }))} />
      </div>
      <Button onClick={() => mut.mutate()} loading={mut.isPending} style={{ width: '100%', justifyContent: 'center' }}>
        Ekipman Ekle
      </Button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PERSONEL
// ═══════════════════════════════════════════════════════════════════════════
export const Personel: React.FC = () => {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const { data, isLoading } = useQuery({ queryKey: ['personel'], queryFn: () => personelApi.list().then(r => r.data) })
  const personeller: PersonelType[] = data?.data || []
  const toplam = personeller.length
  const toplamMaas = personeller.reduce((s, p) => s + (p.maas || 0), 0)

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>

  return (
    <div>
      <PageHeader title="Personel Yönetimi" action={<Button onClick={() => setModal(true)}>+ Personel Ekle</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <KpiCard label="Toplam Personel" value={toplam} sub="yönetici kadro" color="#a78bfa" />
        <KpiCard label="Aylık Maaş Gideri" value={fmtTL(toplamMaas)} color="#60a5fa" />
      </div>
      <Card noPad>
        <Table
          columns={[
            { key: 'ad', label: 'Ad Soyad', render: r => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor(r.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {initials(r.ad, r.soyad)}
                </div>
                <span style={{ fontWeight: 600 }}>{r.ad} {r.soyad}</span>
              </div>
            )},
            { key: 'gorev', label: 'Görev', render: r => <span style={{ color: '#94a3b8' }}>{r.gorev}</span> },
            { key: 'santiye_adi', label: 'Şantiye', render: r => <span style={{ color: '#6b7280', fontSize: 11 }}>{r.santiye_adi || '—'}</span> },
            { key: 'ise_giris', label: 'Giriş', render: r => fmtTarih(r.ise_giris) },
            { key: 'durum', label: 'Durum', render: r => <Badge text={r.durum} /> },
            { key: 'maas', label: 'Maaş', render: r => <span style={{ color: '#00d4aa', fontWeight: 700 }}>₺{fmtSayi(r.maas || 0)}</span> },
          ]}
          data={personeller}
          emptyText="Henüz personel kaydı yok"
        />
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} title="Personel Ekle">
        <YeniPersonelForm onClose={() => { setModal(false); qc.invalidateQueries({ queryKey: ['personel'] }) }} />
      </Modal>
    </div>
  )
}

const YeniPersonelForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { data: sData } = useQuery({ queryKey: ['santiyeler'], queryFn: () => santiyeApi.list().then(r => r.data.data) })
  const santiyeler: Santiye[] = sData || []
  const [f, setF] = useState({ santiye_id: '', ad: '', soyad: '', gorev: '', telefon: '', ise_giris: new Date().toISOString().slice(0,10), maas: '', maas_turu: 'aylik' })

  const mut = useMutation({
    mutationFn: () => personelApi.create({ ...f, maas: f.maas ? Number(f.maas) : null }),
    onSuccess: () => { toast.success('Personel eklendi'); onClose() },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  })

  return (
    <div>
      <FormInput label="Şantiye" value={f.santiye_id} onChange={v => setF(p => ({ ...p, santiye_id: v }))}
        options={[{value:'',label:'Seçiniz'},...santiyeler.map(s => ({value:s.id,label:s.ad}))]} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormInput label="Ad *" value={f.ad} onChange={v => setF(p => ({ ...p, ad: v }))} required />
        <FormInput label="Soyad *" value={f.soyad} onChange={v => setF(p => ({ ...p, soyad: v }))} required />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormInput label="Görev *" value={f.gorev} onChange={v => setF(p => ({ ...p, gorev: v }))} placeholder="Ör: Şef Mühendis" required />
        <FormInput label="Telefon" value={f.telefon} onChange={v => setF(p => ({ ...p, telefon: v }))} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <FormInput label="İşe Giriş" value={f.ise_giris} onChange={v => setF(p => ({ ...p, ise_giris: v }))} type="date" />
        <FormInput label="Maaş (TL)" value={f.maas} onChange={v => setF(p => ({ ...p, maas: v }))} type="number" />
        <FormInput label="Maaş Türü" value={f.maas_turu} onChange={v => setF(p => ({ ...p, maas_turu: v }))}
          options={[{value:'aylik',label:'Aylık'},{value:'gunluk',label:'Günlük'},{value:'saatlik',label:'Saatlik'}]} />
      </div>
      <Button onClick={() => mut.mutate()} loading={mut.isPending} style={{ width: '100%', justifyContent: 'center' }}>
        Personel Ekle
      </Button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// NAKİT AKIŞ
// ═══════════════════════════════════════════════════════════════════════════
export const NakitAkis: React.FC = () => {
  const qc = useQueryClient()
  const [yil] = useState(new Date().getFullYear().toString())
  const [modal, setModal] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['nakit-analiz', yil],
    queryFn: () => nakitApi.analiz({ yil }).then(r => r.data.data)
  })

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>
  if (!data) return <EmptyState icon="💰" title="Veri yüklenemedi" />

  const { ytd, aylik, tahminler, santiyeler: santiyeNakit } = data
  const ayAdlari = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']

  return (
    <div>
      <PageHeader title="Nakit Akış Yönetimi" sub={`${yil} yılı`}
        action={<Button onClick={() => setModal(true)}>+ Hareket Ekle</Button>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        <KpiCard label="Toplam Tahsilat (YTD)" value={fmtTL(ytd?.toplam_tahsilat || 0)} color="#00d4aa" />
        <KpiCard label="Toplam Gider (YTD)" value={fmtTL(ytd?.toplam_gider || 0)} color="#ef4444" />
        <KpiCard label="Net Nakit Pozisyonu" value={fmtTL(ytd?.net_nakit || 0)} color="#60a5fa" />
      </div>

      {/* Aylık bar */}
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
              {[['#00d4aa','Tahsilat'],['#ef4444','Gider'],['#60a5fa','Net']].map(([c,l]) => (
                <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6b7280' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block' }} />{l}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* 6 aylık tahmin */}
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
    santiye_id: '', tarih: new Date().toISOString().slice(0,10),
    tip: 'giris', kategori: '', aciklama: '', tutar: '', belge_no: ''
  })

  const KATEGORILER_GIRIS = ['Hakediş Tahsilatı','Avans','Teminat Geliri','Diğer']
  const KATEGORILER_CIKIS = ['Malzeme','İşçilik','Ekipman Kirası','Taşeron','Genel Gider','KDV Ödemesi','SGK','Diğer']

  const mut = useMutation({
    mutationFn: () => nakitApi.create({ ...f, tutar: Number(f.tutar), tutar_try: Number(f.tutar) }),
    onSuccess: () => { toast.success('Hareket eklendi'); onClose() },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  })

  return (
    <div>
      <FormInput label="Şantiye" value={f.santiye_id} onChange={v => setF(p => ({ ...p, santiye_id: v }))}
        options={[{value:'',label:'Genel (Şantiyesiz)'},...santiyeler.map(s => ({value:s.id,label:s.ad}))]} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormInput label="Tarih *" value={f.tarih} onChange={v => setF(p => ({ ...p, tarih: v }))} type="date" />
        <FormInput label="Tip" value={f.tip} onChange={v => setF(p => ({ ...p, tip: v, kategori: '' }))}
          options={[{value:'giris',label:'💰 Tahsilat/Giriş'},{value:'cikis',label:'💸 Ödeme/Çıkış'}]} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormInput label="Kategori *" value={f.kategori} onChange={v => setF(p => ({ ...p, kategori: v }))}
          options={[{value:'',label:'Seçiniz'},...(f.tip === 'giris' ? KATEGORILER_GIRIS : KATEGORILER_CIKIS).map(k => ({value:k,label:k}))]} />
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

// ═══════════════════════════════════════════════════════════════════════════
// FİNANS
// ═══════════════════════════════════════════════════════════════════════════
export const Finans: React.FC = () => {
  const { data: sData, isLoading } = useQuery({ queryKey: ['santiyeler'], queryFn: () => santiyeApi.list().then(r => r.data.data) })
  const santiyeler: Santiye[] = sData || []
  const totS = santiyeler.reduce((s, x) => s + x.sozlesme_bedel, 0)
  const totG = santiyeler.reduce((s, x) => s + x.gerceklesen, 0)
  const pct = totS > 0 ? Math.round(totG / totS * 100) : 0

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>

  return (
    <div>
      <PageHeader title="Finans – Proje Mali Durum" />
      <Card noPad>
        <Table
          columns={[
            { key: 'ad', label: 'Proje', render: r => (
              <div>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{r.ad.split(' ').slice(0,3).join(' ')}</div>
                <div style={{ color: '#6b7280', fontSize: 10 }}>{r.il}</div>
              </div>
            )},
            { key: 'sozlesme_bedel', label: 'Sözleşme', render: r => <span style={{ color: '#94a3b8' }}>{fmtTL(r.sozlesme_bedel)}</span> },
            { key: 'gerceklesen', label: 'Gerçekleşen', render: r => <span style={{ color: '#00d4aa', fontWeight: 700 }}>{fmtTL(r.gerceklesen)}</span> },
            { key: 'kalan', label: 'Kalan', render: r => <span style={{ color: '#60a5fa' }}>{fmtTL(r.sozlesme_bedel - r.gerceklesen)}</span> },
            { key: 'fiziksel_ilerleme', label: 'İlerleme', render: r => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
                <div style={{ flex: 1 }}><ProgressBar value={r.fiziksel_ilerleme} height={5} /></div>
                <span style={{ fontSize: 11, fontWeight: 700, minWidth: 32 }}>%{r.fiziksel_ilerleme}</span>
              </div>
            )},
            { key: 'durum', label: 'Durum', render: r => <Badge text={r.durum} /> },
          ]}
          data={santiyeler}
        />
        <div style={{ background: 'rgba(255,255,255,.04)', borderTop: '2px solid rgba(255,255,255,.12)', padding: '10px 14px', display: 'flex', gap: 40 }}>
          <span style={{ fontWeight: 800 }}>TOPLAM</span>
          <span style={{ color: '#60a5fa', fontWeight: 800 }}>{fmtTL(totS)}</span>
          <span style={{ color: '#00d4aa', fontWeight: 800 }}>{fmtTL(totG)}</span>
          <span style={{ color: '#94a3b8', fontWeight: 800 }}>{fmtTL(totS - totG)}</span>
          <span style={{ fontWeight: 800 }}>%{pct}</span>
        </div>
      </Card>
    </div>
  )
}
