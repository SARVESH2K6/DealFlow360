import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { api, clearSession, setSession } from './api'
import type { AuthResponse, Role, User } from './types'

interface AuthContextValue {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<User>
  signup: (email: string, password: string, name: string) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredUser(): User | null {
  const raw = localStorage.getItem('df360_user')
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readStoredUser())
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('df360_token'))

  const applyAuth = useCallback((auth: AuthResponse) => {
    setSession(auth)
    setUser(auth.user)
    setToken(auth.token)
    return auth.user
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const auth = await api<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      return applyAuth(auth)
    },
    [applyAuth],
  )

  const signup = useCallback(
    async (email: string, password: string, name: string) => {
      const auth = await api<AuthResponse>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      })
      return applyAuth(auth)
    },
    [applyAuth],
  )

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
    setToken(null)
  }, [])

  const value = useMemo(
    () => ({ user, token, login, signup, logout }),
    [user, token, login, signup, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

const INTERNAL: Role[] = ['rep', 'manager', 'finance', 'admin']

export function isInternal(role: Role | undefined): boolean {
  return Boolean(role && INTERNAL.includes(role))
}

export function canSeeApprovals(role: Role | undefined): boolean {
  return role === 'manager' || role === 'finance' || role === 'admin'
}

export function canSeeDealHealth(role: Role | undefined): boolean {
  return role === 'manager' || role === 'finance' || role === 'admin'
}

export function canSeeReports(role: Role | undefined): boolean {
  return role === 'admin'
}

export function canSeeProducts(role: Role | undefined): boolean {
  return role === 'admin'
}

export function canSeeDiscountConfig(role: Role | undefined): boolean {
  return role === 'admin' || role === 'finance'
}

export function canEditDiscountConfig(role: Role | undefined): boolean {
  return role === 'admin'
}

export function canActOnApprovals(role: Role | undefined): boolean {
  return role === 'manager' || role === 'finance' || role === 'admin'
}

export function canSplitFulfillment(role: Role | undefined): boolean {
  return role === 'finance' || role === 'admin'
}

export function canSetInvoiceStatus(role: Role | undefined): boolean {
  return role === 'rep' || role === 'manager' || role === 'admin'
}
