import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Make an immutable source snapshot; concurrent local edits cannot alter an upload.
const root = process.cwd();
const release = path.join(root, 'work', `i18n-release-${Date.now()}`);
fs.mkdirSync(release, { recursive: true });
const omitted = new Set(['node_modules', '.git', '.next', '.vinext', '.wrangler', '.firebase', '.agents', '.codex', '.aws', 'dist', 'work', 'outputs', 'coverage']);
const include = file => {
  const parts = path.relative(root, file).split(path.sep);
  return !parts.some(part => omitted.has(part))
    && !(parts[0] === 'functions' && parts[1] === 'lib')
    && !path.basename(file).endsWith('.local')
    && !(path.basename(file).startsWith('.env') && path.basename(file) !== '.env.example')
    && !path.basename(file).endsWith('.log');
};
for (const entry of fs.readdirSync(root)) {
  const source = path.join(root, entry);
  if (include(source)) fs.cpSync(source, path.join(release, entry), { recursive: true, filter: include });
}
const hash = crypto.createHash('sha256');
let count = 0;
function digest(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) digest(file);
    else { hash.update(path.relative(release,file)); hash.update(fs.readFileSync(file)); count++; }
  }
}
digest(release);
console.log(JSON.stringify({ release, files: count, sha256: hash.digest('hex') }));
