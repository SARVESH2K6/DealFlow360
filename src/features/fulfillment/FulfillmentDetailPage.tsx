import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ErrorState, Page, PageHeader, TableSkeleton, inputCls } from '../../components/ui/Page'
import { useToast } from '../../components/ui/Toast'
import { canSplitFulfillment, useAuth } from '../../lib/auth'
import { quotationStatusLabel } from '../../lib/format'
import { useFulfillmentAction, useFulfillmentDetail } from '../../lib/hooks'
import type { FulfillmentOrder } from '../../lib/types'

export function FulfillmentDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { push } = useToast()
  const { data, isLoading, isError, error } = useFulfillmentDetail(id)
  const action = useFulfillmentAction(id ?? '')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<FulfillmentOrder | null>(null)
  const canSplit = canSplitFulfillment(user?.role)

  if (isLoading) {
    return (
      <Page>
        <PageHeader title="Fulfillment order" />
        <TableSkeleton />
      </Page>
    )
  }
  if (isError || !data) {
    return (
      <Page>
        <ErrorState message={error instanceof Error ? error.message : 'Order not found'} />
      </Page>
    )
  }

  const view = editing && draft ? draft : data

  function updateQty(lineIdx: number, rowIdx: number, qty: number) {
    if (!draft) return
    const next: FulfillmentOrder = {
      ...draft,
      lines: draft.lines.map((line, i) =>
        i === lineIdx
          ? {
              ...line,
              suggested: line.suggested.map((row, j) => (j === rowIdx ? { ...row, qtyFulfilled: qty } : row)),
            }
          : line,
      ),
    }
    setDraft(next)
  }

  return (
    <Page>
      <PageHeader
        title={`${view.orderNumber} · ${view.customerName}`}
        actions={<Badge status={view.status}>{quotationStatusLabel(view.status)}</Badge>}
      />

      <div className="mb-6 flex gap-8 border-b border-border pb-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-inkMuted">Estimated Delivery Cost</p>
          <p className="mt-1 font-serif text-[22px] tabular-nums text-ink">${view.estimatedDeliveryCost ?? 0}</p>
        </div>
        {view.finalDeliveryCost > 0 ? (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-inkMuted">Final Delivery Cost</p>
            <p className="mt-1 font-serif text-[22px] tabular-nums text-ok">${view.finalDeliveryCost}</p>
          </div>
        ) : null}
      </div>

      {view.canConsolidate && canSplit ? (
        <div className="flex items-center justify-between gap-6 border-l-[3px] border-warn bg-warnBg/40 px-4 py-3">
          <p className="text-[13px] leading-relaxed text-warn">
            Stock has arrived. Consolidate remaining backorder
            {view.remainingQty ? ` (${view.remainingQty} units)` : ''}?
          </p>
          <Button
            variant="commit"
            loading={action.isPending && action.variables?.action === 'consolidate'}
            onClick={async () => {
              await action.mutateAsync({ action: 'consolidate' })
              push('Remaining backorder consolidated.', 'ok')
            }}
          >
            Consolidate Remaining Backorder
          </Button>
        </div>
      ) : null}

      {view.lines.map((line, lineIdx) => (
        <section key={line.productId} className="mt-10">
          <h2 className="mb-3 text-[15px] font-medium text-ink">
            {line.productName} <span className="text-inkMuted">· qty {line.qty}</span>
          </h2>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-bronze/40">
                {['Warehouse', 'Qty Fulfilled', 'Est. Shipments', 'Cost'].map((h) => (
                  <th key={h} className="h-8 text-[10px] font-medium uppercase tracking-[0.12em] text-inkMuted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {line.suggested.map((row, rowIdx) => (
                <tr key={row.warehouse} className="h-9 border-b border-ink/[0.08] last:border-0">
                  <td className="pr-4 text-[13px]">{row.warehouse}</td>
                  <td className="pr-4">
                    {canSplit && editing ? (
                      <input
                        className={inputCls('w-20')}
                        type="number"
                        min={0}
                        step="1"
                        value={row.qtyFulfilled}
                        onChange={(e) => updateQty(lineIdx, rowIdx, Math.max(0, Number(e.target.value) || 0))}
                      />
                    ) : (
                      <span className="font-serif text-[15px] tabular-nums">{row.qtyFulfilled}</span>
                    )}
                  </td>
                  <td className="pr-4 font-serif text-[15px] tabular-nums">{row.estShipments}</td>
                  <td className="font-serif text-[15px] tabular-nums">{row.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {canSplit ? (
        <div className="flex gap-2">
          <Button
            variant="commit"
            loading={action.isPending && action.variables?.action === 'accept-split'}
            onClick={async () => {
              await action.mutateAsync({ action: 'accept-split' })
              push('Suggested split accepted.', 'ok')
              setEditing(false)
            }}
          >
            Accept Suggested Split
          </Button>
          {!editing ? (
            <Button
              variant="secondary"
              onClick={() => {
                setDraft(data)
                setEditing(true)
              }}
            >
              Manual Override
            </Button>
          ) : (
            <Button
              variant="secondary"
              loading={action.isPending && action.variables?.action === 'override'}
              onClick={async () => {
                if (!draft) return
                await action.mutateAsync({ action: 'override', body: { lines: draft.lines } })
                push('Override saved.', 'ok')
                setEditing(false)
              }}
            >
              Save override
            </Button>
          )}
        </div>
      ) : (
        <p className="text-[13px] text-inkMuted">
          Suggested split and manual override are recorded by Finance or Admin.
        </p>
      )}
    </Page>
  )
}
