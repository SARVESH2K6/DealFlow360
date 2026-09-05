import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ErrorState, Page, PageHeader, TableSkeleton, inputCls } from '../../components/ui/Page'
import { useToast } from '../../components/ui/Toast'
import { quotationStatusLabel } from '../../lib/format'
import { useFulfillmentAction, useFulfillmentDetail } from '../../lib/hooks'
import type { FulfillmentOrder } from '../../lib/types'

export function FulfillmentDetailPage() {
  const { id } = useParams()
  const { push } = useToast()
  const { data, isLoading, isError, error } = useFulfillmentDetail(id)
  const action = useFulfillmentAction(id ?? '')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<FulfillmentOrder | null>(null)

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

      {view.lines.map((line, lineIdx) => (
        <section key={line.productId}>
          <h2 className="mb-3 text-[15px] font-medium text-ink">
            {line.productName} <span className="text-inkMuted">· qty {line.qty}</span>
          </h2>
          <div className="overflow-hidden rounded-md border border-border bg-surface">
            <table className="w-full text-left">
              <thead>
                <tr className="h-9 bg-surfaceAlt">
                  {['Warehouse', 'Qty Fulfilled', 'Est. Shipments', 'Cost'].map((h) => (
                    <th key={h} className="px-3 text-[11px] font-medium uppercase tracking-[0.04em] text-inkMuted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {line.suggested.map((row, rowIdx) => (
                  <tr key={row.warehouse} className="h-11 border-b border-border last:border-0">
                    <td className="px-3">{row.warehouse}</td>
                    <td className="px-3">
                      {editing ? (
                        <input
                          className={inputCls('w-24')}
                          type="number"
                          value={row.qtyFulfilled}
                          onChange={(e) => updateQty(lineIdx, rowIdx, Number(e.target.value))}
                        />
                      ) : (
                        row.qtyFulfilled
                      )}
                    </td>
                    <td className="px-3">{row.estShipments}</td>
                    <td className="px-3">{row.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

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
    </Page>
  )
}
