import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { Button, FormInput, Card } from '@/components/ui'

export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const [email, setEmail] = useState('')
  const [sifre, setSifre] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !sifre) {
      toast.error('E-posta ve şifre gerekli')
      return
    }
    setLoading(true)
    try {
      const res = await authApi.login(email.trim(), sifre)
      const d = res.data?.data as
        | {
            accessToken?: string
            token?: string
            refreshToken?: string
            kullanici?: { id: string; email: string; ad?: string; soyad?: string; rol?: string; tenant_id?: string }
          }
        | undefined
      const tok = d?.accessToken ?? d?.token
      if (!res.data?.success || !tok || !d?.kullanici) {
        toast.error((res.data as { message?: string })?.message || 'Giriş başarısız')
        return
      }
      setSession(tok, d.refreshToken ?? tok, d.kullanici)
      toast.success('Hoş geldiniz')
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? String((err as { response?: { data?: { message?: string } } }).response?.data?.message || '')
          : String(err)
      toast.error(msg || 'Giriş yapılamadı')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #0a0e1a 0%, #111827 50%, #0f172a 100%)',
        padding: 24,
      }}
    >
      <Card style={{ width: '100%', maxWidth: 400, padding: 28 }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', letterSpacing: -0.5 }}>Fininsaat ERP</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>Yerel: API http://127.0.0.1:3000 — bu sayfa Vite (5173)</div>
        </div>
        <form onSubmit={submit}>
          <FormInput label="E-posta" value={email} onChange={setEmail} type="email" placeholder="info@finerp.tr" required />
          <FormInput label="Şifre" value={sifre} onChange={setSifre} type="password" required />
          <Button type="submit" loading={loading} style={{ width: '100%', marginTop: 16 }}>
            Giriş yap
          </Button>
        </form>
      </Card>
    </div>
  )
}
