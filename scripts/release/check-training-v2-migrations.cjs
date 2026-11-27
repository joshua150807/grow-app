// Read-only: verifies the exact release migration set; never connects to a DB.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const manifest = require('./training-v2-migrations.json');
const root = path.resolve(__dirname, '../..');
const actual = fs.readdirSync(path.join(root, 'supabase/migrations')).filter(f => f.includes('_training_v2_')).sort();
if (JSON.stringify(actual) !== JSON.stringify(manifest.migrations.map(m => m.file))) throw new Error('Migration list changed; review required');
for (const m of manifest.migrations) {
  const hash = createHash('sha256').update(fs.readFileSync(path.join(root, 'supabase/migrations', m.file))).digest('hex');
  if (hash !== m.sha256) throw new Error('Migration content changed: ' + m.file);
}
console.log('PASS: 14 Training V2 migrations unchanged; planner migration excluded; no DB connection');
