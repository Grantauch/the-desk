import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handler } from '../netlify/functions/curiosity.mjs';

const originalFetch = globalThis.fetch;
const component = await readFile(new URL('../src/components/CuriosityDesk.astro', import.meta.url), 'utf8');
try {
  let requested;
  globalThis.fetch = async url => {
    requested = new URL(url);
    return { ok: true, json: async () => ({ results: [{
      title: 'Unidentified people, fixture', url: 'https://www.loc.gov/item/fixture/',
      image_url: ['https://tile.loc.gov/fixture.jpg'], description: ['Fixture catalog description.'],
    }] }) };
  };
  const result = await handler({ queryStringParameters: { collection: 'mysteries' } });
  assert.equal(result.statusCode, 200);
  assert.equal(requested.searchParams.get('q'), 'unidentified people');
  assert.ok(component.includes("query: 'unidentified people'"), 'direct browser fallback uses the same working query');
  assert.equal(JSON.parse(result.body).items.length, 1);
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ results: [] }) });
  const empty = await handler({ queryStringParameters: { collection: 'mysteries' } });
  assert.equal(empty.statusCode, 502);
  assert.equal(empty.headers['Cache-Control'], 'no-store', 'empty collections cannot be cached for a day');
  globalThis.fetch = async () => { throw new Error('catalog offline'); };
  const offline = await handler({ queryStringParameters: { collection: 'mysteries' } });
  assert.equal(offline.statusCode, 502);
  assert.deepEqual(JSON.parse(offline.body).items, []);
  assert.equal((await handler({ queryStringParameters: { collection: 'unknown' } })).statusCode, 400);
  console.log('PASS Curiosity mysteries: usable records, matching fallback, empty/offline no-store, invalid collection');
} finally {
  globalThis.fetch = originalFetch;
}
