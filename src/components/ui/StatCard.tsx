interface StatCardProps {
  label: string
  value: string | number
  sublabel?: string
  onClick?: () => void
  active?: boolean
  tone?: 'default' | 'ok' | 'warn' | 'danger'
}

export function StatCard({ label, value, sublabel, onClick, active, tone = 'default' }: StatCardProps) {
  const valueColor =
    tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : tone === 'danger' ? 'text-danger' : 'text-ink'
  const className = `bg-surfaceAlt/50 px-4 py-3 text-left ${active ? 'ring-1 ring-bronze/50' : ''} ${onClick ? 'cursor-pointer hover:bg-surfaceAlt' : ''}`
  const body = (
    <>
      <div className={`font-serif text-[24px] leading-none tracking-tight ${valueColor}`}>{value}</div>
      <div className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-inkMuted">{label}</div>
      {sublabel ? <div className="mt-0.5 font-serif text-[13px] tabular-nums text-ink/70">{sublabel}</div> : null}
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
