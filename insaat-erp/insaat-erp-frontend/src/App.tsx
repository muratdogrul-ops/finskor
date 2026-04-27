import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { Layout } from '@/components/layout/Layout'
import { LoginPage } from '@/components/modules/LoginPage'
import { Spinner } from '@/components/ui'

// Lazy load modules
const Dashboard    = lazy(() => import('@/components/modules/Dashboard').then(m => ({ default: m.Dashboard })))
const Santiyeler   = lazy(() => import('@/components/modules/Santiyeler').then(m => ({ default: m.Santiyeler })))
const SantiyeDetay = lazy(() => import('@/components/modules/SantiyeDetay').then(m => ({ default: m.SantiyeDetay })))
const Mesajlar     = lazy(() => import('@/components/modules/Mesajlar').then(m => ({ default: m.Mesajlar })))
const Hakedisler   = lazy(() => import('@/components/modules/Hakedisler').then(m => ({ default: m.Hakedisler })))
const Satinalma    = lazy(() => import('@/components/modules/Satinalma').then(m => ({ default: m.Satinalma })))
const Ekipmanlar   = lazy(() => import('@/components/modules/Ekipmanlar').then(m => ({ default: m.Ekipmanlar })))
const Personel     = lazy(() => import('@/components/modules/Personel').then(m => ({ default: m.Personel })))
const NakitAkis    = lazy(() => import('@/components/modules/NakitAkis').then(m => ({ default: m.NakitAkis })))
const Finans       = lazy(() => import('@/components/modules/Finans').then(m => ({ default: m.Finans })))
const Faturalar    = lazy(() => import('@/components/modules/Faturalar').then(m => ({ default: m.Faturalar })))
const MusteriRaporu = lazy(() => import('@/components/modules/MusteriRaporu').then(m => ({ default: m.MusteriRaporu })))
const IhaleImport   = lazy(() => import('@/components/modules/IhaleImport'))
const ZincirGorunum  = lazy(() => import('@/components/modules/ZincirGorunum').then(m => ({ default: m.ZincirGorunum })))
const MusteriPortal  = lazy(() => import('@/components/modules/MusteriPortal').then(m => ({ default: m.MusteriPortal })))
const StokDepo       = lazy(() => import('@/components/modules/Stok').then(m => ({ default: m.StokDepo })))
const AiUyarilar     = lazy(() => import('@/components/modules/AiUyarilar').then(m => ({ default: m.AiUyarilar })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/giris" replace />
  return <>{children}</>
}

const LoadingScreen: React.FC = () => (
  <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a' }}>
    <Spinner size={32} />
  </div>
)

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/giris" element={<LoginPage />} />
          {/* PUBLIC — login gerektirmez */}
          <Route path="/p/:token" element={
            <Suspense fallback={<LoadingScreen />}><MusteriPortal /></Suspense>
          } />
          <Route path="/*" element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<LoadingScreen />}>
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/santiyeler" element={<Santiyeler />} />
                    <Route path="/santiyeler/:id" element={<SantiyeDetay />} />
                    <Route path="/mesajlar" element={<Mesajlar />} />
                    <Route path="/mesajlar/:santiyeId" element={<Mesajlar />} />
                    <Route path="/hakedisler" element={<Hakedisler />} />
                    <Route path="/satinalma" element={<Satinalma />} />
                    <Route path="/ekipmanlar" element={<Ekipmanlar />} />
                    <Route path="/personel" element={<Personel />} />
                    <Route path="/nakit" element={<NakitAkis />} />
                    <Route path="/finans" element={<Finans />} />
                    <Route path="/faturalar" element={<Faturalar />} />
                    <Route path="/rapor/:id" element={<MusteriRaporu />} />
                    <Route path="/ihale" element={<IhaleImport />} />
                    <Route path="/ihale/:id" element={<IhaleImport />} />
                    <Route path="/zincir" element={<ZincirGorunum />} />
                    <Route path="/stok" element={<StokDepo />} />
                    <Route path="/ai-uyarilar" element={<AiUyarilar />} />
                  </Routes>
                </Suspense>
              </Layout>
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1e2a3a', color: '#f1f5f9', border: '1px solid rgba(255,255,255,.1)' },
          success: { iconTheme: { primary: '#00d4aa', secondary: '#000' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
    </QueryClientProvider>
  )
}
