import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { ErrorState, Field, Page, PageHeader, SearchField, TableSkeleton, inputCls } from '../../components/ui/Page'
import { StatCard } from '../../components/ui/StatCard'
import { useAuth } from '../../lib/auth'
import { formatDate } from '../../lib/format'
import { useCreateSubscription, useCustomers, useSubscriptions } from '../../lib/hooks'
import { matchesSearch } from '../../lib/search'
import type { Subscription } from '../../lib/types'

export function SubscriptionsListPage() {
  const { data, isLoading, isError, error } = useSubscriptions()
  const customers = useCustomers()
  const create = useCreateSubscription()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'active' | 'paused' | 'cancelled' | 'all'>('all')
  const [creating, setCreating] = useState(false)
  const [plan, setPlan] = useState('Custom Plan')
  const [customerId, setCustomerId] = useState('')
  const [cycle, setCycle] = useState<'monthly' | 'quarterly' | 'annual'>('annual')
  const [amount, setAmount] = useState(12000)
  const [nextBill, setNextBill] = useState('2026-10-01')
  const [query, setQuery] = useState('')

  const items = data?.items ?? []
  const filtered = useMemo(() => {
    const byStatus = filter === 'all' ? items : items.filter((s) => s.status === filter)
    return byStatus.filter((s) => matchesSearch(query, [s.customerName, s.plan, s.cycle, s.status]))
  }, [items, filter, query])
  const customerItems = customers.data?.items ?? []

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
            <Button onClick={() => setCreating((v) => !v)}>
              <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              New Plan (Admin)
            </Button>
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
        <div className="grid grid-cols-2 gap-4 border border-border bg-surface p-4 md:grid-cols-5">
          <Field label="Plan name">
            <input className={inputCls()} value={plan} onChange={(e) => setPlan(e.target.value)} />
          </Field>
          <Field label="Customer">
            <select className={inputCls()} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Default customer</option>
              {customerItems.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cycle">
            <select
              className={inputCls()}
              value={cycle}
              onChange={(e) => setCycle(e.target.value as 'monthly' | 'quarterly' | 'annual')}
            >
              <option value="monthly">monthly</option>
              <option value="quarterly">quarterly</option>
              <option value="annual">annual</option>
            </select>
          </Field>
          <Field label="Amount">
            <input className={inputCls()} type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </Field>
          <Field label="Next bill">
            <input className={inputCls()} type="date" value={nextBill} onChange={(e) => setNextBill(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button
              variant="commit"
              loading={create.isPending}
              onClick={async () => {
                const created = await create.mutateAsync({
                  plan,
                  customerId: customerId || undefined,
                  amount,
                  cycle,
                  nextBill,
                })
                setCreating(false)
                navigate(`/app/subscriptions/${created.id}`)
              }}
            >
              Create plan
            </Button>
          </div>
        </div>
      ) : null}
      {data ? <SearchField value={query} onChange={setQuery} placeholder="Search subscriptions" /> : null}
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
