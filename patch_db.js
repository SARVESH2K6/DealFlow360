import { query } from './server/db/pool.js'

async function run() {
  try {
    console.log('Dropping constraints on quotations...');
    await query(`ALTER TABLE quotations DROP CONSTRAINT quotations_status_check`);
  } catch (e) {
    console.log('quotations_status_check drop failed:', e.message);
  }
  
  try {
    console.log('Dropping constraints on approvals...');
    await query(`ALTER TABLE approvals DROP CONSTRAINT approvals_status_check`);
  } catch (e) {
    console.log('approvals_status_check drop failed:', e.message);
  }

  try {
    await query(`ALTER TABLE quotations DROP CONSTRAINT quotations_risk_level_check`);
  } catch (e) {
    console.log('risk level constraint drop failed', e.message);
  }
  
  console.log('Done');
  process.exit(0);
}

run();
