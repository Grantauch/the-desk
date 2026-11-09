import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, statSync } from 'node:fs';
import { HISTORY, newsFromPayload, pointFromLatLon } from '../public/atlas/story-data.mjs';

const now = Date.parse('2026-11-09T17:00:00Z');
const article = (overrides = {}) => ({ title: 'Berlin opens a new exhibition', href: 'https://www.npr.org/fixture', published: '2026-11-09T12:00:00Z', ...overrides });
const payload = stories => ({ groups: [{ name: 'NPR', stories }] });

test('the atlas pins point to existing public lessons and real coordinate ranges', () => {
  assert.equal(new Set(HISTORY.map(story => story.id)).size, HISTORY.length);
  for (const story of HISTORY) {
    assert.ok(story.lat >= -90 && story.lat <= 90 && story.lon >= -180 && story.lon <= 180);
    const path = new URL(`../public${story.href}`, import.meta.url);
    assert.ok(existsSync(path) || existsSync(`${path.pathname}.html`) || existsSync(`${path.pathname}/index.html`), story.href);
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

test('local texture and illustration delivery stays below the initial asset budget',()=>{
  const files=['earth-color.jpg','cloud-mask.jpg','earth-normal.webp','us-history.webp','hidden-history.webp','beyond-the-scoreboard.webp'];
  const bytes=files.reduce((n,name)=>n+statSync(new URL(`../public/atlas/${name}`,import.meta.url)).size,0);
  assert.ok(bytes < 2_000_000,`${bytes} asset bytes exceeds the 2 MB budget`);
});
