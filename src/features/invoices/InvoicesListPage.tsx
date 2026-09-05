import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { ErrorState, Page, PageHeader, SearchField, TableSkeleton } from '../../components/ui/Page'
import { StatCard } from '../../components/ui/StatCard'
import { formatDate, money } from '../../lib/format'
import { useInvoices } from '../../lib/hooks'
import { matchesSearch } from '../../lib/search'
import type { Invoice } from '../../lib/types'

export function InvoicesListPage() {
  const { data, isLoading, isError, error } = useInvoices()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'paid' | 'unpaid' | 'all'>('all')
  const [query, setQuery] = useState('')
  const items = data?.items ?? []
  const filtered = useMemo(() => {
    const byStatus = filter === 'all' ? items : items.filter((i) => i.status === filter)
    return byStatus.filter((i) => matchesSearch(query, [i.number, i.customerName, i.status]))
  }, [items, filter, query])

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
        <div className="grid grid-cols-2 gap-3">
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
        <SearchField value={query} onChange={setQuery} placeholder="Search invoices" />
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
