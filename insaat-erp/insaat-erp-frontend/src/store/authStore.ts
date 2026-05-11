import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface KullaniciOz {
  id: string
  email: string
  ad?: string
  soyad?: string
  rol?: string
  tenant_id?: string
  tenant_ad?: string
  plan?: string
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  kullanici: KullaniciOz | null
  isAuthenticated: boolean
  setSession: (accessToken: string, refreshToken: string | null, kullanici: KullaniciOz | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      kullanici: null,
      isAuthenticated: false,
      setSession: (accessToken, refreshToken, kullanici) =>
        set({
          accessToken,
          refreshToken: refreshToken ?? accessToken,
          kullanici,
          isAuthenticated: Boolean(accessToken),
        }),
      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          kullanici: null,
          isAuthenticated: false,
        }),
    }),
    { name: 'insaat-erp-auth' }
  )
)
