import assert from 'node:assert/strict';
import test from 'node:test';
import { launchOfflinePreviewChrome } from './chrome-startup.mjs';

/** Fake process/filesystem: these tests never launch a real browser or network. */
function harness(outcomes, options = {}) {
  const children = [];
  const removed = [];
  const args = [];
  const reads = new Map();
  let index = 0;
  const impl = {
    chrome: '/synthetic-only/fake-chrome',
    makeProfile: async () => 'fictional-profile-' + index++,
    spawnChrome: (_binary, command, spawnOptions) => {
      args.push({ command, spawnOptions });
      if (options.throwFirstSpawn && children.length === 0) {
        children.push({ threw: true, killed: true });
        throw new Error('synthetic missing executable');
      }
      const child = {
        exitCode: options.exitFirst && children.length === 0 ? 1 : null,
        signalCode: null,
        killed: false,
        listeners: {},
        on(name, fn) { this.listeners[name] = fn; },
        kill() { this.killed = true; },
      };
      children.push(child);
      return child;
    },
    readPort: async (profile) => {
      const profileNumber = Number(profile.split('-').at(-1));
      const seq = outcomes[profileNumber] ?? [];
      const pos = reads.get(profileNumber) ?? 0;
      reads.set(profileNumber, pos + 1);
      const result = seq[Math.min(pos, seq.length - 1)];
      if (result instanceof Error || result === undefined) throw result ?? new Error('port not ready');
      return result;
    },
    remove: async (profile) => { removed.push(profile); },
    pause: async () => {},
    pollsPerAttempt: 2,
  };
  return { impl, children, removed, args, reads };
}

test('SW-189 immediately accepts valid Chrome DevTools port and closes idempotently', async () => {
  const h = harness([['43123\n127.0.0.1']]);
  const browser = await launchOfflinePreviewChrome(h.impl);
  assert.equal(browser.port, '43123');
  assert.equal(browser.profile, 'fictional-profile-0');
  assert.equal(h.children.length, 1);
  assert.equal(h.args[0].spawnOptions.stdio, 'ignore');
  assert.ok(h.args[0].command.includes('--disable-background-networking'));
  assert.ok(h.args[0].command.includes('--disable-dev-shm-usage'));
  assert.ok(h.args[0].command.includes('--user-data-dir=fictional-profile-0'));
  assert.ok(h.args[0].command.includes('--remote-debugging-port=0'));
  await browser.close();
  await browser.close();
  assert.equal(h.children[0].killed, true);
  assert.deepEqual(h.removed, ['fictional-profile-0']);
});

test('SW-189 retries Chrome startup once with a fresh disposable profile', async () => {
  const h = harness([[new Error('not written'), new Error('still booting')], [new Error('not written'), '51234\n']]);
  const browser = await launchOfflinePreviewChrome(h.impl);
  assert.equal(browser.port, '51234');
  assert.deepEqual(h.removed, ['fictional-profile-0']);
  assert.equal(h.children[0].killed, true);
  assert.equal(h.children[1].killed, false);
  assert.ok(h.args[1].command.includes('--user-data-dir=fictional-profile-1'));
  assert.equal(h.children.length, 2);
  await browser.close();
  assert.deepEqual(h.removed, ['fictional-profile-0', 'fictional-profile-1']);
  assert.equal(h.children[1].killed, true);
});

test('SW-189 startup missing on both attempts fails closed and cleans both profiles', async () => {
  const h = harness([[], []]);
  await assert.rejects(launchOfflinePreviewChrome(h.impl),
    /Isolated Chrome DevTools endpoint did not start after bounded attempts/);
  assert.deepEqual(h.removed, ['fictional-profile-0', 'fictional-profile-1']);
  assert.ok(h.children.every(child => child.killed));
  assert.deepEqual([...h.reads.values()], [2, 2]);
});

test('SW-189 refuses untrusted or invalid debugging port values', async () => {
  for (const invalid of ['0', '-1', '65536', '00080', 'abc', '1234;rm -rf /', '']) {
    const h = harness([[invalid], [invalid]]);
    await assert.rejects(launchOfflinePreviewChrome(h.impl),
      /Isolated Chrome DevTools endpoint did not start/);
    assert.equal(h.children.length, 2);
    assert.equal(h.removed.length, 2);
  }
});

test('SW-189 an exited process is cleaned and retried without waiting for all polls', async () => {
  const h = harness([[], ['39123']], { exitFirst: true });
  const browser = await launchOfflinePreviewChrome(h.impl);
  assert.equal(browser.port, '39123');
  assert.equal(h.reads.get(0), 1);
  assert.equal(h.children[0].killed, true);
  await browser.close();
});

test('SW-189 synchronous process-launch exceptions are bounded and cleaned', async () => {
  const h = harness([[], ['41234']], { throwFirstSpawn: true });
  const browser = await launchOfflinePreviewChrome(h.impl);
  assert.equal(browser.port, '41234');
  assert.deepEqual(h.removed, ['fictional-profile-0']);
  await browser.close();
  assert.deepEqual(h.removed, ['fictional-profile-0', 'fictional-profile-1']);
});

test('SW-189 rejects unsafe retry and poll configurations', async () => {
  for (const invalid of [
    { attempts: 0 }, { attempts: 3 }, { attempts: 1.5 },
    { pollsPerAttempt: 0 }, { pollsPerAttempt: 201 },
  ]) {
    const h = harness([['32145']]);
    await assert.rejects(launchOfflinePreviewChrome({ ...h.impl, ...invalid }),
      /Offline preview browser launch options rejected/);
    assert.equal(h.children.length, 0);
  }
});

test('SW-189 default fails rather than suppressing a persistent executable error', async () => {
  const h = harness([[], []], { exitFirst: true });
  await assert.rejects(launchOfflinePreviewChrome(h.impl),
    /Isolated Chrome DevTools endpoint did not start/);
  assert.equal(h.children.length, 2);
  assert.equal(h.removed.length, 2);
});


test('SW-189 profile cleanup failures are visible, not silently treated as a pass', async () => {
  const h = harness([['41234']]);
  h.impl.remove = async () => { throw new Error('fictional profile lock'); };
  const browser = await launchOfflinePreviewChrome(h.impl);
  await assert.rejects(browser.close(), /Offline preview browser profile cleanup failed/);
  assert.equal(h.children[0].killed, true);
});
