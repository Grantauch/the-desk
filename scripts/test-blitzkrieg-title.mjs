import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const html = readFileSync(new URL('../public/hubs/blitzkrieg/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/hubs/blitzkrieg/style.css', import.meta.url), 'utf8');
const one = id => [...html.matchAll(new RegExp('id="' + id + '"', 'g'))].length;

test('command-table presentation preserves original playable menu controls', () => {
  for (const id of ['stage', 'game', 'title', 'b-play', 'b-command', 'b-notes', 'b-sound',
    'b-music', 'b-gore', 'maps', 'hud', 'brief']) {
    assert.equal(one(id), 1, id + ' stays present exactly once');
  }
  assert.match(html, /<h1>BLITZKRIEG<\/h1>/);
  assert.match(html, /<div class="title-layout">/);
  assert.equal(one('field-report-title'), 1);
  assert.equal((html.match(/field-report__number">0[1-3]</g) || []).length, 3);
  assert.match(html, /HISTORICAL SETTING · GAME SCENARIOS/);
});

test('briefing is a semantic, local, no-synthetic-art presentation', () => {
  const start = html.indexOf('<aside class="field-report"');
  const end = html.indexOf('</aside>', start);
  assert.ok(start > -1 && end > start, 'briefing panel exists');
  const panel = html.slice(start, end);
  assert.doesNotMatch(panel, /<(?:img|svg|canvas|script)\b/i, 'no raster or SVG stage decorations in briefing');
  assert.match(panel, /<ol class="field-report__steps">/);
  assert.match(panel, /aria-labelledby="field-report-title"/);
  assert.match(css, /#title \.field-report/);
  assert.match(css, /#title \.menu button:focus-visible/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
