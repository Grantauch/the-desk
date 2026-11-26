import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handler, normalizeLocResults } from '../netlify/functions/curiosity.mjs';
import archiveRecords from '../src/data/curiosity-archive.json' with { type: 'json' };

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
  assert.equal(JSON.parse(result.body).mode, 'live');
  const liveFetch = globalThis.fetch;
  const fixture = { title: 'Fixture', url: 'https://www.loc.gov/item/fixture/', image_url: ['https://tile.loc.gov/fixture.jpg'] };
  for (const [failure, fetchResult] of [
    ['empty', async () => ({ ok: true, json: async () => ({ results: [] }) })],
    ['offline', async () => { throw new Error('catalog offline'); }],
    ['upstream error', async () => ({ ok: false, status: 429 })],
    ['invalid JSON', async () => ({ ok: true, json: async () => { throw new SyntaxError(); } })],
    ['restricted', async () => ({ ok: true, json: async () => ({ results: [{ ...fixture, access_restricted: true }] }) })],
  ]) {
    globalThis.fetch = fetchResult;
    for (const collection of Object.keys(archiveRecords)) {
      const fallback = await handler({ queryStringParameters: { collection } });
      assert.equal(fallback.statusCode, 200, `${failure}: ${collection} remains usable`);
      assert.equal(fallback.headers['Cache-Control'], 'no-store', 'an outage must not mask catalog recovery in a day-long cache');
      const payload = JSON.parse(fallback.body);
      assert.equal(payload.collection, collection);
      assert.equal(payload.mode, 'archive', 'selected records must never be labeled live');
      assert.equal(payload.items.length, 1);
      for (const field of ['source', 'record', 'image', 'question', 'context', 'credit']) {
        assert.equal(payload.items[0][field], archiveRecords[collection][field], `reuse existing reviewed ${field}`);
      }
    }
  }
  globalThis.fetch = liveFetch;
  assert.equal(JSON.parse((await handler({ queryStringParameters: { collection: 'mysteries' } })).body).mode, 'live', 'recovery takes effect on the next request');
  globalThis.fetch = () => { throw new Error('invalid collection must not fetch'); };
  for (const collection of ['unknown', '__proto__', 'constructor', 'toString']) {
    assert.equal((await handler({ queryStringParameters: { collection } })).statusCode, 400);
    assert.deepEqual(normalizeLocResults({ results: [fixture] }, collection), []);
  }
  assert.equal((await handler({})).statusCode, 400);
  console.log('PASS Curiosity: live preference, five-collection fallback, recovery, no-store, invalid collections');
} finally {
  globalThis.fetch = originalFetch;
}
