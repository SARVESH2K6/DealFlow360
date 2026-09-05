import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { ErrorState, Page, PageHeader, SearchField, TableSkeleton } from '../../components/ui/Page'
import { StatCard } from '../../components/ui/StatCard'
import { quotationStatusLabel } from '../../lib/format'
import { useApprovals } from '../../lib/hooks'
import { matchesSearch } from '../../lib/search'
import type { ApprovalListItem, ApprovalStatus } from '../../lib/types'

function riskBadge(level: string) {
  return <Badge status={level.toLowerCase()}>{level}</Badge>
}

export function ApprovalsListPage() {
  const { data, isLoading, isError, error } = useApprovals()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<ApprovalStatus | 'all'>('all')
  const [pendingOnly, setPendingOnly] = useState(false)
  const [query, setQuery] = useState('')

  const items = data?.items ?? []
  const filtered = useMemo(() => {
    let rows = items
    if (pendingOnly) rows = rows.filter((r) => r.status === 'pending')
    else if (filter !== 'all') rows = rows.filter((r) => r.status === filter)
    return rows.filter((r) =>
      matchesSearch(query, [r.quotationNumber, r.customerName, r.assignedTo, r.riskLevel, quotationStatusLabel(r.stage)]),
    )
  }, [items, filter, pendingOnly, query])

  const columns: Column<ApprovalListItem>[] = [
    { key: 'quotationNumber', header: 'Quotation', sortable: true },
    { key: 'customerName', header: 'Customer', sortable: true },
    {
      key: 'blendedRisk',
      header: 'Blended Risk',
      sortable: true,
      accessor: (r) => r.riskScore,
      render: (r) => (
        <span className="inline-flex items-center gap-2">
          <span>{r.riskScore}</span>
          {riskBadge(r.riskLevel)}
        </span>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      render: (r) => quotationStatusLabel(r.stage),
    },
    { key: 'assignedTo', header: 'Assigned To', sortable: true },
  ]

  return (
    <Page>
      <PageHeader
        title="Approvals"
        actions={
          <Button variant="secondary" onClick={() => setPendingOnly((v) => !v)}>
            Filter: Pending Only
          </Button>
        }
      />
      {isLoading ? <TableSkeleton /> : null}
      {isError ? <ErrorState message={error instanceof Error ? error.message : 'Failed to load'} /> : null}
      {data ? (
        <div className="grid grid-cols-3 gap-3">
          {(['pending', 'returned', 'approved'] as const).map((s) => {
            const subset = items.filter((i) => i.status === s)
            return (
              <StatCard
                key={s}
                label={s === 'pending' ? 'Pending' : s === 'returned' ? 'Returned' : 'Approved'}
                value={subset.length}
                active={filter === s && !pendingOnly}
                tone={s === 'approved' ? 'ok' : s === 'returned' ? 'danger' : 'warn'}
                onClick={() => {
                  setPendingOnly(false)
                  setFilter((cur) => (cur === s ? 'all' : s))
                }}
              />
            )
          })}
        </div>
      ) : null}
      {data ? (
        <SearchField value={query} onChange={setQuery} placeholder="Search approvals" />
      ) : null}
      {data ? (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/app/approvals/${r.id}`)}
          emptyMessage="No approvals in this filter."
        />
      ) : null}
    </Page>
  )
}
