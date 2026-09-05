import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Moksh2124@localhost:5432/dealflow360',
})

pool.on('error', (err) => {
  console.error('Unexpected PG pool error', err)
})

export function query(text, params) {
  return pool.query(text, params)
}

export function getClient() {
  return pool.connect()
}

export default pool
