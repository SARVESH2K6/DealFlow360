import type { ReactNode } from 'react'

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`ledger-shimmer ${className}`} />
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3 pt-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="ledger-shimmer" />
      ))}
    </div>
  )
}

export function StatRowSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-surfaceAlt/50 px-4 py-4">
        <div className="ledger-shimmer" />
      </div>
      <div className="bg-surfaceAlt/50 px-4 py-4">
        <div className="ledger-shimmer" />
      </div>
      <div className="bg-surfaceAlt/50 px-4 py-4">
        <div className="ledger-shimmer" />
      </div>
    </div>
  )
}

interface PageHeaderProps {
  title: string
  kicker?: string
  actions?: ReactNode
}

export function PageHeader({ title, kicker, actions }: PageHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        {kicker ? (
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-bronze">{kicker}</p>
        ) : null}
        <h1 className="font-serif text-[26px] leading-tight tracking-tight text-ink">{title}</h1>
      </div>
      {actions ? <div className="mb-0.5 flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="space-y-5">{children}</div>
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex items-end justify-between gap-4">
      <h2 className="font-serif text-[18px] text-ink">{children}</h2>
      {aside}
    </div>
  )
}

export function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-inkMuted">{label}</p>
      <div className="mt-0.5 font-serif text-[15px] leading-snug text-ink">{children}</div>
    </div>
  )
}

export function LedgerRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-ink/[0.08] py-1.5">
      <span className="text-[12px] text-inkMuted">{label}</span>
      <div className="text-right font-serif text-[15px] tabular-nums text-ink">{children}</div>
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return <p className="border-l-[3px] border-danger bg-dangerBg/50 px-3 py-1.5 text-[13px] text-danger">{message}</p>
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-inkMuted">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'h-8 w-full rounded-none border-0 border-b border-bronze/40 bg-transparent px-0 text-[13px] text-ink placeholder:text-inkFaint focus:border-ink focus:outline-none'

export function inputCls(extra = ''): string {
  return `${inputClass} ${extra}`
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Search',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative">
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-bronze"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      >
        <circle cx="6.5" cy="6.5" r="4.25" />
        <path d="M9.6 9.6 14 14" />
      </svg>
      <input
        className="h-10 w-full rounded-none border-0 border-b border-bronze/40 bg-transparent py-0 pl-7 pr-0 text-[14px] text-ink placeholder:text-inkFaint focus:border-ink focus:outline-none"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
      />
    </div>
  )
}
