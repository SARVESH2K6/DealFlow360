import type { ReactNode } from 'react'

interface InfoBannerProps {
  tone?: 'neutral' | 'warning'
  children: ReactNode
}

export function InfoBanner({ tone = 'neutral', children }: InfoBannerProps) {
  return (
    <p
      className={`border-l-[3px] py-1.5 pl-3 text-[13px] leading-snug ${
        tone === 'warning' ? 'border-warn bg-warnBg/40 py-2 text-warn' : 'border-bronze text-inkMuted'
      }`}
    >
      {children}
    </p>
  )
}
