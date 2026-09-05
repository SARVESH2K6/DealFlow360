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

export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    rep: 'Sales Rep',
    manager: 'Sales Manager',
    finance: 'Finance',
    admin: 'Administrator',
    customer: 'Customer',
    system: 'Within-limit auto-approval',
  }
  return map[role] ?? role
}

export function quotationStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Draft',
    returned: 'Returned',
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
    customer_submitted: 'Customer Submitted',
    customer_review: 'Customer Review',
  }
  return map[status] ?? status
}

export function badgeFromStatus(status: string): 'approved' | 'pending' | 'rejected' | 'draft' | 'negotiating' | 'confirmed' {
  if (status === 'approved' || status === 'paid' || status === 'active' || status === 'ready' || status === 'confirmed') {
    return status === 'confirmed' ? 'confirmed' : 'approved'
  }
  if (status === 'rejected' || status === 'cancelled' || status === 'unpaid' || status === 'returned') {
    return 'rejected'
  }
  if (status === 'draft') return 'draft'
  if (status === 'negotiation' || status === 'under_negotiation' || status === 'paused' || status === 'customer_review') return 'negotiating'
  return 'pending'
}
