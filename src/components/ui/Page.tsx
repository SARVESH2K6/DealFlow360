import type { ReactNode } from 'react'

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surfaceAlt ${className}`} />
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <div className="h-9 bg-surfaceAlt" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex h-11 items-center gap-4 border-b border-border px-3 last:border-0">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  )
}

export function StatRowSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
  )
}

interface PageHeaderProps {
  title: string
  actions?: ReactNode
}

export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <h1 className="text-[20px] font-medium text-ink">{title}</h1>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="space-y-6 px-8 py-8">{children}</div>
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-danger/30 bg-dangerBg px-4 py-3 text-[13px] text-danger">
      {message}
    </div>
  )
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
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.04em] text-inkMuted">
        {label}
      </span>
      {children}
    </label>
  )
}

const inputClass =
  'h-9 w-full rounded-md border border-border bg-surface px-3 text-[14px] text-ink placeholder:text-inkFaint'

export function inputCls(extra = ''): string {
  return `${inputClass} ${extra}`
}
