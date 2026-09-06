import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { InfoBanner } from '../../components/ui/InfoBanner'
import { ErrorState, Field, LedgerRow, Page, TableSkeleton, inputCls } from '../../components/ui/Page'
import { RiskStripe } from '../../components/ui/RiskStripe'
import { useToast } from '../../components/ui/Toast'
import { money, moneyExact } from '../../lib/format'
import { blockNegativeKey, sanitizeNonNegative } from '../../lib/numericInput'
import {
  useAddLine,
  useCustomers,
  usePatchLine,
  usePatchQuotation,
  usePricelists,
  useProductsList,
  useQuotationDetail,
  useSubmitQuotation,
} from '../../lib/hooks'
import type { LineRiskStatus } from '../../lib/types'

const statusCopy: Record<LineRiskStatus, string> = {
  within: 'Within limit',
  near: 'Near limit',
  over: 'Over limit',
}

const statusDot: Record<LineRiskStatus, string> = {
  within: 'bg-ok',
  near: 'bg-warn',
  over: 'bg-danger',
}

const statusTone: Record<LineRiskStatus, string> = {
  within: 'text-ok',
  near: 'text-warn',
  over: 'text-danger',
}

function DebouncedNumberCell({
  value,
  onCommit,
  min = 0,
  max,
  step,
  suffix,
}: {
  value: number
  onCommit: (next: number) => void
  min?: number
  max?: number
  step?: string
  suffix?: string
}) {
  const [local, setLocal] = useState(String(value))
  useEffect(() => {
    setLocal(String(value))
  }, [value])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (local.trim() === '') return
      const n = Number(local)
      if (!Number.isFinite(n) || n === value) return
      if (n < min) {
        setLocal(String(min))
        if (min !== value) onCommit(min)
        return
      }
      if (max !== undefined && n > max) {
        setLocal(String(max))
        if (max !== value) onCommit(max)
        return
      }
      onCommit(n)
    }, 300)
    return () => window.clearTimeout(handle)
  }, [local, value, onCommit, min, max])

  return (
    <span className="inline-flex items-baseline gap-1">
      <input
        className="h-8 w-16 border-0 border-b border-bronze/50 bg-transparent px-0 text-right text-[13px] tabular-nums text-ink focus:border-ink focus:outline-none"
        type="number"
        min={min}
        max={max}
        step={step ?? (min < 1 ? '0.01' : '1')}
        inputMode="decimal"
        value={local}
        onKeyDown={blockNegativeKey}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text')
          if (/[-eE+]/.test(text) || Number(text) < min) e.preventDefault()
        }}
        onChange={(e) => setLocal(sanitizeNonNegative(e.target.value))}
      />
      {suffix ? <span className="text-[13px] text-inkMuted">{suffix}</span> : null}
    </span>
  )
}

export function QuotationDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { push } = useToast()
  const { data, isLoading, isError, error } = useQuotationDetail(id)
  const customers = useCustomers()
  const pricelists = usePricelists()
  const products = useProductsList()
  const patchHeader = usePatchQuotation(id ?? '')
  const patchLine = usePatchLine(id ?? '')
  const addLine = useAddLine(id ?? '')
  const submit = useSubmitQuotation(id ?? '')
  const [productId, setProductId] = useState('')

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
        <ErrorState message={error instanceof Error ? error.message : 'Quotation not found'} />
      </Page>
    )
  }

  const editable = ['draft', 'rejected', 'returned', 'negotiation'].includes(data.status)

  async function onSubmit() {
    const result = await submit.mutateAsync()
    push(`Risk score ${result.riskScore} (${result.riskLevel}).`, result.riskLevel === 'HIGH' ? 'warn' : 'ok')
    if (result.approvalRequired) navigate(`/app/approvals/${result.approvalId}`)
    else if (result.fulfillmentId) navigate(`/app/fulfillment/${result.fulfillmentId}`)
    else navigate('/app/fulfillment')
  }

  return (
    <Page>
      <RiskStripe level={data.riskLevel} score={data.riskScore} />

      <header className="flex items-end justify-between gap-8">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-bronze">{data.number}</p>
          <h1 className="mt-2 font-serif text-[36px] leading-tight tracking-tight text-ink">{data.customerName}</h1>
        </div>
        <p className="font-serif text-[36px] leading-none tabular-nums tracking-tight text-ink">{money(data.amount)}</p>
      </header>

      <section>
        <h2 className="mb-2 font-serif text-[22px] text-ink">Terms</h2>
        <div className="rule-gold mb-1" />
        <LedgerRow label="Customer">
          {editable ? (
            <select
              className={inputCls('w-56 text-right font-serif text-[18px]')}
              value={data.customerId}
              onChange={(e) => patchHeader.mutate({ customerId: e.target.value })}
            >
              {(customers.data?.items ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.tier})
                </option>
              ))}
            </select>
          ) : (
            data.customerName
          )}
        </LedgerRow>
        <LedgerRow label="Price list">
          {editable ? (
            <select
              className={inputCls('w-56 text-right font-serif text-[18px]')}
              value={data.priceListId}
              onChange={(e) => patchHeader.mutate({ priceListId: e.target.value })}
            >
              {(pricelists.data?.items ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : (
            data.priceListId
          )}
        </LedgerRow>
        <LedgerRow label="Region">{data.region}</LedgerRow>
        <LedgerRow label="Payment terms">{data.terms}</LedgerRow>
      </section>

      {data.lines.length === 0 ? (
        <EmptyState title="No line items" message="This page is blank. Add a product to post the first entry." />
      ) : (
        <div className="w-full">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-bronze/40">
                {['Product', 'Qty', 'Price', 'Discount %', 'Limit', 'Status'].map((h) => (
                  <th
                    key={h}
                    className={`h-8 pr-4 text-[10px] font-medium uppercase tracking-[0.12em] text-inkMuted ${
                      h === 'Qty' || h === 'Price' || h === 'Discount %' || h === 'Limit' ? 'text-right' : ''
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.id} className="border-b border-ink/[0.08] last:border-b-0">
                  <td className="h-11 pr-4 text-[13px] text-ink">{line.productName}</td>
                  <td className="h-11 pr-4 text-right">
                    {editable ? (
                      <DebouncedNumberCell
                        value={line.qty}
                        min={1}
                        step="1"
                        onCommit={(qty) => patchLine.mutate({ lineId: line.id, qty })}
                      />
                    ) : (
                      <span className="tabular-nums">{line.qty}</span>
                    )}
                  </td>
                  <td className="h-11 pr-4 text-right font-serif text-[15px] tabular-nums text-ink">
                    {moneyExact(line.price)}
                  </td>
                  <td className="h-11 pr-4 text-right">
                    {editable ? (
                      <DebouncedNumberCell
                        value={line.discountPercent}
                        min={0}
                        max={100}
                        step="0.01"
                        suffix="%"
                        onCommit={(discountPercent) => patchLine.mutate({ lineId: line.id, discountPercent })}
                      />
                    ) : (
                      <span className="tabular-nums">{line.discountPercent}%</span>
                    )}
                  </td>
                  <td className="h-11 pr-4 text-right text-[13px] tabular-nums text-inkMuted">{line.limit}%</td>
                  <td className="h-11 pr-4">
                    <span className={`inline-flex items-center gap-2 text-[12px] ${statusTone[line.status]}`}>
                      <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot[line.status]}`} aria-hidden />
                      {statusCopy[line.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editable ? (
        <div className="flex items-end gap-8">
          <Field label="Post a product">
            <select className={inputCls('w-72')} value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Select…</option>
              {(products.data?.items ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Button
            variant="secondary"
            disabled={!productId}
            loading={addLine.isPending}
            onClick={() => {
              if (!productId) return
              addLine.mutate({ productId })
              setProductId('')
            }}
          >
            Add line
          </Button>
        </div>
      ) : null}

      <InfoBanner>
        Discount is checked against each line&apos;s own limit, not just one overall limit for the order.
      </InfoBanner>

      {data.upsells.length > 0 ? (
        <section>
          <h2 className="mb-4 font-serif text-[22px] text-ink">Suggested attach</h2>
          <div className="grid grid-cols-1 gap-px bg-bronze/30 sm:grid-cols-3">
            {data.upsells.slice(0, 3).map((u) => (
              <div key={u.productId} className="bg-sheet px-4 py-4">
                <div className="font-serif text-[18px] leading-tight text-ink">{u.productName}</div>
                <div className="mt-1 text-[13px] text-inkMuted">{u.marginNote}</div>
                <div className="mt-4 flex items-baseline justify-between gap-3">
                  <span className="font-serif text-[18px] tabular-nums">{money(u.price)}</span>
                  {editable ? (
                    <Button variant="ghost" onClick={() => addLine.mutate({ productId: u.productId })}>
                      + Add
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => navigate('/app/quotations')}>
          Save draft
        </Button>
        <Button
          variant="commit"
          disabled={data.lines.length === 0 || !editable}
          loading={submit.isPending}
          onClick={() => void onSubmit()}
        >
          Submit for Approval
        </Button>
      </div>
    </Page>
  )
}
