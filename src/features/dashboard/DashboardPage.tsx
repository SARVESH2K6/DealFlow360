import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState, Page, PageHeader, StatRowSkeleton, TableSkeleton } from '../../components/ui/Page'
import { canSeeApprovals, useAuth } from '../../lib/auth'
import { formatDateTime, money, quotationStatusLabel } from '../../lib/format'
import { useCreateQuotation, useDashboard } from '../../lib/hooks'
import type { DashboardDeal } from '../../lib/types'

export function DashboardPage() {
  const { data, isLoading, isError, error } = useDashboard()
  const { user } = useAuth()
  const navigate = useNavigate()
  const create = useCreateQuotation()
  const deals = data?.deals ?? []

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

  return (
    <Page>
      <PageHeader
        kicker="Confidential ledger"
        title="Portfolio"
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => navigate(canSeeApprovals(user?.role) ? '/app/approvals' : '/app/quotations')}
            >
              {canSeeApprovals(user?.role) ? 'Approvals' : 'Quotations'}
            </Button>
            <Button variant="commit" loading={create.isPending} onClick={() => void newQuote()}>
              New quotation
            </Button>
          </>
        }
      />

      {isLoading ? <StatRowSkeleton /> : null}
      {isError ? <ErrorState message={error instanceof Error ? error.message : 'Failed to load'} /> : null}

      {data ? (
        <div className="grid grid-cols-3 gap-px bg-bronze/30">
          <Metric
            label="Total deal value"
            value={money(data.totalDealValue ?? deals.reduce((sum, d) => sum + d.amount, 0))}
          />
          <Metric label="Active deals" value={String(data.openQuotations)} />
          <Metric label="Avg. discount" value={`${(data.avgDiscount ?? 0).toFixed(1)}%`} />
        </div>
      ) : null}

      <section>
        <h2 className="mb-1 font-serif text-[22px] text-ink">Holdings</h2>
        <p className="mb-5 text-[13px] text-inkMuted">Open and settled deals across the book.</p>
        {isLoading ? <TableSkeleton /> : null}
        {data && deals.length === 0 ? (
          <EmptyState
            title="A blank statement"
            message="No deals have been posted. Open a quotation to begin the book."
            action={{ label: 'New quotation', onClick: () => void newQuote() }}
          />
        ) : null}
        {deals.length > 0 ? (
          <DataTable
            columns={columns}
            rows={deals}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/app/quotations/${r.id}`)}
          />
        ) : null}
      </section>

      <section>
        <h2 className="mb-5 font-serif text-[22px] text-ink">Recent activity</h2>
        {data && data.activity.length === 0 ? (
          <p className="text-[14px] text-inkMuted">No recent entries.</p>
        ) : (
          <ul>
            {data?.activity.map((item) => (
              <li
                key={item.id}
                className="flex items-baseline justify-between gap-8 border-b border-ink/[0.08] py-3.5 last:border-0"
              >
                <span className="text-[14px] text-inkMuted">{item.text}</span>
                <span className="shrink-0 text-[11px] uppercase tracking-[0.08em] text-inkFaint">
                  {formatDateTime(item.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-sheet px-6 py-6">
      <div className="h-px w-10 bg-bronze" />
      <div className="mt-4 font-serif text-[40px] leading-none tracking-tight text-ink">{value}</div>
      <div className="mt-3 text-[10px] font-medium uppercase tracking-[0.16em] text-inkMuted">{label}</div>
    </div>
  )
}
