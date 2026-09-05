import { query } from './pool.js'

export async function listCustomers() {
  const { rows } = await query('SELECT id, name, tier, region, terms FROM customers ORDER BY name')
  return rows
}

export async function findCustomer(id) {
  const { rows } = await query('SELECT * FROM customers WHERE id = $1', [id])
  return rows[0] || null
}
