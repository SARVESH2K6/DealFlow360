import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { ErrorState, Page, PageHeader, TableSkeleton } from '../../components/ui/Page'
import { StatCard } from '../../components/ui/StatCard'
import { formatDate, money } from '../../lib/format'
import { useInvoices } from '../../lib/hooks'
import type { Invoice } from '../../lib/types'

export function InvoicesListPage() {
  const { data, isLoading, isError, error } = useInvoices()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'paid' | 'unpaid' | 'all'>('all')
  const items = data?.items ?? []
  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => i.status === filter)),
    [items, filter],
  )

  const cols: Column<Invoice>[] = [
    { key: 'number', header: 'Invoice #', sortable: true },
    { key: 'customerName', header: 'Customer', sortable: true },
    { key: 'amount', header: 'Amount', sortable: true, accessor: (r) => r.amount, render: (r) => money(r.amount) },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge status={r.status}>{r.status}</Badge>,
    },
    { key: 'dueDate', header: 'Due Date', render: (r) => formatDate(r.dueDate) },
  ]

  return (
    <Page>
      <PageHeader title="Invoices" />
      {isLoading ? <TableSkeleton /> : null}
      {isError ? <ErrorState message={error instanceof Error ? error.message : 'Failed to load'} /> : null}
      {data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(['unpaid', 'paid'] as const).map((s) => (
            <StatCard
              key={s}
              label={s}
              value={items.filter((i) => i.status === s).length}
              active={filter === s}
              tone={s === 'paid' ? 'ok' : 'warn'}
              onClick={() => setFilter((cur) => (cur === s ? 'all' : s))}
            />
          ))}
        </div>
      ) : null}
      {data ? (
        <DataTable
          columns={cols}
          rows={filtered}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/app/invoices/${r.id}`)}
          emptyMessage="No invoices in this filter."
        />
      ) : null}
    </Page>
  )
}
