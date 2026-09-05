import type { ReactNode } from 'react'
import { Button } from './Button'

interface EmptyStateProps {
  title?: string
  message: string
  action?: { label: string; onClick: () => void }
  children?: ReactNode
}

export function EmptyState({ title = 'No entries', message, action, children }: EmptyStateProps) {
  return (
    <div className="py-8">
      <div className="h-px w-10 bg-bronze" />
      <h2 className="mt-4 font-serif text-[22px] leading-tight text-ink">{title}</h2>
      <p className="mt-2 max-w-md text-[13px] leading-relaxed text-inkMuted">{message}</p>
      {action ? (
        <Button className="mt-4" variant="commit" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
      {children}
    </div>
  )
}
