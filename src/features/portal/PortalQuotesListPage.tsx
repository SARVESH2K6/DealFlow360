import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { ErrorState, Page, PageHeader, SearchField, TableSkeleton } from '../../components/ui/Page'
import { badgeFromStatus, formatDate, money, quotationStatusLabel } from '../../lib/format'
import { usePortalQuotes } from '../../lib/hooks'
import { matchesSearch } from '../../lib/search'
import type { QuotationListItem } from '../../lib/types'

export function PortalQuotesListPage() {
  const { data, isLoading, isError, error } = usePortalQuotes()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const rows = useMemo(
    () =>
      (data?.items ?? []).filter((q) =>
        matchesSearch(query, [q.number, q.customerName, quotationStatusLabel(q.status)]),
      ),
    [data?.items, query],
  )

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
      <PageHeader kicker="Customer portal" title="Quotes" />
      {isLoading ? <TableSkeleton /> : null}
      {isError ? <ErrorState message={error instanceof Error ? error.message : 'Failed to load'} /> : null}
      {data ? (
        <>
          <SearchField value={query} onChange={setQuery} placeholder="Search quotations" />
          <DataTable
            columns={cols}
            rows={rows}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/portal/quote/${r.id}`)}
            emptyMessage="No quotes have been shared with you yet."
          />
        </>
      ) : null}
    </Page>
  )
}
