import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState, Page, PageHeader, SearchField, StatRowSkeleton, TableSkeleton } from '../../components/ui/Page'
import { StatCard } from '../../components/ui/StatCard'
import { badgeFromStatus, formatDate, money, quotationStatusLabel } from '../../lib/format'
import { useCreateQuotation, useQuotations } from '../../lib/hooks'
import { matchesSearch } from '../../lib/search'
import type { QuotationListItem, QuotationStatus } from '../../lib/types'

const FILTERS: { key: QuotationStatus | 'all'; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'returned', label: 'Returned' },
  { key: 'pending_approval', label: 'Pending Approval' },
  { key: 'approved', label: 'Approved' },
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'confirmed', label: 'Confirmed' },
]

export function QuotationsListPage() {
  const { data, isLoading, isError, error } = useQuotations()
  const create = useCreateQuotation()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<QuotationStatus | 'all'>('all')
  const [query, setQuery] = useState('')

  const items = data?.items ?? []
  const filtered = useMemo(() => {
    const byStatus = filter === 'all' ? items : items.filter((q) => q.status === filter)
    return byStatus.filter((q) =>
      matchesSearch(query, [q.number, q.customerName, q.repName, quotationStatusLabel(q.status)]),
    )
  }, [items, filter, query])

  async function newQuote() {
    const created = await create.mutateAsync({})
    navigate(`/app/quotations/${created.id}`)
  }

  const columns: Column<QuotationListItem>[] = [
    { key: 'number', header: 'ID', sortable: true, accessor: (r) => r.number },
    { key: 'customerName', header: 'Deal Name', sortable: true },
    { key: 'date', header: 'Date', sortable: true, render: (r) => formatDate(r.date) },
    {
      key: 'amount',
      header: 'Value',
      sortable: true,
      align: 'right',
      accessor: (r) => r.amount,
      render: (r) => money(r.amount),
    },
    { key: 'repName', header: 'Owner', sortable: true },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge status={badgeFromStatus(r.status)}>{quotationStatusLabel(r.status)}</Badge>,
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Quotations"
        actions={
          <Button variant="commit" onClick={() => void newQuote()} loading={create.isPending}>
            New quotation
          </Button>
        }
      />

      {isLoading ? <StatRowSkeleton /> : null}
      {isError ? <ErrorState message={error instanceof Error ? error.message : 'Failed to load'} /> : null}

      {data ? (
        <div className="grid grid-cols-6 gap-px bg-bronze/30">
          {FILTERS.map((f) => {
            const subset = items.filter((q) => q.status === f.key)
            const total = subset.reduce((s, q) => s + q.amount, 0)
            return (
              <StatCard
                key={f.key}
                label={f.label}
                value={subset.length}
                sublabel={money(total)}
                active={filter === f.key}
                tone={f.key === 'returned' ? 'danger' : undefined}
                onClick={() => setFilter((cur) => (cur === f.key ? 'all' : f.key))}
              />
            )
          })}
        </div>
      ) : null}

      {isLoading ? <TableSkeleton /> : null}
      {data ? (
        <SearchField value={query} onChange={setQuery} placeholder="Search quotations" />
      ) : null}
      {data && filtered.length === 0 ? (
        <EmptyState
          title="No quotations"
          message={query ? 'No quotations match that search.' : 'No quotations in this view.'}
          action={{ label: 'New quotation', onClick: () => void newQuote() }}
        />
      ) : null}

      {data && filtered.length > 0 ? (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/app/quotations/${r.id}`)}
        />
      ) : null}
    </Page>
  )
}
