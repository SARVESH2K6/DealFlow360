import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { InfoBanner } from '../../components/ui/InfoBanner'
import { Field, inputCls } from '../../components/ui/Page'
import { isInternal, useAuth } from '../../lib/auth'
import { ApiError } from '../../lib/api'

export function LoginPage() {
  const { user, login, signup } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) {
    return <Navigate to={isInternal(user.role) ? '/app/dashboard' : '/portal/quotes'} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const next = mode === 'login' ? await login(email, password) : await signup(email, password, name)
      navigate(isInternal(next.role) ? '/app/dashboard' : '/portal/quotes')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-[380px] rounded-md border border-border bg-surface p-6">
        <h1 className="text-[20px] font-medium text-ink">DealFlow360</h1>
        <p className="mt-1 text-[13px] text-inkMuted">Internal sales operations</p>

        <div className="mt-5 grid grid-cols-2 rounded-md border border-border bg-surfaceAlt p-0.5">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`h-8 rounded-[5px] text-[13px] ${mode === 'login' ? 'bg-surface text-ink' : 'text-inkMuted'}`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`h-8 rounded-[5px] text-[13px] ${mode === 'signup' ? 'bg-surface text-ink' : 'text-inkMuted'}`}
          >
            Sign Up
          </button>
        </div>

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          {mode === 'signup' ? (
            <Field label="Name">
              <input className={inputCls()} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          ) : null}
          <Field label="Email">
            <input
              className={inputCls()}
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Password">
            <input
              className={inputCls()}
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          {error ? <p className="text-[13px] text-danger">{error}</p> : null}
          <Button type="submit" className="w-full" loading={loading}>
            {mode === 'login' ? 'Log In' : 'Create account'}
          </Button>
        </form>

        {mode === 'login' ? (
          <button
            type="button"
            className="mt-3 text-[13px] text-inkMuted hover:text-ink"
            onClick={() => setError('Contact your administrator to reset a password.')}
          >
            Forgot Password?
          </button>
        ) : (
          <p className="mt-3 text-[13px] text-inkMuted">
            Sign-up creates a customer portal account only. Internal roles are seeded by an administrator.
          </p>
        )}

        <div className="mt-5">
          <InfoBanner>
            After login, internal users land on the Sales Dashboard. Customers land on their Quotation Portal.
          </InfoBanner>
        </div>
        <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.04em] text-inkFaint">
          Demo: ivan.p@example.net · olivia.t@example.org · marco.r@example.org / password
        </p>
      </div>
    </div>
  )
}
