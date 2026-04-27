import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/services/api'

// ─── API ─────────────────────────────────────────────────────────────────────
const adminApi = {
  ozet:            ()          => api.get('/admin/ozet'),
  kullanicilar:    ()          => api.get('/admin/kullanicilar'),
  createKul:       (d: any)    => api.post('/admin/kullanicilar', d),
  updateKul:       (id: string, d: any) => api.put(`/admin/kullanicilar/${id}`, d),
  deleteKul:       (id: string) => api.delete(`/admin/kullanicilar/${id}`),
  auditLog:        (p?: any)   => api.get('/admin/audit-log', { params: p }),
  createYedek:     ()          => api.post('/admin/yedek', {}),
  listYedekler:    ()          => api.get('/admin/yedekler'),
  auditExportUrl:  ()          => '/api/v1/admin/audit-log/export',
}

// ─── TİPLER ──────────────────────────────────────────────────────────────────
interface Kullanici { id: string; email: string; ad: string; soyad: string; rol: string; aktif: boolean; telefon?: string; olusturuldu: string }
interface AuditRow  { id: string; tablo: string; islem: string; kayit_id: string; ip_adresi: string; olusturuldu: string; kullanici_email: string; kullanici_rol: string; yeni_deger: any }
interface Yedek     { dosya: string; boyut_kb: number; olusturuldu: string }

const ROL_RENK: Record<string, string> = {
  admin: 'bg-red-100 text-red-700', mudur: 'bg-orange-100 text-orange-700',
  muhendis: 'bg-blue-100 text-blue-700', muhasebe: 'bg-green-100 text-green-700',
  satin_alma: 'bg-purple-100 text-purple-700', viewer: 'bg-gray-100 text-gray-600',
}
const ROLLER = ['admin','mudur','muhendis','muhasebe','satin_alma','viewer']
const ISLEM_RENK: Record<string, string> = {
  INSERT: 'bg-green-100 text-green-700', UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700', LOGIN: 'bg-indigo-100 text-indigo-700', LOGOUT: 'bg-gray-100 text-gray-600',
}

// ─── KULLANICI FORMU ──────────────────────────────────────────────────────────
const KullaniciForm: React.FC<{ hedef?: Kullanici | null; onKapat: () => void }> = ({ hedef, onKapat }) => {
  const qc = useQueryClient()
  const [form, setForm] = useState({ email: hedef?.email ?? '', ad: hedef?.ad ?? '', soyad: hedef?.soyad ?? '', sifre: '', rol: hedef?.rol ?? 'muhendis', telefon: hedef?.telefon ?? '', aktif: hedef?.aktif ?? true })

  const mutasyon = useMutation({
    mutationFn: () => hedef ? adminApi.updateKul(hedef.id, { ...form, sifre: form.sifre || undefined }) : adminApi.createKul(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-kullanicilar'] }); toast.success(hedef ? 'Güncellendi' : 'Kullanıcı oluşturuldu'); onKapat() },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  })

  const inp = (label: string, key: keyof typeof form, type = 'text', req = false) => (
    <div className="mb-3">
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}{req && <span className="text-red-400 ml-1">*</span>}</label>
      <input type={type} value={String(form[key])} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="font-bold text-lg mb-4">{hedef ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı'}</h3>
        {!hedef && inp('E-posta', 'email', 'email', true)}
        {inp('Ad', 'ad', 'text', true)}
        {inp('Soyad', 'soyad', 'text', true)}
        <div className="mb-3">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Şifre{!hedef && <span className="text-red-400 ml-1">*</span>}</label>
          <input type="password" placeholder={hedef ? 'Boş bırakırsanız değişmez' : ''} value={form.sifre} onChange={e => setForm(p => ({ ...p, sifre: e.target.value }))}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Rol *</label>
          <select value={form.rol} onChange={e => setForm(p => ({ ...p, rol: e.target.value }))}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {ROLLER.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        {inp('Telefon', 'telefon')}
        {hedef && (
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input type="checkbox" checked={form.aktif} onChange={e => setForm(p => ({ ...p, aktif: e.target.checked }))} className="w-4 h-4 rounded" />
            <span className="text-sm text-gray-700">Hesap aktif</span>
          </label>
        )}
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onKapat} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">İptal</button>
          <button onClick={() => mutasyon.mutate()} disabled={mutasyon.isPending} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
            {mutasyon.isPending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SEKME: KULLANICILAR ──────────────────────────────────────────────────────
const KullanicilarSekme: React.FC = () => {
  const qc = useQueryClient()
  const [form, setForm] = useState<Kullanici | null | 'yeni'>(null)

  const { data: kullanicilar = [] } = useQuery<Kullanici[]>({
    queryKey: ['admin-kullanicilar'],
    queryFn: () => adminApi.kullanicilar().then(r => r.data.data),
  })

  const silMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteKul(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-kullanicilar'] }); toast.success('Silindi') },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Silinemedi'),
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{kullanicilar.length} kullanıcı</p>
        <button onClick={() => setForm('yeni')} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">+ Yeni Kullanıcı</button>
      </div>

      <div className="space-y-2">
        {kullanicilar.map(k => (
          <div key={k.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {(k.ad[0] || '?').toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{k.ad} {k.soyad}</p>
                <p className="text-xs text-gray-500 truncate">{k.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROL_RENK[k.rol] || 'bg-gray-100 text-gray-600'}`}>{k.rol}</span>
              {!k.aktif && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Pasif</span>}
              <button onClick={() => setForm(k)} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50">Düzenle</button>
              <button onClick={() => { if (confirm(`${k.email} silinsin mi?`)) silMut.mutate(k.id) }} className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50">Sil</button>
            </div>
          </div>
        ))}
      </div>

      {/* Rol İzin Tablosu */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-sm">Rol İzin Matrisi</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 text-gray-500 font-medium">İşlem</th>
                {ROLLER.map(r => <th key={r} className="p-3 text-center text-gray-500 font-medium">{r}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ['Şantiye oluştur/sil', '✅','✅','❌','❌','❌','❌'],
                ['Hakediş onayı',       '✅','✅','❌','✅','❌','❌'],
                ['Fatura öde',          '✅','✅','❌','✅','❌','❌'],
                ['Satın alma onayı',    '✅','✅','❌','❌','✅','❌'],
                ['Stok girişi',         '✅','✅','✅','❌','✅','❌'],
                ['Rapor görüntüle',     '✅','✅','✅','✅','✅','✅'],
                ['Admin paneli',        '✅','❌','❌','❌','❌','❌'],
              ].map(([islem, ...vals]) => (
                <tr key={islem} className="hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-700">{islem}</td>
                  {vals.map((v, i) => <td key={i} className="p-3 text-center">{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {form && <KullaniciForm hedef={form === 'yeni' ? null : form} onKapat={() => setForm(null)} />}
    </div>
  )
}

// ─── SEKME: AUDİT LOG ────────────────────────────────────────────────────────
const AuditLogSekme: React.FC = () => {
  const [filtre, setFiltre] = useState({ islem: '', tablo: '', sayfa: '1' })
  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', filtre],
    queryFn: () => adminApi.auditLog({ ...filtre, limit: '30' }).then(r => r.data),
    placeholderData: prev => prev,
  })

  const rows: AuditRow[] = data?.data ?? []
  const meta = data?.meta

  const handleExport = () => {
    const token = localStorage.getItem('insaat-erp-auth')
      ? JSON.parse(localStorage.getItem('insaat-erp-auth')!).state?.accessToken
      : null
    const url = `${adminApi.auditExportUrl()}?islem=${filtre.islem}&tablo=${filtre.tablo}`
    const a = document.createElement('a')
    a.href = url
    a.click()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2">
          <select value={filtre.islem} onChange={e => setFiltre(p => ({ ...p, islem: e.target.value, sayfa: '1' }))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Tüm İşlemler</option>
            {['INSERT','UPDATE','DELETE','LOGIN','LOGOUT'].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <input placeholder="Tablo filtrele…" value={filtre.tablo} onChange={e => setFiltre(p => ({ ...p, tablo: e.target.value, sayfa: '1' }))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-40" />
        </div>
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg">
          ⬇ CSV İndir
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Yükleniyor…</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Kayıt bulunamadı</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-3 text-gray-500 font-medium">Tarih</th>
                  <th className="text-left p-3 text-gray-500 font-medium">Kullanıcı</th>
                  <th className="text-left p-3 text-gray-500 font-medium">Tablo</th>
                  <th className="text-left p-3 text-gray-500 font-medium">İşlem</th>
                  <th className="text-left p-3 text-gray-500 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="p-3 text-gray-600 whitespace-nowrap">{new Date(r.olusturuldu).toLocaleString('tr-TR')}</td>
                    <td className="p-3">
                      <span className="font-medium text-gray-800">{r.kullanici_email || '—'}</span>
                      {r.kullanici_rol && <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${ROL_RENK[r.kullanici_rol] || ''}`}>{r.kullanici_rol}</span>}
                    </td>
                    <td className="p-3 text-gray-600">{r.tablo}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ISLEM_RENK[r.islem] || 'bg-gray-100 text-gray-600'}`}>{r.islem}</span>
                    </td>
                    <td className="p-3 text-gray-500 font-mono">{r.ip_adresi || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meta && meta.toplam_sayfa > 1 && (
            <div className="p-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>Toplam {meta.toplam} kayıt</span>
              <div className="flex gap-1">
                <button disabled={filtre.sayfa === '1'} onClick={() => setFiltre(p => ({ ...p, sayfa: String(parseInt(p.sayfa) - 1) }))}
                  className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-30">← Önceki</button>
                <span className="px-2 py-1">{filtre.sayfa} / {meta.toplam_sayfa}</span>
                <button disabled={parseInt(filtre.sayfa) >= meta.toplam_sayfa} onClick={() => setFiltre(p => ({ ...p, sayfa: String(parseInt(p.sayfa) + 1) }))}
                  className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-30">Sonraki →</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── SEKME: YEDEKLEME ────────────────────────────────────────────────────────
const YedeklemeSekme: React.FC = () => {
  const qc = useQueryClient()
  const { data: yedekler = [] } = useQuery<Yedek[]>({
    queryKey: ['admin-yedekler'],
    queryFn: () => adminApi.listYedekler().then(r => r.data.data),
  })

  const yedekMut = useMutation({
    mutationFn: () => adminApi.createYedek(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['admin-yedekler'] })
      const d = r.data.data
      toast.success(`Yedek oluşturuldu: ${d.kayit_sayisi} kayıt, ${d.boyut_kb} KB`)
    },
    onError: () => toast.error('Yedekleme başarısız'),
  })

  const indir = (dosya: string) => {
    const a = document.createElement('a')
    a.href = `/api/v1/admin/yedekler/${dosya}`
    a.download = dosya
    a.click()
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-semibold text-blue-800 mb-1">Veri Yedeği Nedir?</h3>
        <p className="text-sm text-blue-700">
          Tüm şantiye, hakediş, fatura, personel ve stok verileriniz JSON formatında dışa aktarılır.
          Yedek dosyasını güvenli bir yerde saklayın. İhtiyaç durumunda destek ekibimiz geri yükleyebilir.
        </p>
      </div>

      <button onClick={() => yedekMut.mutate()} disabled={yedekMut.isPending}
        className="flex items-center gap-2 px-5 py-3 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 transition-colors">
        {yedekMut.isPending ? (
          <><span className="animate-spin">⟳</span> Yedekleniyor…</>
        ) : (
          <><span>💾</span> Şimdi Yedek Al</>
        )}
      </button>

      <div>
        <h3 className="font-semibold text-gray-800 mb-3 text-sm">Önceki Yedekler ({yedekler.length})</h3>
        {yedekler.length === 0 ? (
          <div className="text-center py-8 text-gray-400 bg-white rounded-xl border border-gray-200">
            Henüz yedek alınmamış
          </div>
        ) : (
          <div className="space-y-2">
            {yedekler.map(y => (
              <div key={y.dosya} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📦</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{new Date(y.olusturuldu).toLocaleString('tr-TR')}</p>
                    <p className="text-xs text-gray-500">{y.boyut_kb} KB</p>
                  </div>
                </div>
                <button onClick={() => indir(y.dosya)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200">
                  ⬇ İndir
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ANA PANEL ───────────────────────────────────────────────────────────────
type Sekme = 'ozet' | 'kullanicilar' | 'audit' | 'yedekleme'

export const AdminPanel: React.FC = () => {
  const [sekme, setSekme] = useState<Sekme>('ozet')

  const { data: ozet } = useQuery({
    queryKey: ['admin-ozet'],
    queryFn: () => adminApi.ozet().then(r => r.data.data),
  })

  const sekmeler: Array<{ id: Sekme; label: string; icon: string }> = [
    { id: 'ozet',        label: 'Genel Bakış',       icon: '📊' },
    { id: 'kullanicilar',label: 'Kullanıcılar',       icon: '👥' },
    { id: 'audit',       label: 'Audit Log',          icon: '🔍' },
    { id: 'yedekleme',   label: 'Yedekleme',          icon: '💾' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Paneli</h1>
        <p className="text-sm text-gray-500 mt-1">Kullanıcı yönetimi, güvenlik logu ve yedekleme</p>
      </div>

      {/* Sekme Seçici */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {sekmeler.map(s => (
          <button key={s.id} onClick={() => setSekme(s.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              sekme === s.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <span>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* ── ÖZET ── */}
      {sekme === 'ozet' && ozet && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-3">🏢 Firma Bilgileri</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Firma Adı</dt><dd className="font-medium">{ozet.tenant?.ad}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Plan</dt><dd><span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{ozet.tenant?.plan}</span></dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Maks. Şantiye</dt><dd className="font-medium">{ozet.tenant?.max_santiye}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Kayıt Tarihi</dt><dd className="font-medium">{ozet.tenant?.olusturuldu ? new Date(ozet.tenant.olusturuldu).toLocaleDateString('tr-TR') : '—'}</dd></div>
            </dl>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-3">👥 Kullanıcı Dağılımı</h3>
            <div className="space-y-2">
              {(ozet.kullanici_dagilimi || []).map((k: any) => (
                <div key={k.rol} className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROL_RENK[k.rol] || 'bg-gray-100 text-gray-600'}`}>{k.rol}</span>
                  <span className="text-sm font-bold text-gray-900">{k.count} kişi</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-3">🏗️ Şantiye Durumu</h3>
            <div className="space-y-2">
              {(ozet.santiye_dagilimi || []).map((s: any) => (
                <div key={s.durum} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{s.durum}</span>
                  <span className="font-bold text-gray-900">{s.count} şantiye</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-3">🔍 Audit Log Özeti</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Toplam İşlem</dt><dd className="font-bold text-gray-900">{parseInt(ozet.audit_ozet?.toplam || 0).toLocaleString('tr-TR')}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Son İşlem</dt><dd className="font-medium">{ozet.audit_ozet?.son_islem ? new Date(ozet.audit_ozet.son_islem).toLocaleString('tr-TR') : '—'}</dd></div>
            </dl>
          </div>
        </div>
      )}

      {sekme === 'kullanicilar' && <KullanicilarSekme />}
      {sekme === 'audit'        && <AuditLogSekme />}
      {sekme === 'yedekleme'    && <YedeklemeSekme />}
    </div>
  )
}

export default AdminPanel
