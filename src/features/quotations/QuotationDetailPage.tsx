import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { InfoBanner } from '../../components/ui/InfoBanner'
import { ErrorState, Field, Page, PageHeader, TableSkeleton, inputCls } from '../../components/ui/Page'
import { EmptyState } from '../../components/ui/EmptyState'
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
import type { LineRiskStatus, QuotationLine } from '../../lib/types'

const statusDot: Record<LineRiskStatus, string> = {
  within: 'bg-ok',
  near: 'bg-warn',
  over: 'bg-danger',
}

function DiscountCell({
  line,
  onCommit,
}: {
  line: QuotationLine
  onCommit: (discountPercent: number) => void
}) {
  const [local, setLocal] = useState(String(line.discountPercent))
  useEffect(() => {
    setLocal(String(line.discountPercent))
  }, [line.discountPercent])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const n = Number(local)
      if (!Number.isNaN(n) && n !== line.discountPercent) onCommit(n)
    }, 300)
    return () => window.clearTimeout(handle)
  }, [local, line.discountPercent, onCommit])

  return (
    <input
      className="h-8 w-20 rounded-md border border-border bg-surface px-2 text-[14px] text-ink"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onClick={(e) => e.stopPropagation()}
    />
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
        <PageHeader title="Quotation" />
        <TableSkeleton />
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

  const editable = data.status === 'draft' || data.status === 'rejected'

  async function onSubmit() {
    const result = await submit.mutateAsync()
    push(`Risk score ${result.riskScore} (${result.riskLevel}).`, result.riskLevel === 'HIGH' ? 'warn' : 'ok')
    if (result.approvalRequired) navigate(`/app/approvals/${result.approvalId}`)
    else navigate('/app/fulfillment')
  }

  return (
    <Page>
      <PageHeader
        title={`${data.customerName} · ${data.number}`}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-inkMuted">
              Risk score <span className="font-medium text-ink">{data.riskScore}</span>
            </span>
            <Badge status={data.riskLevel.toLowerCase()}>{data.riskLevel}</Badge>
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-4 rounded-md border border-border bg-surface p-4">
        <Field label="Customer">
          <select
            className={inputCls()}
            value={data.customerId}
            disabled={!editable}
            onChange={(e) => patchHeader.mutate({ customerId: e.target.value })}
          >
            {(customers.data?.items ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.tier})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Price list">
          <select
            className={inputCls()}
            value={data.priceListId}
            disabled={!editable}
            onChange={(e) => patchHeader.mutate({ priceListId: e.target.value })}
          >
            {(pricelists.data?.items ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Region">
          <input className={inputCls()} value={data.region} readOnly />
        </Field>
        <Field label="Terms">
          <input className={inputCls()} value={data.terms} readOnly />
        </Field>
      </div>

      {data.lines.length === 0 ? (
        <EmptyState message="No line items yet. Add a product to begin." />
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="h-9 bg-surfaceAlt">
                {['Product', 'Qty', 'Price', 'Discount %', 'Limit', 'Status'].map((h) => (
                  <th key={h} className="px-3 text-[11px] font-medium uppercase tracking-[0.04em] text-inkMuted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.id} className="h-11 border-b border-border last:border-0">
                  <td className="px-3 text-[14px]">{line.productName}</td>
                  <td className="px-3 text-[14px]">{line.qty}</td>
                  <td className="px-3 text-[14px]">{moneyExact(line.price)}</td>
                  <td className="px-3">
                    {editable ? (
                      <DiscountCell
                        line={line}
                        onCommit={(discountPercent) =>
                          patchLine.mutate({ lineId: line.id, discountPercent })
                        }
                      />
                    ) : (
                      `${line.discountPercent}%`
                    )}
                  </td>
                  <td className="px-3 text-[14px] text-inkMuted">{line.limit}%</td>
                  <td className="px-3">
                    <span className="inline-flex items-center gap-2 text-[13px] text-inkMuted">
                      <span className={`h-2 w-2 rounded-full ${statusDot[line.status]}`} />
                      {line.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editable ? (
        <div className="flex items-end gap-3">
          <Field label="Add product">
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
        <h2 className="mb-3 text-[15px] font-medium text-ink">Upsell / Cross-sell</h2>
        <div className="grid grid-cols-3 gap-3">
          {data.upsells.map((u) => (
            <div key={u.productId} className="rounded-md border border-border bg-surface p-4">
              <div className="text-[15px] font-medium text-ink">{u.productName}</div>
              <div className="mt-1 text-[13px] text-inkMuted">{u.marginNote}</div>
              <div className="mt-2 text-[13px] text-inkMuted">{money(u.price)}</div>
              {editable ? (
                <Button
                  className="mt-3"
                  variant="secondary"
                  onClick={() => addLine.mutate({ productId: u.productId })}
                >
                  + Add
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => navigate('/app/quotations')}>
          Save Draft
        </Button>
        <Button
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
