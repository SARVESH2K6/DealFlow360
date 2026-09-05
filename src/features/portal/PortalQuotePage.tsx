import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { InfoBanner } from '../../components/ui/InfoBanner'
import { ErrorState, Field, LedgerRow, MetaItem, Page, SectionTitle, TableSkeleton, inputCls } from '../../components/ui/Page'
import { useToast } from '../../components/ui/Toast'
import { formatDate, formatDateTime, moneyExact } from '../../lib/format'
import { ApiError } from '../../lib/api'
import { usePortalConfirm, usePortalNegotiate, usePortalQuote } from '../../lib/hooks'
import { downloadPortalQuotePdf } from '../../lib/portalQuotePdf'
import type { PortalQuoteLine } from '../../lib/types'

type DraftLine = PortalQuoteLine & { unitPrice: number }

function reviewLabel(portalStatus: string): string {
  if (portalStatus === 'confirmed') return 'Accepted'
  if (portalStatus === 'under_negotiation') return 'Revision requested'
  if (portalStatus === 'rejected') return 'Declined'
  return 'Awaiting Your Review'
}

function reviewBadge(portalStatus: string): string {
  if (portalStatus === 'confirmed') return 'confirmed'
  if (portalStatus === 'rejected') return 'rejected'
  if (portalStatus === 'under_negotiation') return 'under_negotiation'
  return 'sent'
}

function toDraft(lines: PortalQuoteLine[]): DraftLine[] {
  return lines.map((l) => ({
    ...l,
    unitPrice: Math.round(l.price * (1 - l.discountPercent / 100) * 100) / 100,
    description: l.description ?? '',
    taxPercent: l.taxPercent ?? 0,
  }))
}

function totals(lines: DraftLine[], currency: string) {
  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0)
  const net = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
  const discount = Math.max(0, subtotal - net)
  const tax = lines.reduce((s, l) => s + l.qty * l.unitPrice * (l.taxPercent / 100), 0)
  return {
    subtotal,
    discount,
    tax,
    total: net + tax,
    currency,
  }
}

export function PortalQuotePage() {
  const { id } = useParams()
  const { push } = useToast()
  const { data, isLoading, isError, error } = usePortalQuote(id)
  const negotiate = usePortalNegotiate(id ?? '')
  const confirm = usePortalConfirm(id ?? '')
  const [editing, setEditing] = useState(false)
  const [lines, setLines] = useState<DraftLine[]>([])
  const [delivery, setDelivery] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!data) return
    setLines(toDraft(data.lines))
    setDelivery(data.requestedDeliveryDate || '')
    setEditing(false)
  }, [data])

  const figures = useMemo(() => totals(lines, data?.currency ?? 'USD'), [lines, data?.currency])

  if (isLoading) {
    return (
      <Page>
        <TableSkeleton rows={8} />
      </Page>
    )
  }
  if (isError || !data) {
    return (
      <Page>
        <ErrorState message={error instanceof Error ? error.message : 'Quote not found'} />
      </Page>
    )
  }

  const locked = data.portalStatus === 'confirmed' || data.status === 'confirmed'
  const view = editing && !locked

  function updateLine(lineId: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, ...patch } : l)))
  }

  async function submitRevision() {
    try {
      await negotiate.mutateAsync({
        lines: lines.map((l) => ({
          id: l.id,
          qty: l.qty,
          unitPrice: l.unitPrice,
          comment: l.comment,
        })),
        requestedDeliveryDate: delivery,
        note: note || 'Customer requested revised terms from the portal.',
      })
      setNote('')
      setEditing(false)
      push('Revision request sent. Your sales representative will see this live.', 'ok')
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Could not send the revision.', 'danger')
    }
  }

  async function accept() {
    try {
      const result = await confirm.mutateAsync()
      push(
        result.reenteredApproval
          ? 'Terms exceeded internal thresholds — the quote re-entered approval.'
          : 'Quote accepted.',
        result.reenteredApproval ? 'warn' : 'ok',
      )
    } catch (err) {
      push(err instanceof ApiError ? err.message : 'Could not accept this quote.', 'danger')
    }
  }

  return (
    <Page>
      <header className="flex items-end justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-bronze">{data.number}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-[26px] leading-tight tracking-tight text-ink">
              Quote for {data.customerName}
            </h1>
            <Badge status={reviewBadge(data.portalStatus)}>{reviewLabel(data.portalStatus)}</Badge>
          </div>
        </div>
        <div className="flex shrink-0 items-end gap-4">
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-inkMuted">Total</p>
            <p className="mt-0.5 font-serif text-[26px] leading-none tabular-nums tracking-tight text-ink">
              {moneyExact(figures.total, figures.currency)}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {!locked && !view ? (
              <>
                <Button variant="commit" loading={confirm.isPending} onClick={() => void accept()}>
                  Accept & Sign
                </Button>
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  Request Changes
                </Button>
              </>
            ) : null}
            {view ? (
              <>
                <Button variant="commit" loading={negotiate.isPending} onClick={() => void submitRevision()}>
                  Submit revision
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setLines(toDraft(data.lines))
                    setDelivery(data.requestedDeliveryDate || '')
                    setNote('')
                    setEditing(false)
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : null}
            <Button variant="secondary" onClick={() => downloadPortalQuotePdf(data)}>
              <Download className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              PDF
            </Button>
          </div>
        </div>
      </header>

      {locked ? (
        <InfoBanner>
          This quote is accepted. A contract copy is available as PDF. Quantity and price can no longer be changed.
        </InfoBanner>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <MetaItem label="Sales representative">{data.repName || '—'}</MetaItem>
            <MetaItem label="Prepared">{data.date ? formatDate(data.date) : '—'}</MetaItem>
            <MetaItem label="Terms">{data.terms}</MetaItem>
            <MetaItem label="Delivery">
              {view ? (
                <input
                  className={inputCls('w-full font-serif text-[15px]')}
                  type="date"
                  value={delivery}
                  onChange={(e) => setDelivery(e.target.value)}
                />
              ) : data.requestedDeliveryDate ? (
                formatDate(data.requestedDeliveryDate)
              ) : (
                '—'
              )}
            </MetaItem>
          </div>

          <section>
            <SectionTitle>Line items</SectionTitle>
            <div className="rule-gold mb-1" />
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-bronze/40">
                  {['Product / Service', 'Qty', 'Unit price', 'Total'].map((h) => (
                    <th
                      key={h}
                      className={`h-8 text-[10px] font-medium uppercase tracking-[0.12em] text-inkMuted ${
                        h === 'Product / Service' ? '' : 'text-right'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-b border-ink/[0.08] align-top">
                    <td className="py-2 pr-4">
                      <div className="font-serif text-[15px] text-ink">{line.productName}</div>
                      {line.description ? (
                        <p className="mt-0.5 text-[12px] leading-snug text-inkMuted">{line.description}</p>
                      ) : null}
                    </td>
                    <td className="py-2 text-right">
                      {view ? (
                        <input
                          className={inputCls('ml-auto w-14 text-right font-serif text-[15px]')}
                          type="number"
                          min={1}
                          value={line.qty}
                          onChange={(e) => updateLine(line.id, { qty: Math.max(1, Number(e.target.value) || 1) })}
                        />
                      ) : (
                        <span className="font-serif text-[15px] tabular-nums">{line.qty}</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {view ? (
                        <input
                          className={inputCls('ml-auto w-24 text-right font-serif text-[15px]')}
                          type="number"
                          min={0}
                          value={line.unitPrice}
                          onChange={(e) =>
                            updateLine(line.id, { unitPrice: Math.max(0, Number(e.target.value) || 0) })
                          }
                        />
                      ) : (
                        <span className="font-serif text-[15px] tabular-nums">
                          {moneyExact(line.unitPrice, data.currency)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right font-serif text-[15px] tabular-nums">
                      {moneyExact(line.qty * line.unitPrice, data.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="ml-auto max-w-xs">
            <LedgerRow label="Subtotal">{moneyExact(figures.subtotal, figures.currency)}</LedgerRow>
            <LedgerRow label="Discount">−{moneyExact(figures.discount, figures.currency)}</LedgerRow>
            <LedgerRow label="Tax">{moneyExact(figures.tax, figures.currency)}</LedgerRow>
            <LedgerRow label="Total">{moneyExact(figures.total, figures.currency)}</LedgerRow>
          </div>

          {view ? (
            <Field label="Note to sales">
              <textarea
                className="min-h-[56px] w-full border-0 border-b border-bronze/40 bg-transparent px-0 py-1.5 text-[13px] text-ink focus:border-ink focus:outline-none"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What should we change, and why?"
              />
            </Field>
          ) : null}
        </div>

        <aside>
          <SectionTitle>History</SectionTitle>
          {(!data.history || data.history.length === 0) ? (
            <p className="text-[13px] text-inkMuted">No activity on this quote yet.</p>
          ) : (
            <ol className="border-l border-bronze/40 pl-3">
              {data.history.map((item, i) => (
                <li key={`${item.date}-${i}`} className="relative mb-3 last:mb-0">
                  <span className="absolute -left-[17px] top-1.5 h-1.5 w-1.5 rounded-full bg-bronze" />
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-bronze">{item.action}</p>
                  <p className="mt-0.5 text-[13px] text-ink">{item.from}</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-inkMuted">{item.body}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-inkFaint">
                    {formatDateTime(item.date)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </Page>
  )
}
