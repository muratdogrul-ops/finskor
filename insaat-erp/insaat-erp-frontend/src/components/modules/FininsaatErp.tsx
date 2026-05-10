import React, { useMemo } from 'react'
import { PageHeader } from '@/components/ui'

/** Tam URL veya boşsa same-origin public dosyası (NakitFlow ile aynı mantık). */
function resolveFininsaatErpSrc(): string {
  const u = import.meta.env.VITE_FININSAAT_ERP_URL?.trim()
  if (u) return u
  return '/fininsaat_erp.html'
}

export const FininsaatErp: React.FC = () => {
  const iframeSrc = useMemo(() => resolveFininsaatErpSrc(), [])

  return (
    <div>
      <PageHeader
        title="Fininsaat ERP"
        sub="Yerel panel veya VITE_FININSAAT_ERP_URL ile harici sayfa — NakitFlow ile aynı yükleme modeli"
      />
      <div style={{ display: 'flex', gap: 14, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <a
          href={iframeSrc}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 12, color: '#38bdf8', fontWeight: 600 }}
        >
          Yeni sekmede aç ↗
        </a>
      </div>
      <div
        style={{
          border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 12,
          overflow: 'hidden',
          height: 'min(85vh, 920px)',
          background: '#060810',
        }}
      >
        <iframe
          title="Fininsaat ERP"
          src={iframeSrc}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        />
      </div>
    </div>
  )
}
