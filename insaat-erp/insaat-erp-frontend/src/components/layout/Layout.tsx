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

// Mobil alt çubukta gösterilecek 5 ana sekme
const bottomNavItems = [
  { path: '/dashboard',  label: 'Ana Sayfa', icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z' },
  { path: '/santiyeler', label: 'Şantiyeler', icon: 'M12 3L2 12h3v9h6v-6h2v6h6v-9h3L12 3z' },
  { path: '/mesajlar',   label: 'Mesajlar', icon: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z' },
  { path: '/hakedisler', label: 'Hakedişler', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z' },
]

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { kullanici, refreshToken, logout } = useAuthStore()

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  const handleLogout = async () => {
    try { if (refreshToken) await authApi.logout(refreshToken) } finally {
      logout(); navigate('/giris'); toast.success('Çıkış yapıldı')
    }
  }

  const activeItem = navItems.find(n => location.pathname.startsWith(n.path))
  const sidebarWidth = collapsed ? 60 : 220

  return (
    <div className="erp-root">

      {/* MOBİL OVERLAY */}
      {mobileOpen && (
        <div className="mob-overlay" onClick={() => setMobileOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside
        className={`erp-sidebar${mobileOpen ? ' sidebar-open' : ''}${collapsed ? ' collapsed' : ''}`}
        style={{ width: sidebarWidth }}
      >

        {/* Logo + Collapse Toggle (masaüstü) */}
        <div className="sidebar-logo">
          <div className="logo-icon">İ</div>
          {!collapsed && (
            <div className="logo-text">
              <div className="logo-name">İnşaatERP</div>
              <div className="logo-ver">v2.0 Enterprise</div>
            </div>
          )}
          <button className="collapse-btn desk-only" onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Genişlet' : 'Daralt'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d={collapsed ? 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z' : 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z'} />
            </svg>
          </button>
        </div>

        {/* Firma */}
        {!collapsed && kullanici && (
          <div className="sidebar-firma">
            <div className="firma-label">Firma</div>
            <div className="firma-ad">{kullanici.tenant_ad}</div>
            <div className="firma-plan">{kullanici.plan} plan</div>
          </div>
        )}

        {/* Nav */}
        <nav className="sidebar-nav">
          {navItems.map(item => {
            const isActive = location.pathname.startsWith(item.path)
            return (
              <Link key={item.path} to={item.path}
                className={`nav-item${isActive ? ' active' : ''}`}
                title={collapsed ? item.label : undefined}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="nav-icon">
                  <path d={item.icon} />
                </svg>
                {!collapsed && <span className="nav-label">{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Kullanıcı */}
        {kullanici && (
          <div className="sidebar-user">
            <div className="user-avatar" style={{ background: avatarColor(kullanici.id) }}>
              {initials(kullanici.ad, kullanici.soyad)}
            </div>
            {!collapsed && (
              <>
                <div className="user-info">
                  <div className="user-name">{kullanici.ad} {kullanici.soyad}</div>
                  <div className="user-rol">{kullanici.rol}</div>
                </div>
                <button onClick={handleLogout} className="logout-btn" title="Çıkış yap">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                  </svg>
                </button>
              </>
            )}
          </div>
        )}
      </aside>

      {/* MAIN */}
      <div className="erp-main">

        {/* Topbar */}
        <header className="erp-topbar">
          <button className="hamburger" onClick={() => {
            if (window.innerWidth < 768) setMobileOpen(o => !o)
            else setCollapsed(c => !c)
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
            </svg>
          </button>

          <div className="topbar-title">
            <div className="page-title">{activeItem?.label || 'İnşaatERP'}</div>
            <div className="page-date desk-only">
              {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>

          <div style={{ flex: 1 }} />

          <div className="topbar-tenant desk-only">{kullanici?.tenant_ad}</div>

          {/* Mobil çıkış */}
          <button className="mob-only logout-btn-mob" onClick={handleLogout}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
          </button>
        </header>

        {/* Content */}
        <main className="erp-content">
          {children}
        </main>

        {/* MOBİL ALT NAVİGASYON */}
        <nav className="bottom-nav mob-only">
          {bottomNavItems.map(item => {
            const isActive = location.pathname.startsWith(item.path)
            return (
              <Link key={item.path} to={item.path} className={`bottom-nav-item${isActive ? ' active' : ''}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d={item.icon} />
                </svg>
                <span>{item.label}</span>
              </Link>
            )
          })}
          {/* Daha Fazla butonu */}
          <button className={`bottom-nav-item${mobileOpen ? ' active' : ''}`} onClick={() => setMobileOpen(o => !o)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
            </svg>
            <span>Menü</span>
          </button>
        </nav>
      </div>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow: hidden; background: #0a0e1a; font-family: 'DM Sans','Segoe UI',sans-serif; }
        @keyframes spin { to { transform: rotate(360deg) } }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 2px; }
        a { text-decoration: none; }
        input, select, textarea, button { font-family: inherit; }

        /* ── ROOT ── */
        .erp-root { display: flex; height: 100dvh; background: #0a0e1a; overflow: hidden; color: #f1f5f9; }

        /* ── SIDEBAR ── */
        .erp-sidebar {
          flex-shrink: 0;
          background: #0d1526; border-right: 1px solid rgba(255,255,255,.06);
          display: flex; flex-direction: column; transition: width .25s, transform .25s;
          overflow: hidden; z-index: 50;
        }

        .sidebar-logo {
          padding: 16px 14px; border-bottom: 1px solid rgba(255,255,255,.06);
          display: flex; align-items: center; gap: 10; flex-shrink: 0; position: relative;
        }
        .logo-icon {
          width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
          background: linear-gradient(135deg,#00d4aa,#00a896);
          display: flex; align-items: center; justify-content: center;
          color: #000; font-weight: 900; font-size: 15px;
        }
        .logo-text { overflow: hidden; }
        .logo-name { font-weight: 800; font-size: 13px; color: #f1f5f9; white-space: nowrap; }
        .logo-ver  { font-size: 10px; color: #4b5563; }
        .collapse-btn {
          position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
          background: none; border: none; color: #4b5563; cursor: pointer;
          width: 24px; height: 24px; border-radius: 4px; display: flex; align-items: center; justify-content: center;
        }
        .collapse-btn:hover { background: rgba(255,255,255,.06); color: #9ca3af; }

        .sidebar-firma {
          padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,.04);
          background: rgba(0,212,170,.04); flex-shrink: 0;
        }
        .firma-label { font-size: 10px; color: #4b5563; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; }
        .firma-ad    { font-size: 12px; color: #00d4aa; font-weight: 700; margin-top: 2px; }
        .firma-plan  { font-size: 10px; color: #4b5563; margin-top: 1px; }

        .sidebar-nav { flex: 1; padding: 10px 6px; overflow-y: auto; overflow-x: hidden; }
        .nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 10px; border-radius: 8px; margin-bottom: 2px;
          background: transparent; color: #6b7280;
          border-left: 2px solid transparent;
          font-size: 12px; font-weight: 500; white-space: nowrap;
          overflow: hidden; transition: all .15s; cursor: pointer;
        }
        .nav-item:hover  { background: rgba(255,255,255,.04); color: #9ca3af; }
        .nav-item.active { background: rgba(0,212,170,.1); color: #00d4aa; border-left-color: #00d4aa; font-weight: 700; }
        .nav-icon { flex-shrink: 0; }
        .nav-label { overflow: hidden; text-overflow: ellipsis; }

        .sidebar-user {
          padding: 10px 6px; border-top: 1px solid rgba(255,255,255,.06);
          display: flex; align-items: center; gap: 8px; padding: 8px 10px; flex-shrink: 0;
        }
        .user-avatar {
          width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: #fff;
        }
        .user-info { flex: 1; min-width: 0; }
        .user-name { font-size: 11px; font-weight: 700; color: #f1f5f9; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .user-rol  { font-size: 10px; color: #4b5563; }
        .logout-btn { background: none; border: none; color: #4b5563; cursor: pointer; padding: 4px; flex-shrink: 0; }
        .logout-btn:hover { color: #ef4444; }

        /* ── MAIN ── */
        .erp-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

        /* ── TOPBAR ── */
        .erp-topbar {
          height: 54px; background: rgba(13,21,38,.98);
          border-bottom: 1px solid rgba(255,255,255,.06);
          display: flex; align-items: center; padding: 0 18px; gap: 12; flex-shrink: 0;
        }
        .hamburger { background: none; border: none; color: #6b7280; cursor: pointer; padding: 6px; border-radius: 6px; display: flex; align-items: center; }
        .hamburger:hover { background: rgba(255,255,255,.06); color: #9ca3af; }
        .topbar-title { }
        .page-title { font-weight: 700; font-size: 14px; color: #f1f5f9; }
        .page-date   { font-size: 10px; color: #4b5563; margin-top: 1px; }
        .topbar-tenant { font-size: 11px; color: #4b5563; }
        .logout-btn-mob { background: none; border: none; color: #6b7280; cursor: pointer; padding: 6px; }

        /* ── CONTENT ── */
        .erp-content { flex: 1; overflow-y: auto; padding: 20px; color: #f1f5f9; }

        /* ── BOTTOM NAV ── */
        .bottom-nav {
          display: none;
          background: #0d1526; border-top: 1px solid rgba(255,255,255,.08);
          padding: 6px 0 max(6px, env(safe-area-inset-bottom));
        }
        .bottom-nav-item {
          display: flex; flex-direction: column; align-items: center; gap: 3px;
          flex: 1; padding: 6px 4px; background: none; border: none;
          color: #4b5563; font-size: 10px; font-weight: 500; cursor: pointer; text-decoration: none;
          transition: color .15s;
        }
        .bottom-nav-item.active { color: #00d4aa; }
        .bottom-nav-item:hover  { color: #9ca3af; }

        /* ── HELPER CLASSES ── */
        .mob-only  { display: none !important; }
        .desk-only { display: block; }

        /* ── TABLET ── */
        @media (min-width: 768px) and (max-width: 1023px) {
          .erp-sidebar { width: 60px !important; }
          .nav-label, .logo-text, .sidebar-firma, .user-info, .logout-btn { display: none !important; }
          .collapse-btn { display: none; }
        }

        /* ── MOBİL ── */
        @media (max-width: 767px) {
          .erp-root { flex-direction: column; }

          .erp-sidebar {
            position: fixed !important;
            top: 0; left: 0; bottom: 0; width: 260px !important;
            transform: translateX(-100%); z-index: 100;
            box-shadow: 4px 0 24px rgba(0,0,0,.6);
          }
          .erp-sidebar.sidebar-open { transform: translateX(0) !important; }
          .collapse-btn { display: none !important; }

          .mob-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,.6);
            z-index: 90; touch-action: none;
          }

          .mob-only  { display: flex !important; }
          .desk-only { display: none !important; }

          .erp-topbar { padding: 0 12px; gap: 8px; }
          .erp-content { padding: 12px; padding-bottom: 80px; }

          .bottom-nav {
            display: flex; position: sticky; bottom: 0;
            z-index: 40; width: 100%;
          }

          /* Responsive grid */
          .r-grid-4 { grid-template-columns: 1fr 1fr !important; }
          .r-grid-3 { grid-template-columns: 1fr 1fr !important; }
          .r-grid-2 { grid-template-columns: 1fr !important; }
          .r-grid-auto { grid-template-columns: 1fr !important; }

          /* Tablolar yatay kaydır */
          .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          table { min-width: 600px; }

          /* Kartlar tam genişlik */
          .card-full-mob { width: 100% !important; }
        }

        /* ── FORM RESPONSIVE ── */
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 600px) {
          .form-grid { grid-template-columns: 1fr !important; }
        }

        /* ── GENEL ── */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px; margin-bottom: 20px;
        }
        @media (max-width: 480px) {
          .kpi-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
        }
      `}</style>
    </div>
  )
}
