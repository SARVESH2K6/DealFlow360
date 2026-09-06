import { query } from './pool.js'
import { nextId } from './helpers.js'

export async function listProducts() {
  const { rows: products } = await query('SELECT * FROM products ORDER BY name')
  // Attach variants
  const { rows: variants } = await query('SELECT * FROM product_variants')
  const { rows: pricelists } = await query('SELECT * FROM pricelists')

  const items = products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: Number(p.price),
    unit: p.unit,
    taxPercent: Number(p.tax_percent),
    status: p.status,
    description: p.description,
    isSubscription: p.is_subscription,
    cycle: p.cycle,
    quantity: p.quantity,
    variants: variants
      .filter((v) => v.product_id === p.id)
      .map((v) => ({ id: v.id, attribute: v.attribute, values: v.values, extraPrice: Number(v.extra_price) })),
  }))

  return {
    items,
    stats: {
      totalProducts: items.length,
      pricelists: pricelists.length,
      variants: variants.length,
    },
  }
}

export async function getProduct(id) {
  const { rows } = await query('SELECT * FROM products WHERE id = $1', [id])
  if (rows.length === 0) return null
  const p = rows[0]
  const { rows: variants } = await query('SELECT * FROM product_variants WHERE product_id = $1', [id])
  const { rows: plRows } = await query('SELECT * FROM pricelists')
  const { rows: ruleRows } = await query('SELECT * FROM pricelist_rules')

  const product = {
    id: p.id,
    name: p.name,
    category: p.category,
    price: Number(p.price),
    unit: p.unit,
    taxPercent: Number(p.tax_percent),
    status: p.status,
    description: p.description,
    isSubscription: p.is_subscription,
    cycle: p.cycle,
    quantity: p.quantity,
    variants: variants.map((v) => ({ id: v.id, attribute: v.attribute, values: v.values, extraPrice: Number(v.extra_price) })),
  }

  const pricelists = plRows.map((pl) => ({
    id: pl.id,
    name: pl.name,
    currency: pl.currency,
    rules: ruleRows
      .filter((r) => r.pricelist_id === pl.id)
      .map((r) => ({ tier: r.tier, currency: r.currency, priceRule: r.price_rule })),
  }))

  return { product, pricelists }
}

export async function createProduct(body) {
  const id = nextId('p')
  await query(
    `INSERT INTO products (id, name, category, price, unit, tax_percent, status, description, is_subscription, cycle, quantity)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      body.name || 'Untitled product',
      body.category === 'Services' ? 'Services' : 'Hardware',
      Number(body.price) || 0,
      body.unit || 'unit',
      Number(body.taxPercent) || 0,
      'active',
      body.description || '',
      Boolean(body.isSubscription),
      body.isSubscription ? body.cycle || 'annual' : null,
      body.isSubscription ? Number(body.quantity) || 1 : null,
    ],
  )
  // Insert variants
  if (Array.isArray(body.variants)) {
    for (const v of body.variants) {
      const vid = nextId('v')
      await query(
        'INSERT INTO product_variants (id, product_id, attribute, values, extra_price) VALUES ($1, $2, $3, $4, $5)',
        [vid, id, v.attribute, v.values, Number(v.extraPrice) || 0],
      )
    }
  }
  return getProduct(id)
}

export async function patchProduct(id, body) {
  const fields = ['name', 'category', 'price', 'unit', 'taxPercent', 'status', 'description', 'isSubscription', 'cycle', 'quantity']
  const dbFields = {
    name: 'name', category: 'category', price: 'price', unit: 'unit',
    taxPercent: 'tax_percent', status: 'status', description: 'description',
    isSubscription: 'is_subscription', cycle: 'cycle', quantity: 'quantity',
  }
  const sets = []
  const vals = []
  let idx = 1
  for (const key of fields) {
    if (body[key] !== undefined) {
      sets.push(`${dbFields[key]} = $${idx}`)
      vals.push(body[key])
      idx++
    }
  }
  if (sets.length > 0) {
    vals.push(id)
    await query(`UPDATE products SET ${sets.join(', ')} WHERE id = $${idx}`, vals)
  }
  // Handle subscription cleanup
  if (body.isSubscription === false) {
    await query('UPDATE products SET cycle = NULL, quantity = NULL WHERE id = $1', [id])
  }
  // Handle variants replacement
  if (Array.isArray(body.variants)) {
    await query('DELETE FROM product_variants WHERE product_id = $1', [id])
    for (const v of body.variants) {
      const vid = v.id || nextId('v')
      await query(
        'INSERT INTO product_variants (id, product_id, attribute, values, extra_price) VALUES ($1, $2, $3, $4, $5)',
        [vid, id, v.attribute, v.values, Number(v.extraPrice) || 0],
      )
    }
  }
  return getProduct(id)
}

export async function deleteProduct(id) {
  try {
    const { rowCount } = await query('DELETE FROM products WHERE id = $1', [id])
    return rowCount > 0
  } catch (err) {
    if (err.code === '23503') throw new Error('Cannot delete product in use')
    throw err
  }
}

export async function listPricelists() {
  const { rows: plRows } = await query('SELECT * FROM pricelists ORDER BY name')
  const { rows: ruleRows } = await query('SELECT * FROM pricelist_rules')
  return plRows.map((pl) => ({
    id: pl.id,
    name: pl.name,
    currency: pl.currency,
    rules: ruleRows
      .filter((r) => r.pricelist_id === pl.id)
      .map((r) => ({ tier: r.tier, currency: r.currency, priceRule: r.price_rule })),
  }))
}
