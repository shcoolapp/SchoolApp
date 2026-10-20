const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'ChangeMe2026';

// Ensures at least one admin account exists so a fresh deploy always has a
// way in, without needing a manual SQL insert. Only creates one if NO admin
// account exists yet — safe to call on every server start. The default
// password is meant to be changed immediately via the account settings page.
async function seedDefaultAdmin() {
  try {
    const existing = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (existing.rows.length > 0) return; // an admin already exists, nothing to do

    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
    await pool.query(
      'INSERT INTO users (name, username, password_hash, role) VALUES ($1, $2, $3, $4)',
      ['Admin', DEFAULT_ADMIN_USERNAME, passwordHash, 'admin']
    );
    console.log(
      `[seed] Created default admin account — username: "${DEFAULT_ADMIN_USERNAME}", password: "${DEFAULT_ADMIN_PASSWORD}". Change this immediately via the Account page.`
    );
  } catch (err) {
    console.error('[seed] Failed to seed default admin:', err.message);
  }
}

module.exports = { seedDefaultAdmin };
