import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { ErrorState, Page, PageHeader, TableSkeleton } from '../../components/ui/Page'
import { badgeFromStatus, formatDate, money, quotationStatusLabel } from '../../lib/format'
import { usePortalQuotes } from '../../lib/hooks'
import type { QuotationListItem } from '../../lib/types'

export function PortalQuotesListPage() {
  const { data, isLoading, isError, error } = usePortalQuotes()
  const navigate = useNavigate()

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

  return (
    <Page>
      <PageHeader title="My Quotations" />
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
    </Page>
  )
}
