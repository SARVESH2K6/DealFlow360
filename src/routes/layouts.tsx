import { Navigate, Outlet } from 'react-router-dom'
import type { ReactNode } from 'react'
import { TopNav } from '../components/ui/TopNav'
import { isInternal, useAuth } from '../lib/auth'
import type { Role } from '../lib/types'

export function InternalLayout() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!isInternal(user.role)) return <Navigate to="/portal/quotes" replace />
  return (
    <div className="min-h-screen bg-paper">
      <TopNav role="internal" />
      <Outlet />
    </div>
  )
}

export function PortalLayout() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'customer') return <Navigate to="/app/dashboard" replace />
  return (
    <div className="min-h-screen bg-paper">
      <TopNav role="portal" />
      <Outlet />
    </div>
  )
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth()
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/app/dashboard" replace />
  }
  return <>{children}</>
}
