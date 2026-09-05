import { query } from './pool.js'
import { nextId, computeAndPersistRisk, getUpsells } from './helpers.js'

// ── Quotation list item shape ────────────────────────────────────────

function toListItem(row) {
  return {
    id: row.id,
    number: row.number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    date: row.date,
    amount: Number(row.amount),
    repName: row.rep_name,
    status: row.status,
    riskLevel: row.risk_level,
    riskScore: Number(row.risk_score),
    blendedRisk: Number(row.blended_risk),
    customerTier: row.customer_tier,
  }
}

// ── Full detail shape ────────────────────────────────────────────────

async function toDetail(row) {
  const { rows: lineRows } = await query(
    'SELECT * FROM quotation_lines WHERE quotation_id = $1',
    [row.id],
  )
  const lines = lineRows.map((l) => ({
    id: l.id,
    productId: l.product_id,
    productName: l.product_name,
    category: l.category,
    qty: Number(l.qty),
    price: Number(l.price),
    discountPercent: Number(l.discount_percent),
    limit: l.line_limit != null ? Number(l.line_limit) : 0,
    status: l.line_status || 'within',
    comment: l.comment || '',
    counterDiscount: l.counter_discount != null ? Number(l.counter_discount) : undefined,
  }))

  const upsells = await getUpsells(lines)

  return {
    ...toListItem(row),
    currency: row.currency,
    region: row.region,
    terms: row.terms,
    priceListId: row.price_list_id,
    lines,
    flagReasons: row.flag_reasons || [],
    upsells,
    portalStatus: row.portal_status,
    requestedDeliveryDate: row.requested_delivery_date,
    repId: row.rep_id,
  }
}

// ── Queries ──────────────────────────────────────────────────────────

export async function listQuotations(user) {
  let rows
  if (user.role === 'customer') {
    const result = await query(
      'SELECT * FROM quotations WHERE customer_id = $1 ORDER BY date DESC',
      [user.customerId],
    )
    rows = result.rows
  } else {
    const result = await query('SELECT * FROM quotations ORDER BY date DESC')
    rows = result.rows
  }
  // Recompute risk for all
  for (const row of rows) {
    await computeAndPersistRisk(row.id)
  }
  // Re-fetch after risk update
  const ids = rows.map((r) => r.id)
  if (ids.length === 0) return []
  const { rows: updated } = await query(
    'SELECT * FROM quotations WHERE id = ANY($1) ORDER BY date DESC',
    [ids],
  )
  return updated.map(toListItem)
}

export async function getQuotation(id) {
  await computeAndPersistRisk(id)
  const { rows } = await query('SELECT * FROM quotations WHERE id = $1', [id])
  if (rows.length === 0) return null
  return toDetail(rows[0])
}

export async function createQuotation(body, user) {
  let customerId = body.customerId
  if (!customerId) {
    const { rows: firstCust } = await query('SELECT id FROM customers ORDER BY name LIMIT 1')
    if (firstCust.length > 0) customerId = firstCust[0].id
  }
  const { rows: custRows } = await query('SELECT * FROM customers WHERE id = $1', [customerId])
  if (custRows.length === 0) return null

  // Get next sequence number
  const { rows: countRows } = await query('SELECT COUNT(*)::int AS cnt FROM quotations')
  const seq = 1049 + (countRows[0]?.cnt || 0)

  const id = nextId('q')
  await query(
    `INSERT INTO quotations (id, number, customer_id, customer_name, customer_tier, date, rep_id, rep_name, status, currency, region, terms, price_list_id, amount, risk_score, risk_level, blended_risk)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', 'USD', $9, $10, $11, 0, 0, 'LOW', 0)`,
    [id, `Q-${seq}`, customerId, custRows[0].name, custRows[0].tier, new Date().toISOString(), user.id, user.name, custRows[0].region, custRows[0].terms, body.priceListId || 'pl-usd'],
  )

  await logActivityDb(`${custRows[0].name} draft quotation Q-${seq} created by ${user.name}`)
  return getQuotation(id)
}

export async function patchQuotation(id, body) {
  const { rows } = await query('SELECT * FROM quotations WHERE id = $1', [id])
  if (rows.length === 0) return null

  if (body.customerId) {
    const { rows: cRows } = await query('SELECT * FROM customers WHERE id = $1', [body.customerId])
    if (cRows.length > 0) {
      const c = cRows[0]
      await query(
        'UPDATE quotations SET customer_id = $1, customer_name = $2, customer_tier = $3, region = $4, terms = $5 WHERE id = $6',
        [c.id, c.name, c.tier, c.region, c.terms, id],
      )
    }
  }
  if (body.priceListId) await query('UPDATE quotations SET price_list_id = $1 WHERE id = $2', [body.priceListId, id])
  if (body.region) await query('UPDATE quotations SET region = $1 WHERE id = $2', [body.region, id])
  if (body.terms) await query('UPDATE quotations SET terms = $1 WHERE id = $2', [body.terms, id])
  if (body.currency) await query('UPDATE quotations SET currency = $1 WHERE id = $2', [body.currency, id])

  await computeAndPersistRisk(id)
  return getQuotation(id)
}

export async function addLine(quotationId, body) {
  const { rows: qRows } = await query('SELECT * FROM quotations WHERE id = $1', [quotationId])
  if (qRows.length === 0) return null
  const { rows: pRows } = await query('SELECT * FROM products WHERE id = $1', [body.productId])
  if (pRows.length === 0) return null
  const product = pRows[0]

  const lineId = nextId('l')
  await query(
    `INSERT INTO quotation_lines (id, quotation_id, product_id, product_name, category, qty, price, discount_percent, comment)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '')`,
    [lineId, quotationId, product.id, product.name, product.category, Number(body.qty) || 1, Number(product.price), Number(body.discountPercent) || 0],
  )

  await computeAndPersistRisk(quotationId)
  return getQuotation(quotationId)
}

export async function patchLine(quotationId, lineId, body) {
  const { rows } = await query('SELECT * FROM quotation_lines WHERE id = $1 AND quotation_id = $2', [lineId, quotationId])
  if (rows.length === 0) return null

  if (body.discountPercent !== undefined) {
    const clamped = Math.max(0, Math.min(80, Number(body.discountPercent)))
    await query('UPDATE quotation_lines SET discount_percent = $1 WHERE id = $2', [clamped, lineId])
  }
  if (body.qty !== undefined) {
    await query('UPDATE quotation_lines SET qty = $1 WHERE id = $2', [Math.max(1, Number(body.qty)), lineId])
  }

  await computeAndPersistRisk(quotationId)
  return getQuotation(quotationId)
}

export async function deleteLine(quotationId, lineId) {
  await query('DELETE FROM quotation_lines WHERE id = $1 AND quotation_id = $2', [lineId, quotationId])
  await computeAndPersistRisk(quotationId)
  return getQuotation(quotationId)
}

// ── Activity helper (imported here to avoid circular deps) ───────────

async function logActivityDb(text) {
  const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  await query('INSERT INTO activity (id, text, timestamp) VALUES ($1, $2, $3)', [id, text, new Date().toISOString()])
}
