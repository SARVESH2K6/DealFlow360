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
    quotationId: row.quotation_id || null,
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

// ── Auto-create invoice from a confirmed quotation ───────────────────

export async function createInvoiceFromQuotation(quotationId) {
  // Check if an invoice already exists for this quotation
  const { rows: existing } = await query('SELECT id FROM invoices WHERE quotation_id = $1', [quotationId])
  if (existing.length > 0) return getInvoice(existing[0].id)

  // Fetch quotation data
  const { rows: qRows } = await query('SELECT * FROM quotations WHERE id = $1', [quotationId])
  if (qRows.length === 0) return null
  const q = qRows[0]

  // Fetch quotation lines
  const { rows: lineRows } = await query('SELECT * FROM quotation_lines WHERE quotation_id = $1', [quotationId])

  // Build items JSON from quotation lines
  const items = lineRows.map((l) => ({
    description: l.product_name,
    qty: Number(l.qty),
    unitPrice: Number(l.price),
    amount: Number(l.qty) * Number(l.price) * (1 - (Number(l.discount_percent) || 0) / 100),
  }))

  // Compute total (including delivery cost if any)
  const lineTotal = items.reduce((sum, i) => sum + i.amount, 0)
  const deliveryCost = Number(q.estimated_delivery_cost) || 0
  const totalAmount = lineTotal + deliveryCost
  if (deliveryCost > 0) {
    items.push({ description: 'Shipping & Delivery', qty: 1, unitPrice: deliveryCost, amount: deliveryCost })
  }

  // Generate invoice ID & number
  const { rows: countRows } = await query('SELECT COUNT(*)::int AS cnt FROM invoices')
  const seq = 2200 + (countRows[0]?.cnt || 0)
  const invoiceId = `inv-${seq}`
  const invoiceNumber = `INV-${seq}`

  // Compute due date from terms
  const termsDays = parseInt(q.terms?.replace(/\D/g, '') || '30', 10)
  const issuedDate = new Date().toISOString().slice(0, 10)
  const dueDate = new Date(Date.now() + termsDays * 86400000).toISOString().slice(0, 10)

  await query(
    `INSERT INTO invoices (id, number, customer_id, customer_name, amount, status, issued_date, due_date, terms, region, step, note, items, quotation_id)
     VALUES ($1, $2, $3, $4, $5, 'unpaid', $6, $7, $8, $9, 'invoiced', '', $10::jsonb, $11)`,
    [invoiceId, invoiceNumber, q.customer_id, q.customer_name, totalAmount, issuedDate, dueDate, q.terms || 'Net 30', q.region || 'North America', JSON.stringify(items), quotationId],
  )

  // Create a single invoice line
  await query(
    `INSERT INTO invoice_lines (invoice_id, number, amount, status, due_date)
     VALUES ($1, $2, $3, 'unpaid', $4)`,
    [invoiceId, invoiceNumber, totalAmount, dueDate],
  )

  await logActivityDb(`Invoice ${invoiceNumber} created (unpaid) for quotation ${q.number}`)
  return getInvoice(invoiceId)
}
