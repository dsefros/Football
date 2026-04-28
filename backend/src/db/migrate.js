const fs = require('fs');
const path = require('path');

function runMigrations() {
  const dir = path.join(__dirname, 'migrations');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
}

if (require.main === module) {
  const files = runMigrations();
  console.log(`In-memory backend mode: migration SQL files present (${files.join(', ')}) but not executed against a DB in this skeleton.`);
}

module.exports = { runMigrations };
