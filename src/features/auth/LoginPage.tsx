import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
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
  const [companyName, setCompanyName] = useState('')
  const [region, setRegion] = useState('')
  const [city, setCity] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) {
    return <Navigate to={isInternal(user.role) ? '/app/dashboard' : '/portal/quotes'} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setLoading(true)
    try {
      const next = mode === 'login' ? await login(email, password) : await signup(email, password, name, companyName, region, city)
      navigate(isInternal(next.role) ? '/app/dashboard' : '/portal/quotes')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center overflow-hidden px-6">
      <div className="w-full max-w-[380px] bg-sheet px-6 py-5 shadow-sheet">
        <div className="rule-double" />
        <p className="mt-3 font-serif text-[18px] text-commit">DealFlow360</p>
        <div className="relative mt-2 h-7 overflow-hidden">
          <h1
            className={`absolute inset-0 font-serif text-[24px] leading-tight text-ink transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              mode === 'login' ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
            }`}
            aria-hidden={mode !== 'login'}
          >
            Sign in
          </h1>
          <h1
            className={`absolute inset-0 font-serif text-[24px] leading-tight text-ink transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              mode === 'signup' ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
            }`}
            aria-hidden={mode !== 'signup'}
          >
            Open an account
          </h1>
        </div>
        <p className="mt-1 text-[13px] text-inkMuted">Private operations ledger. Restricted access.</p>

        <div className="relative mt-4 grid grid-cols-2 border border-bronze/50">
          <span
            aria-hidden
            className={`absolute inset-y-0 w-1/2 bg-ink transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              mode === 'signup' ? 'translate-x-full' : 'translate-x-0'
            }`}
          />
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setError(null)
              setNotice(null)
            }}
            className={`relative z-10 h-8 text-[11px] uppercase tracking-[0.14em] transition-colors duration-300 ${
              mode === 'login' ? 'text-sheet' : 'text-inkMuted hover:text-ink'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup')
              setError(null)
              setNotice(null)
            }}
            className={`relative z-10 h-8 text-[11px] uppercase tracking-[0.14em] transition-colors duration-300 ${
              mode === 'signup' ? 'text-sheet' : 'text-inkMuted hover:text-ink'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form className="mt-4" onSubmit={onSubmit}>
          <div
            className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              mode === 'signup' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            }`}
          >
            <div className="overflow-hidden">
              <div
                className={`pb-3 transition-opacity duration-300 ${
                  mode === 'signup' ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <Field label="Name">
                  <input
                    className={inputCls()}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={mode === 'signup'}
                    tabIndex={mode === 'signup' ? 0 : -1}
                    autoComplete="name"
                  />
                </Field>
                <Field label="Company Name">
                  <input
                    className={inputCls()}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required={mode === 'signup'}
                    tabIndex={mode === 'signup' ? 0 : -1}
                    autoComplete="organization"
                  />
                </Field>
                <Field label="Region">
                  <select
                    className={inputCls()}
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    required={mode === 'signup'}
                    tabIndex={mode === 'signup' ? 0 : -1}
                  >
                    <option value="">Select a region</option>
                    <option value="North America">North America</option>
                    <option value="South America">South America</option>
                    <option value="EMEA">EMEA</option>
                    <option value="APAC">APAC</option>
                  </select>
                </Field>
                <Field label="City">
                  <input
                    className={inputCls()}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required={mode === 'signup'}
                    tabIndex={mode === 'signup' ? 0 : -1}
                    autoComplete="address-level2"
                  />
                </Field>
              </div>
            </div>
          </div>
          <div className="space-y-3">
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
            {notice ? <p className="text-[13px] text-inkMuted">{notice}</p> : null}
            <Button type="submit" variant="commit" className="w-full" loading={loading}>
              {mode === 'login' ? 'Log In' : 'Create account'}
            </Button>
          </div>
        </form>

        <div className="relative mt-3 min-h-[2.5rem]">
          <p
            className={`absolute inset-x-0 top-0 text-[13px] leading-snug text-inkMuted transition-all duration-300 ${
              mode === 'login' ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1 opacity-0'
            }`}
          >
            Password resets are handled by an administrator.
          </p>
          <p
            className={`absolute inset-x-0 top-0 text-[12px] leading-snug text-inkMuted transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              mode === 'signup' ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0'
            }`}
          >
            Sign-up creates a customer portal account only. Internal roles are seeded by an administrator.
          </p>
        </div>

        <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.12em] text-inkFaint">
          Demo: ivan.p@example.net · olivia.t@example.org · marco.r@example.org / password
        </p>
      </div>
    </div>
  )
}
