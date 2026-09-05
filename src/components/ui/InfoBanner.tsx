import { Info } from 'lucide-react'
import type { ReactNode } from 'react'

interface InfoBannerProps {
  tone?: 'neutral' | 'warning'
  children: ReactNode
}

export function InfoBanner({ tone = 'neutral', children }: InfoBannerProps) {
  const cls =
    tone === 'warning'
      ? 'border-warn/30 bg-warnBg text-warn'
      : 'border-borderDark bg-surfaceAlt text-inkMuted'
  return (
    <div className={`flex gap-2 rounded-md border px-3 py-2.5 text-[13px] ${cls}`}>
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  )
}
