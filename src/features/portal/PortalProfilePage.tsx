import { ErrorState, Page, PageHeader, TableSkeleton } from '../../components/ui/Page'
import { usePortalProfile } from '../../lib/hooks'

export function PortalProfilePage() {
  const { data, isLoading, isError, error } = usePortalProfile()

  return (
    <Page>
      <PageHeader title="Profile" />
      {isLoading ? <TableSkeleton rows={3} /> : null}
      {isError ? <ErrorState message={error instanceof Error ? error.message : 'Failed to load'} /> : null}
      {data ? (
        <div className="max-w-md space-y-3 rounded-md border border-border bg-surface p-4">
          <Row label="Name" value={data.user.name} />
          <Row label="Email" value={data.user.email} />
          <Row label="Company" value={data.customer?.name ?? '—'} />
          <Row label="Tier" value={data.customer?.tier ?? '—'} />
          <Row label="Terms" value={data.customer?.terms ?? '—'} />
        </div>
      ) : null}
    </Page>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-inkMuted">{label}</div>
      <div className="mt-0.5 text-[14px] text-ink">{value}</div>
    </div>
  )
}
