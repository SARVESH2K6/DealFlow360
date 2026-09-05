import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { ErrorState, Page, PageHeader, StatRowSkeleton } from '../../components/ui/Page'
import { StatCard } from '../../components/ui/StatCard'
import { canSeeApprovals, useAuth } from '../../lib/auth'
import { formatDateTime } from '../../lib/format'
import { useCreateQuotation, useDashboard } from '../../lib/hooks'

export function DashboardPage() {
  const { data, isLoading, isError, error } = useDashboard()
  const { user } = useAuth()
  const navigate = useNavigate()
  const create = useCreateQuotation()

  return (
    <Page>
      <PageHeader title="Sales Dashboard" />
      {isLoading ? <StatRowSkeleton /> : null}
      {isError ? <ErrorState message={error instanceof Error ? error.message : 'Failed to load'} /> : null}
      {data ? (
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Pending Approvals"
            value={data.pendingApprovals}
            onClick={() => canSeeApprovals(user?.role) && navigate('/app/approvals')}
          />
          <StatCard
            label="Open Quotations"
            value={data.openQuotations}
            onClick={() => navigate('/app/quotations')}
          />
          <StatCard label="At Risk Deals" value={data.atRiskDeals} tone="warn" />
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button
          loading={create.isPending}
          onClick={async () => {
            const created = await create.mutateAsync({})
            navigate(`/app/quotations/${created.id}`)
          }}
        >
          + New Quotation
        </Button>
        {canSeeApprovals(user?.role) ? (
          <Button variant="secondary" onClick={() => navigate('/app/approvals')}>
            View Approvals
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => navigate('/app/quotations')}>
            View Quotations
          </Button>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-[15px] font-medium text-ink">Recent Activity</h2>
        {data && data.activity.length === 0 ? (
          <p className="text-[14px] text-inkMuted">No recent activity.</p>
        ) : (
          <ul className="space-y-2">
            {data?.activity.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-6">
                <span className="text-[14px] text-inkMuted">{item.text}</span>
                <span className="shrink-0 text-[13px] text-inkFaint">{formatDateTime(item.timestamp)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  )
}
