import { Loader } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-paper hover:bg-accentSoft disabled:bg-inkFaint',
  secondary: 'border border-borderDark bg-surface text-ink hover:bg-surfaceAlt',
  danger: 'border border-danger/30 bg-dangerBg text-danger hover:bg-dangerBg/80',
  ghost: 'text-inkMuted hover:text-ink hover:bg-surfaceAlt',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
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
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-3.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...rest}
    >
      {loading ? <Loader className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  )
}
