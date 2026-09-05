import { ErrorState, MetaItem, Page, PageHeader, TableSkeleton } from '../../components/ui/Page'
import { usePortalProfile } from '../../lib/hooks'

export function PortalProfilePage() {
  const { data, isLoading, isError, error } = usePortalProfile()

  return (
    <Page>
      <PageHeader title="Profile" />
      {isLoading ? <TableSkeleton rows={3} /> : null}
      {isError ? <ErrorState message={error instanceof Error ? error.message : 'Failed to load'} /> : null}
      {data ? (
        <div className="grid max-w-2xl grid-cols-2 gap-x-8 gap-y-3">
          <MetaItem label="Name">{data.user.name}</MetaItem>
          <MetaItem label="Email">{data.user.email}</MetaItem>
          <MetaItem label="Company">{data.customer?.name ?? '—'}</MetaItem>
          <MetaItem label="Tier">{data.customer?.tier ?? '—'}</MetaItem>
          <MetaItem label="Terms">{data.customer?.terms ?? '—'}</MetaItem>
        </div>
      ) : null}
    </Page>
  )
}
