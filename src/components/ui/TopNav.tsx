import { NavLink, useNavigate } from 'react-router-dom'
import {
  canSeeApprovals,
  canSeeDealHealth,
  canSeeDiscountConfig,
  canSeeProducts,
  canSeeReports,
  useAuth,
} from '../../lib/auth'
import type { Role } from '../../lib/types'

interface TopNavProps {
  role: 'internal' | 'portal'
}

interface Tab {
  to: string
  label: string
}

function tabsForInternal(role: Role | undefined): Tab[] {
  const tabs: Tab[] = [
    { to: '/app/dashboard', label: 'Dashboard' },
    { to: '/app/quotations', label: 'Quotations' },
  ]
  if (canSeeApprovals(role)) tabs.push({ to: '/app/approvals', label: 'Approvals' })
  tabs.push(
    { to: '/app/fulfillment', label: 'Fulfillment' },
    { to: '/app/subscriptions', label: 'Subscriptions' },
    { to: '/app/invoices', label: 'Invoices' },
  )
  if (canSeeDealHealth(role)) tabs.push({ to: '/app/deal-health', label: 'Deal Health' })
  if (canSeeReports(role)) tabs.push({ to: '/app/reports', label: 'Reports' })
  if (canSeeProducts(role)) tabs.push({ to: '/app/products', label: 'Product' })
  if (canSeeDiscountConfig(role)) {
    tabs.push({ to: '/app/admin/discount-config', label: 'Config' })
  }
  return tabs
}

const portalTabs: Tab[] = [
  { to: '/portal/quotes', label: 'My Quotations' },
  { to: '/portal/messages', label: 'Messages' },
  { to: '/portal/profile', label: 'Profile' },
]

export function TopNav({ role }: TopNavProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const tabs = role === 'portal' ? portalTabs : tabsForInternal(user?.role)

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface">
      <div className="flex h-12 items-center justify-between px-8">
        <div className="flex items-center gap-8">
          <span className="text-[15px] font-medium text-ink">DealFlow360</span>
          <nav className="flex items-center gap-1">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `rounded-md px-2.5 py-1 text-[13px] ${
                    isActive ? 'bg-surfaceAlt font-medium text-ink' : 'text-inkMuted hover:text-ink'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-inkMuted">
            {user?.name}
            <span className="ml-2 text-[11px] font-medium uppercase tracking-[0.04em] text-inkFaint">
              {user?.role}
            </span>
          </span>
          <button
            type="button"
            className="text-[13px] text-inkMuted hover:text-ink"
            onClick={() => {
              logout()
              navigate('/login')
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  )
}
