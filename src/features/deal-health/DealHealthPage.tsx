import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { ErrorState, Page, PageHeader, SearchField, StatRowSkeleton, TableSkeleton } from '../../components/ui/Page'
import { StatCard } from '../../components/ui/StatCard'
import { useToast } from '../../components/ui/Toast'
import { formatDate } from '../../lib/format'
import { useDealHealth, useDealHealthAction } from '../../lib/hooks'
import { matchesSearch } from '../../lib/search'
import type { DealHealthItem } from '../../lib/types'

export function DealHealthPage() {
  const { data, isLoading, isError, error } = useDealHealth()
  const action = useDealHealthAction()
  const { push } = useToast()
  const [query, setQuery] = useState('')
  const rows = useMemo(
    () => (data?.items ?? []).filter((r) => matchesSearch(query, [r.deal, r.issue, r.type])),
    [data?.items, query],
  )

  const cols: Column<DealHealthItem>[] = [
    { key: 'deal', header: 'Deal', sortable: true },
    { key: 'issue', header: 'Issue' },
    { key: 'flagged', header: 'Flagged', render: (r) => formatDate(r.flagged) },
    {
      key: 'action',
      header: 'Action',
      render: (r) => (
        <span className="inline-flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="danger"
            className="h-7 px-2 text-[12px]"
            loading={action.isPending && action.variables?.id === r.id && action.variables.action === 'escalate'}
            onClick={() => {
              void action.mutateAsync({ id: r.id, action: 'escalate' }).then(() => push('Escalated.', 'danger'))
            }}
          >
            Escalate
          </Button>
          <Button
            variant="secondary"
            className="h-7 px-2 text-[12px]"
            loading={action.isPending && action.variables?.id === r.id && action.variables.action === 'nudge'}
            onClick={() => {
              void action.mutateAsync({ id: r.id, action: 'nudge' }).then(() => push('Rep nudged.', 'ok'))
            }}
          >
            Nudge Rep
          </Button>
        </span>
      ),
    },
  ]

  return (
    <Page>
      <PageHeader title="Deal Health" />
      {isLoading ? (
        <>
          <StatRowSkeleton />
          <TableSkeleton />
        </>
      ) : null}
      {isError ? <ErrorState message={error instanceof Error ? error.message : 'Failed to load'} /> : null}
      {data ? (
        <>
          <div className="grid grid-cols-3 gap-px bg-bronze/30">
            <StatCard label="Stalled Deals" value={data.stalled} tone="warn" />
            <StatCard label="Discount Anomalies" value={data.anomalies} tone="danger" />
            <StatCard label="Delivery Slippage" value={data.slippage} />
          </div>
          <SearchField value={query} onChange={setQuery} placeholder="Search flagged deals" />
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div>
              <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} emptyMessage="No flagged deals." />
            </div>
            <section>
              <h2 className="mb-2 font-serif text-[18px] text-ink">Deals by stage</h2>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byStage} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#E6DCCB" vertical={false} />
                  <XAxis dataKey="stage" tick={{ fill: '#5E584E', fontSize: 12 }} axisLine={{ stroke: '#B08948' }} />
                  <YAxis allowDecimals={false} tick={{ fill: '#5E584E', fontSize: 12 }} axisLine={{ stroke: '#B08948' }} />
                  <Tooltip
                    contentStyle={{
                      background: '#FBF6EC',
                      border: '1px solid #B08948',
                      borderRadius: 0,
                      fontSize: 13,
                    }}
                  />
                  <Bar dataKey="count" fill="#B08948" radius={[0, 0, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            </section>
          </div>
        </>
      ) : null}
    </Page>
  )
}
