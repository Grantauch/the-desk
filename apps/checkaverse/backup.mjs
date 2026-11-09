// Nightly backup. Makes a clean copy of the live database while the server keeps running,
// writes it to every backup folder, and keeps the newest 30 copies in each.
// CHECKAVERSE_BACKUP_DIRS takes extra folders separated by semicolons, such as a Google Drive folder.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.CHECKAVERSE_DATA || path.resolve(HERE, '..', 'storage');
const KEEP = Number(process.env.CHECKAVERSE_BACKUP_KEEP || 30);
const dirs = [
  process.env.CHECKAVERSE_RECOVERY || path.resolve(HERE, '..', 'recovery'),
  ...(process.env.CHECKAVERSE_BACKUP_DIRS || '').split(';').map((s) => s.trim()).filter(Boolean),
];

const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const source = path.join(DATA_DIR, 'checkaverse.db');
if (!fs.existsSync(source)) {
  console.log('No database yet, nothing to back up.');
  process.exit(0);
}

const first = path.join(dirs[0], `checkaverse-${stamp}.db`);
fs.mkdirSync(dirs[0], { recursive: true });
const db = new DatabaseSync(source);
db.exec(`VACUUM INTO '${first.replace(/'/g, "''")}'`);
db.close();
console.log('Backed up to', first);

for (const dir of dirs.slice(1)) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(first, path.join(dir, path.basename(first)));
    console.log('Copied to', dir);
  } catch (err) {
    console.log('Could not copy to', dir, err.message);
  }
}

for (const dir of dirs) {
  try {
    const old = fs.readdirSync(dir).filter((f) => /^checkaverse-.*\.db$/.test(f)).sort().reverse().slice(KEEP);
    for (const f of old) fs.unlinkSync(path.join(dir, f));
  } catch { /* a missing folder is fine */ }
}

// Server logs older than 30 days go too.
const logs = path.join(DATA_DIR, 'logs');
const cutoff = Date.now() - 30 * 86_400_000;
for (const f of fs.existsSync(logs) ? fs.readdirSync(logs) : []) {
  const full = path.join(logs, f);
  if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
}
