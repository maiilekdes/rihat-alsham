// Incremental production migrations. Each file is written to be safe to run
// again, so a restarted container can verify the schema before serving traffic.
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const migrations = [
  '001_auth_identity.sql',
  '002_loyalty_points_guard.sql',
  '003_account_deletion.sql',
];
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    for (const migration of migrations) {
      const sql = fs.readFileSync(path.join(__dirname, '../../../db/migrations', migration), 'utf8');
      await client.query(sql);
      console.log(`Migration applied: ${migration}`);
    }
  } finally {
    await client.end();
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
