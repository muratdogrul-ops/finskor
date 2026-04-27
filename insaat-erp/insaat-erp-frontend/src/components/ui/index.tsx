import React, { useState, useRef } from 'react'
import { durumLabel, durumColor, progColor } from '@/utils/format'

// ─── BADGE ────────────────────────────────────────────────────────────────────
interface BadgeProps { text: string; custom?: string }
export const Badge: React.FC<BadgeProps> = ({ text, custom }) => {
  const color = custom || durumColor[text] || 'amber'
  const label = durumLabel[text] || text
  const styles: Record<string, React.CSSProperties> = {
    green:  { background: 'rgba(0,212,170,.12)',  color: '#00d4aa', border: '1px solid rgba(0,212,170,.25)' },
    blue:   { background: 'rgba(96,165,250,.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,.25)' },
    amber:  { background: 'rgba(245,158,11,.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,.25)' },
    red:    { background: 'rgba(239,68,68,.12)',  color: '#ef4444', border: '1px solid rgba(239,68,68,.25)' },
    purple: { background: 'rgba(167,139,250,.12)',color: '#a78bfa', border: '1px solid rgba(167,139,250,.25)' },
  }
  return (
    <span style={{
      ...styles[color],
      padding: '2px 10px', borderRadius: 99,
      fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block'
    }}>{label}</span>
  )
}

// ─── PROGRESS BAR ─────────────────────────────────────────────────────────────
export const ProgressBar: React.FC<{ value: number; height?: number }> = ({ value, height = 6 }) => (
  <div style={{ background: 'rgba(255,255,255,.08)', borderRadius: 99, height, overflow: 'hidden' }}>
    <div style={{
      width: `${Math.min(value, 100)}%`, height: '100%',
      background: progColor(value), borderRadius: 99,
      transition: 'width .8s ease'
    }} />
  </div>
)

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
interface KpiProps {
  label: string; value: string | number; sub?: string
  color?: string; change?: number; onClick?: () => void
}
export const KpiCard: React.FC<KpiProps> = ({ label, value, sub, color = '#00d4aa', change, onClick }) => (
  <div onClick={onClick} style={{
    background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 12, padding: '16px 18px', cursor: onClick ? 'pointer' : 'default',
    transition: 'border-color .2s',
  }}
    onMouseEnter={e => onClick && ((e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,212,170,.3)')}
    onMouseLeave={e => onClick && ((e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,.08)')}
  >
    <div style={{ color: '#6b7280', fontSize: 10, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
    <div style={{ color, fontSize: 22, fontWeight: 800, letterSpacing: -.5, fontFamily: 'monospace' }}>{value}</div>
    {sub && <div style={{ color: '#6b7280', fontSize: 11, marginTop: 3 }}>{sub}</div>}
    {change !== undefined && (
      <div style={{ color: change >= 0 ? '#00d4aa' : '#ef4444', fontSize: 11, fontWeight: 700, marginTop: 5 }}>
        {change >= 0 ? '▲' : '▼'} {Math.abs(change)}% bu ay
      </div>
    )}
  </div>
)

// ─── CARD ─────────────────────────────────────────────────────────────────────
export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; noPad?: boolean }> = ({ children, style, noPad }) => (
  <div style={{
    background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)',
    borderRadius: 14, padding: noPad ? 0 : 16, overflow: noPad ? 'hidden' : undefined,
    ...style
  }}>{children}</div>
)

// ─── MODAL ────────────────────────────────────────────────────────────────────
interface ModalProps { open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: number }
export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, width = 560 }) => {
  if (!open) return null
  return (
    <div className="erp-modal-backdrop" onClick={onClose}>
      <div
        className="erp-modal-box"
        style={{ maxWidth: width }}
        onClick={e => e.stopPropagation()}
      >
        {/* Mobilde tutma çubuğu */}
        <div style={{ display: 'none' }} className="mob-handle">
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.2)', margin: '0 auto 16px' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ color: '#f1f5f9', fontSize: 17, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,.07)', border: 'none', color: '#9ca3af',
            cursor: 'pointer', width: 32, height: 32, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
          }}>✕</button>
        </div>
        {children}
      </div>
      <style>{`
        .erp-modal-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,.75);
          z-index: 1000; display: flex; align-items: center;
          justify-content: center; padding: 20px;
        }
        .erp-modal-box {
          background: #141b2d; border: 1px solid rgba(255,255,255,.1);
          border-radius: 20px; padding: 28px; width: 100%;
          max-height: 90dvh; overflow-y: auto;
        }
        @media (max-width: 767px) {
          .erp-modal-backdrop {
            padding: 0 !important;
            align-items: flex-end !important;
          }
          .erp-modal-box {
            border-bottom-left-radius: 0 !important;
            border-bottom-right-radius: 0 !important;
            border-bottom: none !important;
            max-height: 96dvh !important;
            padding: 8px 16px 24px !important;
            max-width: 100% !important;
          }
          .mob-handle { display: block !important; }
        }
      `}</style>
    </div>
  )
}

// ─── FORM INPUT ───────────────────────────────────────────────────────────────
interface InputProps {
  label: string; value: string | number; onChange: (v: string) => void
  type?: string; options?: Array<{ value: string; label: string }>
  required?: boolean; disabled?: boolean; placeholder?: string
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 8, padding: '9px 12px', color: '#f1f5f9', fontSize: 13,
  boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit'
}
export const FormInput: React.FC<InputProps> = ({ label, value, onChange, type = 'text', options, required, disabled, placeholder }) => (
  <div style={{ marginBottom: 13 }}>
    <label style={{ color: '#9ca3af', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 5 }}>
      {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
    </label>
    {options ? (
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled} style={inputStyle}>
        {options.map(o => <option key={o.value} value={o.value} style={{ background: '#141b2d' }}>{o.label}</option>)}
      </select>
    ) : (
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        disabled={disabled} placeholder={placeholder}
        style={{ ...inputStyle, opacity: disabled ? .5 : 1 }}
      />
    )}
  </div>
)

// ─── BUTTON ───────────────────────────────────────────────────────────────────
interface BtnProps {
  children: React.ReactNode; onClick?: () => void; type?: 'button' | 'submit'
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; size?: 'sm' | 'md'
  disabled?: boolean; loading?: boolean; style?: React.CSSProperties
}
export const Button: React.FC<BtnProps> = ({
  children, onClick, type = 'button', variant = 'primary',
  size = 'md', disabled, loading, style
}) => {
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: 'linear-gradient(135deg,#00d4aa,#00a896)', color: '#000', border: 'none' },
    secondary: { background: 'rgba(255,255,255,.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,.1)' },
    danger: { background: 'rgba(239,68,68,.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,.25)' },
    ghost: { background: 'transparent', color: '#6b7280', border: 'none' },
  }
  return (
    <button
      type={type} onClick={onClick}
      disabled={disabled || loading}
      style={{
        ...variants[variant],
        padding: size === 'sm' ? '5px 12px' : '9px 18px',
        borderRadius: 9, cursor: disabled || loading ? 'not-allowed' : 'pointer',
        fontWeight: 700, fontSize: size === 'sm' ? 11 : 13,
        display: 'flex', alignItems: 'center', gap: 6,
        opacity: disabled ? .5 : 1, transition: 'opacity .15s',
        fontFamily: 'inherit', ...style
      }}
    >
      {loading ? '⏳' : children}
    </button>
  )
}

// ─── TABLE ────────────────────────────────────────────────────────────────────
interface Column<T> { key: string; label: string; render?: (row: T) => React.ReactNode; width?: string }
interface TableProps<T> { columns: Column<T>[]; data: T[]; onRowClick?: (row: T) => void; emptyText?: string }
export function Table<T extends { id: string }>({ columns, data, onRowClick, emptyText = 'Kayıt bulunamadı' }: TableProps<T>) {
  return (
    <div className="table-scroll">
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,.03)' }}>
            {columns.map(c => (
              <th key={c.key} style={{
                padding: '10px 14px', textAlign: 'left', color: '#6b7280',
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                borderBottom: '1px solid rgba(255,255,255,.07)', width: c.width,
                whiteSpace: 'nowrap'
              }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} style={{ padding: '30px', textAlign: 'center', color: '#4b5563', fontSize: 13 }}>{emptyText}</td></tr>
          ) : (
            data.map(row => (
              <tr key={row.id}
                onClick={() => onRowClick?.(row)}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,.04)',
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background .15s'
                }}
                onMouseEnter={e => onRowClick && ((e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,.03)')}
                onMouseLeave={e => onRowClick && ((e.currentTarget as HTMLTableRowElement).style.background = 'transparent')}
              >
                {columns.map(c => (
                  <td key={c.key} style={{ padding: '10px 14px', fontSize: 12, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                    {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────
export const EmptyState: React.FC<{ icon?: string; title: string; sub?: string; action?: React.ReactNode }> = ({ icon = '📋', title, sub, action }) => (
  <div style={{ textAlign: 'center', padding: '48px 24px' }}>
    <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
    <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{title}</div>
    {sub && <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>{sub}</div>}
    {action}
  </div>
)

// ─── SPINNER ─────────────────────────────────────────────────────────────────
export const Spinner: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    border: `2px solid rgba(255,255,255,.1)`,
    borderTop: `2px solid #00d4aa`,
    animation: 'spin 0.8s linear infinite',
  }} />
)

// ─── PAGE HEADER ─────────────────────────────────────────────────────────────
export const PageHeader: React.FC<{
  title: string; sub?: string; action?: React.ReactNode
}> = ({ title, sub, action }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
    <div style={{ minWidth: 0 }}>
      <h1 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 800, margin: 0 }}>{title}</h1>
      {sub && <p style={{ color: '#6b7280', fontSize: 12, margin: '3px 0 0' }}>{sub}</p>}
    </div>
    {action && <div style={{ flexShrink: 0 }}>{action}</div>}
  </div>
)
