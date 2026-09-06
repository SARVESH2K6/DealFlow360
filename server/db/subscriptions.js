import { query } from './pool.js'
import { nextId, httpError } from './helpers.js'

async function logActivityDb(text) {
  const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  await query('INSERT INTO activity (id, text, timestamp) VALUES ($1, $2, $3)', [id, text, new Date().toISOString()])
}

function toSubscription(row, oneTimeLines, recurringLines) {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    plan: row.plan,
    cycle: row.cycle,
    nextBill: row.next_bill,
    amount: Number(row.amount),
    status: row.status,
    originatingOrderId: row.originating_order_id,
    oneTimeLines: oneTimeLines.map((l) => ({ productName: l.product_name, qty: Number(l.qty), amount: Number(l.amount) })),
    recurringLines: recurringLines.map((l) => ({ plan: l.plan, cycle: l.cycle, nextBillDate: l.next_bill_date, amount: Number(l.amount) })),
  }
}

export async function listSubscriptions() {
  const { rows } = await query('SELECT * FROM subscriptions ORDER BY next_bill DESC')
  const { rows: otRows } = await query('SELECT * FROM subscription_onetime_lines')
  const { rows: rrRows } = await query('SELECT * FROM subscription_recurring_lines')
  return rows.map((s) =>
    toSubscription(s, otRows.filter((l) => l.subscription_id === s.id), rrRows.filter((l) => l.subscription_id === s.id)),
  )
}

export async function getSubscription(id) {
  const { rows } = await query('SELECT * FROM subscriptions WHERE id = $1', [id])
  if (rows.length === 0) return null
  const { rows: otRows } = await query('SELECT * FROM subscription_onetime_lines WHERE subscription_id = $1', [id])
  const { rows: rrRows } = await query('SELECT * FROM subscription_recurring_lines WHERE subscription_id = $1', [id])
  return toSubscription(rows[0], otRows, rrRows)
}

export async function createSubscription(body) {
  const { rows: cRows } = await query('SELECT * FROM customers WHERE id = $1', [body.customerId])
  const customer = cRows[0] || { id: body.customerId, name: 'Unknown' }
  const id = nextId('s')
  await query(
    `INSERT INTO subscriptions (id, customer_id, customer_name, plan, cycle, next_bill, amount, status, originating_order_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)`,
    [id, customer.id, customer.name, body.plan || 'Custom Plan', body.cycle || 'annual', body.nextBill || '2026-10-01', Number(body.amount) || 0, body.originatingOrderId || null],
  )
  await query(
    'INSERT INTO subscription_recurring_lines (subscription_id, plan, cycle, next_bill_date, amount) VALUES ($1, $2, $3, $4, $5)',
    [id, body.plan || 'Custom Plan', body.cycle || 'annual', body.nextBill || '2026-10-01', Number(body.amount) || 0],
  )
  return getSubscription(id)
}

export async function createSubscriptionFromQuote(quotationId) {
  const { rows: existing } = await query('SELECT id FROM subscriptions WHERE originating_order_id = $1', [quotationId])
  if (existing.length > 0) return getSubscription(existing[0].id)

  const { rows: qRows } = await query('SELECT * FROM quotations WHERE id = $1', [quotationId])
  if (qRows.length === 0) return null
  const q = qRows[0]
  const { rows: lineRows } = await query(
    `SELECT l.*, p.is_subscription, p.cycle AS product_cycle, p.name AS product_name
     FROM quotation_lines l
     LEFT JOIN products p ON p.id = l.product_id
     WHERE l.quotation_id = $1`,
    [quotationId],
  )
  const recurring = lineRows.filter((l) => l.is_subscription)
  const oneTime = lineRows.filter((l) => !l.is_subscription)
  if (recurring.length === 0) return null

  const primary = recurring[0]
  const amount = recurring.reduce(
    (sum, l) => sum + Number(l.qty) * Number(l.price) * (1 - Number(l.discount_percent || 0) / 100),
    0,
  )
  const nextBill = new Date()
  nextBill.setMonth(nextBill.getMonth() + 1)
  const id = nextId('s')
  await query(
    `INSERT INTO subscriptions (id, customer_id, customer_name, plan, cycle, next_bill, amount, status, originating_order_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)`,
    [id, q.customer_id, q.customer_name, primary.product_name, primary.product_cycle || 'annual', nextBill.toISOString().slice(0, 10), amount, quotationId],
  )
  for (const l of recurring) {
    const lineAmt = Number(l.qty) * Number(l.price) * (1 - Number(l.discount_percent || 0) / 100)
    await query(
      'INSERT INTO subscription_recurring_lines (subscription_id, plan, cycle, next_bill_date, amount) VALUES ($1, $2, $3, $4, $5)',
      [id, l.product_name, l.product_cycle || 'annual', nextBill.toISOString().slice(0, 10), lineAmt],
    )
  }
  for (const l of oneTime) {
    const lineAmt = Number(l.qty) * Number(l.price) * (1 - Number(l.discount_percent || 0) / 100)
    await query(
      'INSERT INTO subscription_onetime_lines (subscription_id, product_name, qty, amount) VALUES ($1, $2, $3, $4)',
      [id, l.product_name, Number(l.qty), lineAmt],
    )
  }
  return getSubscription(id)
}

export async function cancelSubscription(id, userName) {
  const sub = await getSubscription(id)
  if (!sub) return null
  if (sub.status === 'cancelled') throw httpError(409, 'Subscription is already cancelled')
  await query("UPDATE subscriptions SET status = 'cancelled' WHERE id = $1", [id])
  await logActivityDb(`${sub.plan} for ${sub.customerName} cancelled by ${userName}`)
  return getSubscription(id)
}

export async function modifySubscription(id, body, userName) {
  const sub = await getSubscription(id)
  if (!sub) return null
  if (sub.status === 'cancelled') throw httpError(409, 'Cancelled subscriptions cannot be modified')
  if (body.amount !== undefined) {
    const n = Number(body.amount)
    if (!Number.isFinite(n) || n < 0) throw httpError(400, 'Amount cannot be negative')
  }
  if (body.cycle) await query('UPDATE subscriptions SET cycle = $1 WHERE id = $2', [body.cycle, id])
  if (body.amount !== undefined) await query('UPDATE subscriptions SET amount = $1 WHERE id = $2', [Number(body.amount), id])
  if (body.status && body.status !== 'cancelled') {
    await query('UPDATE subscriptions SET status = $1 WHERE id = $2', [body.status, id])
  }
  await query(
    'UPDATE subscription_recurring_lines SET cycle = $1, amount = $2 WHERE subscription_id = $3',
    [body.cycle || sub.cycle, body.amount !== undefined ? Number(body.amount) : sub.amount, id],
  )
  await logActivityDb(`${sub.plan} for ${sub.customerName} modified by ${userName}`)
  return getSubscription(id)
}
