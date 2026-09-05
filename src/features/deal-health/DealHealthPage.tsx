import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { ErrorState, Page, PageHeader, StatRowSkeleton, TableSkeleton } from '../../components/ui/Page'
import { StatCard } from '../../components/ui/StatCard'
import { useToast } from '../../components/ui/Toast'
import { formatDate } from '../../lib/format'
import { useDealHealth, useDealHealthAction } from '../../lib/hooks'
import type { DealHealthItem } from '../../lib/types'

export function DealHealthPage() {
  const { data, isLoading, isError, error } = useDealHealth()
  const action = useDealHealthAction()
  const { push } = useToast()

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
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Stalled Deals" value={data.stalled} tone="warn" />
            <StatCard label="Discount Anomalies" value={data.anomalies} tone="danger" />
            <StatCard label="Delivery Slippage" value={data.slippage} />
          </div>
          <DataTable columns={cols} rows={data.items} rowKey={(r) => r.id} emptyMessage="No flagged deals." />
          <section className="rounded-md border border-border bg-surface p-4">
            <h2 className="mb-4 text-[15px] font-medium text-ink">Deals by stage</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byStage} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#E4DDD0" vertical={false} />
                  <XAxis dataKey="stage" tick={{ fill: '#6B6459', fontSize: 12 }} axisLine={{ stroke: '#D3C9B6' }} />
                  <YAxis allowDecimals={false} tick={{ fill: '#6B6459', fontSize: 12 }} axisLine={{ stroke: '#D3C9B6' }} />
                  <Tooltip
                    contentStyle={{
                      background: '#FFFFFF',
                      border: '1px solid #E4DDD0',
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                  />
                  <Bar dataKey="count" fill="#9C7A3C" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      ) : null}
    </Page>
  )
}
