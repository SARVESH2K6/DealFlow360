import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { ErrorState, Field, Page, PageHeader, StatRowSkeleton, inputCls } from '../../components/ui/Page'
import { StatCard } from '../../components/ui/StatCard'
import { useReports } from '../../lib/hooks'

export function ReportsPage() {
  const { data, isLoading, isError, error } = useReports()
  const [period, setPeriod] = useState('Q3 2026')
  const [team, setTeam] = useState('All')
  const [status, setStatus] = useState('All')
  const [product, setProduct] = useState('All')

  return (
    <Page>
      <PageHeader
        title="Reports"
        actions={
          <>
            <Button variant="secondary" disabled title="Coming soon">
              Export PDF
            </Button>
            <Button variant="secondary" disabled title="Coming soon">
              Export XLS
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-4 gap-3">
        <Field label="Period">
          <select className={inputCls()} value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option>Q3 2026</option>
            <option>Q2 2026</option>
            <option>YTD</option>
          </select>
        </Field>
        <Field label="Sales Team">
          <select className={inputCls()} value={team} onChange={(e) => setTeam(e.target.value)}>
            <option>All</option>
            <option>North America</option>
            <option>EMEA</option>
          </select>
        </Field>
        <Field label="Approval Status">
          <select className={inputCls()} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>All</option>
            <option>Pending</option>
            <option>Approved</option>
          </select>
        </Field>
        <Field label="Product">
          <select className={inputCls()} value={product} onChange={(e) => setProduct(e.target.value)}>
            <option>All</option>
            <option>Industrial Sensor Array</option>
            <option>Predictive Maintenance Suite</option>
          </select>
        </Field>
      </div>
      {isLoading ? <StatRowSkeleton /> : null}
      {isError ? <ErrorState message={error instanceof Error ? error.message : 'Failed to load'} /> : null}
      {data ? (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Quotes Created" value={data.quotesCreated} />
          <StatCard label="Avg Approval Time" value={data.avgApprovalTime} />
          <StatCard label="Top Upsell Product" value={data.topUpsellProduct} />
        </div>
      ) : null}
    </Page>
  )
}
