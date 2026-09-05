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
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-[420px] bg-sheet px-10 py-12 shadow-sheet">
        <div className="rule-double" />
        <p className="mt-6 font-serif text-[22px] text-commit">DealFlow360</p>
        <h1 className="mt-5 font-serif text-[34px] leading-tight text-ink">
          {mode === 'login' ? 'Sign in' : 'Open an account'}
        </h1>
        <p className="mt-2 text-[14px] text-inkMuted">Private operations ledger. Restricted access.</p>

        <div className="mt-8 flex gap-8 border-b border-bronze/40">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`pb-2 text-[12px] uppercase tracking-[0.14em] ${mode === 'login' ? 'border-b-2 border-ink text-ink' : 'text-inkMuted'}`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`pb-2 text-[12px] uppercase tracking-[0.14em] ${mode === 'signup' ? 'border-b-2 border-ink text-ink' : 'text-inkMuted'}`}
          >
            Sign Up
          </button>
        </div>

        <form className="mt-8 space-y-5" onSubmit={onSubmit}>
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
          <Button type="submit" variant="commit" className="w-full" loading={loading}>
            {mode === 'login' ? 'Log In' : 'Create account'}
          </Button>
        </form>

        {mode === 'login' ? (
          <button
            type="button"
            className="mt-5 text-[13px] text-inkMuted hover:text-ink"
            onClick={() => setError('Contact your administrator to reset a password.')}
          >
            Forgot Password?
          </button>
        ) : (
          <p className="mt-5 text-[13px] text-inkMuted">
            Sign-up creates a customer portal account only. Internal roles are seeded by an administrator.
          </p>
        )}

        <div className="mt-10">
          <InfoBanner>
            After login, internal users land on the ledger. Customers land on their quotation portal.
          </InfoBanner>
        </div>
        <p className="mt-6 text-[10px] font-medium uppercase tracking-[0.12em] text-inkFaint">
          Demo: ivan.p@example.net · olivia.t@example.org · marco.r@example.org / password
        </p>
      </div>
    </div>
  )
}
