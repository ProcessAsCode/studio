/* Run SQL migrations from /database/migrations with a schema_migrations table */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is missing');
  process.exit(1);
}

const migrationsDir = path.resolve(__dirname, '../../database/migrations');

function listSqlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort(); // ensure 000,001,... order
}

(async () => {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Ensure schema_migrations exists (even if 000 file missing)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const files = listSqlFiles(migrationsDir);

    for (const file of files) {
      const id = file;
      const already = await pool.query('SELECT 1 FROM schema_migrations WHERE id=$1', [id]);
      if (already.rowCount > 0) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`Applying migration: ${file}`);
      await pool.query('BEGIN');
      try {
        await pool.query(sql);
        await pool.query('INSERT INTO schema_migrations(id) VALUES($1)', [id]);
        await pool.query('COMMIT');
      } catch (e) {
        await pool.query('ROLLBACK');
        throw e;
      }
    }

    console.log('Migrations complete.');
    process.exit(0);
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
})();
