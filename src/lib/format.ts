export function money(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function moneyExact(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}

export function formatDate(iso: string): string {
  if (!iso || iso === '—') return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function quotationStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Draft',
    pending_approval: 'Pending Approval',
    approved: 'Approved',
    negotiation: 'Negotiation',
    confirmed: 'Confirmed',
    rejected: 'Rejected',
    split_pending: 'Split Pending',
    backorder: 'Backorder',
    ready: 'Ready',
    unpaid: 'Unpaid',
    paid: 'Paid',
    active: 'Active',
    paused: 'Paused',
    cancelled: 'Cancelled',
    sent: 'Sent',
    under_negotiation: 'Under Negotiation',
    sales_manager: 'Sales Manager',
    finance: 'Finance',
    submitted: 'Submitted',
  }
  return map[status] ?? status
}

export function badgeFromStatus(status: string): 'approved' | 'pending' | 'rejected' | 'draft' | 'negotiating' | 'confirmed' {
  if (status === 'approved' || status === 'paid' || status === 'active' || status === 'ready' || status === 'confirmed') {
    return status === 'confirmed' ? 'confirmed' : 'approved'
  }
  if (status === 'rejected' || status === 'cancelled' || status === 'unpaid') return 'rejected'
  if (status === 'draft') return 'draft'
  if (status === 'negotiation' || status === 'under_negotiation' || status === 'paused') return 'negotiating'
  return 'pending'
}
