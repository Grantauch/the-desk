const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
require('../public/hubs/checkling/camp/engine.js');
const E = globalThis.FirstTrail;
const baseline = require('../docs/checklings/founder-art-baseline.json');
const root = path.resolve(__dirname,'..');

test('the playable founder roster remains the four preserved identities', () => {
  assert.deepEqual(E.IDS,['mochi','bolt','zee','ember']);
  assert.deepEqual(baseline.species,E.IDS);
  assert.deepEqual(E.IDS.map(id=>E.SPECIES[id].name),['Mochi','Bolt','Zee','Ember']);
  assert.equal(baseline.files.length,8);
  assert.equal(new Set(baseline.files.map(file=>file.file)).size,8);
});
for (const entry of baseline.files) test('original founder image unchanged: '+entry.file, () => {
  const expected = E.IDS.flatMap(id=>['png','gif'].map(ext=>'public/hubs/checkling/camp/assets/'+id+'.'+ext));
  assert.ok(expected.includes(entry.file),'only the eight preserved founder images belong in this baseline');
  const resolved=path.resolve(root,entry.file);
  assert.ok(resolved.startsWith(root+path.sep));
  const bytes=fs.readFileSync(resolved);
  assert.equal(bytes.length,entry.bytes);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256,'preserve original artwork; use a separately reviewed new asset');
});
