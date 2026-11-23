const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const script = read('public/storyhub/subday-20260908/storyhub-art.js');
const marker = 'data-preserve-story-art';

for (const [story, count, diagram] of [
  ['bts-s01-the-death-harvest', 1, true],
  ['hh-s01-the-desk-it-stopped-at', 2, false],
  ['ush9-s01-the-margin', 2, false],
]) {
  test(`${story} marks its ${count} authored evidence figures`, () => {
    const html = read(`public/hubs/${story}.html`);
    const figures = html.match(/<figure[^>]*\bdata-archive-media\b[^>]*>/g) ?? [];
    assert.equal(figures.length, count);
    assert.ok(figures.every(figure => figure.includes(marker)));
    const marked = html.match(/<(?:div|figure)[^>]*\bdata-preserve-story-art\b[^>]*>/g) ?? [];
    assert.equal(marked.length, count + Number(diagram));
    if (diagram) assert.match(html, /<div class="plate rules-measure" data-preserve-story-art[^>]+1905[^>]+1906[^>]*>/);
  });
}

function simulate(story, preserveHero) {
  const generated = [];
  function node(protectedNode = false) {
    return {
      children: [],
      hasAttribute: name => protectedNode && name === marker,
      replaced: [],
      inserted: [],
      replaceWith(value) { this.replaced.push(value); },
      insertAdjacentElement(where, value) { this.inserted.push({ where, value }); },
      append(...values) { this.children.push(...values); },
    };
  }

  const hero = node(preserveHero);
  const marked = { plate: node(true), heading: node() };
  const regular = { plate: node(), heading: node() };
  const noPlate = { heading: node() };
  const sections = [marked, regular, noPlate].map(({ plate, heading }) => ({
    querySelector: key => ({ '.plate': plate, '.wrap h2': heading })[key] ?? null,
  }));
  const extra = node();
  extra.textContent = 'How far can this document carry you?';
  vm.runInNewContext(script, {
    document: {
      body: { dataset: { story } },
      querySelector: key => key === '.heroGrid'
        ? { firstElementChild: node(), lastElementChild: hero } : null,
      querySelectorAll: key => ({
        'section.story': sections, '.instrument h3': [extra],
      })[key] ?? [],
      createElement: tag => {
        if (tag === 'figure') generated.push(tag);
        return node();
      },
    },
  });
  return { hero, marked, regular, noPlate, extra, generated };
}

test('keeps marked hero and chapter nodes without creating redundant visuals', () => {
  const { hero, marked, regular, noPlate, extra, generated } =
    simulate('hh-s01-the-desk-it-stopped-at', true);
  assert.equal(hero.replaced.length, 0);
  assert.equal(marked.plate.replaced.length, 0);
  assert.equal(marked.heading.inserted.length, 0);

  assert.equal(regular.plate.replaced.length, 1);
  assert.equal(noPlate.heading.inserted.length, 1);
  assert.equal(extra.inserted.length, 1);
  assert.equal(generated.length, 3);
  const captions = regular.plate.replaced[0].children[1].children;
  assert.equal(captions[1].textContent, 'Generated visual reconstruction — not archival evidence.');
});

test('leaves original generated treatment for an unmarked hero', () => {
  const { hero, generated } = simulate('bts-s01-the-death-harvest', false);
  assert.equal(hero.replaced.length, 1);
  assert.equal(hero.replaced[0].children[0].loading, 'eager');
  assert.equal(generated.length, 3);
});
