import { query } from './pool.js'
import { nextId } from './helpers.js'

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

export async function cancelSubscription(id, userName) {
  const sub = await getSubscription(id)
  if (!sub) return null
  await query("UPDATE subscriptions SET status = 'cancelled' WHERE id = $1", [id])
  await logActivityDb(`${sub.plan} for ${sub.customerName} cancelled by ${userName}`)
  return getSubscription(id)
}

export async function modifySubscription(id, body, userName) {
  const sub = await getSubscription(id)
  if (!sub) return null
  if (body.cycle) await query('UPDATE subscriptions SET cycle = $1 WHERE id = $2', [body.cycle, id])
  if (body.amount !== undefined) await query('UPDATE subscriptions SET amount = $1 WHERE id = $2', [Number(body.amount), id])
  if (body.status) await query('UPDATE subscriptions SET status = $1 WHERE id = $2', [body.status, id])
  // Update recurring line too
  await query(
    'UPDATE subscription_recurring_lines SET cycle = $1, amount = $2 WHERE subscription_id = $3',
    [body.cycle || sub.cycle, body.amount !== undefined ? Number(body.amount) : sub.amount, id],
  )
  await logActivityDb(`${sub.plan} for ${sub.customerName} modified by ${userName}`)
  return getSubscription(id)
}
