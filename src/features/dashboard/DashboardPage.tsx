import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Plus } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState, Page, PageHeader, SearchField, SectionTitle, StatRowSkeleton, TableSkeleton } from '../../components/ui/Page'
import { StatCard } from '../../components/ui/StatCard'
import { canSeeApprovals, useAuth } from '../../lib/auth'
import { formatDateTime, money, quotationStatusLabel } from '../../lib/format'
import { useCreateQuotation, useDashboard } from '../../lib/hooks'
import { matchesSearch } from '../../lib/search'
import type { DashboardDeal } from '../../lib/types'

export function DashboardPage() {
  const { data, isLoading, isError, error } = useDashboard()
  const { user } = useAuth()
  const navigate = useNavigate()
  const create = useCreateQuotation()
  const deals = data?.deals ?? []
  const [query, setQuery] = useState('')
  const visibleDeals = useMemo(
    () => deals.filter((d) => matchesSearch(query, [d.customerName, d.number, quotationStatusLabel(d.status)])),
    [deals, query],
  )

  async function newQuote() {
    const created = await create.mutateAsync({})
    navigate(`/app/quotations/${created.id}`)
  }

  const columns: Column<DashboardDeal>[] = [
    {
      key: 'customerName',
      header: 'Deal Name',
      sortable: true,
      render: (r) => (
        <span>
          {r.customerName}
          <span className="ml-2 text-[12px] text-inkFaint">{r.number}</span>
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Value',
      sortable: true,
      align: 'right',
      accessor: (r) => r.amount,
      render: (r) => money(r.amount),
    },
    { key: 'status', header: 'Stage', render: (r) => quotationStatusLabel(r.status) },
    {
      key: 'riskScore',
      header: 'Risk Score',
      sortable: true,
      align: 'right',
      accessor: (r) => r.riskScore,
    },
    {
      key: 'riskLevel',
      header: 'Status',
      render: (r) => <Badge status={r.riskLevel.toLowerCase()}>{r.riskLevel}</Badge>,
    },
  ]

  const activity = (data?.activity ?? []).slice(0, 8)

  return (
    <Page>
      <PageHeader
        kicker="Internal workspace"
        title="Sales Dashboard"
        actions={
          <>
            <Button variant="commit" loading={create.isPending} onClick={() => void newQuote()}>
              <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              New Quotation
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate(canSeeApprovals(user?.role) ? '/app/approvals' : '/app/quotations')}
            >
              <ClipboardList className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              {canSeeApprovals(user?.role) ? 'View Approvals' : 'View Quotations'}
            </Button>
          </>
        }
      />

      {isLoading ? <StatRowSkeleton /> : null}
      {isError ? <ErrorState message={error instanceof Error ? error.message : 'Failed to load'} /> : null}

      {data ? (
        <div className="grid grid-cols-3 gap-px bg-bronze/30">
          <StatCard label="Pending Approvals" value={data.pendingApprovals} />
          <StatCard label="Open Quotations" value={data.openQuotations} />
          <StatCard label="At Risk Deals" value={data.atRiskDeals} tone="warn" />
        </div>
      ) : null}

      {data ? <SearchField value={query} onChange={setQuery} placeholder="Search holdings" /> : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <section>
          <SectionTitle>Recent activity</SectionTitle>
          {data && data.activity.length === 0 ? (
            <p className="text-[13px] text-inkMuted">No recent entries.</p>
          ) : (
            <ul>
              {activity.map((item) => (
                <li
                  key={item.id}
                  className="flex items-baseline justify-between gap-6 border-b border-ink/[0.08] py-1.5 last:border-0"
                >
                  <span className="min-w-0 truncate text-[13px] text-inkMuted">{item.text}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-[0.08em] text-inkFaint">
                    {formatDateTime(item.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionTitle>Holdings</SectionTitle>
          {isLoading ? <TableSkeleton /> : null}
          {data && visibleDeals.length === 0 ? (
            <EmptyState
              title="A blank statement"
              message={query ? 'No holdings match that search.' : 'No deals have been posted. Open a quotation to begin the book.'}
              action={{ label: 'New quotation', onClick: () => void newQuote() }}
            />
          ) : null}
          {visibleDeals.length > 0 ? (
            <DataTable
              columns={columns}
              rows={visibleDeals}
              rowKey={(r) => r.id}
              onRowClick={(r) => navigate(`/app/quotations/${r.id}`)}
            />
          ) : null}
        </section>
      </div>
    </Page>
  )
}
