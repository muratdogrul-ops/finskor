import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { taseronApi, santiyeApi } from '@/services/api'
import {
  PageHeader, Card, Badge, Button, Modal,
  FormInput, EmptyState, Spinner, Table
} from '@/components/ui'
import { fmtTL, fmtTarih } from '@/utils/format'

// ─── TIPLER ──────────────────────────────────────────────────────────────────
interface Taseron {
  id: string; ad: string; vergi_no: string; telefon: string
  email: string; yetkili: string; puan: number
  sozlesme_sayisi: number; toplam_sozlesme: number; aktif_sozlesme: number
}
interface Sozlesme {
  id: string; taseron_id: string; santiye_id: string
  sozlesme_no: string; is_tanimi: string; is_grubu: string
  sozlesme_bedeli: number; sozlesme_tarihi: string
  baslangic: string; bitis: string
  taseron_adi: string; santiye_adi: string; il: string
  durum: string; hakedis_sayisi: number
  hakedis_toplam: number; odenen_toplam: number
}
interface TaseronHakedis {
  id: string; donem_no: number; tarih: string
  sozlesme_is: number; net_odeme: number
  kdv_tutari: number; avans_kesinti: number
  durum: string; odeme_tarihi: string | null
}

type Sekme = 'taseronlar' | 'sozlesmeler' | 'puantaj'

// ─── PUAN YILDIZ ──────────────────────────────────────────────────────────────
const PuanYildiz: React.FC<{ puan: number }> = ({ puan }) => (
  <span style={{ color: '#f59e0b', fontSize: 12 }}>
    {'★'.repeat(Math.min(puan, 5))}{'☆'.repeat(Math.max(5 - puan, 0))}
  </span>
)

// ════════════════════════════════════════════════════════════════
// TAŞERONLAR SEKMESİ
// ════════════════════════════════════════════════════════════════
const TaseronlarSekme: React.FC<{ onSec: (t: Taseron) => void }> = ({ onSec }) => {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({
    ad: '', vergi_no: '', telefon: '', email: '',
    adres: '', yetkili: '', banka_adi: '', iban: '', notlar: ''
  })
  const f = (k: string) => (v: string) => setForm(p => ({ ...p, [k]: v }))

  const { data, isLoading } = useQuery({
    queryKey: ['taseronlar'],
    queryFn: () => taseronApi.list().then(r => r.data.data as Taseron[])
  })

  const create = useMutation({
    mutationFn: (d: typeof form) => taseronApi.create(d),
    onSuccess: () => {
      toast.success('Taşeron eklendi')
      qc.invalidateQueries({ queryKey: ['taseronlar'] })
      setModal(false)
      setForm({ ad: '', vergi_no: '', telefon: '', email: '', adres: '', yetkili: '', banka_adi: '', iban: '', notlar: '' })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Hata')
  })

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>

  const taseronlar = data || []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button onClick={() => setModal(true)}>+ Taşeron Ekle</Button>
      </div>

      {taseronlar.length === 0 ? (
        <EmptyState icon="🏢" title="Henüz taşeron yok"
          sub="Alt yüklenicilerinizi ekleyerek sözleşme ve hakediş takibi yapın"
          action={<Button onClick={() => setModal(true)}>Taşeron Ekle</Button>}
        />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {taseronlar.map(t => (
            <Card key={t.id} style={{ cursor: 'pointer' }}
              // @ts-ignore
              onClick={() => onSec(t)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{t.ad}</div>
                  <div style={{ color: '#6b7280', fontSize: 11, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {t.vergi_no && <span>VKN: {t.vergi_no}</span>}
                    {t.telefon && <span>📞 {t.telefon}</span>}
                    {t.yetkili && <span>👤 {t.yetkili}</span>}
                  </div>
                  <div style={{ marginTop: 6 }}><PuanYildiz puan={t.puan || 5} /></div>
                </div>
                <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#6b7280', fontSize: 10 }}>Toplam Sözleşme</div>
                    <div style={{ color: '#60a5fa', fontWeight: 700 }}>{fmtTL(t.toplam_sozlesme)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#6b7280', fontSize: 10 }}>Aktif İş</div>
                    <div style={{ color: '#00d4aa', fontWeight: 700 }}>{fmtTL(t.aktif_sozlesme)}</div>
                  </div>
                  <Badge text={String(t.sozlesme_sayisi) + ' sözleşme'} custom="blue" />
                  <span style={{ color: '#6b7280' }}>›</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Yeni Taşeron Ekle" width={580}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <FormInput label="Firma / Taşeron Adı *" value={form.ad} onChange={f('ad')} placeholder="Örn: ABC İnşaat Ltd." />
          </div>
          <FormInput label="Vergi Kimlik No" value={form.vergi_no} onChange={f('vergi_no')} placeholder="1234567890" />
          <FormInput label="Yetkili Kişi" value={form.yetkili} onChange={f('yetkili')} placeholder="Ad Soyad" />
          <FormInput label="Telefon" value={form.telefon} onChange={f('telefon')} placeholder="0532..." />
          <FormInput label="E-Posta" value={form.email} onChange={f('email')} type="email" placeholder="info@..." />
          <FormInput label="Banka Adı" value={form.banka_adi} onChange={f('banka_adi')} placeholder="Ziraat Bankası" />
          <FormInput label="IBAN" value={form.iban} onChange={f('iban')} placeholder="TR..." />
          <div style={{ gridColumn: '1 / -1' }}>
            <FormInput label="Adres" value={form.adres} onChange={f('adres')} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <Button variant="secondary" onClick={() => setModal(false)}>Vazgeç</Button>
          <Button onClick={() => create.mutate(form)} disabled={!form.ad.trim()} loading={create.isPending}>
            Kaydet
          </Button>
        </div>
      </Modal>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// SÖZLEŞMELEr SEKMESİ
// ════════════════════════════════════════════════════════════════
const SozlesmelerSekme: React.FC = () => {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [detayId, setDetayId] = useState<string | null>(null)
  const [form, setForm] = useState({
    taseron_id: '', santiye_id: '', sozlesme_no: '', is_tanimi: '',
    is_grubu: '', sozlesme_bedeli: '', sozlesme_tarihi: '',
    baslangic: '', bitis: '', odeme_vadesi: '30',
    avans_tutari: '0', kdv_orani: '20', stopaj_orani: '0',
    sgk_kesinti_oran: '0', notlar: ''
  })
  const f = (k: string) => (v: string) => setForm(p => ({ ...p, [k]: v }))

  const { data } = useQuery({
    queryKey: ['taseron-sozlesmeler'],
    queryFn: () => taseronApi.sozlesmeler().then(r => r.data.data as Sozlesme[])
  })
  const { data: taseronlarData } = useQuery({
    queryKey: ['taseronlar'],
    queryFn: () => taseronApi.list().then(r => r.data.data as Taseron[])
  })
  const { data: santiyelerData } = useQuery({
    queryKey: ['santiyeler'],
    queryFn: () => santiyeApi.list().then(r => r.data.data)
  })
  const { data: detayData } = useQuery({
    queryKey: ['taseron-sozlesme', detayId],
    queryFn: () => detayId ? taseronApi.sozlesme(detayId).then(r => r.data.data) : null,
    enabled: !!detayId
  })

  const create = useMutation({
    mutationFn: (d: Record<string, unknown>) => taseronApi.sozlesmeOlustur(d),
    onSuccess: () => {
      toast.success('Sözleşme oluşturuldu')
      qc.invalidateQueries({ queryKey: ['taseron-sozlesmeler'] })
      setModal(false)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Hata')
  })

  const sozlesmeler = data || []

  const durumRenk: Record<string, string> = {
    taslak: 'amber', devam: 'blue', tamamlandi: 'green', iptal: 'red'
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button onClick={() => setModal(true)}>+ Sözleşme Ekle</Button>
      </div>

      {sozlesmeler.length === 0 ? (
        <EmptyState icon="📋" title="Sözleşme yok"
          sub="Taşeronlarla sözleşme yaparak iş ve hakediş takibi başlatın"
          action={<Button onClick={() => setModal(true)}>Sözleşme Ekle</Button>}
        />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {sozlesmeler.map(s => (
            <Card key={s.id} style={{ cursor: 'pointer' }}
              // @ts-ignore
              onClick={() => setDetayId(s.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>
                    {s.taseron_adi}
                    {s.sozlesme_no && <span style={{ color: '#4b5563', fontWeight: 400, marginLeft: 8 }}>#{s.sozlesme_no}</span>}
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: 11 }}>{s.is_tanimi}</div>
                  <div style={{ color: '#6b7280', fontSize: 11, marginTop: 3 }}>
                    🏗️ {s.santiye_adi} ({s.il}) &nbsp;•&nbsp; {s.is_grubu || '—'}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>
                    📅 {fmtTarih(s.baslangic)} – {fmtTarih(s.bitis)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#6b7280', fontSize: 10 }}>Sözleşme</div>
                    <div style={{ color: '#60a5fa', fontWeight: 700 }}>{fmtTL(s.sozlesme_bedeli)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#6b7280', fontSize: 10 }}>Ödenen</div>
                    <div style={{ color: '#00d4aa', fontWeight: 700 }}>{fmtTL(s.odenen_toplam)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#6b7280', fontSize: 10 }}>Hakediş</div>
                    <div style={{ color: '#a78bfa', fontWeight: 700 }}>{s.hakedis_sayisi}</div>
                  </div>
                  <Badge text={s.durum} custom={durumRenk[s.durum] || 'amber'} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* YENİ SÖZLEŞME MODAL */}
      <Modal open={modal} onClose={() => setModal(false)} title="Yeni Taşeron Sözleşmesi" width={640}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FormInput label="Taşeron *" value={form.taseron_id} onChange={f('taseron_id')}
            options={[{ value: '', label: '— Seçin —' }, ...(taseronlarData || []).map((t: Taseron) => ({ value: t.id, label: t.ad }))]}
          />
          <FormInput label="Şantiye *" value={form.santiye_id} onChange={f('santiye_id')}
            options={[{ value: '', label: '— Seçin —' }, ...((santiyelerData as any[]) || []).map((s: any) => ({ value: s.id, label: `${s.ad} (${s.il})` }))]}
          />
          <div style={{ gridColumn: '1 / -1' }}>
            <FormInput label="İş Tanımı *" value={form.is_tanimi} onChange={f('is_tanimi')} placeholder="Yapılacak işin kapsamı" />
          </div>
          <FormInput label="İş Grubu" value={form.is_grubu} onChange={f('is_grubu')} placeholder="Örn: Betonarme, Elektrik..." />
          <FormInput label="Sözleşme No" value={form.sozlesme_no} onChange={f('sozlesme_no')} placeholder="SZ-2024-001" />
          <FormInput label="Sözleşme Bedeli (₺) *" value={form.sozlesme_bedeli} onChange={f('sozlesme_bedeli')} type="number" />
          <FormInput label="Sözleşme Tarihi *" value={form.sozlesme_tarihi} onChange={f('sozlesme_tarihi')} type="date" />
          <FormInput label="Ödeme Vadesi (gün)" value={form.odeme_vadesi} onChange={f('odeme_vadesi')} type="number" />
          <FormInput label="Başlangıç" value={form.baslangic} onChange={f('baslangic')} type="date" />
          <FormInput label="Bitiş" value={form.bitis} onChange={f('bitis')} type="date" />
          <FormInput label="KDV (%)" value={form.kdv_orani} onChange={f('kdv_orani')} type="number" />
          <FormInput label="Stopaj (%)" value={form.stopaj_orani} onChange={f('stopaj_orani')} type="number" />
          <FormInput label="SGK Kesinti (%)" value={form.sgk_kesinti_oran} onChange={f('sgk_kesinti_oran')} type="number" />
          <FormInput label="Avans (₺)" value={form.avans_tutari} onChange={f('avans_tutari')} type="number" />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <Button variant="secondary" onClick={() => setModal(false)}>Vazgeç</Button>
          <Button
            onClick={() => create.mutate({
              ...form,
              sozlesme_bedeli: parseFloat(form.sozlesme_bedeli) || 0,
              odeme_vadesi: parseInt(form.odeme_vadesi) || 30,
              avans_tutari: parseFloat(form.avans_tutari) || 0,
              kdv_orani: parseInt(form.kdv_orani) || 20,
              stopaj_orani: parseInt(form.stopaj_orani) || 0,
              sgk_kesinti_oran: parseInt(form.sgk_kesinti_oran) || 0,
            })}
            disabled={!form.taseron_id || !form.santiye_id || !form.is_tanimi || !form.sozlesme_bedeli}
            loading={create.isPending}
          >Sözleşme Oluştur</Button>
        </div>
      </Modal>

      {/* SÖZLEŞME DETAYI */}
      {detayId && detayData && (
        <SozlesmeDetay sozlesme={detayData} onKapat={() => setDetayId(null)} />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// SÖZLEŞME DETAYI (HAKEDİŞLER)
// ════════════════════════════════════════════════════════════════
const SozlesmeDetay: React.FC<{ sozlesme: any; onKapat: () => void }> = ({ sozlesme, onKapat }) => {
  const qc = useQueryClient()
  const [hakedisModal, setHakedisModal] = useState(false)
  const [hakedisForm, setHakedisForm] = useState({
    tarih: new Date().toISOString().split('T')[0],
    sozlesme_is: '', diger_kesinti: '0', notlar: ''
  })
  const hf = (k: string) => (v: string) => setHakedisForm(p => ({ ...p, [k]: v }))

  const { data, isLoading } = useQuery({
    queryKey: ['taseron-hakedisler', sozlesme.id],
    queryFn: () => taseronApi.hakedisler(sozlesme.id).then(r => r.data.data as TaseronHakedis[])
  })

  const createH = useMutation({
    mutationFn: (d: Record<string, unknown>) => taseronApi.hakedisOlustur(sozlesme.id, d),
    onSuccess: () => {
      toast.success('Hakediş oluşturuldu')
      qc.invalidateQueries({ queryKey: ['taseron-hakedisler', sozlesme.id] })
      qc.invalidateQueries({ queryKey: ['taseron-sozlesmeler'] })
      setHakedisModal(false)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Hata')
  })

  const onaylaH = useMutation({
    mutationFn: ({ id, odeme_tarihi }: { id: string; odeme_tarihi?: string }) =>
      taseronApi.hakedisOnayla(id, { odeme_tarihi }),
    onSuccess: () => {
      toast.success('Durum güncellendi')
      qc.invalidateQueries({ queryKey: ['taseron-hakedisler', sozlesme.id] })
    }
  })

  const hakedisler = data || []
  const toplamOdenen = hakedisler.filter(h => h.durum === 'odendi').reduce((s, h) => s + Number(h.net_odeme), 0)
  const kalan = Number(sozlesme.sozlesme_bedeli) - toplamOdenen

  const durumRenk: Record<string, string> = { taslak: 'amber', onaylandi: 'blue', odendi: 'green' }
  const durumAd: Record<string, string> = { taslak: 'Taslak', onaylandi: 'Onaylandı', odendi: 'Ödendi' }
  const sonrakiDurum: Record<string, string> = { taslak: 'Onayla', onaylandi: 'Ödendi İşaretle' }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)',
      zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end'
    }} onClick={onKapat}>
      <div style={{
        background: '#141b2d', borderLeft: '1px solid rgba(255,255,255,.1)',
        width: '100%', maxWidth: 700, height: '100%', overflowY: 'auto',
        padding: 28, display: 'flex', flexDirection: 'column', gap: 16
      }} onClick={e => e.stopPropagation()}>

        {/* Başlık */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{sozlesme.taseron_adi}</div>
            <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
              {sozlesme.is_tanimi} • {sozlesme.santiye_adi}
            </div>
          </div>
          <button onClick={onKapat} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>

        {/* KPI'lar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
          {[
            { label: 'Sözleşme', value: fmtTL(sozlesme.sozlesme_bedeli), color: '#60a5fa' },
            { label: 'Ödenen', value: fmtTL(toplamOdenen), color: '#00d4aa' },
            { label: 'Bakiye', value: fmtTL(kalan), color: kalan > 0 ? '#f59e0b' : '#10b981' },
            { label: 'Hakediş', value: hakedisler.length, color: '#a78bfa' },
          ].map(k => (
            <div key={k.label} style={{
              background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '12px 14px',
              border: '1px solid rgba(255,255,255,.07)'
            }}>
              <div style={{ color: '#6b7280', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{k.label}</div>
              <div style={{ color: k.color, fontSize: 20, fontWeight: 800, marginTop: 4 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Hakediş listesi */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Hakediş Tablosu</div>
            <Button size="sm" onClick={() => setHakedisModal(true)}>+ Hakediş Ekle</Button>
          </div>

          {isLoading ? <Spinner /> : hakedisler.length === 0 ? (
            <div style={{ color: '#4b5563', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
              Henüz hakediş yok
            </div>
          ) : (
            <div className="table-scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,.03)' }}>
                    {['Dönem', 'Tarih', 'İş Bedeli', 'KDV', 'Net Ödeme', 'Durum', ''].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,.07)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hakedisler.map(h => (
                    <tr key={h.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                      <td style={{ padding: '10px 12px', fontSize: 12 }}>{h.donem_no}. Dönem</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtTarih(h.tarih)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12 }}>{fmtTL(h.sozlesme_is)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12 }}>{fmtTL(h.kdv_tutari)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#00d4aa' }}>{fmtTL(h.net_odeme)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <Badge text={durumAd[h.durum] || h.durum} custom={durumRenk[h.durum] || 'amber'} />
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {h.durum !== 'odendi' && (
                          <Button size="sm" variant="secondary"
                            onClick={() => onaylaH.mutate({ id: h.id, odeme_tarihi: h.durum === 'onaylandi' ? new Date().toISOString().split('T')[0] : undefined })}
                            loading={onaylaH.isPending}
                          >
                            {sonrakiDurum[h.durum]}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sözleşme bilgileri */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Sözleşme Bilgileri</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              ['Sözleşme No', sozlesme.sozlesme_no || '—'],
              ['Tarih', fmtTarih(sozlesme.sozlesme_tarihi)],
              ['Başlangıç', fmtTarih(sozlesme.baslangic)],
              ['Bitiş', fmtTarih(sozlesme.bitis)],
              ['KDV Oranı', `%${sozlesme.kdv_orani}`],
              ['Stopaj', `%${sozlesme.stopaj_orani}`],
              ['SGK Kesinti', `%${sozlesme.sgk_kesinti_oran}`],
              ['Avans', fmtTL(sozlesme.avans_tutari)],
              ['IBAN', sozlesme.iban || '—'],
              ['Banka', sozlesme.banka_adi || '—'],
            ].map(([lbl, val]) => (
              <div key={lbl}>
                <div style={{ color: '#4b5563', fontSize: 10, textTransform: 'uppercase' }}>{lbl}</div>
                <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 500, marginTop: 2 }}>{val}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* HAKEDİŞ MODAL */}
      <Modal open={hakedisModal} onClose={() => setHakedisModal(false)} title="Yeni Taşeron Hakedişi" width={480}>
        <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(0,212,170,.06)', borderRadius: 8, border: '1px solid rgba(0,212,170,.15)' }}>
          <div style={{ color: '#6b7280', fontSize: 11 }}>Sözleşme tutarı</div>
          <div style={{ color: '#00d4aa', fontWeight: 700 }}>{fmtTL(sozlesme.sozlesme_bedeli)}</div>
        </div>
        <FormInput label="Tarih" value={hakedisForm.tarih} onChange={hf('tarih')} type="date" />
        <FormInput label="Bu Döneme Ait İş Bedeli (₺) *" value={hakedisForm.sozlesme_is}
          onChange={hf('sozlesme_is')} type="number" placeholder="KDV hariç tutar" />
        <FormInput label="Diğer Kesintiler (₺)" value={hakedisForm.diger_kesinti}
          onChange={hf('diger_kesinti')} type="number" />
        <FormInput label="Not" value={hakedisForm.notlar} onChange={hf('notlar')} />
        {hakedisForm.sozlesme_is && (
          <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,.04)', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>
            <div style={{ color: '#6b7280', marginBottom: 4 }}>Hesaplama Önizleme</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <span style={{ color: '#9ca3af' }}>KDV ({sozlesme.kdv_orani}%):</span>
              <span style={{ color: '#00d4aa' }}>{fmtTL(Math.round(parseFloat(hakedisForm.sozlesme_is) * sozlesme.kdv_orani / 100))}</span>
              <span style={{ color: '#9ca3af' }}>Stopaj ({sozlesme.stopaj_orani}%):</span>
              <span style={{ color: '#ef4444' }}>-{fmtTL(Math.round(parseFloat(hakedisForm.sozlesme_is) * sozlesme.stopaj_orani / 100))}</span>
              <span style={{ color: '#9ca3af' }}>SGK ({sozlesme.sgk_kesinti_oran}%):</span>
              <span style={{ color: '#ef4444' }}>-{fmtTL(Math.round(parseFloat(hakedisForm.sozlesme_is) * sozlesme.sgk_kesinti_oran / 100))}</span>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setHakedisModal(false)}>Vazgeç</Button>
          <Button
            onClick={() => createH.mutate({ ...hakedisForm, sozlesme_is: parseFloat(hakedisForm.sozlesme_is) || 0, diger_kesinti: parseFloat(hakedisForm.diger_kesinti) || 0 })}
            disabled={!hakedisForm.sozlesme_is}
            loading={createH.isPending}
          >Hakediş Oluştur</Button>
        </div>
      </Modal>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// PUANTAJ SEKMESİ
// ════════════════════════════════════════════════════════════════
const PuantajSekme: React.FC = () => {
  const qc = useQueryClient()
  const now = new Date()
  const [santiyeId, setSantiyeId] = useState('')
  const [yil, setYil] = useState(now.getFullYear())
  const [ay, setAy] = useState(now.getMonth() + 1)
  const [degisiklikler, setDegisiklikler] = useState<Record<string, Record<number, any>>>({})
  const [kaydediliyor, setKaydediliyor] = useState(false)

  const { data: santiyelerData } = useQuery({
    queryKey: ['santiyeler'],
    queryFn: () => santiyeApi.list().then(r => r.data.data as any[])
  })

  const { data: gridData, isLoading } = useQuery({
    queryKey: ['puantaj-grid', santiyeId, yil, ay],
    queryFn: () => santiyeId
      ? taseronApi.puantajGrid({ santiye_id: santiyeId, yil: String(yil), ay: String(ay) }).then(r => r.data.data)
      : null,
    enabled: !!santiyeId
  })

  const gunler = gridData ? Array.from({ length: gridData.meta.gun_sayisi }, (_, i) => i + 1) : []
  const personeller: any[] = gridData?.personeller || []
  const puantajMap: Record<string, Record<number, any>> = gridData?.puantajlar || {}

  const getVal = (personelId: string, gun: number, alan: string, varsayilan: any) => {
    if (degisiklikler[personelId]?.[gun]?.[alan] !== undefined) return degisiklikler[personelId][gun][alan]
    if (puantajMap[personelId]?.[gun]?.[alan] !== undefined) return puantajMap[personelId][gun][alan]
    return varsayilan
  }

  const setVal = (personelId: string, gun: number, alan: string, deger: any) => {
    setDegisiklikler(prev => ({
      ...prev,
      [personelId]: {
        ...(prev[personelId] || {}),
        [gun]: {
          ...(prev[personelId]?.[gun] || {}),
          [alan]: deger
        }
      }
    }))
  }

  const ayAdi = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'][ay - 1]

  const kaydet = async () => {
    if (!santiyeId || Object.keys(degisiklikler).length === 0) return
    setKaydediliyor(true)
    try {
      const kayitlar = []
      for (const [personelId, gunler] of Object.entries(degisiklikler)) {
        for (const [gun, vals] of Object.entries(gunler)) {
          const tarih = `${yil}-${String(ay).padStart(2, '0')}-${String(gun).padStart(2, '0')}`
          kayitlar.push({ personel_id: personelId, tarih, ...vals })
        }
      }
      await taseronApi.puantajKaydet({ santiye_id: santiyeId, kayitlar })
      toast.success(`${kayitlar.length} kayıt kaydedildi`)
      qc.invalidateQueries({ queryKey: ['puantaj-grid', santiyeId, yil, ay] })
      setDegisiklikler({})
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Kayıt hatası')
    } finally {
      setKaydediliyor(false)
    }
  }

  const ayToplamSaat = (personelId: string) => {
    let top = 0
    for (let g = 1; g <= gunler.length; g++) {
      const t = getVal(personelId, g, 'tatil_mi', false)
      if (!t) top += getVal(personelId, g, 'calisma_saat', 0)
    }
    return top
  }

  const calismadimi = (personelId: string, gun: number) => {
    const v = getVal(personelId, gun, 'calisma_saat', 0)
    return v > 0
  }

  return (
    <div>
      {/* Filtreler */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 220px' }}>
          <div style={{ color: '#9ca3af', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Şantiye</div>
          <select
            value={santiyeId}
            onChange={e => setSantiyeId(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '8px 10px', color: '#f1f5f9', fontSize: 13 }}
          >
            <option value="">— Şantiye Seçin —</option>
            {(santiyelerData || []).map((s: any) => (
              <option key={s.id} value={s.id}>{s.ad} ({s.il})</option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ color: '#9ca3af', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Yıl</div>
          <select value={yil} onChange={e => setYil(parseInt(e.target.value))}
            style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '8px 10px', color: '#f1f5f9', fontSize: 13 }}>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ color: '#9ca3af', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Ay</div>
          <select value={ay} onChange={e => setAy(parseInt(e.target.value))}
            style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '8px 10px', color: '#f1f5f9', fontSize: 13 }}>
            {['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'].map((ad, i) => (
              <option key={i + 1} value={i + 1}>{ad}</option>
            ))}
          </select>
        </div>
        {Object.keys(degisiklikler).length > 0 && (
          <Button onClick={kaydet} loading={kaydediliyor}>
            💾 Kaydet ({Object.values(degisiklikler).reduce((s, g) => s + Object.keys(g).length, 0)} kayıt)
          </Button>
        )}
      </div>

      {!santiyeId ? (
        <EmptyState icon="📅" title="Şantiye seçin" sub="Puantaj tablosunu görmek için şantiye seçin" />
      ) : isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
      ) : personeller.length === 0 ? (
        <EmptyState icon="👷" title="Bu şantiyede personel yok"
          sub="Önce Personel sayfasından şantiyeye personel atayın" />
      ) : (
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
            <span>📅 {ayAdi} {yil} — Puantaj Tablosu</span>
            <span style={{ color: '#6b7280', fontSize: 11 }}>{personeller.length} personel</span>
          </div>
          <div className="table-scroll">
            <table style={{ borderCollapse: 'collapse', minWidth: Math.max(600, gunler.length * 36 + 200) }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,.03)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontSize: 11, fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,.07)', position: 'sticky', left: 0, background: '#141b2d', zIndex: 1, minWidth: 160 }}>
                    Personel
                  </th>
                  {gunler.map(g => {
                    const d = new Date(yil, ay - 1, g)
                    const hafta = d.getDay()
                    const tatilGun = hafta === 0 || hafta === 6
                    return (
                      <th key={g} style={{
                        padding: '4px 2px', textAlign: 'center', fontSize: 10, fontWeight: 700,
                        borderBottom: '1px solid rgba(255,255,255,.07)',
                        color: tatilGun ? '#f59e0b' : '#6b7280', width: 32, minWidth: 32
                      }}>
                        <div>{g}</div>
                        <div style={{ fontSize: 9 }}>
                          {['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'][hafta]}
                        </div>
                      </th>
                    )
                  })}
                  <th style={{ padding: '8px 10px', textAlign: 'center', color: '#00d4aa', fontSize: 11, fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,.07)', minWidth: 70 }}>
                    Top. Saat
                  </th>
                </tr>
              </thead>
              <tbody>
                {personeller.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    <td style={{
                      padding: '6px 12px', fontSize: 12, fontWeight: 600,
                      position: 'sticky', left: 0, background: '#141b2d', zIndex: 1
                    }}>
                      <div>{p.ad} {p.soyad}</div>
                      <div style={{ color: '#6b7280', fontSize: 10 }}>{p.gorev}</div>
                    </td>
                    {gunler.map(g => {
                      const tatil = getVal(p.id, g, 'tatil_mi', false)
                      const saat = getVal(p.id, g, 'calisma_saat', 0)
                      const d = new Date(yil, ay - 1, g)
                      const haftaTatil = d.getDay() === 0 || d.getDay() === 6
                      return (
                        <td key={g} style={{ padding: '2px', textAlign: 'center' }}>
                          <div
                            title={`${saat} saat`}
                            style={{
                              width: 28, height: 28, borderRadius: 4, margin: '0 auto',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, fontWeight: 700,
                              background: tatil ? 'rgba(245,158,11,.2)'
                                : saat > 0 ? 'rgba(0,212,170,.2)'
                                : haftaTatil ? 'rgba(255,255,255,.03)'
                                : 'rgba(239,68,68,.06)',
                              color: tatil ? '#f59e0b'
                                : saat > 0 ? '#00d4aa'
                                : '#4b5563',
                              border: `1px solid ${tatil ? 'rgba(245,158,11,.3)' : saat > 0 ? 'rgba(0,212,170,.3)' : 'rgba(255,255,255,.05)'}`
                            }}
                            onClick={() => {
                              const yeniSaat = saat === 0 ? 8 : saat === 8 ? 10 : saat === 10 ? 0 : 8
                              setVal(p.id, g, 'calisma_saat', yeniSaat)
                            }}
                          >
                            {tatil ? 'İ' : saat > 0 ? saat : '—'}
                          </div>
                        </td>
                      )
                    })}
                    <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: '#00d4aa', fontSize: 13 }}>
                      {ayToplamSaat(p.id)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: '#6b7280' }}>
            💡 Tıklayarak: 0 → 8 saat → 10 saat → 0 döngüsü. "İ" = İzinli
          </div>
        </Card>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ANA MODÜL
// ════════════════════════════════════════════════════════════════
export const Taseron: React.FC = () => {
  const [sekme, setSekme] = useState<Sekme>('taseronlar')
  const [seciliTaseron, setSeciliTaseron] = useState<Taseron | null>(null)

  const sekmeler: Array<{ id: Sekme; label: string; icon: string }> = [
    { id: 'taseronlar',  label: 'Taşeronlar',   icon: '🏢' },
    { id: 'sozlesmeler', label: 'Sözleşmeler',  icon: '📋' },
    { id: 'puantaj',     label: 'Puantaj',       icon: '📅' },
  ]

  return (
    <div>
      <PageHeader
        title="Taşeron Yönetimi"
        sub="Alt yüklenici sözleşmeleri, hakediş ödemeleri ve personel puantajı"
      />

      {/* Sekmeler */}
      <div className="tab-scroll" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
          {sekmeler.map(s => (
            <button key={s.id} onClick={() => setSekme(s.id)} style={{
              padding: '8px 18px', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: sekme === s.id ? '#00d4aa' : 'transparent',
              color: sekme === s.id ? '#000' : '#6b7280',
              fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap'
            }}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </div>

      {sekme === 'taseronlar'  && <TaseronlarSekme onSec={t => { setSeciliTaseron(t); setSekme('sozlesmeler') }} />}
      {sekme === 'sozlesmeler' && <SozlesmelerSekme />}
      {sekme === 'puantaj'     && <PuantajSekme />}
    </div>
  )
}
