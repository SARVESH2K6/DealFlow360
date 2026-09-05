import { useParams } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { InfoBanner } from '../../components/ui/InfoBanner'
import { ErrorState, Page, PageHeader, TableSkeleton } from '../../components/ui/Page'
import { useToast } from '../../components/ui/Toast'
import { formatDate, money } from '../../lib/format'
import { useSubscriptionAction, useSubscriptionDetail } from '../../lib/hooks'
import type { OneTimeLine, RecurringLine } from '../../lib/types'

export function SubscriptionDetailPage() {
  const { id } = useParams()
  const { push } = useToast()
  const { data, isLoading, isError, error } = useSubscriptionDetail(id)
  const action = useSubscriptionAction(id ?? '')

  if (isLoading) {
    return (
      <Page>
        <PageHeader title="Subscription" />
        <TableSkeleton />
      </Page>
    )
  }
  if (isError || !data) {
    return (
      <Page>
        <ErrorState message={error instanceof Error ? error.message : 'Not found'} />
      </Page>
    )
  }

  const oneTimeCols: Column<OneTimeLine>[] = [
    { key: 'productName', header: 'Product' },
    { key: 'qty', header: 'Qty' },
    { key: 'amount', header: 'Amount', render: (r) => money(r.amount) },
  ]
  const recCols: Column<RecurringLine>[] = [
    { key: 'plan', header: 'Plan' },
    { key: 'cycle', header: 'Cycle' },
    { key: 'nextBillDate', header: 'Next Bill Date', render: (r) => formatDate(r.nextBillDate) },
    { key: 'amount', header: 'Amount', render: (r) => money(r.amount) },
  ]

  return (
    <Page>
      <PageHeader
        title={`${data.customerName} · ${data.plan}`}
        actions={<Badge status={data.status}>{data.status}</Badge>}
      />
      <section>
        <h2 className="mb-3 text-[15px] font-medium text-ink">One-Time Lines (from originating order)</h2>
        <DataTable columns={oneTimeCols} rows={data.oneTimeLines} rowKey={(r) => r.productName} emptyMessage="No one-time lines." />
      </section>
      <section>
        <h2 className="mb-3 text-[15px] font-medium text-ink">Recurring Lines</h2>
        <DataTable columns={recCols} rows={data.recurringLines} rowKey={(r) => r.plan} emptyMessage="No recurring lines." />
      </section>
      <InfoBanner>
        Recurring lines are invoiced at the start of each billing period, independently of one-time hardware on the originating order.
      </InfoBanner>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          loading={action.isPending && action.variables?.action === 'modify'}
          onClick={async () => {
            await action.mutateAsync({
              action: 'modify',
              body: { status: data.status === 'paused' ? 'active' : 'paused' },
            })
            push('Subscription updated.', 'ok')
          }}
        >
          Modify Subscription
        </Button>
        <Button
          variant="danger"
          loading={action.isPending && action.variables?.action === 'cancel'}
          onClick={async () => {
            await action.mutateAsync({ action: 'cancel' })
            push('Subscription cancelled.', 'danger')
          }}
        >
          Cancel Subscription
        </Button>
      </div>
    </Page>
  )
}
