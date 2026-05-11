import React from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { santiyeApi } from '@/services/api'
import { PageHeader, Card, Spinner, EmptyState, Button } from '@/components/ui'
import type { Santiye } from '@/types'

export const Mesajlar: React.FC = () => {
  const { santiyeId } = useParams<{ santiyeId?: string }>()
  const { data, isLoading } = useQuery({
    queryKey: ['santiyeler', 'mesajlar-menu'],
    queryFn: () => santiyeApi.list({ limit: '100' }).then((r) => r.data.data as Santiye[]),
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Spinner size={32} />
      </div>
    )
  }

  const list: Santiye[] = data || []

  if (santiyeId) {
    return (
      <div>
        <PageHeader title="Şantiye mesajları" sub={`Şantiye: ${santiyeId.slice(0, 8)}…`} />
        <Card>
          <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6 }}>
            Bu ekran ileride sohbet listesi ve gönderim ile doldurulacak. API:{' '}
            <code style={{ color: '#a5b4fc' }}>GET /santiyeler/:id/mesajlar</code>
          </p>
          <Link to="/mesajlar">
            <Button variant="secondary" style={{ marginTop: 16 }}>
              ← Tüm şantiyeler
            </Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Mesajlaşma" sub="Şantiye seçin" />
      {list.length === 0 ? (
        <EmptyState icon="💬" title="Şantiye yok" sub="Önce şantiye oluşturun; sonra odaya girin." />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {list.map((s) => (
            <Link key={s.id} to={`/mesajlar/${s.id}`} style={{ textDecoration: 'none' }}>
              <Card style={{ cursor: 'pointer', transition: 'border-color .2s' }}>
                <div style={{ fontWeight: 700, color: '#e2e8f0' }}>{s.ad}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  {s.il || '—'} · Mesajlar →
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
