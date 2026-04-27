import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/authStore'

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

// ─── ANA CLIENT ───────────────────────────────────────────────────────────────
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// ─── REQUEST INTERCEPTOR ─────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ─── RESPONSE INTERCEPTOR (Token Refresh) ────────────────────────────────────

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Herhangi bir 401 → oturumu kapat ve giriş ekranına yönlendir
    if (error.response?.status === 401 && !error.config?._retry) {
      error.config._retry = true
      useAuthStore.getState().logout()
      // zaten giriş sayfasındaysak döngü oluşmasın
      if (window.location.pathname !== '/giris') {
        window.location.href = '/giris'
      }
      return Promise.reject(error)
    }

    return Promise.reject(error)
  }
)

// Interceptor'lı axios instance'ı dışa aktar
export { api as apiClient }

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, sifre: string) =>
    api.post('/auth/login', { email, sifre }),
  register: (data: Record<string, string>) =>
    api.post('/auth/register', data),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),
  getMe: () => api.get('/auth/me'),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
export const dashboardApi = {
  getKpi: () => api.get('/dashboard/kpi'),
}

// ─── ŞANTİYELER ──────────────────────────────────────────────────────────────
export const santiyeApi = {
  list: (params?: Record<string, string>) =>
    api.get('/santiyeler', { params }),
  get: (id: string) => api.get(`/santiyeler/${id}`),
  create: (data: Record<string, unknown>) =>
    api.post('/santiyeler', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/santiyeler/${id}`, data),
  delete: (id: string) => api.delete(`/santiyeler/${id}`),
}

// ─── FOTOĞRAFLAR ──────────────────────────────────────────────────────────────
export const fotografApi = {
  list: (santiyeId: string, params?: Record<string, string>) =>
    api.get(`/santiyeler/${santiyeId}/fotograflar`, { params }),
  upload: (santiyeId: string, formData: FormData) =>
    api.post(`/santiyeler/${santiyeId}/fotograflar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (e.total) console.log(`Yükleniyor: ${Math.round((e.loaded * 100) / e.total)}%`)
      },
    }),
  delete: (id: string) => api.delete(`/fotograflar/${id}`),
}

// ─── MESAJLAR ─────────────────────────────────────────────────────────────────
export const mesajApi = {
  list: (santiyeId: string, params?: Record<string, string>) =>
    api.get(`/santiyeler/${santiyeId}/mesajlar`, { params }),
  send: (santiyeId: string, formData: FormData) =>
    api.post(`/santiyeler/${santiyeId}/mesajlar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  okunmamis: () => api.get('/mesajlar/okunmamis'),
}

// ─── HAKEDİŞLER ──────────────────────────────────────────────────────────────
export const hakedisApi = {
  list: (params?: Record<string, string>) =>
    api.get('/hakedisler', { params }),
  get: (id: string) => api.get(`/hakedisler/${id}`),
  create: (data: Record<string, unknown>) =>
    api.post('/hakedisler', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/hakedisler/${id}`, data),
  onayla: (id: string, data: Record<string, unknown>) =>
    api.post(`/hakedisler/${id}/onayla`, data),
  faturaOlustur: (id: string) =>
    api.post(`/hakedisler/${id}/fatura-olustur`),
}

// ─── SATIN ALMA ───────────────────────────────────────────────────────────────
export const satinalmaApi = {
  list: (params?: Record<string, string>) =>
    api.get('/satinalma', { params }),
  get: (id: string) => api.get(`/satinalma/${id}`),
  create: (data: Record<string, unknown>) =>
    api.post('/satinalma', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/satinalma/${id}`, data),
  onayla: (id: string, yeni_durum: string) =>
    api.post(`/satinalma/${id}/onayla`, { yeni_durum }),
}

// ─── EKİPMAN ─────────────────────────────────────────────────────────────────
export const ekipmanApi = {
  list: (params?: Record<string, string>) =>
    api.get('/ekipmanlar', { params }),
  get: (id: string) => api.get(`/ekipmanlar/${id}`),
  create: (data: Record<string, unknown>) =>
    api.post('/ekipmanlar', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/ekipmanlar/${id}`, data),
  addBakim: (id: string, data: Record<string, unknown>) =>
    api.post(`/ekipmanlar/${id}/bakim`, data),
}

// ─── PERSONEL ─────────────────────────────────────────────────────────────────
export const personelApi = {
  list: (params?: Record<string, string>) =>
    api.get('/personel', { params }),
  get: (id: string) => api.get(`/personel/${id}`),
  create: (data: Record<string, unknown>) =>
    api.post('/personel', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/personel/${id}`, data),
  addPuantaj: (kayitlar: unknown[]) =>
    api.post('/personel/puantaj', { kayitlar }),
  puantajRapor: (params?: Record<string, string>) =>
    api.get('/personel/puantaj/rapor', { params }),
}

// ─── NAKİT AKIŞ ───────────────────────────────────────────────────────────────
export const nakitApi = {
  hareketler: (params?: Record<string, string>) =>
    api.get('/nakit/hareketler', { params }),
  analiz: (params?: Record<string, string>) =>
    api.get('/nakit/analiz', { params }),
  create: (data: Record<string, unknown>) =>
    api.post('/nakit/hareketler', data),
}

// ─── GÜNLÜK RAPOR ─────────────────────────────────────────────────────────────
export const gunlukApi = {
  list: (santiyeId: string, params?: Record<string, string>) =>
    api.get(`/santiyeler/${santiyeId}/gunlukler`, { params }),
  create: (santiyeId: string, data: Record<string, unknown>) =>
    api.post(`/santiyeler/${santiyeId}/gunlukler`, data),
  get: (id: string) => api.get(`/gunlukler/${id}`),
  delete: (id: string) => api.delete(`/gunlukler/${id}`),
  getFotolar: (gunlukId: string) => api.get(`/gunlukler/${gunlukId}/fotograflar`),
  uploadFotolar: (gunlukId: string, files: File[]) => {
    const form = new FormData()
    files.forEach(f => form.append('fotograflar', f))
    return api.post(`/gunlukler/${gunlukId}/fotograflar`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

// ─── FATURALAR ────────────────────────────────────────────────────────────────
export const faturaApi = {
  list: (params?: Record<string, string>) =>
    api.get('/faturalar', { params }),
  ozet: () =>
    api.get('/faturalar/ozet'),
  get: (id: string) =>
    api.get(`/faturalar/${id}`),
  create: (data: Record<string, unknown>) =>
    api.post('/faturalar', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/faturalar/${id}`, data),
  gibGonder: (id: string, entegrator_kodu?: string) =>
    api.post(`/faturalar/${id}/gib-gonder`, { entegrator_kodu }),
  ode: (id: string, data: { odeme_tarihi?: string; odeme_notu?: string }) =>
    api.post(`/faturalar/${id}/ode`, data),
  iptal: (id: string, iptal_nedeni?: string) =>
    api.post(`/faturalar/${id}/iptal`, { iptal_nedeni }),
}

// ─── MÜŞTERİ PORTALI ─────────────────────────────────────────────────────────
export const musteriPortalApi = {
  createLink: (santiyeId: string, data: { baslik?: string; gun?: number }) =>
    api.post(`/santiyeler/${santiyeId}/rapor-linki`, data),
  listLinks: (santiyeId: string) =>
    api.get(`/santiyeler/${santiyeId}/rapor-linkleri`),
  deactivate: (linkId: string) =>
    api.delete(`/rapor-linkleri/${linkId}`),
  // Public (no auth) — doğrudan axios ile çağrılır, api.ts interceptor'u token ekler ama 404 gelmez
  getPublic: (token: string) =>
    api.get(`/public/rapor/${token}`),
}

// ─── STOK / DEPO ─────────────────────────────────────────────────────────────
export const stokApi = {
  list: (params?: Record<string, string>) =>
    api.get('/stok', { params }),
  get: (id: string) =>
    api.get(`/stok/${id}`),
  create: (data: Record<string, unknown>) =>
    api.post('/stok', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/stok/${id}`, data),
  addHareket: (data: Record<string, unknown>) =>
    api.post('/stok/hareket', data),
  hareketler: (params?: Record<string, string>) =>
    api.get('/stok/hareketler', { params }),
}

// ─── İHALE MODÜLÜ ─────────────────────────────────────────────────────────────
export const ihaleApi = {
  list: (params?: Record<string, string>) =>
    api.get('/ihale', { params }),
  get: (id: string) =>
    api.get(`/ihale/${id}`),
  parseExcel: (file: File) => {
    const form = new FormData()
    form.append('dosya', file)
    return api.post('/ihale/parse', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  import: (data: Record<string, unknown>) =>
    api.post('/ihale/import', data),
  delete: (id: string) =>
    api.delete(`/ihale/${id}`),
  sablonUrl: () => '/api/v1/ihale/sablon',
}

// ─── TAŞERON ─────────────────────────────────────────────────────────────────
export const taseronApi = {
  list: () => api.get('/taseron'),
  get: (id: string) => api.get(`/taseron/${id}`),
  create: (data: Record<string, unknown>) => api.post('/taseron', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/taseron/${id}`, data),
  // Sözleşmeler
  sozlesmeler: (params?: Record<string, string>) => api.get('/taseron-sozlesmeler', { params }),
  sozlesme: (id: string) => api.get(`/taseron-sozlesmeler/${id}`),
  sozlesmeOlustur: (data: Record<string, unknown>) => api.post('/taseron-sozlesmeler', data),
  sozlesmeGuncelle: (id: string, data: Record<string, unknown>) => api.put(`/taseron-sozlesmeler/${id}`, data),
  // Hakediş
  hakedisler: (sozlesmeId: string) => api.get(`/taseron-sozlesmeler/${sozlesmeId}/hakedis`),
  hakedisOlustur: (sozlesmeId: string, data: Record<string, unknown>) =>
    api.post(`/taseron-sozlesmeler/${sozlesmeId}/hakedis`, data),
  hakedisOnayla: (id: string, data: Record<string, unknown>) =>
    api.post(`/taseron-hakedis/${id}/onayla`, data),
  // Ekipman maliyet
  ekipmanMaliyet: (params?: Record<string, string>) => api.get('/ekipman-maliyet', { params }),
  ekipmanMaliyetEkle: (data: Record<string, unknown>) => api.post('/ekipman-maliyet', data),
  // Puantaj
  puantajGrid: (params: Record<string, string>) => api.get('/puantaj/grid', { params }),
  puantajKaydet: (data: Record<string, unknown>) => api.post('/puantaj/grid', data),
}

// ─── AI UYARI / ANALİTİK ─────────────────────────────────────────────────────
export const aiApi = {
  uyarilar:     () => api.get('/ai/uyarilar'),
  projeRiskler: () => api.get('/ai/proje-riskler'),
  ozet:         () => api.get('/ai/ozet'),
}

export default api
