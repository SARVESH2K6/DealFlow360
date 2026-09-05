import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { InfoBanner } from '../../components/ui/InfoBanner'
import { ErrorState, Field, MetaItem, Page, SectionTitle, TableSkeleton, inputCls } from '../../components/ui/Page'
import { RiskStripe } from '../../components/ui/RiskStripe'
import { useToast } from '../../components/ui/Toast'
import { money, moneyExact } from '../../lib/format'
import { useAuth } from '../../lib/auth'
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
        className="h-7 w-14 border-0 border-b border-bronze/50 bg-transparent px-0 text-right font-serif text-[15px] tabular-nums text-ink focus:border-ink focus:outline-none"
        type="number"
        min={min}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
      />
      {suffix ? <span className="font-serif text-[15px] text-ink">{suffix}</span> : null}
    </span>
  )
}

export function QuotationDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { push } = useToast()
  const { user } = useAuth()
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

  const isOwner = Boolean(user && data.repId === user.id)
  const editable =
    isOwner && (data.status === 'draft' || data.status === 'returned' || data.status === 'rejected')

  async function onSubmit() {
    const result = await submit.mutateAsync()
    push(`Risk score ${result.riskScore} (${result.riskLevel}).`, result.riskLevel === 'HIGH' ? 'warn' : 'ok')
    if (result.approvalRequired) navigate(`/app/approvals/${result.approvalId}`)
    else navigate('/app/fulfillment')
  }

  return (
    <Page>
      <RiskStripe level={data.riskLevel} score={data.riskScore} />

      {data.status === 'returned' && isOwner ? (
        <InfoBanner tone="warning">
          Returned for revision. Only you can update this quotation and submit it again.
        </InfoBanner>
      ) : null}
      {data.status === 'draft' && isOwner ? (
        <InfoBanner>This draft is only visible to you. No one else can complete or submit it.</InfoBanner>
      ) : null}

      <header className="flex items-end justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-bronze">{data.number}</p>
          <h1 className="mt-1 font-serif text-[26px] leading-tight tracking-tight text-ink">{data.customerName}</h1>
        </div>
        <div className="flex shrink-0 items-end gap-4">
          <p className="font-serif text-[26px] leading-none tabular-nums tracking-tight text-ink">{money(data.amount)}</p>
          {editable ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => navigate('/app/quotations')}>
                Save draft
              </Button>
              <Button
                variant="commit"
                disabled={data.lines.length === 0}
                loading={submit.isPending}
                onClick={() => void onSubmit()}
              >
                {data.status === 'returned' ? 'Resubmit for approval' : 'Submit for approval'}
              </Button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <MetaItem label="Customer">
          {editable ? (
            <select
              className={inputCls('w-full font-serif text-[15px]')}
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
        </MetaItem>
        <MetaItem label="Price list">
          {editable ? (
            <select
              className={inputCls('w-full font-serif text-[15px]')}
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
        </MetaItem>
        <MetaItem label="Region">{data.region}</MetaItem>
        <MetaItem label="Payment terms">{data.terms}</MetaItem>
      </div>

      {data.lines.length === 0 ? (
        <EmptyState title="No line items" message="This page is blank. Add a product to post the first entry." />
      ) : (
        <section>
          <SectionTitle aside={<span className="text-[11px] uppercase tracking-[0.12em] text-inkMuted">Risk {data.riskScore} · {data.riskLevel}</span>}>
            Line items
          </SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-bronze/40">
                  {['Product', 'Qty', 'Price', 'Discount %', 'Limit', 'Status'].map((h) => (
                    <th
                      key={h}
                      className="h-8 text-[10px] font-medium uppercase tracking-[0.12em] text-inkMuted"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.lines.map((line) => (
                  <tr key={line.id} className="border-b border-ink/[0.08]">
                    <td className="py-1.5 pr-4 font-serif text-[15px] text-ink">{line.productName}</td>
                    <td className="py-1.5 pr-4">
                      {editable ? (
                        <DebouncedNumberCell
                          value={line.qty}
                          min={1}
                          onCommit={(qty) => patchLine.mutate({ lineId: line.id, qty })}
                        />
                      ) : (
                        <span className="font-serif text-[15px] tabular-nums">{line.qty}</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-4 font-serif text-[15px] tabular-nums">{moneyExact(line.price)}</td>
                    <td className="py-1.5 pr-4">
                      {editable ? (
                        <DebouncedNumberCell
                          value={line.discountPercent}
                          min={0}
                          suffix="%"
                          onCommit={(discountPercent) => patchLine.mutate({ lineId: line.id, discountPercent })}
                        />
                      ) : (
                        <span className="font-serif text-[15px] tabular-nums">{line.discountPercent}%</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-4 font-serif text-[15px] tabular-nums">{line.limit}%</td>
                    <td className="py-1.5">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            line.status === 'within' ? 'bg-ok' : line.status === 'near' ? 'bg-warn' : 'bg-danger'
                          }`}
                          aria-hidden
                        />
                        <span className={`text-[12px] ${statusTone[line.status]}`}>{statusCopy[line.status]}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editable ? (
        <div className="flex items-end gap-4">
          <Field label="Post a product">
            <select className={inputCls('w-64')} value={productId} onChange={(e) => setProductId(e.target.value)}>
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

      <section>
        <SectionTitle>Suggested attach</SectionTitle>
        <div className="grid grid-cols-3 gap-px bg-bronze/30">
          {data.upsells.map((u) => (
            <div key={u.productId} className="bg-sheet px-4 py-3">
              <div className="font-serif text-[15px] text-ink">{u.productName}</div>
              <div className="mt-0.5 text-[12px] text-inkMuted">{u.marginNote}</div>
              <div className="mt-2 flex items-baseline justify-between gap-3">
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
    </Page>
  )
}
