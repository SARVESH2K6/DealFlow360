import './loadEnv.js'
import pg from 'pg'

const url =
  process.env.DATABASE_URL || 'postgresql://postgres:Moksh2124@127.0.0.1:5432/dealflow360'

const pool = new pg.Pool({
  connectionString: url,
  connectionTimeoutMillis: 2500,
})

try {
  await pool.query('SELECT 1')
  await pool.end()
  console.log('DealFlow360 using PostgreSQL')
  await import('./index.pg.js')
} catch (err) {
  await pool.end().catch(() => {})
  console.warn(`PostgreSQL unavailable (${err.message}). Using in-memory store.`)
  await import('./index.memory.js')
}
