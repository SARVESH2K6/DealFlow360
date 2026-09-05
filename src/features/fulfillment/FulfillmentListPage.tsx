import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { InfoBanner } from '../../components/ui/InfoBanner'
import { ErrorState, Page, PageHeader, TableSkeleton } from '../../components/ui/Page'
import { quotationStatusLabel } from '../../lib/format'
import { useFulfillment } from '../../lib/hooks'
import type { FulfillmentOrderListItem, StockRow } from '../../lib/types'

export function FulfillmentListPage() {
  const { data, isLoading, isError, error } = useFulfillment()
  const navigate = useNavigate()

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
          <section>
            <h2 className="mb-3 text-[15px] font-medium text-ink">Live stock</h2>
            <DataTable columns={stockCols} rows={data.stock} rowKey={(r) => r.warehouse + r.productId} emptyMessage="No stock rows." />
          </section>
          <section>
            <h2 className="mb-3 text-[15px] font-medium text-ink">Orders awaiting fulfillment</h2>
            <DataTable
              columns={orderCols}
              rows={data.orders}
              rowKey={(r) => r.id}
              onRowClick={(r) => navigate(`/app/fulfillment/${r.id}`)}
              emptyMessage="No orders awaiting fulfillment."
            />
          </section>
          <InfoBanner>
            &apos;Consolidate Remaining Backorder&apos; prompt appears automatically once stock arrives.
          </InfoBanner>
        </>
      ) : null}
    </Page>
  )
}
