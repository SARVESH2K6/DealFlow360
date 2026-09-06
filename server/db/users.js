import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
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

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 32).toString('hex')
  return `scrypt:${salt}:${hash}`
}

function verifyPassword(password, stored) {
  if (!stored) return false
  if (stored.startsWith('scrypt:')) {
    const parts = stored.split(':')
    if (parts.length !== 3) return false
    const [, salt, hash] = parts
    const next = scryptSync(password, salt, 32)
    const prev = Buffer.from(hash, 'hex')
    if (prev.length !== next.length) return false
    return timingSafeEqual(prev, next)
  }
  return stored === password
}

export async function findByCredentials(email, password) {
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email])
  const user = rows[0]
  if (!user) return null
  if (!verifyPassword(password, user.password)) return null
  if (!String(user.password).startsWith('scrypt:')) {
    const hashed = hashPassword(password)
    await query('UPDATE users SET password = $1 WHERE id = $2', [hashed, user.id])
    user.password = hashed
  }
  return user
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
  const hashed = hashPassword(password)

  await query(
    `INSERT INTO customers (id, name, tier, region, terms) VALUES ($1, $2, 'Bronze', 'North America', 'Net 30')`,
    [customerId, customerName],
  )
  await query(
    `INSERT INTO users (id, email, password, name, role, customer_id) VALUES ($1, $2, $3, $4, 'customer', $5)`,
    [userId, email, hashed, name, customerId],
  )
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [userId])
  return rows[0]
}
