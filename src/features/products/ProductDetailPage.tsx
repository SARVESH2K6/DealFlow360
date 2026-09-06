import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { InfoBanner } from '../../components/ui/InfoBanner'
import { ErrorState, Field, Page, PageHeader, TableSkeleton, inputCls } from '../../components/ui/Page'
import { useToast } from '../../components/ui/Toast'
import { money } from '../../lib/format'
import { usePatchProduct, useProductDetail, useDeleteProduct } from '../../lib/hooks'
import type { PriceListRule, Product, ProductVariant } from '../../lib/types'

export function ProductDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { push } = useToast()
  const { data, isLoading, isError, error } = useProductDetail(id)
  const patch = usePatchProduct(id ?? '')
  const del = useDeleteProduct()
  const [form, setForm] = useState<Product | null>(null)

  useEffect(() => {
    if (data?.product) setForm(data.product)
  }, [data])

  if (isLoading || !form) {
    return (
      <Page>
        <PageHeader title="Product" />
        {isError ? <ErrorState message={error instanceof Error ? error.message : 'Not found'} /> : <TableSkeleton />}
      </Page>
    )
  }

  const variantCols: Column<ProductVariant>[] = [
    { key: 'attribute', header: 'Attribute' },
    { key: 'values', header: 'Values' },
    { key: 'extraPrice', header: 'Extra Price', render: (r) => money(r.extraPrice) },
  ]
  const rules = data?.pricelists.flatMap((p) => p.rules.map((r) => ({ ...r, list: p.name }))) ?? []
  const priceCols: Column<PriceListRule & { list: string }>[] = [
    { key: 'tier', header: 'Tier' },
    { key: 'currency', header: 'Currency' },
    { key: 'priceRule', header: 'Price Rule' },
  ]

  function set<K extends keyof Product>(key: K, value: Product[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  return (
    <Page>
      <PageHeader title={form.name} />
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3 rounded-md border border-border bg-surface p-4">
          <h2 className="text-[15px] font-medium text-ink">General info</h2>
          <Field label="Product Name">
            <input className={inputCls()} value={form.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Category">
            <select
              className={inputCls()}
              value={form.category}
              onChange={(e) => set('category', e.target.value === 'Services' ? 'Services' : 'Hardware')}
            >
              <option>Hardware</option>
              <option>Services</option>
            </select>
          </Field>
          <Field label="Price">
            <input className={inputCls()} type="number" value={form.price} onChange={(e) => set('price', Number(e.target.value))} />
          </Field>
          <Field label="Unit">
            <input className={inputCls()} value={form.unit} onChange={(e) => set('unit', e.target.value)} />
          </Field>
          <Field label="Description">
            <textarea
              className="min-h-[72px] w-full rounded-md border border-border bg-surface px-3 py-2 text-[14px] text-ink"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </Field>
          <Field label="Tax %">
            <input className={inputCls()} type="number" value={form.taxPercent} onChange={(e) => set('taxPercent', Number(e.target.value))} />
          </Field>
        </div>
        <div className="space-y-3 rounded-md border border-border bg-surface p-4">
          <h2 className="text-[15px] font-medium text-ink">Subscription config</h2>
          <Field label="Recurring">
            <select
              className={inputCls()}
              value={form.isSubscription ? 'yes' : 'no'}
              onChange={(e) => set('isSubscription', e.target.value === 'yes')}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
          {form.isSubscription ? (
            <>
              <Field label="Cycle">
                <select
                  className={inputCls()}
                  value={form.cycle ?? 'annual'}
                  onChange={(e) => set('cycle', e.target.value as Product['cycle'])}
                >
                  <option value="monthly">monthly</option>
                  <option value="quarterly">quarterly</option>
                  <option value="annual">annual</option>
                </select>
              </Field>
              <Field label="Quantity">
                <input
                  className={inputCls()}
                  type="number"
                  value={form.quantity ?? 1}
                  onChange={(e) => set('quantity', Number(e.target.value))}
                />
              </Field>
            </>
          ) : null}
        </div>
      </div>
      <section>
        <h2 className="mb-3 text-[15px] font-medium text-ink">Variants</h2>
        <DataTable columns={variantCols} rows={form.variants} rowKey={(r) => r.id} emptyMessage="No variants." />
      </section>
      <section>
        <h2 className="mb-3 text-[15px] font-medium text-ink">Pricelist</h2>
        <DataTable columns={priceCols} rows={rules} rowKey={(r) => r.list + r.tier + r.currency} emptyMessage="No pricelist rules." />
      </section>
      <InfoBanner>
        Recurring lines appear on invoices at the start of the billing period, not when the originating hardware ships.
      </InfoBanner>
      <div className="flex gap-2">
        <Button
          loading={patch.isPending}
          onClick={async () => {
            await patch.mutateAsync(form)
            push('Product saved.', 'ok')
          }}
        >
          Save product
        </Button>
        <Button
          variant="secondary"
          className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          loading={del.isPending}
          onClick={async () => {
            if (!confirm('Are you sure you want to delete this product?')) return
            try {
              await del.mutateAsync(form.id)
              push('Product deleted.', 'ok')
              navigate('/app/products')
            } catch (err: any) {
              push(err.message || 'Failed to delete product', 'warn')
            }
          }}
        >
          Delete product
        </Button>
      </div>
    </Page>
  )
}
