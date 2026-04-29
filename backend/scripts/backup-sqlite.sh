#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${DB_PATH:-./data/football.sqlite}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "Error: sqlite3 CLI is required but was not found in PATH." >&2
  exit 1
fi

if [ ! -f "$DB_PATH" ]; then
  echo "Error: source database not found at '$DB_PATH'." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_PATH="$BACKUP_DIR/football-$STAMP.sqlite"

sqlite3 "$DB_PATH" ".backup '$BACKUP_PATH'"

INTEGRITY_RESULT="$(sqlite3 "$BACKUP_PATH" 'PRAGMA integrity_check;')"
if [ "$INTEGRITY_RESULT" != "ok" ]; then
  echo "Error: integrity_check failed for backup '$BACKUP_PATH': $INTEGRITY_RESULT" >&2
  exit 1
fi

echo "Backup created: $BACKUP_PATH"
