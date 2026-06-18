const { Client } = require('pg');

async function ensureSchema() {
  const schema = process.env.DATABASE_SCHEMA || 'strapi';
  const client = new Client({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    database: process.env.DATABASE_NAME || 'strapi',
    user: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || '',
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    console.log(`Schema "${schema}" is ready`);
  } catch (err) {
    console.error('Failed to ensure schema:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

ensureSchema();
