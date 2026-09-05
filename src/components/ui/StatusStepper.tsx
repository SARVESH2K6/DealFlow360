interface StatusStepperProps {
  steps: string[]
  currentStep: number
}

export function StatusStepper({ steps, currentStep }: StatusStepperProps) {
  return (
    <ol className="flex items-end gap-0">
      {steps.map((step, i) => {
        const current = i === currentStep
        const done = i < currentStep
        return (
          <li key={step} className="flex flex-1 flex-col gap-2">
            <span className={`text-[10px] font-medium uppercase tracking-[0.14em] ${current ? 'text-ink' : 'text-inkFaint'}`}>
              {step}
            </span>
            <span className={`h-[2px] w-full ${done || current ? 'bg-bronze' : 'bg-ink/10'}`} />
          </li>
        )
      })}
    </ol>
  )
}
