import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { InvoiceDocument } from '../../components/ui/InvoiceDocument'
import { ErrorState, Page, PageHeader, TableSkeleton } from '../../components/ui/Page'
import { StatusStepper } from '../../components/ui/StatusStepper'
import { useToast } from '../../components/ui/Toast'
import { canSetInvoiceStatus, useAuth } from '../../lib/auth'
import { downloadInvoicePdf } from '../../lib/invoicePdf'
import { useInvoiceDetail, useSetInvoiceStatus } from '../../lib/hooks'

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
  const setStatus = useSetInvoiceStatus(id ?? '')
  const [downloading, setDownloading] = useState(false)
  const canSet = canSetInvoiceStatus(user?.role)

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

  return (
    <Page>
      <PageHeader
        kicker="Statement"
        title={data.number}
        actions={
          <div className="flex items-center gap-3">
            {canSet ? (
              data.status === 'paid' ? (
                <Button
                  variant="secondary"
                  loading={setStatus.isPending}
                  onClick={async () => {
                    await setStatus.mutateAsync('unpaid')
                    push('Marked unpaid.')
                  }}
                >
                  Mark unpaid
                </Button>
              ) : (
                <Button
                  variant="commit"
                  loading={setStatus.isPending}
                  onClick={async () => {
                    await setStatus.mutateAsync('paid')
                    push('Marked paid.', 'ok')
                  }}
                >
                  Mark paid
                </Button>
              )
            ) : (
              <p className="max-w-[220px] text-right text-[12px] text-inkMuted">
                Payment status is set by sales, not finance.
              </p>
            )}
            <Button
              variant="secondary"
              loading={downloading}
              onClick={() => {
                setDownloading(true)
                try {
                  downloadInvoicePdf(data)
                  push('Invoice downloaded.', 'ok')
                } finally {
                  setDownloading(false)
                }
              }}
            >
              Download PDF
            </Button>
          </div>
        }
      />
      <StatusStepper steps={STEPS} currentStep={stepIndex(data.step)} />
      <InvoiceDocument invoice={data} />
    </Page>
  )
}
