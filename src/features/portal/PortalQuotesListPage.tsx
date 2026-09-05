import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { ErrorState, Page, PageHeader, TableSkeleton } from '../../components/ui/Page'
import { badgeFromStatus, formatDate, money, quotationStatusLabel } from '../../lib/format'
import { usePortalQuotes, useProductsList, useCreatePortalQuote } from '../../lib/hooks'
import type { QuotationListItem } from '../../lib/types'

export function PortalQuotesListPage() {
  const { data, isLoading, isError, error } = usePortalQuotes()
  const { data: productsData } = useProductsList()
  const createQuote = useCreatePortalQuote()
  const navigate = useNavigate()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [cart, setCart] = useState<{ productId: string; productName: string; qty: number; price: number; category: string }[]>([])

  const cols: Column<QuotationListItem>[] = [
    { key: 'number', header: 'Quotation' },
    { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
    { key: 'amount', header: 'Amount', render: (r) => money(r.amount) },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge status={badgeFromStatus(r.status)}>{quotationStatusLabel(r.status)}</Badge>,
    },
  ]

  const handleAddToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((p) => p.productId === product.id)
      if (existing) {
        return prev.map((p) => (p.productId === product.id ? { ...p, qty: p.qty + 1 } : p))
      }
      return [...prev, { productId: product.id, productName: product.name, qty: 1, price: product.price, category: product.category }]
    })
  }

  const handleSubmitCart = async () => {
    if (cart.length === 0) return
    const res = await createQuote.mutateAsync({ lines: cart })
    setIsModalOpen(false)
    setCart([])
    if (res?.id) {
      navigate(`/portal/quote/${res.id}`)
    }
  }

  return (
    <Page>
      <PageHeader
        title="My Quotations"
        action={
          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            Create Request
          </Button>
        }
      />
      {isLoading ? <TableSkeleton /> : null}
      {isError ? <ErrorState message={error instanceof Error ? error.message : 'Failed to load'} /> : null}
      {data ? (
        <DataTable
          columns={cols}
          rows={data.items}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/portal/quote/${r.id}`)}
          emptyMessage="No quotations have been shared with you yet."
        />
      ) : null}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-800 flex flex-col max-h-[90vh]">
            <h2 className="mb-4 text-xl font-bold text-slate-900 dark:text-white">Request New Quotation</h2>
            <div className="flex-1 overflow-y-auto mb-4 border border-slate-200 dark:border-slate-700 p-4 rounded-lg">
              <h3 className="font-semibold mb-2 text-slate-800 dark:text-slate-200">Available Products</h3>
              <div className="space-y-2 mb-6">
                {productsData?.map((p) => (
                  <div key={p.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-2 rounded">
                    <div>
                      <div className="font-medium text-slate-800 dark:text-slate-200">{p.name}</div>
                      <div className="text-sm text-slate-500">{money(p.price)}</div>
                    </div>
                    <Button variant="secondary" onClick={() => handleAddToCart(p)}>
                      Add
                    </Button>
                  </div>
                ))}
              </div>

              <h3 className="font-semibold mb-2 text-slate-800 dark:text-slate-200">Your Cart</h3>
              {cart.length === 0 ? (
                <div className="text-sm text-slate-500">Cart is empty</div>
              ) : (
                <div className="space-y-2">
                  {cart.map((item) => (
                    <div key={item.productId} className="flex justify-between items-center text-sm bg-slate-100 dark:bg-slate-700 p-2 rounded">
                      <div>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{item.productName}</span> x{item.qty}
                      </div>
                      <div className="flex items-center gap-2">
                        <span>{money(item.price * item.qty)}</span>
                        <button
                          className="text-red-500 hover:text-red-600"
                          onClick={() => setCart((prev) => prev.filter((p) => p.productId !== item.productId))}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-auto">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmitCart}
                disabled={cart.length === 0 || createQuote.isPending}
              >
                {createQuote.isPending ? 'Submitting...' : 'Submit to Sales'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Page>
  )
}
