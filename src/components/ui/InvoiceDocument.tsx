import { formatDate, moneyExact, roleLabel } from '../../lib/format'
import type { Invoice } from '../../lib/types'

export function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  const items = invoice.items ?? []
  const paid = invoice.status === 'paid'
  const approvers = invoice.approvedBy ?? []

  return (
    <article>
      <div className="flex items-end justify-between gap-6 border-b border-ink/[0.08] pb-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-inkMuted">Bill to</p>
          <h2 className="mt-0.5 font-serif text-[22px] leading-tight text-ink">{invoice.customerName}</h2>
          <p className="mt-0.5 text-[12px] text-inkMuted">
            {invoice.region} · {invoice.terms}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-[10px] font-medium uppercase tracking-[0.16em] ${paid ? 'text-ok' : 'text-danger'}`}>
            {paid ? 'Paid in full' : 'Balance due'}
          </p>
          <p className="mt-0.5 font-serif text-[26px] leading-none tabular-nums tracking-tight text-ink">
            {moneyExact(invoice.amount)}
          </p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 sm:grid-cols-4">
        <Meta label="Issued" value={formatDate(invoice.issuedDate)} />
        <Meta label="Due" value={formatDate(invoice.dueDate)} />
        <Meta label="Terms" value={invoice.terms} />
        <Meta label="Status" value={paid ? 'Paid' : 'Unpaid'} tone={paid ? 'ok' : 'danger'} />
      </dl>

      <div className="mt-5">
        <h3 className="mb-1 font-serif text-[18px] text-ink">Charges</h3>
        <div className="rule-gold mb-1" />
        <div className="flex justify-between pb-1.5 pt-2 text-[10px] font-medium uppercase tracking-[0.12em] text-inkMuted">
          <span>Description</span>
          <span className="flex w-56 justify-between">
            <span>Qty</span>
            <span>Rate</span>
            <span>Amount</span>
          </span>
        </div>
        {items.map((item) => (
          <div
            key={item.description}
            className="flex items-baseline justify-between gap-6 border-b border-ink/[0.08] py-1.5"
          >
            <span className="text-[13px] text-ink">{item.description}</span>
            <span className="flex w-56 justify-between font-serif text-[15px] tabular-nums text-ink">
              <span>{item.qty}</span>
              <span>{moneyExact(item.unitPrice)}</span>
              <span>{moneyExact(item.amount)}</span>
            </span>
          </div>
        ))}
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-[12px] text-inkMuted">Amount due</span>
          <span className="font-serif text-[22px] tabular-nums tracking-tight text-ink">
            {moneyExact(invoice.amount)}
          </span>
        </div>
      </div>

      {invoice.note ? (
        <p className="mt-4 border-l-[3px] border-bronze px-3 py-1.5 text-[13px] leading-relaxed text-inkMuted">
          {invoice.note}
        </p>
      ) : null}

      <section className="mt-5">
        <h3 className="mb-1 font-serif text-[18px] text-ink">Approved by</h3>
        {approvers.length === 0 ? (
          <p className="text-[13px] text-inkMuted">No countersignature is on file for this statement.</p>
        ) : (
          <div className={`grid gap-6 ${approvers.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {approvers.map((person) => (
              <div key={`${person.name}-${person.role}`} className="border-t border-ink/20 pt-2">
                <p className="font-serif text-[16px] leading-tight text-ink">{person.name}</p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-bronze">
                  {person.roleLabel || roleLabel(person.role)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {paid && invoice.paymentRecordedBy ? (
        <section className="mt-4">
          <h3 className="mb-1 font-serif text-[18px] text-ink">Payment recorded by</h3>
          <div className="border-t border-ink/20 pt-2">
            <p className="font-serif text-[16px] leading-tight text-ink">{invoice.paymentRecordedBy.name}</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-bronze">
              {invoice.paymentRecordedBy.roleLabel || roleLabel(invoice.paymentRecordedBy.role)}
            </p>
          </div>
        </section>
      ) : null}
    </article>
  )
}

function Meta({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'ok' | 'danger'
}) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-inkMuted">{label}</dt>
      <dd
        className={`mt-0.5 font-serif text-[15px] tabular-nums ${
          tone === 'ok' ? 'text-ok' : tone === 'danger' ? 'text-danger' : 'text-ink'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}
