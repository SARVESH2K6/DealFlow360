import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'commit' | 'primary' | 'secondary' | 'danger' | 'ghost'

const variants: Record<Variant, string> = {
  commit: 'bg-commit text-sheet hover:bg-commitHover',
  primary: 'bg-commit text-sheet hover:bg-commitHover',
  secondary: 'border border-bronze/50 bg-sheet text-ink hover:bg-surfaceAlt',
  danger: 'border border-danger/50 bg-dangerBg text-danger hover:bg-danger/10',
  ghost: 'text-inkMuted hover:text-ink',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  children: ReactNode
}

export function Button({
  variant = 'secondary',
  loading = false,
  className = '',
  disabled,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex h-8 items-center justify-center gap-1.5 px-3.5 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} aria-hidden /> : null}
      {children}
    </button>
  )
}
