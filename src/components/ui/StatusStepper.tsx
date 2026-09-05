interface StatusStepperProps {
  steps: string[]
  currentStep: number
}

export function StatusStepper({ steps, currentStep }: StatusStepperProps) {
  return (
    <ol className="flex items-center gap-0">
      {steps.map((step, i) => {
        const done = i < currentStep
        const current = i === currentStep
        return (
          <li key={step} className="flex flex-1 items-center">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  done || current
                    ? 'border-ink bg-ink'
                    : 'border-borderDark bg-surface'
                }`}
              >
                {done || current ? <span className="h-1.5 w-1.5 rounded-full bg-paper" /> : null}
              </span>
              <span className={`text-[13px] ${current ? 'font-medium text-ink' : 'text-inkMuted'}`}>
                {step}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <span className={`mx-3 h-px flex-1 ${i < currentStep ? 'bg-ink' : 'bg-borderDark'}`} />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
