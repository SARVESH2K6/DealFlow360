import { useEffect, useRef, useState } from 'react'

export function CountFigure({ value, className = '' }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value)
  const shownRef = useRef(value)
  shownRef.current = shown

  useEffect(() => {
    const from = shownRef.current
    const to = value
    if (from === to) return
    const started = performance.now()
    const duration = 360
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / duration)
      const eased = 1 - (1 - t) ** 3
      setShown(Math.round(from + (to - from) * eased))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return <span className={`font-serif tabular-nums ${className}`}>{shown}</span>
}
