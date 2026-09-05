import { useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { InfoBanner } from '../../components/ui/InfoBanner'
import { ErrorState, Page, PageHeader, TableSkeleton } from '../../components/ui/Page'
import { StatusStepper } from '../../components/ui/StatusStepper'
import { useToast } from '../../components/ui/Toast'
import { canRecordPayment, useAuth } from '../../lib/auth'
import { formatDate, money } from '../../lib/format'
import { useInvoiceDetail, useRecordPayment } from '../../lib/hooks'
import type { InvoiceLine } from '../../lib/types'

const STEPS = ['Order Confirmed', 'Shipped', 'Invoiced', 'Paid']

function stepIndex(step: string): number {
  if (step === 'confirmed') return 0
  if (step === 'shipped') return 1
  if (step === 'invoiced') return 2
  return 3
}

export function InvoiceDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { push } = useToast()
  const { data, isLoading, isError, error } = useInvoiceDetail(id)
  const pay = useRecordPayment(id ?? '')

  if (isLoading) {
    return (
      <Page>
        <PageHeader title="Invoice" />
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

  const cols: Column<InvoiceLine>[] = [
    { key: 'number', header: 'Invoice #' },
    { key: 'amount', header: 'Amount', render: (r) => money(r.amount) },
    { key: 'status', header: 'Status' },
    { key: 'dueDate', header: 'Due Date', render: (r) => formatDate(r.dueDate) },
  ]

  return (
    <Page>
      <PageHeader title={`${data.number} · ${data.customerName}`} />
      <StatusStepper steps={STEPS} currentStep={stepIndex(data.step)} />
      <DataTable columns={cols} rows={data.lines} rowKey={(r) => r.number} />
      <InfoBanner>{data.note}</InfoBanner>
      <div className="flex gap-2">
        {canRecordPayment(user?.role) && data.status !== 'paid' ? (
          <Button
            variant="commit"
            loading={pay.isPending}
            onClick={async () => {
              await pay.mutateAsync()
              push('Payment recorded.', 'ok')
            }}
          >
            Record Payment
          </Button>
        ) : null}
        <Button
          variant="secondary"
          title="Coming soon"
          disabled
        >
          Download Invoice
        </Button>
      </div>
    </Page>
  )
}
