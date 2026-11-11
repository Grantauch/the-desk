import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { HISTORY, newsFromPayload, pointFromLatLon } from '../public/atlas/story-data.mjs';
import { countryAt } from '../public/atlas/atlas-countries.mjs';
import { ORBITAL_EVENTS, createOrbitalPlayback, eligibleEvents } from '../public/atlas/orbital-events.mjs';
import atlasClouds from '../netlify/functions/atlas-clouds.mjs';

const now = Date.parse('2026-11-09T17:00:00Z');
const article = (overrides = {}) => ({ title: 'Berlin opens a new exhibition', href: 'https://www.npr.org/fixture', published: '2026-11-09T12:00:00Z', ...overrides });
const payload = stories => ({ groups: [{ name: 'NPR', stories }] });

test('the atlas pins point to existing public lessons and real coordinate ranges', () => {
  assert.equal(new Set(HISTORY.map(story => story.id)).size, HISTORY.length);
  for (const story of HISTORY) {
    assert.ok(story.lat >= -90 && story.lat <= 90 && story.lon >= -180 && story.lon <= 180);
    assert.ok(['', '.html', '/index.html'].some(suffix =>
      existsSync(new URL(`../public${story.href}${suffix}`, import.meta.url))), story.href);
    if (story.art) assert.ok(existsSync(new URL(`../public${story.art}`, import.meta.url)));
  }
});

test('latitude and longitude use the same orientation as equirectangular Earth imagery', () => {
  const near = (a,b) => assert.ok(Math.abs(a-b) < 1e-9);
  pointFromLatLon(0,0).forEach((v,i)=>near(v,[1,0,0][i]));
  pointFromLatLon(0,90).forEach((v,i)=>near(v,[0,0,-1][i]));
  pointFromLatLon(90,0).forEach((v,i)=>near(v,[0,1,0][i]));
});

test('recent reporting keeps its publisher, original URL and date without publisher images', () => {
  const result = newsFromPayload(payload([article({ image: 'https://copyright-photo.example/file.jpg' })]), now);
  assert.equal(result.stories.length,1);
  assert.equal(result.stories[0].place,'Berlin');
  assert.equal(result.stories[0].source,'NPR');
  assert.equal(result.stories[0].published,'2026-11-09T12:00:00.000Z');
  assert.equal('image' in result.stories[0],false);
});

test('unknown, conflicting and known ambiguous place names are left unplaced', () => {
  const stories = [article({title:'A global economic outlook'}),article({title:'London and Paris discuss the arts',href:'https://www.npr.org/two'}),article({title:'Paris, Texas opens an exhibition',href:'https://www.npr.org/ambiguous'}),article({title:'London, Ontario opens an exhibition',href:'https://www.npr.org/ambiguous2'})];
  const result=newsFromPayload(payload(stories),now);
  assert.equal(result.stories.length,0);assert.equal(result.unplaced,4);
});

test('named airports map locally and broad regional headlines carry an approximate pin label', () => {
  const result=newsFromPayload(payload([
    article({title:'Close call at LAX airport',href:'https://www.npr.org/airport'}),
    article({title:'California voters weigh a ballot measure',href:'https://www.npr.org/california'}),
    article({title:'France accuses Iran in new report',href:'https://www.npr.org/multiple'}),
  ]),now);
  assert.equal(result.stories[0].place,'Los Angeles International Airport');
  assert.equal(result.stories[1].place,'California · approximate region');
  assert.match(result.stories[1].summary,/approximate center/);
  assert.equal(result.unplaced,1);
});

test('unsafe and spoofed sources, missing dates, stale dates and future dates produce no pins', () => {
  for(const overrides of [
    {href:'javascript:alert(1)'},{href:'http://www.npr.org/fixture'},
    {href:'https://npr.org.attacker.example/fixture'},{href:'https://user:pass@www.npr.org/fixture'},
    {published:''},{published:'invalid'},{published:'2026-10-01T12:00:00Z'},
    {published:'2027-01-01T12:00:00Z'},
  ])assert.equal(newsFromPayload(payload([article(overrides)]),now).stories.length,0,JSON.stringify(overrides));
  assert.equal(newsFromPayload({groups:[{name:'Unverified publisher',stories:[article()]}]},now).stories.length,0);
});

test('deduplication and payload caps keep repeated feeds bounded', () => {
  assert.equal(newsFromPayload(payload([article(),article()]),now).stories.length,1);
  const stories=Array.from({length:40},(_,i)=>article({href:`https://www.npr.org/fixture-${i}`}));
  assert.equal(newsFromPayload(payload(stories),now).stories.length,18);
  for(const value of [null,{},[],{groups:[null]},payload([null,{}])])assert.deepEqual(newsFromPayload(value,now),{stories:[],unplaced:0});
});

test('the Blender portrait, live textures and largest course illustrations fit the asset budget',()=>{
  const files=['earth-color.jpg','cloud-mask.jpg','earth-normal.webp','earth-relief.bin','globe-portrait.webp','sky-grain.svg','us-history.webp','hidden-history.webp','beyond-the-scoreboard.webp'];
  const bytes=files.reduce((n,name)=>n+statSync(new URL(`../public/atlas/${name}`,import.meta.url)).size,0);
  assert.ok(bytes < 2_000_000,`${bytes} asset bytes exceeds the 2 MB budget`);
  assert.equal(statSync(new URL('../public/atlas/earth-relief.bin',import.meta.url)).size,145*97);
  const detail=['earth-detail.webp','us-history-1440.avif','hidden-history-1440.avif','beyond-the-scoreboard-1440.avif'];
  const extra=detail.reduce((n,name)=>n+statSync(new URL(`../public/atlas/${name}`,import.meta.url)).size,0);
  assert.ok(extra < 2_100_000,`${extra} optional detail bytes exceeds the 2.1 MB budget`);
});

test('satellite relay serves a bounded image and rejects upstream errors', async t=>{
  const url='https://example.test/.netlify/functions/atlas-clouds';
  let contentType='image/jpeg';
  const fetch=t.mock.method(globalThis,'fetch',async endpoint=>{
    assert.equal(endpoint,'https://clouds.matteason.co.uk/images/2048x1024/clouds.jpg');
    return new Response(Uint8Array.from([255,216,255,217]),{headers:{'Content-Type':contentType}});
  });
  assert.equal((await atlasClouds(new Request(url,{method:'POST'}))).status,405);
  assert.equal(fetch.mock.callCount(),0);
  const image=await atlasClouds(new Request(url));
  assert.equal(image.status,200);
  assert.equal(image.headers.get('content-type'),'image/jpeg');
  assert.match(image.headers.get('netlify-cdn-cache-control'),/s-maxage=900/);
  contentType='text/html';
  const unavailable=await atlasClouds(new Request(url));
  assert.equal(unavailable.status,503);
  assert.equal(unavailable.headers.get('cache-control'),'no-store');
});

test('satellite relay cancels an oversized stream without a content length', async t=>{
  const chunks = [Uint8Array.of(255, 216), new Uint8Array(1_000_000), Uint8Array.of(255, 217)];
  let pulled = 0;
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) {
      if (pulled === chunks.length) controller.close();
      else controller.enqueue(chunks[pulled++]);
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  t.mock.method(globalThis, 'fetch', async () =>
    new Response(body, { headers: { 'Content-Type': 'image/jpeg' } }));

  const result = await atlasClouds(new Request('https://example.test/.netlify/functions/atlas-clouds'));
  assert.equal(result.status, 503);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal(cancelled, true);
  assert.equal(pulled, 2);
});

test('country picking honors the dateline, ocean, and the selected historical map', () => {
  const modern = JSON.parse(readFileSync(new URL('../public/atlas/countries.json', import.meta.url)));
  const historical = JSON.parse(readFileSync(new URL('../public/atlas/history/1914.json', import.meta.url)));
  assert.equal(countryAt(modern, 16.37, 48.21)?.[0], 'Austria');
  assert.equal(countryAt(historical, 16.37, 48.21)?.[0], 'Austro-Hungarian Empire');
  assert.equal(countryAt(modern, 139.69, 35.68)?.[0], 'Japan');
  for (const lon of [-179.9, 179.9]) assert.equal(countryAt(modern, lon, -16.2)?.[0], 'Fiji');
  assert.equal(countryAt(modern, -140, 0), undefined);
});

test('orbital autoplay chooses only visible, year-eligible scenes and rotates when none are in view', () => {
  assert.equal(ORBITAL_EVENTS.length, 7);
  assert.equal(new Set(ORBITAL_EVENTS.map(event => event.effect)).size, 7);
  assert.deepEqual(eligibleEvents(1914).map(event => event.id), ['thunderstorm']);
  const playback = createOrbitalPlayback(() => 0);
  const tick = overrides => playback.tick({
    dt: 6, year: 2026, auto: true, blocked: false, still: false, visible: () => false, ...overrides,
  });
  assert.equal(tick({}).rotate, true);
  assert.equal(tick({ visible: event => event.id === 'katrina' }).scene.id, 'katrina');
  assert.equal(tick({ year: 1969 }).scene, null);
  assert.equal(tick({ year: 1969, visible: event => event.id === 'katrina' }).rotate, true);
  assert.equal(tick({ blocked: true }).rotate, false);
});

test('orbital playback shuffles without repeats and offers a static reduced-motion replay', () => {
  const playback = createOrbitalPlayback(() => 0);
  const tick = overrides => playback.tick({
    dt: 20, year: 2026, auto: true, blocked: false, still: false, visible: () => true, ...overrides,
  });
  const seen = Array.from({ length: 7 }, () => tick({}).scene.id);
  assert.equal(new Set(seen).size, 7);
  assert.notEqual(tick({}).scene.id, seen.at(-1));
  playback.stop();
  assert.equal(tick({ still: true }).scene, null);
  playback.replay(ORBITAL_EVENTS[5], true);
  const still = tick({ still: true, auto: false });
  assert.equal(still.scene.id, 'eclipse');
  assert.equal(still.progress, .62);
  assert.equal(tick({ still: true, blocked: true }).scene, null);
});
