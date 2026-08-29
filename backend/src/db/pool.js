const { Pool } = require('pg');

// DATABASE_URL comes from Supabase/Neon connection string, set in .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

module.exports = pool;
