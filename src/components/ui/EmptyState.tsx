import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'

interface EmptyStateProps {
  message: string
  action?: { label: string; onClick: () => void }
  children?: ReactNode
}

export function EmptyState({ message, action, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-border bg-surface px-6 py-16 text-center">
      <Inbox className="h-5 w-5 text-inkFaint" />
      <p className="mt-3 text-[14px] text-inkMuted">{message}</p>
      {action ? (
        <Button className="mt-4" variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
      {children}
    </div>
  )
}
