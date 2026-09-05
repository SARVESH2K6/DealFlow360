import { LogOut } from 'lucide-react'
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
  { to: '/portal/quotes', label: 'Quotes' },
  { to: '/portal/messages', label: 'Messages' },
  { to: '/portal/profile', label: 'Profile' },
]

export function TopNav({ role }: TopNavProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const tabs = role === 'portal' ? portalTabs : tabsForInternal(user?.role)

  return (
    <header className="sticky top-0 z-20 bg-sheet">
      <div className="rule-double" />
      <div className="flex h-12 items-center justify-between px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-6">
          <span className="shrink-0 font-serif text-[18px] tracking-tight text-commit">DealFlow360</span>
          <nav className="flex items-center gap-5 overflow-x-auto">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `whitespace-nowrap text-[11px] uppercase tracking-[0.12em] transition-colors duration-150 ${
                    isActive ? 'text-ink' : 'text-inkMuted hover:text-ink'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-5">
          <span className="text-[13px] text-inkMuted">
            {user?.name}
            <span className="ml-2 text-[10px] font-medium uppercase tracking-[0.14em] text-inkFaint">
              {user?.role}
            </span>
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.12em] text-inkMuted transition-colors duration-150 hover:text-ink"
            onClick={() => {
              logout()
              navigate('/login')
            }}
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            Log out
          </button>
        </div>
      </div>
      <div className="h-px bg-bronze/40" />
    </header>
  )
}
