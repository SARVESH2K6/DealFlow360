interface StatCardProps {
  label: string
  value: string | number
  sublabel?: string
  onClick?: () => void
  active?: boolean
  tone?: 'default' | 'ok' | 'warn' | 'danger'
}

export function StatCard({ label, value, sublabel, onClick, active, tone = 'default' }: StatCardProps) {
  const toneBorder =
    tone === 'ok'
      ? 'border-ok/30'
      : tone === 'warn'
        ? 'border-warn/30'
        : tone === 'danger'
          ? 'border-danger/30'
          : 'border-border'
  const className = `rounded-md border bg-surface p-4 text-left ${toneBorder} ${onClick ? 'cursor-pointer hover:bg-surfaceAlt' : ''} ${active ? 'bg-surfaceAlt' : ''}`
  const body = (
    <>
      <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-inkMuted">{label}</div>
      <div className="mt-1 text-[20px] font-medium text-ink">{value}</div>
      {sublabel ? <div className="mt-1 text-[13px] text-inkMuted">{sublabel}</div> : null}
    </>
  )
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    )
  }
  return <div className={className}>{body}</div>
}
