import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

interface ToastItem {
  id: string
  message: string
  tone: 'ok' | 'warn' | 'danger' | 'neutral'
}

interface ToastContextValue {
  push: (message: string, tone?: ToastItem['tone']) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((message: string, tone: ToastItem['tone'] = 'neutral') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setItems((prev) => [...prev, { id, message, tone }])
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, 4200)
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-8 right-10 z-50 flex w-80 flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto border-l-[3px] bg-sheet px-4 py-3 text-[13px] ${
              t.tone === 'ok'
                ? 'border-ok bg-okBg text-ok'
                : t.tone === 'warn'
                  ? 'border-warn bg-warnBg text-warn'
                  : t.tone === 'danger'
                    ? 'border-danger bg-dangerBg text-danger'
                    : 'border-bronze text-ink'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
