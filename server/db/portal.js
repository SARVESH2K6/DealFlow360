import { query } from './pool.js'
import { nextId, computeAndPersistRisk, httpError, parseDiscountPercent } from './helpers.js'

async function logActivityDb(text) {
  const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  await query('INSERT INTO activity (id, text, timestamp) VALUES ($1, $2, $3)', [id, text, new Date().toISOString()])
}

async function appendAuditDb(approvalId, user, action, note) {
  await query(
    'INSERT INTO approval_audit_log (approval_id, user_name, user_id, action, date, note) VALUES ($1, $2, $3, $4, $5, $6)',
    [approvalId, user.name, user.id, action, new Date().toISOString(), note],
  )
}

export async function listPortalQuotes(customerId) {
  const { rows } = await query(
    "SELECT * FROM quotations WHERE customer_id = $1 AND status <> 'draft' ORDER BY date DESC",
    [customerId],
  )
  return rows.map((q) => ({
    id: q.id, number: q.number, customerId: q.customer_id, customerName: q.customer_name,
    date: q.date, amount: Number(q.amount), repName: q.rep_name, status: q.status,
    riskLevel: q.risk_level, riskScore: Number(q.risk_score), blendedRisk: Number(q.blended_risk),
    customerTier: q.customer_tier,
  }))
}

export async function getPortalQuote(id, customerId) {
  const { rows } = await query('SELECT * FROM quotations WHERE id = $1 AND customer_id = $2', [id, customerId])
  if (rows.length === 0) return null
  const q = rows[0]
  await computeAndPersistRisk(id)

  const { rows: lineRows } = await query('SELECT * FROM quotation_lines WHERE quotation_id = $1', [id])
  const safeLines = lineRows.map((l) => ({
    id: l.id,
    productName: l.product_name,
    qty: Number(l.qty),
    price: Number(l.price),
    discountPercent: Number(l.discount_percent),
    comment: l.comment || '',
    counterDiscount: l.counter_discount != null ? Number(l.counter_discount) : Number(l.discount_percent),
    amount: Number(l.qty) * Number(l.price) * (1 - Number(l.discount_percent) / 100),
  }))

  return {
    id: q.id, number: q.number, customerName: q.customer_name, amount: Number(q.amount),
    status: q.status,
    portalStatus: q.portal_status || (q.status === 'confirmed' ? 'confirmed' : 'sent'),
    requestedDeliveryDate: q.requested_delivery_date || '',
    currency: q.currency, terms: q.terms, lines: safeLines,
    estimatedDeliveryCost: Number(q.estimated_delivery_cost) || 0,
    finalDeliveryCost: Number(q.final_delivery_cost) || 0,
  }
}

export async function negotiate(id, customerId, user, body) {
  const { rows } = await query('SELECT * FROM quotations WHERE id = $1 AND customer_id = $2', [id, customerId])
  if (rows.length === 0) return null
  const q = rows[0]
  if (q.portal_status === 'confirmed' || q.status === 'confirmed') {
    throw httpError(409, 'Confirmed quotations cannot be renegotiated')
  }
  if (q.status === 'rejected') {
    throw httpError(409, 'Rejected quotations cannot be renegotiated')
  }
  if (q.status === 'draft') {
    throw httpError(409, 'This quotation has not been sent yet')
  }

  const lines = Array.isArray(body.lines) ? body.lines : []
  for (const incoming of lines) {
    if (incoming.comment !== undefined) {
      await query('UPDATE quotation_lines SET comment = $1 WHERE id = $2 AND quotation_id = $3', [String(incoming.comment), incoming.id, id])
    }
    if (incoming.counterDiscount !== undefined) {
      const parsed = parseDiscountPercent(incoming.counterDiscount)
      if (parsed.error) throw httpError(400, parsed.error)
      await query('UPDATE quotation_lines SET counter_discount = $1, discount_percent = $1 WHERE id = $2 AND quotation_id = $3', [parsed.value, incoming.id, id])
    }
  }

  if (body.requestedDeliveryDate) {
    await query('UPDATE quotations SET requested_delivery_date = $1 WHERE id = $2', [body.requestedDeliveryDate, id])
  }

  await computeAndPersistRisk(id)

  const keepPending = q.status === 'pending_approval'
  if (!keepPending) {
    await query("UPDATE quotations SET status = 'negotiation', portal_status = 'under_negotiation' WHERE id = $1", [id])
  } else {
    await query("UPDATE quotations SET portal_status = 'under_negotiation' WHERE id = $1", [id])
  }

  const { rows: aRows } = await query('SELECT * FROM approvals WHERE quotation_id = $1', [id])
  let approval
  if (aRows.length === 0) {
    const aId = nextId('a')
    await query(
      `INSERT INTO approvals (id, quotation_id, status, stage, assigned_to, assigned_role, days_pending)
       VALUES ($1, $2, $3, $4, $5, $6, 0)`,
      [aId, id, keepPending ? 'pending' : 'returned', keepPending ? 'sales_manager' : 'negotiation', q.rep_name || 'Unassigned', keepPending ? 'manager' : 'rep'],
    )
    approval = { id: aId }
  } else {
    approval = aRows[0]
    if (!keepPending) {
      await query("UPDATE approvals SET status = 'returned', stage = 'negotiation', assigned_to = $2, assigned_role = 'rep' WHERE id = $1", [approval.id, q.rep_name || 'Unassigned'])
    }
  }

  const { rows: qUpdated } = await query('SELECT requested_delivery_date FROM quotations WHERE id = $1', [id])
  await appendAuditDb(
    approval.id, user, 'Negotiation',
    body.note || `Customer requested revised terms. Delivery ${qUpdated[0]?.requested_delivery_date || 'unchanged'}.`,
  )

  // Portal message
  const mId = nextId('m')
  await query(
    'INSERT INTO portal_messages (id, customer_id, quotation_id, from_name, body, date) VALUES ($1, $2, $3, $4, $5, $6)',
    [mId, customerId, id, user.name, body.note || 'Submitted a negotiation request from the portal.', new Date().toISOString()],
  )

  await logActivityDb(`${user.name} submitted a negotiation on ${q.number}`)
  return { ok: true, quotationId: id, approvalId: approval.id }
}

export async function confirmPortalQuote(id, customerId, user) {
  const { rows } = await query('SELECT * FROM quotations WHERE id = $1 AND customer_id = $2', [id, customerId])
  if (rows.length === 0) return null
  const q = rows[0]
  if (q.status === 'pending_approval') {
    throw httpError(409, 'This quotation is still awaiting internal approval')
  }
  if (q.portal_status === 'confirmed' || q.status === 'confirmed') {
    throw httpError(409, 'Quotation is already confirmed')
  }
  if (q.status === 'rejected') {
    throw httpError(409, 'Rejected quotations cannot be confirmed')
  }

  await query("UPDATE quotations SET status = 'confirmed', portal_status = 'confirmed' WHERE id = $1", [id])
  const { createFulfillmentFromQuote } = await import('./fulfillment.js')
  await createFulfillmentFromQuote(id)
  const { createSubscriptionFromQuote } = await import('./subscriptions.js')
  await createSubscriptionFromQuote(id)
  const { createInvoiceFromQuotation } = await import('./invoices.js')
  await createInvoiceFromQuotation(id)

  const { rows: aRows } = await query('SELECT * FROM approvals WHERE quotation_id = $1', [id])
  if (aRows.length > 0) {
    await query("UPDATE approvals SET status = 'approved', stage = 'confirmed', assigned_to = '—' WHERE id = $1", [aRows[0].id])
    await appendAuditDb(aRows[0].id, user, 'Confirmed', 'Customer confirmed quotation from portal.')
  }

  await logActivityDb(`${user.name} confirmed quotation ${q.number}`)
  return { ok: true, reenteredApproval: false }
}

export async function listPortalMessages(customerId) {
  const { rows } = await query('SELECT * FROM portal_messages WHERE customer_id = $1 ORDER BY date', [customerId])
  return rows.map((m) => ({
    id: m.id, customerId: m.customer_id, quotationId: m.quotation_id,
    from: m.from_name, body: m.body, date: m.date,
  }))
}

export async function getPortalProfile(user) {
  const { rows } = await query('SELECT * FROM customers WHERE id = $1', [user.customerId])
  return { user, customer: rows[0] || undefined }
}

export async function createPortalQuote(user, lines) {
  const { rows: custRows } = await query('SELECT * FROM customers WHERE id = $1', [user.customerId])
  if (custRows.length === 0) return null
  const c = custRows[0]

  const { rows: countRows } = await query('SELECT COUNT(*)::int AS cnt FROM quotations')
  const seq = 1049 + (countRows[0]?.cnt || 0)

  const id = nextId('q')
  await query(
    `INSERT INTO quotations (id, number, customer_id, customer_name, customer_tier, date, rep_id, rep_name, status, portal_status, currency, region, terms, price_list_id, amount, risk_score, risk_level, blended_risk)
     VALUES ($1, $2, $3, $4, $5, $6, NULL, 'Unassigned', 'draft', 'submitted', 'USD', $7, $8, 'pl-usd', 0, 0, 'LOW', 0)`,
    [id, `Q-${seq}`, c.id, c.name, c.tier, new Date().toISOString(), c.region, c.terms],
  )

  for (const l of lines) {
    const lineId = nextId('l')
    const qtyParsed = Number(l.qty)
    if (!Number.isFinite(qtyParsed) || qtyParsed < 1) throw httpError(400, 'Quantity must be at least 1')
    await query(
      `INSERT INTO quotation_lines (id, quotation_id, product_id, product_name, category, qty, price, discount_percent, comment)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, '')`,
      [lineId, id, l.productId, l.productName, l.category || 'Hardware', qtyParsed, Number(l.price)],
    )
  }

  await computeAndPersistRisk(id)
  await logActivityDb(`${c.name} submitted a new quote request from the portal`)
  return getPortalQuote(id, user.customerId)
}
