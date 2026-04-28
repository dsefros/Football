const fs = require('fs');
const path = require('path');

function listMigrationFiles() {
  const dir = path.join(__dirname, 'migrations');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((name) => ({
    id: name,
    filePath: path.join(dir, name)
  }));
}

function runSqliteMigrations(db) {
  const migrations = listMigrationFiles();

  db.sqlite.exec('BEGIN;');
  try {
    db.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const appliedRows = db.sqlite.prepare('SELECT id FROM schema_migrations;').all();
    const applied = new Set(appliedRows.map((r) => r.id));

    for (const migration of migrations) {
      if (applied.has(migration.id)) continue;
      const sql = fs.readFileSync(migration.filePath, 'utf8');
      db.sqlite.exec(sql);
      db.sqlite.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(migration.id, new Date().toISOString());
    }

    db.sqlite.exec('COMMIT;');
    return { driver: 'sqlite', migrations: migrations.map((m) => m.id) };
  } catch (error) {
    db.sqlite.exec('ROLLBACK;');
    throw error;
  }
}

function runMigrations(db) {
  const migrations = listMigrationFiles();
  if (!db || db.driver === 'memory') {
    return { driver: 'memory', migrations: migrations.map((m) => m.id), applied: false };
  }
  if (db.driver !== 'sqlite') throw new Error(`Unsupported db driver for migrations: ${db.driver}`);
  return runSqliteMigrations(db);
}

if (require.main === module) {
  const { createDb } = require('./connection');
  const db = createDb();
  try {
    const result = runMigrations(db);
    if (result.driver === 'memory') {
      console.log(`DB_DRIVER=memory: migrations discovered (${result.migrations.join(', ')}) but not applied by design.`);
    } else {
      console.log(`Applied SQLite migrations (idempotent): ${result.migrations.join(', ')}`);
    }
  } finally {
    db.close();
  }
}

module.exports = { runMigrations, listMigrationFiles };
