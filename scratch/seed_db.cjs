const fs = require('fs');
const { Client } = require('pg');

async function seed() {
  const client = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Moksh2124@localhost:5432/dealflow360' });
  await client.connect();
  try {
    console.log('Running schema_and_seed.sql...');
    const sql1 = fs.readFileSync('database/schema_and_seed.sql', 'utf8');
    await client.query(sql1);
    
    console.log('Running new_seeds.sql...');
    const sql2 = fs.readFileSync('database/new_seeds.sql', 'utf8');
    await client.query(sql2);
    
    console.log('Done!');
  } catch (err) {
    console.error('Error seeding DB:', err);
  } finally {
    await client.end();
  }
}

seed();
