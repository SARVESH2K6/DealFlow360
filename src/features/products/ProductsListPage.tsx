import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { ErrorState, Page, PageHeader, StatRowSkeleton, TableSkeleton } from '../../components/ui/Page'
import { StatCard } from '../../components/ui/StatCard'
import { money } from '../../lib/format'
import { useCreateProduct, useProductsList } from '../../lib/hooks'
import type { Product } from '../../lib/types'

export function ProductsListPage() {
  const { data, isLoading, isError, error } = useProductsList()
  const create = useCreateProduct()
  const navigate = useNavigate()

  const cols: Column<Product>[] = [
    { key: 'name', header: 'Product Name', sortable: true },
    { key: 'category', header: 'Category', sortable: true },
    { key: 'variants', header: 'Variants', render: (r) => String(r.variants.length) },
    { key: 'price', header: 'Price', sortable: true, accessor: (r) => r.price, render: (r) => money(r.price) },
    { key: 'unit', header: 'Unit' },
    { key: 'taxPercent', header: 'Tax', render: (r) => `${r.taxPercent}%` },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge status={r.status === 'active' ? 'approved' : 'draft'}>{r.status}</Badge>,
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Products"
        actions={
          <Button
            loading={create.isPending}
            onClick={async () => {
              const p = await create.mutateAsync({
                name: 'New product',
                category: 'Hardware',
                price: 0,
                unit: 'unit',
                taxPercent: 0,
                description: '',
                isSubscription: false,
              })
              navigate(`/app/products/${p.product.id}`)
            }}
          >
            + New Product
          </Button>
        }
      />
      {isLoading ? (
        <>
          <StatRowSkeleton />
          <TableSkeleton />
        </>
      ) : null}
      {isError ? <ErrorState message={error instanceof Error ? error.message : 'Failed to load'} /> : null}
      {data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard label="Total Products" value={data.stats.totalProducts} />
            <StatCard label="Pricelists" value={data.stats.pricelists} />
            <StatCard label="Variants" value={data.stats.variants} />
          </div>
          <DataTable
            columns={cols}
            rows={data.items}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/app/products/${r.id}`)}
            emptyMessage="No products yet."
          />
        </>
      ) : null}
    </Page>
  )
}
