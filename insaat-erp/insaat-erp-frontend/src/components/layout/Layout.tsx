import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { initials, avatarColor } from '@/utils/format'
import toast from 'react-hot-toast'
import { authApi } from '@/services/api'

const navItems = [
  { path: '/dashboard',   label: 'Genel Bakış',  icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z' },
  { path: '/santiyeler',  label: 'Şantiyeler',   icon: 'M12 3L2 12h3v9h6v-6h2v6h6v-9h3L12 3z' },
  { path: '/mesajlar',    label: 'Mesajlaşma',   icon: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z' },
  { path: '/hakedisler',  label: 'Hakedişler',   icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z' },
  { path: '/satinalma',   label: 'Satın Alma',   icon: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45C5.09 12.32 5 12.65 5 13c0 1.1.9 2 2 2h11v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H17c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 21.46 4H5.21l-.94-2H1z' },
  { path: '/ekipmanlar',  label: 'Ekipmanlar',   icon: 'M20 8h-2.81c-.45-.78-1.07-1.45-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5s-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09C6.04 10.33 6 10.66 6 11v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81C7.85 19.79 9.78 21 12 21s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8z' },
  { path: '/personel',    label: 'Personel',     icon: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' },
  { path: '/nakit',       label: 'Nakit Akışı',  icon: 'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z' },
  { path: '/finans',      label: 'Finans',       icon: 'M3 3h18v2H3zm0 4h18v2H3zm0 4h18v2H3zm0 4h12v2H3z' },
  { path: '/faturalar',   label: 'e-Fatura',     icon: 'M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z' },
  { path: '/zincir',      label: 'Tahsilat Zinciri', icon: 'M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z' },
  { path: '/stok',        label: 'Stok / Depo',  icon: 'M20 6h-2.18c.07-.44.18-.88.18-1 0-2.21-1.79-4-4-4s-4 1.79-4 4c0 .12.11.56.18 1H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-3c1.1 0 2 .9 2 2 0 .12-.11.56-.18 1h-3.64C12.11 5.56 12 5.12 12 5c0-1.1.9-2 2-2zm-2 14l-2-2 1.41-1.41L12 15.17l4.59-4.58L18 12l-6 6z' },
  { path: '/ihale',       label: 'İhale / Teklif', icon: 'M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z' },
  { path: '/ai-uyarilar', label: 'AI Uyarılar',   icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z' },
  { path: '/admin',       label: 'Admin Paneli',  icon: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z' },
]

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { kullanici, refreshToken, logout } = useAuthStore()

  // Mobilde sayfa değişince menüyü kapat
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken)
    } finally {
      logout()
      navigate('/giris')
      toast.success('Çıkış yapıldı')
    }
  }

  const activeItem = navItems.find(n => location.pathname.startsWith(n.path))

  const sidebarWidth = collapsed ? 60 : 220

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0e1a', fontFamily: "'DM Sans','Segoe UI',sans-serif", overflow: 'hidden' }}>

      {/* MOBİL OVERLAY */}
      {mobileOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
            zIndex: 40, display: 'none',
          }}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`sidebar${mobileOpen ? ' sidebar-open' : ''}`}
        style={{
          width: sidebarWidth, flexShrink: 0,
          background: '#0d1526', borderRight: '1px solid rgba(255,255,255,.06)',
          display: 'flex', flexDirection: 'column', transition: 'width .25s, transform .25s',
          overflow: 'hidden', zIndex: 50,
        }}
      >
        {/* Logo */}
        <div style={{ padding: '16px 14px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg,#00d4aa,#00a896)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#000', fontWeight: 900, fontSize: 15
          }}>İ</div>
          {!collapsed && (
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#f1f5f9', whiteSpace: 'nowrap' }}>İnşaatERP</div>
              <div style={{ fontSize: 10, color: '#4b5563' }}>v2.0 Enterprise</div>
            </div>
          )}
        </div>

        {/* Firma adı */}
        {!collapsed && kullanici && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,.04)', background: 'rgba(0,212,170,.04)' }}>
            <div style={{ fontSize: 10, color: '#4b5563', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5 }}>Firma</div>
            <div style={{ fontSize: 12, color: '#00d4aa', fontWeight: 700, marginTop: 2 }}>{kullanici.tenant_ad}</div>
            <div style={{ fontSize: 10, color: '#4b5563', marginTop: 1 }}>{kullanici.plan} plan</div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 6px', overflowY: 'auto' }}>
          {navItems.map(item => {
            const isActive = location.pathname.startsWith(item.path)
            return (
              <Link key={item.path} to={item.path} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 8, marginBottom: 2,
                background: isActive ? 'rgba(0,212,170,.1)' : 'transparent',
                color: isActive ? '#00d4aa' : '#6b7280',
                borderLeft: `2px solid ${isActive ? '#00d4aa' : 'transparent'}`,
                textDecoration: 'none', fontSize: 12, fontWeight: isActive ? 700 : 500,
                whiteSpace: 'nowrap', overflow: 'hidden', transition: 'all .15s'
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                  <path d={item.icon} />
                </svg>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Kullanıcı */}
        <div style={{ padding: '10px 6px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
          {kullanici && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px' }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: avatarColor(kullanici.id),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#fff'
              }}>{initials(kullanici.ad, kullanici.soyad)}</div>
              {!collapsed && (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {kullanici.ad} {kullanici.soyad}
                    </div>
                    <div style={{ fontSize: 10, color: '#4b5563' }}>{kullanici.rol}</div>
                  </div>
                  <button onClick={handleLogout} title="Çıkış yap" style={{
                    background: 'none', border: 'none', color: '#4b5563',
                    cursor: 'pointer', padding: 4, flexShrink: 0
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                    </svg>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Topbar */}
        <header style={{
          height: 54, background: 'rgba(13,21,38,.98)',
          borderBottom: '1px solid rgba(255,255,255,.06)',
          display: 'flex', alignItems: 'center', padding: '0 18px', gap: 12, flexShrink: 0
        }}>
          {/* Masaüstü: collapse toggle / Mobil: hamburger */}
          <button
            className="menu-toggle"
            onClick={() => {
              if (window.innerWidth < 768) setMobileOpen(o => !o)
              else setCollapsed(c => !c)
            }}
            style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 4 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
            </svg>
          </button>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9' }}>{activeItem?.label || 'İnşaatERP'}</div>
            <div style={{ fontSize: 10, color: '#4b5563' }} className="hide-mobile">
              {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11, color: '#4b5563' }} className="hide-mobile">
            {kullanici?.tenant_ad}
          </div>
          {/* Mobil: çıkış */}
          <button
            className="show-mobile"
            onClick={handleLogout}
            style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', padding: 4, display: 'none' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
          </button>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 20, color: '#f1f5f9' }}>
          {children}
        </main>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow: hidden; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 2px; }
        a { text-decoration: none; }
        input, select, textarea, button { font-family: inherit; }

        /* ── MOBİL RESPONSIVE ── */
        @media (max-width: 767px) {
          .sidebar {
            position: fixed !important;
            top: 0; left: 0; bottom: 0;
            width: 240px !important;
            transform: translateX(-100%);
            z-index: 50;
            box-shadow: 4px 0 24px rgba(0,0,0,.5);
          }
          .sidebar.sidebar-open {
            transform: translateX(0) !important;
          }
          .mobile-overlay {
            display: block !important;
          }
          .hide-mobile { display: none !important; }
          .show-mobile { display: flex !important; }
          main { padding: 12px !important; }
        }

        /* ── TABLO MOBİL ── */
        @media (max-width: 767px) {
          table { display: block; overflow-x: auto; white-space: nowrap; }
          .grid-responsive { grid-template-columns: 1fr !important; }
          .grid-2 { grid-template-columns: 1fr !important; }
          .grid-3 { grid-template-columns: 1fr 1fr !important; }
          .grid-4 { grid-template-columns: 1fr 1fr !important; }
        }

        /* ── TABLET ── */
        @media (min-width: 768px) and (max-width: 1023px) {
          .grid-4 { grid-template-columns: repeat(2,1fr) !important; }
          .grid-3 { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>
    </div>
  )
}
