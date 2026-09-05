import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { InfoBanner } from '../../components/ui/InfoBanner'
import { ErrorState, Field, LedgerRow, Page, TableSkeleton, inputCls } from '../../components/ui/Page'
import { RiskStripe } from '../../components/ui/RiskStripe'
import { useToast } from '../../components/ui/Toast'
import { money, moneyExact } from '../../lib/format'
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

const statusTone: Record<LineRiskStatus, string> = {
  within: 'text-ok',
  near: 'text-warn',
  over: 'text-danger',
}

function DebouncedNumberCell({
  value,
  onCommit,
  min,
  suffix,
}: {
  value: number
  onCommit: (next: number) => void
  min?: number
  suffix?: string
}) {
  const [local, setLocal] = useState(String(value))
  useEffect(() => {
    setLocal(String(value))
  }, [value])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const n = Number(local)
      if (Number.isNaN(n) || n === value) return
      onCommit(min !== undefined ? Math.max(min, n) : n)
    }, 300)
    return () => window.clearTimeout(handle)
  }, [local, value, onCommit, min])

  return (
    <span className="inline-flex items-baseline gap-1">
      <input
        className="h-8 w-16 border-0 border-b border-bronze/50 bg-transparent px-0 text-right font-serif text-[18px] tabular-nums text-ink focus:border-ink focus:outline-none"
        type="number"
        min={min}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
      />
      {suffix ? <span className="font-serif text-[18px] text-ink">{suffix}</span> : null}
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

  const editable = ['draft', 'rejected', 'customer_submitted', 'negotiation'].includes(data.status)

  async function onSubmit() {
    const result = await submit.mutateAsync()
    push(`Risk score ${result.riskScore} (${result.riskLevel}).`, result.riskLevel === 'HIGH' ? 'warn' : 'ok')
    if (result.approvalRequired) navigate(`/app/approvals/${result.approvalId}`)
    else navigate('/app/quotations')
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
        <section className="space-y-10">
          {data.lines.map((line) => (
            <div key={line.id} className="bg-surfaceAlt/40 px-5 py-4">
              <h2 className="mb-1 font-serif text-[22px] text-ink">{line.productName}</h2>
              <LedgerRow label="Quantity">
                {editable ? (
                  <DebouncedNumberCell
                    value={line.qty}
                    min={1}
                    onCommit={(qty) => patchLine.mutate({ lineId: line.id, qty })}
                  />
                ) : (
                  line.qty
                )}
              </LedgerRow>
              <LedgerRow label="Unit price">{moneyExact(line.price)}</LedgerRow>
              <LedgerRow label="Discount">
                {editable ? (
                  <DebouncedNumberCell
                    value={line.discountPercent}
                    min={0}
                    suffix="%"
                    onCommit={(discountPercent) => patchLine.mutate({ lineId: line.id, discountPercent })}
                  />
                ) : (
                  `${line.discountPercent}%`
                )}
              </LedgerRow>
              <LedgerRow label="Limit allowed">{`${line.limit}%`}</LedgerRow>
              <LedgerRow label="Risk factor">
                <span className={statusTone[line.status]}>{statusCopy[line.status]}</span>
              </LedgerRow>
            </div>
          ))}
        </section>
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

      <section>
        <h2 className="mb-4 font-serif text-[22px] text-ink">Suggested attach</h2>
        <div className="divide-y divide-ink/[0.08] border-y border-ink/[0.08]">
          {data.upsells.map((u) => (
            <div key={u.productId} className="flex items-baseline justify-between gap-6 py-4">
              <div>
                <div className="font-serif text-[18px] text-ink">{u.productName}</div>
                <div className="mt-1 text-[13px] text-inkMuted">{u.marginNote}</div>
              </div>
              <div className="flex items-baseline gap-6">
                <span className="font-serif text-[18px] tabular-nums">{money(u.price)}</span>
                {editable ? (
                  <Button variant="ghost" onClick={() => addLine.mutate({ productId: u.productId })}>
                    Add
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

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
          Submit Quote
        </Button>
      </div>
    </Page>
  )
}
