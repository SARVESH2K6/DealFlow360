import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { InfoBanner } from '../../components/ui/InfoBanner'
import { ErrorState, Page, PageHeader, TableSkeleton, inputCls } from '../../components/ui/Page'
import { useToast } from '../../components/ui/Toast'
import { canEditDiscountConfig, useAuth } from '../../lib/auth'
import { blockNegativeKey } from '../../lib/numericInput'
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
      <PageHeader
        title="Discount Tiers and Approval Chain"
        actions={
          canEdit ? (
            <Button
              variant="commit"
              loading={save.isPending}
              onClick={async () => {
                await save.mutateAsync(config)
                push('Configuration saved.', 'ok')
              }}
            >
              Save Configuration
            </Button>
          ) : null
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <section>
          <h2 className="mb-2 font-serif text-[18px] text-ink">Tier discounts</h2>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-bronze/40">
                <th className="h-8 text-[10px] font-medium uppercase tracking-[0.12em] text-inkMuted">Tier</th>
                <th className="h-8 text-[10px] font-medium uppercase tracking-[0.12em] text-inkMuted">Max Discount</th>
              </tr>
            </thead>
            <tbody>
              {config.tierDiscounts.map((row, i) => (
                <tr key={row.id} className="h-9 border-b border-ink/[0.08] last:border-0">
                  <td className="pr-3 text-[13px]">{row.tier}</td>
                  <td>
                    <input
                      className={inputCls('w-20')}
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      disabled={!canEdit}
                      value={row.maxDiscount}
                      onKeyDown={blockNegativeKey}
                      onChange={(e) => {
                        const next = [...config.tierDiscounts]
                        const cur = next[i]
                        if (!cur) return
                        next[i] = { ...cur, maxDiscount: Math.max(0, Number(e.target.value) || 0) }
                        setConfig({ ...config, tierDiscounts: next })
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h2 className="mb-2 font-serif text-[18px] text-ink">Category ceilings</h2>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-bronze/40">
                <th className="h-8 text-[10px] font-medium uppercase tracking-[0.12em] text-inkMuted">Category</th>
                <th className="h-8 text-[10px] font-medium uppercase tracking-[0.12em] text-inkMuted">Max Discount</th>
              </tr>
            </thead>
            <tbody>
              {config.categoryCeilings.map((row, i) => (
                <tr key={row.id} className="h-9 border-b border-ink/[0.08] last:border-0">
                  <td className="pr-3 text-[13px]">{row.category}</td>
                  <td>
                    <input
                      className={inputCls('w-20')}
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      disabled={!canEdit}
                      value={row.maxDiscount}
                      onKeyDown={blockNegativeKey}
                      onChange={(e) => {
                        const next = [...config.categoryCeilings]
                        const cur = next[i]
                        if (!cur) return
                        next[i] = { ...cur, maxDiscount: Math.max(0, Number(e.target.value) || 0) }
                        setConfig({ ...config, categoryCeilings: next })
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h2 className="mb-2 font-serif text-[18px] text-ink">Approval chain</h2>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-bronze/40">
                <th className="h-8 text-[10px] font-medium uppercase tracking-[0.12em] text-inkMuted">Range</th>
                <th className="h-8 text-[10px] font-medium uppercase tracking-[0.12em] text-inkMuted">Routing</th>
              </tr>
            </thead>
            <tbody>
              {config.approvalChain.map((row, i) => (
                <tr key={row.id} className="h-9 border-b border-ink/[0.08] last:border-0">
                  <td className="pr-3 text-[13px]">{row.range}</td>
                  <td>
                    <select
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
                    >
                      <option>No approval</option>
                      <option>Sales Manager</option>
                      <option>Sales Manager then Finance</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {!canEdit ? (
        <p className="text-[13px] text-inkMuted">Finance has read access. Only admin can save changes.</p>
      ) : null}

      <InfoBanner>
        Blended risk is the weighted sum of each line&apos;s discount over its own ceiling. A score of 0 (within
        every ceiling) needs no approval. Scores at or above the medium threshold route using the Sales Manager
        row; scores at or above the high threshold use the Finance row. Those routing values are what the engine
        reads.
      </InfoBanner>
    </Page>
  )
}
