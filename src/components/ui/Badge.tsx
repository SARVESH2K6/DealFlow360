import type { BadgeStatus } from '../../lib/types'

const styles: Record<BadgeStatus, string> = {
  approved: 'bg-okBg text-ok',
  confirmed: 'bg-okBg text-ok',
  paid: 'bg-okBg text-ok',
  active: 'bg-okBg text-ok',
  ready: 'bg-okBg text-ok',
  low: 'bg-okBg text-ok',
  pending: 'bg-warnBg text-warn',
  medium: 'bg-warnBg text-warn',
  split_pending: 'bg-warnBg text-warn',
  backorder: 'bg-warnBg text-warn',
  paused: 'bg-warnBg text-warn',
  unpaid: 'bg-warnBg text-warn',
  sent: 'bg-warnBg text-warn',
  rejected: 'bg-dangerBg text-danger',
  high: 'bg-dangerBg text-danger',
  cancelled: 'bg-dangerBg text-danger',
  draft: 'bg-cream text-inkMuted',
  negotiating: 'bg-warnBg text-warn',
  under_negotiation: 'bg-warnBg text-warn',
}

const labels: Partial<Record<BadgeStatus, string>> = {
  split_pending: 'Split Pending',
  under_negotiation: 'Under Negotiation',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  draft: 'Draft',
  negotiating: 'Negotiation',
  confirmed: 'Confirmed',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

interface BadgeProps {
  status: BadgeStatus | string
  children?: string
}

export function Badge({ status, children }: BadgeProps) {
  const key = status as BadgeStatus
  const cls = styles[key] ?? 'bg-cream text-inkMuted'
  const text = children ?? labels[key] ?? status.replace(/_/g, ' ')
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.04em] ${cls}`}
    >
      {text}
    </span>
  )
}
