import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { InfoBanner } from '../../components/ui/InfoBanner'
import { ErrorState, Page, PageHeader, SearchField, TableSkeleton } from '../../components/ui/Page'
import { useToast } from '../../components/ui/Toast'
import { quotationStatusLabel } from '../../lib/format'
import { useFulfillment, useConsolidateFulfillment } from '../../lib/hooks'
import { matchesSearch } from '../../lib/search'
import type { FulfillmentOrderListItem, StockRow } from '../../lib/types'

export function FulfillmentListPage() {
  const { data, isLoading, isError, error } = useFulfillment()
  const navigate = useNavigate()
  const { push } = useToast()
  const [query, setQuery] = useState('')
  const consolidatable = (data?.orders ?? []).filter((o) => o.canConsolidate)
  const firstPrompt = consolidatable[0]
  const consolidate = useConsolidateFulfillment()

  const stock = useMemo(
    () =>
      (data?.stock ?? []).filter((s) =>
        matchesSearch(query, [s.warehouse, s.productName, String(s.inStock), String(s.available)]),
      ),
    [data?.stock, query],
  )
  const orders = useMemo(
    () =>
      (data?.orders ?? []).filter((o) =>
        matchesSearch(query, [o.orderNumber, o.customerName, o.warehouse, quotationStatusLabel(o.status)]),
      ),
    [data?.orders, query],
  )

  const stockCols: Column<StockRow>[] = [
    { key: 'warehouse', header: 'Warehouse', sortable: true },
    { key: 'productName', header: 'Product', sortable: true },
    { key: 'inStock', header: 'In Stock', sortable: true, accessor: (r) => r.inStock },
    { key: 'reserved', header: 'Reserved', sortable: true, accessor: (r) => r.reserved },
    { key: 'available', header: 'Available', sortable: true, accessor: (r) => r.available },
  ]

  const orderCols: Column<FulfillmentOrderListItem>[] = [
    { key: 'orderNumber', header: 'Order', sortable: true },
    { key: 'customerName', header: 'Customer', sortable: true },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge status={r.status}>{quotationStatusLabel(r.status)}</Badge>,
    },
    { key: 'warehouse', header: 'Warehouse' },
  ]

  return (
    <Page>
      <PageHeader title="Fulfillment" />
      {isLoading ? <TableSkeleton /> : null}
      {isError ? <ErrorState message={error instanceof Error ? error.message : 'Failed to load'} /> : null}
      {data ? (
        <>
          {firstPrompt ? (
            <div className="flex items-center justify-between gap-6 border-l-[3px] border-warn bg-warnBg/40 px-4 py-3">
              <p className="text-[13px] leading-relaxed text-warn">
                Stock has arrived for {firstPrompt.orderNumber}. Consolidate remaining backorder
                {firstPrompt.remainingQty ? ` (${firstPrompt.remainingQty} units)` : ''}?
              </p>
              <Button
                variant="commit"
                loading={consolidate.isPending}
                onClick={async () => {
                  await consolidate.mutateAsync(firstPrompt.id)
                  push('Remaining backorder consolidated.', 'ok')
                }}
              >
                Consolidate Remaining Backorder
              </Button>
            </div>
          ) : (
            <InfoBanner>
              A Consolidate Remaining Backorder prompt appears automatically once stock arrives for a backorder.
            </InfoBanner>
          )}
          <SearchField value={query} onChange={setQuery} placeholder="Search stock or orders" />
          <section>
            <h2 className="mb-3 text-[15px] font-medium text-ink">Live stock</h2>
            <DataTable columns={stockCols} rows={stock} rowKey={(r) => r.warehouse + r.productId} emptyMessage="No stock rows." />
          </section>
          <section>
            <h2 className="mb-3 text-[15px] font-medium text-ink">Orders awaiting fulfillment</h2>
            <DataTable
              columns={orderCols}
              rows={orders}
              rowKey={(r) => r.id}
              onRowClick={(r) => navigate(`/app/fulfillment/${r.id}`)}
              emptyMessage="No orders awaiting fulfillment."
            />
          </section>
        </>
      ) : null}
    </Page>
  )
}
