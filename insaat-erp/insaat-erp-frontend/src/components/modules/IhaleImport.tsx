import React, { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ihaleApi } from '@/services/api'
import { fmtTL, fmtTarih } from '@/utils/format'

// ─── TIPLER ──────────────────────────────────────────────────────────────────
interface ParsedProje {
  proje_adi: string; isveren: string; il: string; ilce: string
  sozlesme_no: string; ihale_tarihi: string | null; baslangic_tarihi: string | null
  sure_gun: number; teklif_bedeli: number; kdv_orani: number; notlar: string
}
interface ParseOzet {
  kalem_sayisi: number; metraj_toplam: number; toplam_maliyet: number
  brut_kar: number; brut_kar_marji: number; hakedis_donem: number
  projeksiyon_ay: number; min_nakit: number
}
interface ParseResult {
  gecici_yol: string; proje: ParsedProje; ozet: ParseOzet
  metraj_ornekleri: unknown[]; nakit_projeksiyonu: unknown[]
  hakedis_takvimi: unknown[]; maliyet: Record<string, number>
}
interface Ihale {
  id: string; proje_adi: string; isveren: string; il: string; durum: string
  teklif_bedeli: number; toplam_maliyet: number; brut_kar: number; brut_kar_marji: number
  kalem_sayisi: number; santiye_adi: string | null; olusturuldu: string
}

// ─── DURUM BADGE ─────────────────────────────────────────────────────────────
const DurumBadge: React.FC<{ durum: string }> = ({ durum }) => {
  const cfg: Record<string, { label: string; color: string }> = {
    taslak:     { label: 'Taslak',    color: '#64748b' },
    aktif:      { label: 'Aktif',     color: '#3b82f6' },
    kazanildi:  { label: 'Kazanıldı', color: '#22c55e' },
    kaybedildi: { label: 'Kaybedildi',color: '#ef4444' },
    iptal:      { label: 'İptal',     color: '#991b1b' },
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

// ─── PARA FORMATLA ────────────────────────────────────────────────────────────
const marjRenk = (marj: number) => marj >= 15 ? '#22c55e' : marj >= 8 ? '#f59e0b' : '#ef4444'

// ─── ANA BİLEŞEN ─────────────────────────────────────────────────────────────
const IhaleImport: React.FC = () => {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [adim, setAdim] = useState<'liste' | 'yukle' | 'onizle'>('liste')
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [santiyeOlustur, setSantiyeOlustur] = useState(true)
  const [yukleniyor, setYukleniyor] = useState(false)

  // ─── İHALE LİSTESİ ────────────────────────────────────────────────────────
  const { data: listData } = useQuery({
    queryKey: ['ihaleler'],
    queryFn: () => ihaleApi.list().then(r => r.data),
    enabled: adim === 'liste',
  })
  const ihaleler: Ihale[] = listData?.data ?? []

  // ─── EXCEL PARSE ──────────────────────────────────────────────────────────
  const parseMutation = useMutation({
    mutationFn: (file: File) => ihaleApi.parseExcel(file).then(r => r.data),
    onSuccess: (data) => {
      setParsed(data.data)
      setAdim('onizle')
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Excel okunamadı')
    },
  })

  // ─── IMPORT ───────────────────────────────────────────────────────────────
  const importMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      ihaleApi.import(payload).then(r => r.data),
    onSuccess: (data) => {
      toast.success(data.message ?? 'İhale kaydedildi')
      qc.invalidateQueries({ queryKey: ['ihaleler'] })
      if (data.data?.santiyeId) {
        navigate(`/santiyeler/${data.data.santiyeId}`)
      } else {
        setAdim('liste')
        setParsed(null)
      }
    },
    onError: () => toast.error('Kaydetme başarısız'),
  })

  const handleDosyaSec = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setYukleniyor(true)
    try {
      await parseMutation.mutateAsync(file)
    } finally {
      setYukleniyor(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleOnayla = () => {
    if (!parsed) return
    importMutation.mutate({
      gecici_yol:        parsed.gecici_yol,
      proje:             parsed.proje,
      maliyet:           parsed.maliyet,
      nakit_projeksiyonu: parsed.nakit_projeksiyonu,
      hakedis_takvimi:   parsed.hakedis_takvimi,
      metraj_kalemleri:  parsed.metraj_ornekleri,
      santiye_olustur:   santiyeOlustur,
    })
  }

  // ─── RENK & STIL SABITLER ─────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: 'var(--card-bg, #fff)',
    border: '1px solid var(--border, #e2e8f0)',
    borderRadius: 10, padding: 20,
  }
  const kpiStyle: React.CSSProperties = { ...cardStyle, textAlign: 'center' as const }

  // ─── RENDER: LİSTE GÖRÜNÜMÜ ───────────────────────────────────────────────
  if (adim === 'liste') return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>İhale / Teklif Modülü</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
            Excel şablonunu doldurun, sisteme yükleyin — proje, nakit akışı ve hakediş takvimi otomatik oluşur.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a
            href={ihaleApi.sablonUrl()}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0',
              background: '#f8fafc', fontSize: 14, textDecoration: 'none', color: '#374151', cursor: 'pointer',
            }}
          >
            Şablonu İndir
          </a>
          <button
            onClick={() => setAdim('yukle')}
            style={{
              padding: '8px 18px', borderRadius: 8, background: '#3b82f6',
              color: '#fff', border: 'none', fontSize: 14, cursor: 'pointer', fontWeight: 600,
            }}
          >
            + Excel Yükle
          </button>
        </div>
      </div>

      {ihaleler.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <p style={{ color: '#64748b', marginBottom: 16 }}>
            Henüz ihale kaydı yok. Şablonu indirin, doldurun, yükleyin.
          </p>
          <a
            href={ihaleApi.sablonUrl()}
            style={{
              padding: '10px 20px', borderRadius: 8, background: '#3b82f6',
              color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 600,
            }}
          >
            Excel Şablonunu İndir
          </a>
        </div>
      ) : (
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Proje Adı', 'İşveren', 'İl', 'Teklif Bedeli', 'Brüt Marj', 'Durum', 'Şantiye'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ihaleler.map((ih, i) => (
                <tr
                  key={ih.id}
                  style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 ? '#fafafa' : '#fff', cursor: 'pointer' }}
                  onClick={() => navigate(`/ihale/${ih.id}`)}
                >
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>{ih.proje_adi}</td>
                  <td style={{ padding: '10px 14px', color: '#64748b' }}>{ih.isveren || '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#64748b' }}>{ih.il || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>{fmtTL(ih.teklif_bedeli)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ color: marjRenk(parseFloat(String(ih.brut_kar_marji ?? 0)) * 100), fontWeight: 600 }}>
                      %{(parseFloat(String(ih.brut_kar_marji ?? 0)) * 100).toFixed(1)}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}><DurumBadge durum={ih.durum} /></td>
                  <td style={{ padding: '10px 14px', color: '#64748b' }}>
                    {ih.santiye_adi ? (
                      <span style={{ color: '#3b82f6', fontWeight: 500 }}>{ih.santiye_adi}</span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  // ─── RENDER: YÜKLE ADIMI ──────────────────────────────────────────────────
  if (adim === 'yukle') return (
    <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <button
        onClick={() => setAdim('liste')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', marginBottom: 16, fontSize: 14 }}
      >
        ← Geri
      </button>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>İhale Excel Yükle</h2>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>
        Şablonu doldurup buraya yükleyin. Sistem dosyayı okuyacak ve önizleme gösterecek.
      </p>

      <div
        style={{
          ...cardStyle,
          border: '2px dashed #cbd5e1',
          textAlign: 'center', padding: 48, cursor: 'pointer',
        }}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault()
          const file = e.dataTransfer.files[0]
          if (file) parseMutation.mutate(file)
        }}
      >
        {yukleniyor || parseMutation.isPending ? (
          <div>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p style={{ color: '#64748b' }}>Excel okunuyor...</p>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>Dosyayı buraya sürükleyin veya tıklayın</p>
            <p style={{ color: '#64748b', fontSize: 13 }}>Desteklenen: .xlsx, .xls</p>
          </div>
        )}
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleDosyaSec} />
      </div>

      <div style={{ marginTop: 20, ...cardStyle, background: '#f0f9ff', borderColor: '#bae6fd' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#0369a1' }}>
          <strong>Şablonu henüz indirmediniz mi?</strong>{' '}
          <a href={ihaleApi.sablonUrl()} style={{ color: '#0369a1' }}>Buradan indirin</a>,
          doldurun ve geri gelin.
        </p>
      </div>
    </div>
  )

  // ─── RENDER: ÖNİZLE ADIMI ────────────────────────────────────────────────
  if (adim === 'onizle' && parsed) {
    const ozet = parsed.ozet
    const proj = parsed.proje
    return (
      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
        <button
          onClick={() => { setAdim('yukle'); setParsed(null) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', marginBottom: 16, fontSize: 14 }}
        >
          ← Farklı dosya yükle
        </button>

        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Önizleme — Onaylıyor musunuz?</h2>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
          Aşağıdaki bilgiler Excel'den okundu. Doğruysa "Onayla ve Kaydet" deyin.
        </p>

        {/* KPI Kutuları */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Teklif Bedeli', value: fmtTL(proj.teklif_bedeli) },
            { label: 'Toplam Maliyet', value: fmtTL(ozet.toplam_maliyet) },
            { label: 'Brüt Kar', value: fmtTL(ozet.brut_kar), color: ozet.brut_kar >= 0 ? '#22c55e' : '#ef4444' },
            { label: 'Brüt Marj', value: `%${ozet.brut_kar_marji.toFixed(1)}`, color: marjRenk(ozet.brut_kar_marji) },
          ].map(k => (
            <div key={k.label} style={kpiStyle}>
              <div style={{ fontSize: 18, fontWeight: 700, color: k.color || '#111' }}>{k.value}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Proje Bilgileri */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Proje Bilgileri</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { label: 'Proje Adı', value: proj.proje_adi },
              { label: 'İşveren', value: proj.isveren || '—' },
              { label: 'İl / İlçe', value: [proj.il, proj.ilce].filter(Boolean).join(' / ') || '—' },
              { label: 'Teklif Bedeli', value: fmtTL(proj.teklif_bedeli) },
              { label: 'KDV Oranı', value: `%${proj.kdv_orani}` },
              { label: 'Süre', value: proj.sure_gun ? `${proj.sure_gun} gün` : '—' },
              { label: 'İhale Tarihi', value: proj.ihale_tarihi ? fmtTarih(proj.ihale_tarihi) : '—' },
              { label: 'Başlangıç', value: proj.baslangic_tarihi ? fmtTarih(proj.baslangic_tarihi) : '—' },
              { label: 'Metraj Kalem', value: `${ozet.kalem_sayisi} kalem` },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>{f.label}</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Maliyet Dağılımı */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Maliyet Dağılımı</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {Object.entries(parsed.maliyet).map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize', marginBottom: 2 }}>
                  {k.replace(/_/g, ' ')}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{fmtTL(v)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Metraj Örnekleri */}
        {(parsed.metraj_ornekleri as Record<string, unknown>[]).length > 0 && (
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>
              Metraj Kalemleri (ilk {parsed.metraj_ornekleri.length} kalem)
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  {['Poz No', 'İş Grubu', 'Kalem Adı', 'Birim', 'Miktar', 'Birim Fiyat', 'Toplam'].map(h => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: '#374151', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(parsed.metraj_ornekleri as Record<string, unknown>[]).map((k, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '6px 10px', color: '#64748b' }}>{String(k.poz_no || '—')}</td>
                    <td style={{ padding: '6px 10px', color: '#64748b' }}>{String(k.is_grubu || '—')}</td>
                    <td style={{ padding: '6px 10px' }}>{String(k.kalem_adi)}</td>
                    <td style={{ padding: '6px 10px', color: '#64748b' }}>{String(k.birim || '—')}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{Number(k.miktar).toLocaleString('tr-TR')}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmtTL(Number(k.birim_fiyat))}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500 }}>
                      {fmtTL(Number(k.miktar) * Number(k.birim_fiyat))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ozet.kalem_sayisi > parsed.metraj_ornekleri.length && (
              <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 12 }}>
                +{ozet.kalem_sayisi - parsed.metraj_ornekleri.length} kalem daha kayıt edilecek
              </p>
            )}
          </div>
        )}

        {/* Nakit Projeksiyonu */}
        {(parsed.nakit_projeksiyonu as Record<string, unknown>[]).length > 0 && (
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Aylık Nakit Akışı Projeksiyonu</h3>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#64748b' }}>
              En düşük kümülatif nakit: <strong style={{ color: ozet.min_nakit < 0 ? '#ef4444' : '#22c55e' }}>
                {fmtTL(ozet.min_nakit)}
              </strong>
              {ozet.min_nakit < 0 && ' — Bu ayda finansman gerekebilir!'}
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    {['Ay', 'Planlanan İmalat', 'Tahsilat', 'Gider', 'Net', 'Kümülatif'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'right', color: '#374151', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(parsed.nakit_projeksiyonu as Record<string, unknown>[]).map((p, i) => {
                    const net = Number(p.net_nakit)
                    const kum = Number(p.kumulatif_nakit)
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: kum < 0 ? '#fff1f2' : 'transparent' }}>
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>{String(p.ay_no)}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmtTL(Number(p.planlanan_imalat))}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: '#22c55e' }}>{fmtTL(Number(p.planlanan_tahsilat))}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: '#ef4444' }}>{fmtTL(Number(p.toplam_gider))}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: net >= 0 ? '#22c55e' : '#ef4444', fontWeight: 500 }}>{fmtTL(net)}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: kum >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{fmtTL(kum)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Şantiye seçeneği */}
        <div style={{ ...cardStyle, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="checkbox"
            id="santiyeOlustur"
            checked={santiyeOlustur}
            onChange={e => setSantiyeOlustur(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          <label htmlFor="santiyeOlustur" style={{ cursor: 'pointer', fontSize: 14 }}>
            <strong>Bu proje için şantiye oluştur</strong>
            <span style={{ color: '#64748b', marginLeft: 6, fontSize: 13 }}>
              (Hakediş, satın alma, personel ekranları hemen açılır)
            </span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => { setAdim('yukle'); setParsed(null) }}
            style={{
              padding: '10px 20px', borderRadius: 8, border: '1px solid #e2e8f0',
              background: '#f8fafc', cursor: 'pointer', fontSize: 14,
            }}
          >
            İptal
          </button>
          <button
            onClick={handleOnayla}
            disabled={importMutation.isPending}
            style={{
              padding: '10px 24px', borderRadius: 8, background: '#22c55e',
              color: '#fff', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, opacity: importMutation.isPending ? 0.7 : 1,
            }}
          >
            {importMutation.isPending ? 'Kaydediliyor...' : 'Onayla ve Kaydet'}
          </button>
        </div>
      </div>
    )
  }

  return null
}

export default IhaleImport
