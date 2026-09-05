import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { InfoBanner } from '../../components/ui/InfoBanner'
import { ErrorState, Field, Page, PageHeader, TableSkeleton, inputCls } from '../../components/ui/Page'
import { useToast } from '../../components/ui/Toast'
import { usePatchProduct, useProductDetail } from '../../lib/hooks'
import type { PriceList, Product, ProductVariant } from '../../lib/types'

export function ProductDetailPage() {
  const { id } = useParams()
  const { push } = useToast()
  const { data, isLoading, isError, error } = useProductDetail(id)
  const patch = usePatchProduct(id ?? '')
  const [form, setForm] = useState<Product | null>(null)
  const [lists, setLists] = useState<PriceList[]>([])

  useEffect(() => {
    if (data?.product) setForm(data.product)
    if (data?.pricelists) setLists(data.pricelists)
  }, [data])

  if (isLoading || !form) {
    return (
      <Page>
        <PageHeader title="Product" />
        {isError ? <ErrorState message={error instanceof Error ? error.message : 'Not found'} /> : <TableSkeleton />}
      </Page>
    )
  }

  function set<K extends keyof Product>(key: K, value: Product[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function updateVariant(index: number, next: ProductVariant) {
    setForm((prev) => {
      if (!prev) return prev
      const variants = [...prev.variants]
      variants[index] = next
      return { ...prev, variants }
    })
  }

  function addVariant() {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            variants: [
              ...prev.variants,
              { id: `v-${Date.now().toString(36)}`, attribute: 'Option', values: '', extraPrice: 0 },
            ],
          }
        : prev,
    )
  }

  function removeVariant(index: number) {
    setForm((prev) => (prev ? { ...prev, variants: prev.variants.filter((_, i) => i !== index) } : prev))
  }

  function updateRule(listId: string, index: number, field: 'tier' | 'currency' | 'priceRule', value: string) {
    setLists((prev) =>
      prev.map((list) => {
        if (list.id !== listId) return list
        const rules = list.rules.map((rule, i) => (i === index ? { ...rule, [field]: value } : rule))
        return { ...list, rules }
      }),
    )
  }

  function addRule(listId: string) {
    setLists((prev) =>
      prev.map((list) =>
        list.id === listId
          ? { ...list, rules: [...list.rules, { tier: 'Bronze', currency: list.currency, priceRule: 'List × 1.00' }] }
          : list,
      ),
    )
  }

  function removeRule(listId: string, index: number) {
    setLists((prev) =>
      prev.map((list) => (list.id === listId ? { ...list, rules: list.rules.filter((_, i) => i !== index) } : list)),
    )
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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-medium text-ink">Variants</h2>
          <Button variant="ghost" onClick={addVariant}>
            <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            Add variant
          </Button>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="h-9 border-b border-bronze/40">
              <th className="text-[11px] font-medium uppercase tracking-[0.04em] text-inkMuted">Attribute</th>
              <th className="text-[11px] font-medium uppercase tracking-[0.04em] text-inkMuted">Values</th>
              <th className="text-[11px] font-medium uppercase tracking-[0.04em] text-inkMuted">Extra Price</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {form.variants.map((row, i) => (
              <tr key={row.id} className="h-12 border-b border-ink/[0.08]">
                <td>
                  <input
                    className={inputCls()}
                    value={row.attribute}
                    onChange={(e) => updateVariant(i, { ...row, attribute: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className={inputCls()}
                    value={row.values}
                    onChange={(e) => updateVariant(i, { ...row, values: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className={inputCls('w-28')}
                    type="number"
                    value={row.extraPrice}
                    onChange={(e) => updateVariant(i, { ...row, extraPrice: Number(e.target.value) })}
                  />
                </td>
                <td className="w-10">
                  <button type="button" className="text-inkMuted hover:text-danger" onClick={() => removeVariant(i)}>
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {form.variants.length === 0 ? <p className="mt-3 text-[13px] text-inkMuted">No variants. Add an attribute row.</p> : null}
      </section>
      <section className="space-y-4">
        <h2 className="text-[15px] font-medium text-ink">Pricelist</h2>
        {lists.map((list) => (
          <div key={list.id}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] text-inkMuted">
                {list.name} · {list.currency}
              </p>
              <Button variant="ghost" onClick={() => addRule(list.id)}>
                <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                Add rule
              </Button>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="h-9 border-b border-bronze/40">
                  <th className="text-[11px] font-medium uppercase tracking-[0.04em] text-inkMuted">Tier</th>
                  <th className="text-[11px] font-medium uppercase tracking-[0.04em] text-inkMuted">Currency</th>
                  <th className="text-[11px] font-medium uppercase tracking-[0.04em] text-inkMuted">Price Rule</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.rules.map((rule, i) => (
                  <tr key={`${list.id}-${i}`} className="h-12 border-b border-ink/[0.08]">
                    <td>
                      <select
                        className={inputCls()}
                        value={rule.tier}
                        onChange={(e) => updateRule(list.id, i, 'tier', e.target.value)}
                      >
                        <option>Bronze</option>
                        <option>Silver</option>
                        <option>Gold</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className={inputCls('w-24')}
                        value={rule.currency}
                        onChange={(e) => updateRule(list.id, i, 'currency', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className={inputCls()}
                        value={rule.priceRule}
                        onChange={(e) => updateRule(list.id, i, 'priceRule', e.target.value)}
                      />
                    </td>
                    <td className="w-10">
                      <button type="button" className="text-inkMuted hover:text-danger" onClick={() => removeRule(list.id, i)}>
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>
      <InfoBanner>
        Recurring lines appear on invoices at the start of the billing period, not when the originating hardware ships.
      </InfoBanner>
      <Button
        loading={patch.isPending}
        onClick={async () => {
          await patch.mutateAsync({ ...form, pricelists: lists })
          push('Product saved.', 'ok')
        }}
      >
        Save product
      </Button>
    </Page>
  )
}
