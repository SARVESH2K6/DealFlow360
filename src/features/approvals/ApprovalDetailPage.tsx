import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { InfoBanner } from '../../components/ui/InfoBanner'
import { ErrorState, Field, Page, PageHeader, StatRowSkeleton, TableSkeleton, inputCls } from '../../components/ui/Page'
import { StatCard } from '../../components/ui/StatCard'
import { StatusStepper } from '../../components/ui/StatusStepper'
import { useToast } from '../../components/ui/Toast'
import { canActOnApprovals, useAuth } from '../../lib/auth'
import { formatDateTime, money } from '../../lib/format'
import { useApprovalAction, useApprovalDetail } from '../../lib/hooks'
import type { AuditEntry, FlagReason } from '../../lib/types'

const STEPS = ['Submitted', 'Sales Manager', 'Finance', 'Confirmed']

function stepIndex(stage: string): number {
  if (stage === 'submitted') return 0
  if (stage === 'sales_manager') return 1
  if (stage === 'finance') return 2
  return 3
}

export function ApprovalDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { push } = useToast()
  const { data, isLoading, isError, error } = useApprovalDetail(id)
  const action = useApprovalAction(id ?? '')
  const [note, setNote] = useState('')

  if (isLoading) {
    return (
      <Page>
        <PageHeader title="Approval" />
        <StatRowSkeleton />
        <TableSkeleton />
      </Page>
    )
  }
  if (isError || !data) {
    return (
      <Page>
        <ErrorState message={error instanceof Error ? error.message : 'Approval not found'} />
      </Page>
    )
  }

  const showActions =
    data.status === 'pending' &&
    canActOnApprovals(user?.role) &&
    (user?.role === 'admin' ||
      (data.stage === 'sales_manager' && (user?.role === 'manager' || user?.role === 'finance')) ||
      (data.stage === 'finance' && user?.role === 'finance'))

  async function run(kind: 'approve' | 'return' | 'reject') {
    const result = await action.mutateAsync({ action: kind, note })
    push(`${kind === 'return' ? 'Returned' : kind === 'reject' ? 'Rejected' : 'Approved'} · ${result.quotation.number}`)
    setNote('')
  }

  const reasonCols: Column<FlagReason>[] = [
    { key: 'line', header: 'Line' },
    { key: 'discountGiven', header: 'Discount Given', render: (r) => `${r.discountGiven}%` },
    { key: 'limitAllowed', header: 'Limit Allowed', render: (r) => `${r.limitAllowed}%` },
    { key: 'overBy', header: 'Over By', render: (r) => `${r.overBy} pts` },
  ]

  const auditCols: Column<AuditEntry>[] = [
    { key: 'user', header: 'User' },
    { key: 'action', header: 'Action' },
    { key: 'date', header: 'Date', render: (r) => formatDateTime(r.date) },
    { key: 'note', header: 'Note' },
  ]

  return (
    <Page>
      <PageHeader
        title={`${data.quotation.number} · ${data.customerName}`}
        actions={<Badge status={data.status}>{data.status}</Badge>}
      />
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Blended Risk" value={data.riskLevel} sublabel={`Score ${data.riskScore} · ${data.blendedRisk} blended`} tone={data.riskLevel === 'HIGH' ? 'danger' : data.riskLevel === 'MEDIUM' ? 'warn' : 'ok'} />
        <StatCard label="Customer Tier" value={data.customerTier} sublabel={money(data.amount)} />
      </div>

      <div>
        <InfoBanner>Why this quote was flagged</InfoBanner>
        <div className="mt-2">
          <DataTable
            columns={reasonCols}
            rows={data.flagReasons}
            rowKey={(r) => r.line}
            emptyMessage="No line exceeded its limit."
          />
        </div>
      </div>

      <StatusStepper steps={STEPS} currentStep={stepIndex(data.stage)} />

      <section>
        <h2 className="mb-3 text-[15px] font-medium text-ink">Line items</h2>
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <table className="w-full text-left">
            <thead>
              <tr className="h-9 bg-surfaceAlt">
                {['Product', 'Qty', 'Price', 'Discount %', 'Limit', 'Status'].map((h) => (
                  <th key={h} className="px-3 text-[11px] font-medium uppercase tracking-[0.04em] text-inkMuted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.quotation.lines.map((l) => (
                <tr key={l.id} className="h-11 border-b border-border last:border-0">
                  <td className="px-3">{l.productName}</td>
                  <td className="px-3">{l.qty}</td>
                  <td className="px-3">{money(l.price)}</td>
                  <td className="px-3">{l.discountPercent}%</td>
                  <td className="px-3">{l.limit}%</td>
                  <td className="px-3 text-inkMuted">{l.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-medium text-ink">Audit log</h2>
        <DataTable columns={auditCols} rows={data.auditLog} rowKey={(r) => r.date + r.action} emptyMessage="No audit entries." />
      </section>

      {showActions ? (
        <div className="space-y-3">
          <Field label="Note">
            <input className={inputCls()} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Required for the log" />
          </Field>
          <div className="flex gap-2">
            <Button variant="commit" loading={action.isPending && action.variables?.action === 'approve'} onClick={() => void run('approve')}>
              Approve
            </Button>
            <Button
              variant="secondary"
              loading={action.isPending && action.variables?.action === 'return'}
              onClick={() => void run('return')}
            >
              Return for Revision
            </Button>
            <Button
              variant="danger"
              loading={action.isPending && action.variables?.action === 'reject'}
              onClick={() => void run('reject')}
            >
              Reject
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-inkMuted">Actions appear for the role assigned to the current pending step.</p>
      )}
    </Page>
  )
}
