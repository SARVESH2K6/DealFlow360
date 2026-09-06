import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { InfoBanner } from '../../components/ui/InfoBanner'
import { ErrorState, Field, Page, PageHeader, TableSkeleton, inputCls } from '../../components/ui/Page'
import { useToast } from '../../components/ui/Toast'
import { moneyExact, quotationStatusLabel } from '../../lib/format'
import { usePortalConfirm, usePortalNegotiate, usePortalQuote } from '../../lib/hooks'
import { blockNegativeKey, sanitizeNonNegative } from '../../lib/numericInput'
import type { PortalQuoteLine } from '../../lib/types'

export function PortalQuotePage() {
  const { id } = useParams()
  const { push } = useToast()
  const { data, isLoading, isError, error } = usePortalQuote(id)
  const negotiate = usePortalNegotiate(id ?? '')
  const confirm = usePortalConfirm(id ?? '')
  const [lines, setLines] = useState<PortalQuoteLine[]>([])
  const [delivery, setDelivery] = useState('')

  useEffect(() => {
    if (data) {
      setLines(data.lines)
      setDelivery(data.requestedDeliveryDate || '')
    }
  }, [data])

  if (isLoading) {
    return (
      <Page>
        <PageHeader title="Quotation" />
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

  const locked = data.portalStatus === 'confirmed' || data.status === 'confirmed' || data.status === 'rejected'

  function updateLine(lineId: string, patch: Partial<PortalQuoteLine>) {
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, ...patch } : l)))
  }

  return (
    <Page>
      <PageHeader
        title={`${data.number} · ${data.customerName}`}
        actions={
          <Badge status={data.portalStatus === 'confirmed' ? 'confirmed' : 'negotiating'}>
            {quotationStatusLabel(data.portalStatus)}
          </Badge>
        }
      />

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <table className="w-full text-left">
          <thead>
            <tr className="h-9 bg-surfaceAlt">
              {['Product', 'Qty', 'Price', 'Offered Discount', 'Comment', 'Counter Discount %'].map((h) => (
                <th key={h} className="px-3 text-[11px] font-medium uppercase tracking-[0.04em] text-inkMuted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="h-11 border-b border-border last:border-0">
                <td className="px-3">{line.productName}</td>
                <td className="px-3">{line.qty}</td>
                <td className="px-3">{moneyExact(line.price)}</td>
                <td className="px-3">{line.discountPercent}%</td>
                <td className="px-3">
                  <input
                    className={inputCls('min-w-[160px]')}
                    disabled={locked}
                    value={line.comment}
                    onChange={(e) => updateLine(line.id, { comment: e.target.value })}
                  />
                </td>
                <td className="px-3">
                  <input
                    className={inputCls('w-24')}
                    disabled={locked}
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    inputMode="decimal"
                    value={line.counterDiscount}
                    onKeyDown={blockNegativeKey}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData('text')
                      if (/[-eE+]/.test(text) || Number(text) < 0) e.preventDefault()
                    }}
                    onChange={(e) => {
                      const raw = sanitizeNonNegative(e.target.value)
                      const n = Number(raw)
                      updateLine(line.id, { counterDiscount: Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0 })
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 mb-6 flex gap-8">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-inkMuted">Estimated Delivery Cost</p>
          <p className="mt-1 font-serif text-[22px] tabular-nums text-ink">${data.estimatedDeliveryCost ?? 0}</p>
        </div>
      </div>

      <Field label="Requested Delivery Date">
        <input
          className={inputCls('w-56')}
          type="date"
          disabled={locked}
          value={delivery}
          onChange={(e) => setDelivery(e.target.value)}
        />
      </Field>

      <InfoBanner>
        If final terms exceed thresholds, the quote automatically re-enters approval.
      </InfoBanner>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          disabled={locked}
          loading={negotiate.isPending}
          onClick={async () => {
            await negotiate.mutateAsync({
              lines,
              requestedDeliveryDate: delivery,
              note: 'Customer submitted revised terms from the portal.',
            })
            push('Request sent. Internal team will see this live.', 'ok')
          }}
        >
          Submit Request
        </Button>
        <Button
          variant="commit"
          disabled={locked}
          loading={confirm.isPending}
          onClick={async () => {
            const result = await confirm.mutateAsync()
            push(
              result.reenteredApproval
                ? 'Terms exceeded thresholds — quote re-entered approval.'
                : 'Quotation confirmed.',
              result.reenteredApproval ? 'warn' : 'ok',
            )
          }}
        >
          Confirm Quotation
        </Button>
      </div>
    </Page>
  )
}
