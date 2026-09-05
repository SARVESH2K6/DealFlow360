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
  if (discountPercent >= Math.max(0, limit - 2)) return 'near'
  return 'within'
}

/**
 * Compute risk in JS given lines array, customerTier, and discountConfig.
 * Returns { amount, riskScore, riskLevel, blendedRisk, flagReasons, lines (annotated) }.
 */
export function computeRisk(lines, customerTier, config) {
  let weightedOver = 0
  let totalValue = 0
  const flagReasons = []

  for (const line of lines) {
    const limit = lineLimit(line, customerTier, config)
    line.limit = limit
    line.status = lineStatus(Number(line.discountPercent), limit)
    const lineValue = Number(line.qty) * Number(line.price)
    totalValue += lineValue
    const overBy = Math.max(0, Math.round((Number(line.discountPercent) - limit) * 10) / 10)
    if (overBy > 0) {
      weightedOver += (overBy / 100) * lineValue
      flagReasons.push({
        line: line.productName,
        discountGiven: Number(line.discountPercent),
        limitAllowed: limit,
        overBy,
      })
    }
  }

  const blended = totalValue === 0 ? 0 : (weightedOver / totalValue) * 100
  const overCount = lines.filter((l) => l.status === 'over').length
  const riskScore = Math.min(100, Math.round(blended * 8 + overCount * 18))

  const highCut = Number(config.thresholds.high)
  const medCut = Number(config.thresholds.medium)
  let riskLevel = 'LOW'
  if (blended >= highCut || lines.some((l) => Number(l.discountPercent) - l.limit > 5)) {
    riskLevel = 'HIGH'
  } else if (blended > medCut || overCount > 0) {
    riskLevel = 'MEDIUM'
  }

  const amount = lines.reduce((sum, l) => {
    return sum + Number(l.qty) * Number(l.price) * (1 - Number(l.discountPercent) / 100)
  }, 0)

  return { amount, riskScore, riskLevel, blendedRisk: Math.round(blended * 10) / 10, flagReasons, lines }
}

export function requiredApprovalLevel(riskLevel) {
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

export async function computeAndPersistRisk(quotationId) {
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
