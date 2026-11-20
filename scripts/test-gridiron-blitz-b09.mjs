import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve(process.cwd(),process.argv.includes('--dist')?'dist':'public');
const game=await readFile(resolve(root,'hubs/gridiron-blitz/index.html'),'utf8');
const privacy=await readFile(resolve(root,'hubs/gridiron-blitz/privacy.html'),'utf8');
const consoleStyles=await readFile(resolve(root,'hubs/gridiron-blitz/console-ui.css'),'utf8');
const catalog=await readFile(resolve(process.cwd(),'src/data/interactiveExperiences.ts'),'utf8');

test('Gridiron is a complete self-contained route',async()=>{
  assert.ok((await stat(resolve(root,'hubs/gridiron-blitz/index.html'))).size>150000);
  for(const key of ['id="playBtn"','id="field"','id="stiffBtn"','gridiron_blitz_progression_v1'])assert.ok(game.includes(key),key);
});
test('Privacy defaults disable external analytics and unverified leaderboards',()=>{
  assert.doesNotMatch(game,/<script[^>]+src=/i);
  assert.doesNotMatch(game,/fetch\(\s*['"`]https?:\/\//i);
  assert.match(privacy,/No account\. No leaderboard\. No tracking endpoint/);
});
test('Pre-release metadata and privacy route are present',()=>{
  assert.match(game,/href="\.\/privacy.html"/);
  assert.match(game,/noindex,nofollow/);
  assert.match(game,/https:\/\/grant-desk.com\/hubs\/gridiron-blitz\//);
});
test('Game catalog includes exactly one Gridiron entry',()=>{
  assert.equal(catalog.split("name: 'gridiron blitz · breakaway'").length-1,1);
  assert.match(catalog,/href: '\/hubs\/gridiron-blitz\/'/);
});
test('B10 accessibility polish preserves keyboard and no-JS recovery',()=>{
  assert.match(game,/<noscript>/i);
  assert.match(game,/JavaScript is required to play/);
  assert.equal((game.match(/<h1\b/g)||[]).length,1,'Keep a single page heading for site validation');
  assert.match(game,/href="\.\/privacy\.html"/);
  assert.match(game,/\.pause-button\{min-width:44px;width:44px;min-height:44px\}/);
  assert.match(game,/\.pause-button\{width:44px;min-width:44px;min-height:45px;padding:7px\}/);
  assert.match(privacy,/Support and troubleshooting/);
  assert.match(privacy,/Please do not send school PINs or passwords/);
});

test('B10C console tile navigation and styling survive the website build',()=>{
  assert.match(game,/href="\.\/console-ui\.css"/);
  assert.match(game,/class="console-topbar"/);
  assert.match(game,/class="console-footer"/);
  assert.match(game,/stopImmediatePropagation\(\)/);
  assert.match(consoleStyles,/\.mode-choice\[aria-pressed="true"\]/);
  assert.match(consoleStyles,/\.aside-nav button/);
  assert.match(consoleStyles,/@media\(max-width:680px\)/);
});
