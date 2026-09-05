import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { ErrorState, Field, Page, PageHeader, TableSkeleton, inputCls } from '../../components/ui/Page'
import { StatCard } from '../../components/ui/StatCard'
import { useAuth } from '../../lib/auth'
import { formatDate } from '../../lib/format'
import { api } from '../../lib/api'
import { useSubscriptions } from '../../lib/hooks'
import type { Subscription } from '../../lib/types'

export function SubscriptionsListPage() {
  const { data, isLoading, isError, error, refetch } = useSubscriptions()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'active' | 'paused' | 'cancelled' | 'all'>('all')
  const [creating, setCreating] = useState(false)
  const [plan, setPlan] = useState('Custom Plan')

  const items = data?.items ?? []
  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((s) => s.status === filter)),
    [items, filter],
  )

  const cols: Column<Subscription>[] = [
    { key: 'customerName', header: 'Customer', sortable: true },
    { key: 'plan', header: 'Plan', sortable: true },
    { key: 'cycle', header: 'Cycle' },
    { key: 'nextBill', header: 'Next Bill', render: (r) => formatDate(r.nextBill) },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge status={r.status}>{r.status}</Badge>,
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Subscriptions"
        actions={
          user?.role === 'admin' ? (
            <Button onClick={() => setCreating((v) => !v)}>+ New Plan (Admin)</Button>
          ) : undefined
        }
      />
      {isLoading ? <TableSkeleton /> : null}
      {isError ? <ErrorState message={error instanceof Error ? error.message : 'Failed to load'} /> : null}
      {data ? (
        <div className="grid grid-cols-3 gap-3">
          {(['active', 'paused', 'cancelled'] as const).map((s) => (
            <StatCard
              key={s}
              label={s}
              value={items.filter((i) => i.status === s).length}
              active={filter === s}
              tone={s === 'active' ? 'ok' : s === 'paused' ? 'warn' : 'danger'}
              onClick={() => setFilter((cur) => (cur === s ? 'all' : s))}
            />
          ))}
        </div>
      ) : null}
      {creating ? (
        <div className="flex items-end gap-3 rounded-md border border-border bg-surface p-4">
          <Field label="Plan name">
            <input className={inputCls('w-64')} value={plan} onChange={(e) => setPlan(e.target.value)} />
          </Field>
          <Button
            onClick={async () => {
              const created = await api<Subscription>('/api/subscriptions', {
                method: 'POST',
                body: JSON.stringify({ plan, amount: 12000, cycle: 'annual' }),
              })
              setCreating(false)
              await refetch()
              navigate(`/app/subscriptions/${created.id}`)
            }}
          >
            Create
          </Button>
        </div>
      ) : null}
      {data ? (
        <DataTable
          columns={cols}
          rows={filtered}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/app/subscriptions/${r.id}`)}
          emptyMessage="No subscriptions in this filter."
        />
      ) : null}
    </Page>
  )
}
