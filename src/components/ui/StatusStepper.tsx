interface StatusStepperProps {
  steps: string[]
  currentStep: number
}

export function StatusStepper({ steps, currentStep }: StatusStepperProps) {
  return (
    <ol className="flex items-center">
      {steps.map((step, i) => {
        const current = i === currentStep
        const done = i < currentStep
        const filled = done || current
        return (
          <li key={step} className="flex min-w-0 flex-1 items-center">
            <div className="flex min-w-0 flex-col items-start gap-1">
              <span
                className={`h-2 w-2 shrink-0 rounded-full border ${
                  filled ? 'border-bronze bg-bronze' : 'border-ink/25 bg-transparent'
                }`}
                aria-hidden
              />
              <span
                className={`text-[10px] font-medium uppercase tracking-[0.12em] ${
                  current ? 'text-ink' : 'text-inkFaint'
                }`}
              >
                {step}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <span className={`mx-2 mb-4 h-px min-w-[8px] flex-1 ${filled ? 'bg-bronze' : 'bg-ink/15'}`} />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
