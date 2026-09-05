import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutGrid, Plus, Table2 } from 'lucide-react'
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
  const [view, setView] = useState<'cards' | 'table'>('cards')

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
            <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden />
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
      {data ? <SearchField value={query} onChange={setQuery} placeholder="Search quotations" /> : null}
      {data ? (
        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => setView((v) => (v === 'cards' ? 'table' : 'cards'))}>
            {view === 'cards' ? (
              <Table2 className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            ) : (
              <LayoutGrid className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            )}
            {view === 'cards' ? 'Switch to Table View' : 'Switch to Card View'}
          </Button>
        </div>
      ) : null}
      {data && filtered.length === 0 ? (
        <EmptyState
          title="No quotations"
          message={query ? 'No quotations match that search.' : 'No quotations in this view.'}
          action={{ label: 'New quotation', onClick: () => void newQuote() }}
        />
      ) : null}

      {data && filtered.length > 0 && view === 'table' ? (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/app/quotations/${r.id}`)}
        />
      ) : null}

      {data && filtered.length > 0 && view === 'cards' ? (
        <div className="grid grid-cols-3 gap-px bg-bronze/30">
          {filtered.map((q) => (
            <button
              key={q.id}
              type="button"
              className="bg-sheet px-4 py-3 text-left hover:bg-surfaceAlt"
              onClick={() => navigate(`/app/quotations/${q.id}`)}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-bronze">{q.number}</p>
                <Badge status={badgeFromStatus(q.status)}>{quotationStatusLabel(q.status)}</Badge>
              </div>
              <h3 className="mt-1.5 font-serif text-[16px] leading-tight text-ink">{q.customerName}</h3>
              <p className="mt-1.5 font-serif text-[18px] tabular-nums text-ink">{money(q.amount)}</p>
            </button>
          ))}
        </div>
      ) : null}
    </Page>
  )
}
