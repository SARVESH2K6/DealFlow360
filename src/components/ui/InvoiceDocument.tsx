import { formatDate, moneyExact, roleLabel } from '../../lib/format'
import type { Invoice } from '../../lib/types'

export function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  const items = invoice.items ?? []
  const paid = invoice.status === 'paid'
  const approvers = invoice.approvedBy ?? []

  return (
    <article className="bg-sheet px-10 py-10 shadow-sheet">
      <div className="rule-double" />
      <div className="mt-6 flex items-start justify-between gap-8">
        <div>
          <p className="font-serif text-[22px] text-commit">DealFlow360</p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-bronze">
            Private operations ledger
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-bronze">Statement</p>
          <p className="mt-1 font-serif text-[28px] leading-none text-ink">{invoice.number}</p>
        </div>
      </div>

      <div className="mt-8 flex items-end justify-between gap-8 border-b border-ink/[0.08] pb-6">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-inkMuted">Bill to</p>
          <h2 className="mt-2 font-serif text-[28px] leading-tight text-ink">{invoice.customerName}</h2>
          <p className="mt-1 text-[13px] text-inkMuted">
            {invoice.region} · {invoice.terms}
          </p>
        </div>
        <div className="text-right">
          <p
            className={`text-[10px] font-medium uppercase tracking-[0.18em] ${paid ? 'text-ok' : 'text-danger'}`}
          >
            {paid ? 'Paid in full' : 'Balance due'}
          </p>
          <p className="mt-2 font-serif text-[36px] leading-none tabular-nums tracking-tight text-ink">
            {moneyExact(invoice.amount)}
          </p>
        </div>
      </div>

      <dl className="mt-2">
        <Row label="Issued" value={formatDate(invoice.issuedDate)} />
        <Row label="Due" value={formatDate(invoice.dueDate)} />
        <Row label="Terms" value={invoice.terms} />
        <Row label="Status" value={paid ? 'Paid' : 'Unpaid'} tone={paid ? 'ok' : 'danger'} />
      </dl>

      <div className="mt-10">
        <h3 className="mb-2 font-serif text-[22px] text-ink">Charges</h3>
        <div className="rule-gold mb-1" />
        <div className="flex justify-between pb-2 pt-3 text-[10px] font-medium uppercase tracking-[0.14em] text-inkMuted">
          <span>Description</span>
          <span className="flex w-64 justify-between">
            <span>Qty</span>
            <span>Rate</span>
            <span>Amount</span>
          </span>
        </div>
        {items.map((item) => (
          <div
            key={item.description}
            className="flex items-baseline justify-between gap-6 border-b border-ink/[0.08] py-3.5"
          >
            <span className="text-[14px] text-ink">{item.description}</span>
            <span className="flex w-64 justify-between font-serif text-[18px] tabular-nums text-ink">
              <span>{item.qty}</span>
              <span>{moneyExact(item.unitPrice)}</span>
              <span>{moneyExact(item.amount)}</span>
            </span>
          </div>
        ))}
        <div className="mt-6 flex items-baseline justify-between">
          <span className="text-[13px] text-inkMuted">Amount due</span>
          <span className="font-serif text-[28px] tabular-nums tracking-tight text-ink">
            {moneyExact(invoice.amount)}
          </span>
        </div>
      </div>

      {invoice.note ? (
        <p className="mt-10 border-l-[3px] border-bronze bg-surfaceAlt/50 px-4 py-3 text-[13px] leading-relaxed text-inkMuted">
          {invoice.note}
        </p>
      ) : null}

      <section className="mt-12">
        <h3 className="mb-2 font-serif text-[22px] text-ink">Approved by</h3>
        <div className="rule-gold mb-6" />
        {approvers.length === 0 ? (
          <p className="text-[13px] text-inkMuted">No countersignature is on file for this statement.</p>
        ) : (
          <div className={`grid gap-10 ${approvers.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {approvers.map((person) => (
              <div key={`${person.name}-${person.role}`} className="border-t border-ink/20 pt-4">
                <p className="font-serif text-[22px] leading-tight text-ink">{person.name}</p>
                <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-bronze">
                  {person.roleLabel || roleLabel(person.role)}
                </p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-5 text-[11px] text-inkFaint">
          This is who signed the deal. Marking an invoice paid does not change this.
        </p>
      </section>

      {paid && invoice.paymentRecordedBy ? (
        <section className="mt-8">
          <h3 className="mb-2 font-serif text-[22px] text-ink">Payment recorded by</h3>
          <div className="rule-gold mb-6" />
          <div className="border-t border-ink/20 pt-4">
            <p className="font-serif text-[22px] leading-tight text-ink">{invoice.paymentRecordedBy.name}</p>
            <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-bronze">
              {invoice.paymentRecordedBy.roleLabel || roleLabel(invoice.paymentRecordedBy.role)}
            </p>
          </div>
          <p className="mt-5 text-[11px] text-inkFaint">
            This is who logged that money was received — not who approved the quotation.
          </p>
        </section>
      ) : null}

      <p className="mt-10 text-[10px] font-medium uppercase tracking-[0.14em] text-inkFaint">
        DealFlow360 · confidential · not for circulation
      </p>
    </article>
  )
}

function Row({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'ok' | 'danger'
}) {
  return (
    <div className="flex items-baseline justify-between gap-8 border-b border-ink/[0.08] py-3.5">
      <span className="text-[13px] text-inkMuted">{label}</span>
      <span
        className={`font-serif text-[18px] tabular-nums ${
          tone === 'ok' ? 'text-ok' : tone === 'danger' ? 'text-danger' : 'text-ink'
        }`}
      >
        {value}
      </span>
    </div>
  )
}
