const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const requests = [], events = [];
class MockImage {
  constructor() { requests.push(this); }
  set src(value) { this.url = value; }
}
const sandbox = { URL, Map, Promise, Image: MockImage,
  CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
  document: { currentScript: { src: 'https://example.test/hubs/blacktop-kings/assets.js' } },
  window: { BK: {}, dispatchEvent(event) { events.push(event); } },
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/hubs/blacktop-kings/assets.js'), 'utf8'), sandbox);
const assets = sandbox.window.BK.assets;
(async () => {
  assert.equal(requests.length, 0, 'Loading the module must not eagerly download every court');
  assert.equal(Object.keys(assets.catalog).length, 23);
  let bytes = 0;
  for (const [key, file] of Object.entries(assets.catalog)) {
    const relative = new URL(assets.url(key)).pathname.split('/assets/')[1];
    const full = path.join(__dirname, '../public/hubs/blacktop-kings/assets', relative);
    const data = fs.readFileSync(full); bytes += data.length;
    assert.equal(data.toString('ascii', 0, 4), 'RIFF');
    assert.equal(data.toString('ascii', 8, 12), 'WEBP');
    assert.ok(data.length < 500000, `${file} exceeds the per-image budget`);
  }
  assert.ok(bytes < 6000000, 'Both image batches should remain under 6 MB');
  const court = { id: 'lot', scene: 'lot' };
  assets.ensureCourt(court); assets.ensureCourt(court);
  assert.equal(requests.length, 2, 'The same court reuses its pending scenery and texture requests');
  assert.equal(assets.get('court-lot'), null, 'Pending images leave original drawing available');
  assert.ok(requests[0].url.endsWith('/lot-backdrop-v1.webp'));
  assert.ok(requests[1].url.endsWith('/asphalt-surface-v1.webp'));
  const ready = assets.load('court-lot'); requests[0].onload();
  assert.equal(await ready, requests[0]);
  assert.equal(assets.get('court-lot'), requests[0]);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'bk-art-ready');
  assert.equal(events[0].detail.key, 'court-lot');
  const failed = assets.load('surface-asphalt'); requests[1].onerror();
  assert.equal(await failed, null, 'Image failure resolves to original-art fallback');
  assert.equal(assets.get('surface-asphalt'), null);
  assets.ensureCourt(court); assert.equal(requests.length, 2, 'Failure must not cause a repeated request loop');
  assert.equal(await assets.load('unknown'), null);
  assert.equal(assets.surface({ scene: 'gym' }), 'wood');
  assert.equal(assets.surface({ scene: 'beach' }), 'painted');
  const menu = assets.load('mode-quick'); assets.load('mode-quick');
  assert.equal(requests.length, 3, 'Menu art uses the same deduplicated loader');
  assert.ok(requests[2].url.endsWith('/generated-v2/mode-quick-v2.webp'));
  requests[2].onerror(); assert.equal(await menu, null);
  assert.equal(assets.get('mode-quick'), null, 'Failed menu art retains its canvas fallback');
  assert.ok(assets.url('arch-slasher').endsWith('/generated-v2/arch-slasher-v2.webp'));
  assert.ok(assets.url('ball').endsWith('/generated-v2/ball-v2.webp'));
  assert.equal(assets.url('unknown'), '');
  console.log(`Blacktop assets: 23 WebP files (${bytes} bytes), lazy loading, deduplication, repaint events and failure fallback passed.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
