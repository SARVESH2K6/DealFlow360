import { query } from './pool.js'

export function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    customerId: row.customer_id ?? null,
  }
}

export async function findByCredentials(email, password) {
  const { rows } = await query(
    'SELECT * FROM users WHERE email = $1 AND password = $2',
    [email, password],
  )
  return rows[0] || null
}

export async function findById(id) {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [id])
  return rows[0] || null
}

export async function findByEmail(email) {
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email])
  return rows[0] || null
}

export async function createCustomerUser(email, password, name) {
  const customerId = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const userId = `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const customerName = `${name} (portal)`

  await query(
    `INSERT INTO customers (id, name, tier, region, terms) VALUES ($1, $2, 'Bronze', 'North America', 'Net 30')`,
    [customerId, customerName],
  )
  await query(
    `INSERT INTO users (id, email, password, name, role, customer_id) VALUES ($1, $2, $3, $4, 'customer', $5)`,
    [userId, email, password, name, customerId],
  )
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [userId])
  return rows[0]
}
