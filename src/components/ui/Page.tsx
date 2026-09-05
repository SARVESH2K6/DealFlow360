import type { ReactNode } from 'react'

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`ledger-shimmer ${className}`} />
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-6 pt-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="ledger-shimmer" />
      ))}
    </div>
  )
}

export function StatRowSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-surfaceAlt/50 px-5 py-8">
        <div className="ledger-shimmer" />
      </div>
      <div className="bg-surfaceAlt/50 px-5 py-8">
        <div className="ledger-shimmer" />
      </div>
      <div className="bg-surfaceAlt/50 px-5 py-8">
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
    <div className="flex items-end justify-between gap-6">
      <div>
        {kicker ? (
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-bronze">{kicker}</p>
        ) : null}
        <h1 className="font-serif text-[36px] leading-[1.15] tracking-tight text-ink">{title}</h1>
      </div>
      {actions ? <div className="mb-1 flex items-center gap-3">{actions}</div> : null}
    </div>
  )
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="space-y-10">{children}</div>
}

export function LedgerRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-8 border-b border-ink/[0.08] py-3.5">
      <span className="text-[13px] text-inkMuted">{label}</span>
      <div className="text-right font-serif text-[18px] tabular-nums text-ink">{children}</div>
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return <p className="border-l-[3px] border-danger bg-dangerBg/50 px-4 py-2 text-[13px] text-danger">{message}</p>
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
      <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.14em] text-inkMuted">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'h-10 w-full rounded-none border-0 border-b border-bronze/40 bg-transparent px-0 text-[14px] text-ink placeholder:text-inkFaint focus:border-ink focus:outline-none'

export function inputCls(extra = ''): string {
  return `${inputClass} ${extra}`
}
