import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { InfoBanner } from '../../components/ui/InfoBanner'
import { ErrorState, Field, Page, PageHeader, TableSkeleton, inputCls } from '../../components/ui/Page'
import { useToast } from '../../components/ui/Toast'
import { formatDate, money } from '../../lib/format'
import { useSubscriptionAction, useSubscriptionDetail } from '../../lib/hooks'
import type { OneTimeLine, RecurringLine } from '../../lib/types'

export function SubscriptionDetailPage() {
  const { id } = useParams()
  const { push } = useToast()
  const { data, isLoading, isError, error } = useSubscriptionDetail(id)
  const action = useSubscriptionAction(id ?? '')
  const [editing, setEditing] = useState(false)
  const [plan, setPlan] = useState('')
  const [cycle, setCycle] = useState('annual')
  const [amount, setAmount] = useState(0)
  const [status, setStatus] = useState<'active' | 'paused' | 'cancelled'>('active')
  const [nextBill, setNextBill] = useState('')

  useEffect(() => {
    if (!data) return
    setPlan(data.plan)
    setCycle(data.cycle)
    setAmount(data.amount)
    setStatus(data.status)
    setNextBill(data.nextBill.slice(0, 10))
  }, [data])

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
  const cancelled = data.status === 'cancelled'

  return (
    <Page>
      <PageHeader
        title={`${data.customerName} · ${data.plan}`}
        actions={<Badge status={data.status}>{data.status}</Badge>}
      />
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 font-serif text-[18px] text-ink">One-time lines</h2>
          <DataTable columns={oneTimeCols} rows={data.oneTimeLines} rowKey={(r) => r.productName} emptyMessage="No one-time lines." />
        </section>
        <section>
          <h2 className="mb-2 font-serif text-[18px] text-ink">Recurring lines</h2>
          <DataTable columns={recCols} rows={data.recurringLines} rowKey={(r) => r.plan} emptyMessage="No recurring lines." />
        </section>
      </div>
      <InfoBanner>
        Recurring lines are invoiced at the start of each billing period, independently of one-time hardware on the originating order.
      </InfoBanner>
      {cancelled ? (
        <p className="text-[13px] text-inkMuted">This subscription is cancelled. Invoices already issued are unchanged.</p>
      ) : editing ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-border bg-surface p-4 md:grid-cols-4">
          <Field label="Plan">
            <input className={inputCls()} value={plan} onChange={(e) => setPlan(e.target.value)} />
          </Field>
          <Field label="Cycle">
            <select className={inputCls()} value={cycle} onChange={(e) => setCycle(e.target.value)}>
              <option value="monthly">monthly</option>
              <option value="quarterly">quarterly</option>
              <option value="annual">annual</option>
            </select>
          </Field>
          <Field label="Amount">
            <input className={inputCls()} type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))} />
          </Field>
          <Field label="Status">
            <select
              className={inputCls()}
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'paused' | 'cancelled')}
            >
              <option value="active">active</option>
              <option value="paused">paused</option>
            </select>
          </Field>
          <Field label="Next bill">
            <input className={inputCls()} type="date" value={nextBill} onChange={(e) => setNextBill(e.target.value)} />
          </Field>
          <div className="flex items-end gap-2">
            <Button
              variant="commit"
              loading={action.isPending && action.variables?.action === 'modify'}
              onClick={async () => {
                await action.mutateAsync({
                  action: 'modify',
                  body: { plan, cycle, amount, status, nextBill },
                })
                setEditing(false)
                push('Subscription updated.', 'ok')
              }}
            >
              Save changes
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
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
      )}
    </Page>
  )
}
