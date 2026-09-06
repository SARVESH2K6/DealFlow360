/** Shared helpers: risk engine, ID generation, camelCase conversion. */

import { query } from './pool.js'

// ── camelCase helpers ────────────────────────────────────────────────
// PG returns snake_case columns; the frontend expects camelCase.

export function toCamel(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

export function camelRow(row) {
  if (!row) return null
  const out = {}
  for (const key of Object.keys(row)) {
    out[toCamel(key)] = row[key]
  }
  return out
}

export function camelRows(rows) {
  return rows.map(camelRow)
}

// ── ID generation ────────────────────────────────────────────────────

export function nextId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

// ── Risk engine (ported from store.js) ───────────────────────────────

export function lineLimit(line, customerTier, config) {
  const tier = config.tierDiscounts.find((t) => t.tier === customerTier)
  const cat = config.categoryCeilings.find((c) => c.category === line.category)
  const tierMax = tier ? Number(tier.maxDiscount) : 10
  const catMax = cat ? Number(cat.maxDiscount) : 10
  return Math.min(tierMax, catMax)
}

export function lineStatus(discountPercent, limit) {
  if (discountPercent > limit) return 'over'
  if (discountPercent >= Math.max(0, limit - 2) && discountPercent < limit) return 'near'
  return 'within'
}

export const QUOTE_EDITABLE = new Set(['draft', 'rejected', 'returned', 'negotiation'])

export function isQuoteEditable(status) {
  return QUOTE_EDITABLE.has(status)
}

export function httpError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

export function parseDiscountPercent(value) {
  if (value === undefined || value === null) return { skip: true }
  if (typeof value === 'string' && value.trim() === '') {
    return { error: 'Discount percent is required' }
  }
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return { error: 'Discount percent must be a number' }
  if (n < 0) return { error: 'Discount percent cannot be negative' }
  if (n > 100) return { error: 'Discount percent cannot exceed 100' }
  return { value: n }
}

export function parseQty(value) {
  if (value === undefined || value === null) return { skip: true }
  if (typeof value === 'string' && value.trim() === '') {
    return { error: 'Quantity is required' }
  }
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return { error: 'Quantity must be a number' }
  if (n < 1) return { error: 'Quantity must be at least 1' }
  return { value: n }
}

/**
 * Spec:
 *   violation = max(0, discountPercent - categoryCeiling)
 *   weight = line.subtotal / order.totalSubtotal
 *   riskScore = sum(violation * weight)
 * Zero lines / zero-value lines resolve to 0, never NaN.
 */
export function computeRisk(lines, customerTier, config) {
  const flagReasons = []
  let totalSubtotal = 0
  const prepared = []

  for (const line of lines) {
    const limit = lineLimit(line, customerTier, config)
    const discount = Number(line.discountPercent)
    const qty = Number(line.qty)
    const price = Number(line.price)
    const subtotal = (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(price) ? price : 0)
    const disc = Number.isFinite(discount) ? discount : 0
    const violation = Math.max(0, disc - limit)
    line.limit = limit
    line.status = lineStatus(disc, limit)
    totalSubtotal += subtotal
    prepared.push({ line, limit, disc, subtotal, violation })
  }

  let riskScore = 0
  for (const row of prepared) {
    const weight = totalSubtotal === 0 ? 0 : row.subtotal / totalSubtotal
    riskScore += row.violation * weight
    if (row.violation > 0) {
      flagReasons.push({
        line: row.line.productName,
        discountGiven: row.disc,
        limitAllowed: row.limit,
        overBy: Math.round(row.violation * 100) / 100,
      })
    }
  }

  riskScore = Math.round(riskScore * 100) / 100
  const highCut = Number(config.thresholds?.high ?? 4)
  const medCut = Number(config.thresholds?.medium ?? 0)

  let riskLevel = 'LOW'
  if (riskScore > 0) {
    if (riskScore >= highCut) riskLevel = 'HIGH'
    else if (medCut === 0 || riskScore >= medCut) riskLevel = 'MEDIUM'
  }

  const amount = lines.reduce((sum, l) => {
    const disc = Number(l.discountPercent)
    const qty = Number(l.qty)
    const price = Number(l.price)
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return sum
    const pct = Number.isFinite(disc) ? disc : 0
    return sum + qty * price * (1 - pct / 100)
  }, 0)

  return { amount, riskScore, riskLevel, blendedRisk: riskScore, flagReasons, lines }
}

export function requiredApprovalLevel(riskLevel, config) {
  const row = config?.approvalChain?.find(
    (c) => String(c.trigger || '').toUpperCase() === String(riskLevel || '').toUpperCase(),
  )
  const routing = String(row?.routing || '')
  if (/finance/i.test(routing)) return 'finance'
  if (/manager/i.test(routing)) return 'manager'
  if (/no approval/i.test(routing)) return 'none'
  if (riskLevel === 'HIGH') return 'finance'
  if (riskLevel === 'MEDIUM') return 'manager'
  return 'none'
}

// ── Discount config loader ───────────────────────────────────────────

export async function loadDiscountConfig() {
  const [tiers, cats, chain, thresh] = await Promise.all([
    query('SELECT id, tier, max_discount FROM discount_tier_discounts'),
    query('SELECT id, category, max_discount FROM discount_category_ceilings'),
    query('SELECT id, range, routing, trigger FROM discount_approval_chain'),
    query('SELECT medium, high FROM discount_thresholds LIMIT 1'),
  ])
  return {
    tierDiscounts: tiers.rows.map((r) => ({ id: r.id, tier: r.tier, maxDiscount: Number(r.max_discount) })),
    categoryCeilings: cats.rows.map((r) => ({ id: r.id, category: r.category, maxDiscount: Number(r.max_discount) })),
    approvalChain: chain.rows.map((r) => ({ id: r.id, range: r.range, routing: r.routing, trigger: r.trigger })),
    thresholds: thresh.rows[0] ? { medium: Number(thresh.rows[0].medium), high: Number(thresh.rows[0].high) } : { medium: 0, high: 4 },
  }
}

// ── Upsell engine ────────────────────────────────────────────────────

const UPSELL_PAIRS = {
  'p-sensor': ['p-spares', 'p-support', 'p-install'],
  'p-gateway': ['p-install', 'p-support', 'p-sensor'],
  'p-maint': ['p-sensor', 'p-gateway', 'p-support'],
  'p-install': ['p-support', 'p-spares', 'p-maint'],
  'p-support': ['p-maint', 'p-spares', 'p-sensor'],
  'p-spares': ['p-sensor', 'p-install', 'p-support'],
}

export async function getUpsells(lines) {
  const inCart = new Set(lines.map((l) => l.productId || l.product_id))
  const ranked = []
  for (const line of lines) {
    const pid = line.productId || line.product_id
    const pairs = UPSELL_PAIRS[pid] ?? []
    for (const id of pairs) {
      if (!inCart.has(id) && !ranked.includes(id)) ranked.push(id)
    }
  }
  // Fill up to 3
  if (ranked.length < 3) {
    const { rows } = await query('SELECT id FROM products')
    for (const p of rows) {
      if (!inCart.has(p.id) && !ranked.includes(p.id)) ranked.push(p.id)
    }
  }
  const ids = ranked.slice(0, 3)
  if (ids.length === 0) return []
  const { rows } = await query('SELECT id, name, price, category FROM products WHERE id = ANY($1)', [ids])
  // Keep ranked order
  return ids.map((id) => {
    const p = rows.find((x) => x.id === id)
    if (!p) return null
    return {
      productId: p.id,
      productName: p.name,
      price: Number(p.price),
      marginNote: p.category === 'Services' ? 'High-margin services attach' : 'Completes the hardware bundle',
    }
  }).filter(Boolean)
}

// ── Quotation risk compute + persist ─────────────────────────────────

let riskColumnsReady = false
async function ensureRiskNumericColumns() {
  if (riskColumnsReady) return
  await query('ALTER TABLE quotations ALTER COLUMN risk_score TYPE NUMERIC(12,2) USING risk_score::numeric').catch(() => {})
  await query('ALTER TABLE quotations ALTER COLUMN blended_risk TYPE NUMERIC(12,2) USING blended_risk::numeric').catch(() => {})
  riskColumnsReady = true
}

export async function computeAndPersistRisk(quotationId) {
  await ensureRiskNumericColumns()
  const { rows: qRows } = await query(
    'SELECT q.id, q.customer_id, c.tier AS customer_tier, c.name AS customer_name FROM quotations q JOIN customers c ON c.id = q.customer_id WHERE q.id = $1',
    [quotationId],
  )
  if (qRows.length === 0) return null
  const q = qRows[0]

  const { rows: lineRows } = await query(
    'SELECT id, product_id, product_name, category, qty, price, discount_percent, counter_discount, comment FROM quotation_lines WHERE quotation_id = $1',
    [quotationId],
  )

  const config = await loadDiscountConfig()
  const lines = lineRows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    productName: r.product_name,
    category: r.category,
    qty: Number(r.qty),
    price: Number(r.price),
    discountPercent: Number(r.discount_percent),
    counterDiscount: r.counter_discount != null ? Number(r.counter_discount) : undefined,
    comment: r.comment || '',
  }))

  const risk = computeRisk(lines, q.customer_tier, config)

  // Persist computed values
  await query(
    `UPDATE quotations SET amount = $1, risk_score = $2, risk_level = $3, blended_risk = $4,
     flag_reasons = $5, customer_name = $6, customer_tier = $7 WHERE id = $8`,
    [risk.amount, risk.riskScore, risk.riskLevel, risk.blendedRisk, JSON.stringify(risk.flagReasons), q.customer_name, q.customer_tier, quotationId],
  )

  // Persist per-line limit/status
  for (const line of risk.lines) {
    await query(
      'UPDATE quotation_lines SET line_limit = $1, line_status = $2 WHERE id = $3',
      [line.limit, line.status, line.id],
    )
  }

  return { ...risk, customerName: q.customer_name, customerTier: q.customer_tier }
}
