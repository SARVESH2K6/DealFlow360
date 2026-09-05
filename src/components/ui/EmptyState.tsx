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
    <div className="py-16">
      <div className="h-px w-12 bg-bronze" />
      <h2 className="mt-6 font-serif text-[30px] leading-tight text-ink">{title}</h2>
      <p className="mt-3 max-w-md text-[14px] leading-relaxed text-inkMuted">{message}</p>
      {action ? (
        <Button className="mt-8" variant="commit" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
      {children}
    </div>
  )
}
