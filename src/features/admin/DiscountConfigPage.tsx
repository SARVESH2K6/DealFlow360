import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { InfoBanner } from '../../components/ui/InfoBanner'
import { ErrorState, Page, PageHeader, TableSkeleton, inputCls } from '../../components/ui/Page'
import { useToast } from '../../components/ui/Toast'
import { canEditDiscountConfig, useAuth } from '../../lib/auth'
import { useDiscountConfig, useSaveDiscountConfig } from '../../lib/hooks'
import type { DiscountConfig } from '../../lib/types'

export function DiscountConfigPage() {
  const { user } = useAuth()
  const { push } = useToast()
  const { data, isLoading, isError, error } = useDiscountConfig()
  const save = useSaveDiscountConfig()
  const [config, setConfig] = useState<DiscountConfig | null>(null)
  const canEdit = canEditDiscountConfig(user?.role)

  useEffect(() => {
    if (data) setConfig(data)
  }, [data])

  if (isLoading || !config) {
    return (
      <Page>
        <PageHeader title="Discount configuration" />
        {isError ? <ErrorState message={error instanceof Error ? error.message : 'Failed to load'} /> : <TableSkeleton />}
      </Page>
    )
  }

  return (
    <Page>
      <PageHeader title="Discount Tiers and Approval Chain" />
      <div className="grid grid-cols-2 gap-4">
        <section className="rounded-md border border-border bg-surface">
          <h2 className="border-b border-border px-4 py-3 text-[15px] font-medium text-ink">Tier Discount Settings</h2>
          <table className="w-full text-left">
            <thead>
              <tr className="h-9 bg-surfaceAlt">
                <th className="px-3 text-[11px] font-medium uppercase tracking-[0.04em] text-inkMuted">Tier</th>
                <th className="px-3 text-[11px] font-medium uppercase tracking-[0.04em] text-inkMuted">Max Discount</th>
              </tr>
            </thead>
            <tbody>
              {config.tierDiscounts.map((row, i) => (
                <tr key={row.id} className="h-11 border-b border-border last:border-0">
                  <td className="px-3">{row.tier}</td>
                  <td className="px-3">
                    <input
                      className={inputCls('w-24')}
                      type="number"
                      disabled={!canEdit}
                      value={row.maxDiscount}
                      onChange={(e) => {
                        const next = [...config.tierDiscounts]
                        const cur = next[i]
                        if (!cur) return
                        next[i] = { ...cur, maxDiscount: Number(e.target.value) }
                        setConfig({ ...config, tierDiscounts: next })
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="rounded-md border border-border bg-surface">
          <h2 className="border-b border-border px-4 py-3 text-[15px] font-medium text-ink">Category Discount Ceilings</h2>
          <table className="w-full text-left">
            <thead>
              <tr className="h-9 bg-surfaceAlt">
                <th className="px-3 text-[11px] font-medium uppercase tracking-[0.04em] text-inkMuted">Category</th>
                <th className="px-3 text-[11px] font-medium uppercase tracking-[0.04em] text-inkMuted">Max Discount</th>
              </tr>
            </thead>
            <tbody>
              {config.categoryCeilings.map((row, i) => (
                <tr key={row.id} className="h-11 border-b border-border last:border-0">
                  <td className="px-3">{row.category}</td>
                  <td className="px-3">
                    <input
                      className={inputCls('w-24')}
                      type="number"
                      disabled={!canEdit}
                      value={row.maxDiscount}
                      onChange={(e) => {
                        const next = [...config.categoryCeilings]
                        const cur = next[i]
                        if (!cur) return
                        next[i] = { ...cur, maxDiscount: Number(e.target.value) }
                        setConfig({ ...config, categoryCeilings: next })
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="rounded-md border border-border bg-surface">
        <h2 className="border-b border-border px-4 py-3 text-[15px] font-medium text-ink">
          Discount Range → Max Discount
        </h2>
        <table className="w-full text-left">
          <thead>
            <tr className="h-9 bg-surfaceAlt">
              <th className="px-3 text-[11px] font-medium uppercase tracking-[0.04em] text-inkMuted">Range</th>
              <th className="px-3 text-[11px] font-medium uppercase tracking-[0.04em] text-inkMuted">Routing</th>
            </tr>
          </thead>
          <tbody>
            {config.approvalChain.map((row, i) => (
              <tr key={row.id} className="h-11 border-b border-border last:border-0">
                <td className="px-3">{row.range}</td>
                <td className="px-3">
                  <input
                    className={inputCls()}
                    disabled={!canEdit}
                    value={row.routing}
                    onChange={(e) => {
                      const next = [...config.approvalChain]
                      const cur = next[i]
                      if (!cur) return
                      next[i] = { ...cur, routing: e.target.value }
                      setConfig({ ...config, approvalChain: next })
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {canEdit ? (
        <Button
          loading={save.isPending}
          onClick={async () => {
            await save.mutateAsync(config)
            push('Configuration saved.', 'ok')
          }}
        >
          Save Configuration
        </Button>
      ) : (
        <p className="text-[13px] text-inkMuted">Finance has read access. Only admin can save changes.</p>
      )}

      <InfoBanner>
        When a quote crosses categories with different ceilings, the system computes a blended risk score and routes to
        the highest required level. All approvals, rejections, and edits must be logged with user, timestamp, and reason.
      </InfoBanner>
    </Page>
  )
}
