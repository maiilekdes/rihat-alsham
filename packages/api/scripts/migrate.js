// Applies db/schema.sql against DATABASE_URL. Idempotent-ish for dev use only —
// for real deployments, switch to a proper migration tool (e.g. node-pg-migrate)
// once the schema starts changing incrementally instead of being created fresh.
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '../../../db/schema.sql'), 'utf8');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(sql);
    console.log('Schema applied.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
