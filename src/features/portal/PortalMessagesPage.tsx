import { formatDateTime } from '../../lib/format'
import { ErrorState, Page, PageHeader, TableSkeleton } from '../../components/ui/Page'
import { EmptyState } from '../../components/ui/EmptyState'
import { usePortalMessages } from '../../lib/hooks'

export function PortalMessagesPage() {
  const { data, isLoading, isError, error } = usePortalMessages()

  return (
    <Page>
      <PageHeader title="Messages" />
      {isLoading ? <TableSkeleton /> : null}
      {isError ? <ErrorState message={error instanceof Error ? error.message : 'Failed to load'} /> : null}
      {data && data.items.length === 0 ? <EmptyState message="No messages yet." /> : null}
      {data && data.items.length > 0 ? (
        <ul className="space-y-3">
          {data.items.map((m) => (
            <li key={m.id} className="rounded-md border border-border bg-surface p-4">
              <div className="flex justify-between text-[13px] text-inkMuted">
                <span>{m.from}</span>
                <span>{formatDateTime(m.date)}</span>
              </div>
              <p className="mt-2 text-[14px] text-ink">{m.body}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </Page>
  )
}
