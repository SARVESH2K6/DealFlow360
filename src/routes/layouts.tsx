import { Navigate, Outlet } from 'react-router-dom'
import type { ReactNode } from 'react'
import { TopNav } from '../components/ui/TopNav'
import { isInternal, useAuth } from '../lib/auth'
import type { Role } from '../lib/types'

function Shell({ role, children }: { role: 'internal' | 'portal'; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <TopNav role={role} />
      <main className="px-6 py-8 lg:px-10">
        <article className="mx-auto max-w-[1180px] bg-sheet px-8 py-10 shadow-sheet sm:px-12">{children}</article>
      </main>
    </div>
  )
}

export function InternalLayout() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!isInternal(user.role)) return <Navigate to="/portal/quotes" replace />
  return (
    <Shell role="internal">
      <Outlet />
    </Shell>
  )
}

export function PortalLayout() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'customer') return <Navigate to="/app/dashboard" replace />
  return (
    <Shell role="portal">
      <Outlet />
    </Shell>
  )
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth()
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/app/dashboard" replace />
  }
  return <>{children}</>
}
