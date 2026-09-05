import { query } from './pool.js'

async function logActivityDb(text) {
  const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  await query('INSERT INTO activity (id, text, timestamp) VALUES ($1, $2, $3)', [id, text, new Date().toISOString()])
}

function toInvoice(row, lines) {
  return {
    id: row.id,
    number: row.number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    amount: Number(row.amount),
    status: row.status,
    issuedDate: row.issued_date,
    dueDate: row.due_date,
    terms: row.terms || 'Net 30',
    region: row.region || 'North America',
    step: row.step,
    note: row.note || '',
    items: row.items || [],
    lines: lines.map((l) => ({
      number: l.number,
      amount: Number(l.amount),
      status: l.status,
      dueDate: l.due_date,
    })),
    approvedBy: row.approved_by || [],
    paymentRecordedBy: row.payment_recorded_by || null,
  }
}

export async function listInvoices() {
  const { rows } = await query('SELECT * FROM invoices ORDER BY due_date DESC')
  const { rows: lineRows } = await query('SELECT * FROM invoice_lines')
  return rows.map((inv) =>
    toInvoice(inv, lineRows.filter((l) => l.invoice_id === inv.id)),
  )
}

export async function getInvoice(id) {
  const { rows } = await query('SELECT * FROM invoices WHERE id = $1', [id])
  if (rows.length === 0) return null
  const { rows: lineRows } = await query('SELECT * FROM invoice_lines WHERE invoice_id = $1', [id])
  return toInvoice(rows[0], lineRows)
}

const ROLE_LABELS = { rep: 'Sales Rep', manager: 'Sales Manager', finance: 'Finance', admin: 'Administrator' }

export async function recordPayment(id, user) {
  const paymentBy = { name: user.name, role: user.role, roleLabel: ROLE_LABELS[user.role] || user.role }
  await query("UPDATE invoices SET status = 'paid', step = 'paid', payment_recorded_by = $1 WHERE id = $2", [JSON.stringify(paymentBy), id])
  await query("UPDATE invoice_lines SET status = 'paid' WHERE invoice_id = $1", [id])
  const { rows } = await query('SELECT number FROM invoices WHERE id = $1', [id])
  await logActivityDb(`Invoice ${rows[0]?.number} payment recorded by ${user.name}`)
  return getInvoice(id)
}

export async function setInvoiceStatus(id, status, user) {
  const paid = status === 'paid'
  if (paid) {
    const paymentBy = { name: user.name, role: user.role, roleLabel: ROLE_LABELS[user.role] || user.role }
    await query('UPDATE invoices SET status = $1, step = $2, payment_recorded_by = $3 WHERE id = $4', [status, 'paid', JSON.stringify(paymentBy), id])
  } else {
    await query('UPDATE invoices SET status = $1, step = $2, payment_recorded_by = NULL WHERE id = $3', [status, 'invoiced', id])
  }
  await query('UPDATE invoice_lines SET status = $1 WHERE invoice_id = $2', [status, id])

  const { rows } = await query('SELECT number FROM invoices WHERE id = $1', [id])
  await logActivityDb(`Invoice ${rows[0]?.number} marked ${status} by ${user.name}`)
  return getInvoice(id)
}
