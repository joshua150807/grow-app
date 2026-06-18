const fs = require('fs');
const path = require('path');

const root = process.cwd();
const exists = (p) => fs.existsSync(path.join(root, p));
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

const checks = [];
function add(name, ok, detail = '') {
  checks.push({ name, ok, detail });
}

let pkg = null;
let app = null;

try {
  pkg = readJson('package.json');
  add('package.json vorhanden', true);
} catch (e) {
  add('package.json vorhanden', false, e.message);
}

try {
  app = readJson('app.json');
  add('app.json vorhanden', true);
} catch (e) {
  add('app.json vorhanden', false, e.message);
}

if (pkg) {
  const scripts = pkg.scripts || {};
  add('Quality Script vorhanden', Boolean(scripts.quality), scripts.quality || 'npm run quality fehlt');
  add('Expo Doctor Script vorhanden', Boolean(scripts.doctor), scripts.doctor || 'npm run doctor fehlt');
  add('Direkte dotenv Dependency unnötig', !(pkg.dependencies && pkg.dependencies.dotenv), pkg.dependencies?.dotenv ? 'dotenv ist direkt installiert, aber im App-Code meist nicht nötig.' : 'OK');
}

if (app) {
  const expo = app.expo || {};
  add('Scheme gesetzt', Boolean(expo.scheme), expo.scheme || 'Kein scheme in app.json');
  add('iOS Bundle Identifier gesetzt', Boolean(expo.ios && expo.ios.bundleIdentifier), expo.ios?.bundleIdentifier || 'Fehlt');
  add('Runtime Version gesetzt', Boolean(expo.runtimeVersion), JSON.stringify(expo.runtimeVersion || 'Fehlt'));
  add('Updates URL gesetzt', Boolean(expo.updates && expo.updates.url), expo.updates?.url || 'Fehlt');
}

add('Logger vorhanden', exists('lib/logger.js'), exists('lib/logger.js') ? 'OK' : 'lib/logger.js fehlt');
add('Auth User Helper vorhanden', exists('services/authUser.js'), exists('services/authUser.js') ? 'OK' : 'services/authUser.js fehlt');
add('Admin Access Hook vorhanden', exists('features/admin/hooks/useAdminAccess.js'), exists('features/admin/hooks/useAdminAccess.js') ? 'OK' : 'features/admin/hooks/useAdminAccess.js fehlt');
add('Admin Protected Route vorhanden', exists('features/admin/components/AdminProtectedRoute.jsx'), exists('features/admin/components/AdminProtectedRoute.jsx') ? 'OK' : 'features/admin/components/AdminProtectedRoute.jsx fehlt');

const sourceDirs = ['app', 'features', 'services', 'lib'];
const directConsole = [];
function walk(dir) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const rel = path.join(dir, entry.name);
    const abs = path.join(root, rel);
    if (entry.isDirectory()) walk(rel);
    if (entry.isFile() && /\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      const txt = fs.readFileSync(abs, 'utf8');
      if (rel !== path.join('lib', 'logger.js') && /console\.(log|warn|error|debug)\s*\(/.test(txt)) {
        directConsole.push(rel);
      }
    }
  }
}
sourceDirs.forEach(walk);
add('Keine direkten console.* außerhalb logger', directConsole.length === 0, directConsole.length ? directConsole.join('\n') : 'OK');

console.log('\nGrow Beta Readiness Check\n');
for (const c of checks) {
  console.log(`${c.ok ? '✅' : '⚠️'} ${c.name}${c.detail ? `\n   ${c.detail}` : ''}`);
}

const warnings = checks.filter((c) => !c.ok);
console.log(`\nErgebnis: ${warnings.length} Warnung(en).`);
if (warnings.length) {
  console.log('Warnungen sind nicht automatisch Blocker. Prüfe sie bewusst vor dem Beta-Build.');
}
