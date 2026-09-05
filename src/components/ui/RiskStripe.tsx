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
    <div className={`flex items-baseline justify-between px-6 py-4 transition-colors duration-[360ms] ease-out ${tone}`}>
      <span className="text-[10px] font-medium uppercase tracking-[0.18em]">Risk standing</span>
      <div className="flex items-baseline gap-4">
        <CountFigure value={score} className="text-[32px] leading-none" />
        <span className="text-[10px] font-medium uppercase tracking-[0.18em]">{level}</span>
      </div>
    </div>
  )
}
