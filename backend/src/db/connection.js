const fs = require('fs');
const path = require('path');
const { DB_DRIVER, DB_PATH } = require('../config/env');

function createMemoryDb() {
  return {
    driver: 'memory',
    state: {
      users: new Map(),
      usersByTelegram: new Map(),
      requests: new Map(),
      requestsByToken: new Map(),
      responses: new Map(),
      responsesByRequestUser: new Map(),
      callbackTokens: new Map(),
      requestEvents: [],
      responseEvents: []
    },
    transaction(fn) { return fn(); },
    close() {}
  };
}

function createSqliteDb(dbPath) {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (error) {
    throw new Error(`DB_DRIVER=sqlite requires node:sqlite support in this Node runtime: ${error.message}`);
  }

  const resolvedPath = path.resolve(dbPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  const sqlite = new DatabaseSync(resolvedPath);
  let transactionDepth = 0;
  sqlite.exec('PRAGMA foreign_keys = ON;');
  try {
    sqlite.exec('PRAGMA journal_mode = WAL;');
  } catch (_) {
    // Ignore journal mode issues in constrained environments.
  }

  return {
    driver: 'sqlite',
    path: resolvedPath,
    sqlite,
    transaction(fn) {
      if (transactionDepth > 0) return fn();
      transactionDepth += 1;
      sqlite.exec('BEGIN');
      try {
        const result = fn();
        sqlite.exec('COMMIT');
        return result;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      } finally {
        transactionDepth -= 1;
      }
    },
    close() { sqlite.close(); }
  };
}

function createDb() {
  if (DB_DRIVER === 'memory') return createMemoryDb();
  if (DB_DRIVER === 'sqlite') return createSqliteDb(DB_PATH);
  throw new Error(`Unsupported DB_DRIVER: ${DB_DRIVER}`);
}

module.exports = { createDb };
