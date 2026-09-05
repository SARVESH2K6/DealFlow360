import { CountFigure } from './CountFigure'

const DEFAULT_TONE = 'bg-okBg text-ok'
const tones: Record<string, string> = {
  LOW: DEFAULT_TONE,
  MEDIUM: 'bg-warnBg text-warn',
  HIGH: 'bg-dangerBg text-danger',
}

interface RiskStripeProps {
  level: string
  score: number
}

export function RiskStripe({ level, score }: RiskStripeProps) {
  const tone = tones[level] ?? DEFAULT_TONE
  return (
    <div className={`flex items-baseline justify-between px-4 py-2 transition-colors duration-[360ms] ease-out ${tone}`}>
      <span className="text-[10px] font-medium uppercase tracking-[0.16em]">Risk standing</span>
      <div className="flex items-baseline gap-3">
        <CountFigure value={score} className="text-[22px] leading-none" />
        <span className="text-[10px] font-medium uppercase tracking-[0.16em]">{level}</span>
      </div>
    </div>
  )
}
