const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness(saved, blocked = false) {
  const handlers = new Map();
  const player = {
    paused: true, volume: 1, currentTime: 0, playCalls: 0, blocked,
    set src(value) { this.source = value; this.currentTime = 0; this.paused = true; },
    get src() { return this.source; },
    play() {
      this.playCalls++;
      if (this.blocked) return Promise.reject(new Error('NotAllowedError'));
      this.paused = false;
      return Promise.resolve();
    },
    pause() { this.paused = true; },
    addEventListener(event, callback) { handlers.set(event, callback); },
    finish() { this.paused = true; handlers.get('ended')(); },
    fail() { this.paused = true; handlers.get('error')(); },
  };
  const storage = new Map(saved ? [['bk-audio', JSON.stringify(saved)]] : []);
  const sandbox = {
    window: { BK: {} }, document: { getElementById: () => player },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    Math, setInterval: () => { throw new Error('The synthesized music scheduler must not run.'); },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/hubs/blacktop-kings/audio.js'), 'utf8'), sandbox);
  return {audio: sandbox.window.BK.audio, player, storage};
}

async function main() {
  const {audio, player, storage} = harness();
  audio.music('menu');
  assert.ok(player.src.endsWith('/the-asphalt-throne.mp3'));
  assert.equal(player.paused, false);
  player.currentTime = 43;
  const calls = player.playCalls;
  for (const screen of ['game', 'crown', 'menu']) audio.music(screen);
  assert.equal(player.currentTime, 43, 'Changing screens must not restart a song.');
  assert.equal(player.playCalls, calls, 'Already-playing music must not overlap.');
  player.finish();
  assert.ok(player.src.endsWith('/canvas-on-the-concrete.mp3'));
  assert.equal(player.paused, false);
  player.finish();
  assert.ok(player.src.endsWith('/the-asphalt-throne.mp3'));
  audio.set('music', 0.27);
  assert.equal(player.volume, 0.27, 'Volume works without a Web Audio context.');
  player.currentTime = 21;
  audio.set('on', false);
  assert.equal(player.paused, true);
  assert.equal(player.muted, true);
  audio.music('game');
  assert.equal(player.paused, true, 'Navigation must respect muted sound.');
  audio.set('on', true);
  assert.equal(player.paused, false);
  assert.equal(player.currentTime, 21, 'Unmuting resumes at the same position.');
  assert.equal(JSON.parse(storage.get('bk-audio')).music, 0.27);
  audio.music(null);
  audio.unlock();
  assert.equal(player.paused, true, 'An explicit stop must stay stopped.');

  const muted = harness({on:false, music:0.4});
  muted.audio.music('menu');
  assert.equal(muted.player.playCalls, 0, 'Saved sound-off preference must be respected.');
  muted.audio.set('on', true);
  assert.ok(muted.player.src.endsWith('/the-asphalt-throne.mp3'));
  assert.equal(muted.player.paused, false);

  const restricted = harness(null, true);
  restricted.audio.music('menu');
  await Promise.resolve();
  assert.equal(restricted.player.paused, true);
  restricted.player.blocked = false;
  restricted.audio.unlock();
  assert.equal(restricted.player.paused, false, 'A gesture retries browser-blocked playback.');

  const broken = harness();
  broken.audio.music('menu');
  broken.player.fail();
  assert.ok(broken.player.src.endsWith('/canvas-on-the-concrete.mp3'));
  broken.player.fail();
  const failedCalls = broken.player.playCalls;
  broken.player.fail();
  assert.equal(broken.player.playCalls, failedCalls, 'Missing tracks must not create a retry loop.');

  for (const file of ['the-asphalt-throne.mp3', 'canvas-on-the-concrete.mp3']) {
    const bytes = fs.readFileSync(path.join(__dirname, '../public/hubs/blacktop-kings/music', file));
    assert.ok(bytes.length > 100000, 'The soundtrack must include the actual audio files.');
  }
  console.log('Blacktop soundtrack checks passed: order, loop, continuity, mute/resume, volume, autoplay retry and load errors.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
