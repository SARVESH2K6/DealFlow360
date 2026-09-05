import { query } from './pool.js'
import { nextId } from './helpers.js'

export async function getDiscountConfig() {
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

export async function saveDiscountConfig(body) {
  // Completely replace configuration
  await query('DELETE FROM discount_tier_discounts')
  await query('DELETE FROM discount_category_ceilings')
  await query('DELETE FROM discount_approval_chain')
  await query('DELETE FROM discount_thresholds')

  for (const t of body.tierDiscounts) {
    await query('INSERT INTO discount_tier_discounts (id, tier, max_discount) VALUES ($1, $2, $3)', [t.id || nextId('td'), t.tier, Number(t.maxDiscount)])
  }
  for (const c of body.categoryCeilings) {
    await query('INSERT INTO discount_category_ceilings (id, category, max_discount) VALUES ($1, $2, $3)', [c.id || nextId('cc'), c.category, Number(c.maxDiscount)])
  }
  for (const a of body.approvalChain) {
    await query('INSERT INTO discount_approval_chain (id, range, routing, trigger) VALUES ($1, $2, $3, $4)', [a.id || nextId('ac'), a.range, a.routing, a.trigger])
  }
  if (body.thresholds) {
    await query('INSERT INTO discount_thresholds (medium, high) VALUES ($1, $2)', [Number(body.thresholds.medium), Number(body.thresholds.high)])
  }
  return getDiscountConfig()
}
