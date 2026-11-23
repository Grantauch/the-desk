/**
 * SW-189 — ephemeral browser startup only for the fictional offline teacher
 * PRELAUNCH preview. Never connects to a school service or student data.
 *
 * The browser test itself remains fail-closed: this helper may retry *startup*
 * once in a fresh profile, but must never skip a failed page/behavior assertion.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sleep = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));
const createProfile = () => mkdtemp(join(tmpdir(), 'schoolwide-preview-qa-'));
const readPortFile = profile => readFile(join(profile, 'DevToolsActivePort'), 'utf8');
const removeProfile = profile => rm(profile, {
  recursive: true, force: true, maxRetries: 8, retryDelay: 100,
});

function isValidPort(port) {
  if (typeof port !== 'string' || !/^[1-9][0-9]{0,4}$/.test(port)) return false;
  return Number(port) <= 65535;
}

/**
 * Dependency injection is limited to the test harness. In CI the defaults
 * launch a real, isolated Chrome process with zero external network access.
 */
export async function launchOfflinePreviewChrome({
  chrome,
  spawnChrome = spawn,
  makeProfile = createProfile,
  readPort = readPortFile,
  remove = removeProfile,
  pause = sleep,
  attempts = 2,
  pollsPerAttempt = 150,
} = {}) {
  if (typeof chrome !== 'string' || !chrome ||
      !Number.isInteger(attempts) || attempts < 1 || attempts > 2 ||
      !Number.isInteger(pollsPerAttempt) || pollsPerAttempt < 1 || pollsPerAttempt > 200) {
    throw new Error('Offline preview browser launch options rejected.');
  }

  for (let attempt = 0; attempt < attempts; attempt++) {
    const profile = await makeProfile();
    let child;
    let failed = false;
    let closed = false;

    const close = async () => {
      if (closed) return;
      closed = true;
      try { child?.kill(); } catch {}
      // Never hide a failed cleanup: leaked profiles must fail CI, not pass.
      try { await remove(profile); }
      catch { throw new Error('Offline preview browser profile cleanup failed.'); }
    };

    try {
      child = spawnChrome(chrome, [
        '--headless=new', '--disable-gpu', '--disable-background-networking',
        '--disable-default-apps', '--disable-dev-shm-usage',
        '--no-first-run', '--no-default-browser-check',
        '--remote-debugging-port=0', '--remote-allow-origins=*',
        '--user-data-dir=' + profile, 'about:blank',
      ], { stdio: 'ignore' });
      // Spawn errors are asynchronous; without a handler they can crash Node
      // before an informative, bounded retry is possible.
      child.on('error', () => { failed = true; });
      for (let poll = 0; poll < pollsPerAttempt; poll++) {
        try {
          const candidate = (await readPort(profile)).split(/\r?\n/, 1)[0]?.trim();
          if (isValidPort(candidate)) {
            return { port: candidate, profile, child, close };
          }
        } catch {
          // Chrome writes DevToolsActivePort only after it initializes.
        }
        if (failed || child.exitCode !== null || child.signalCode !== null) break;
        await pause(100);
      }
    } catch {
      // A failed executable spawn must never silently pass the browser test.
    }

    await close();
    if (attempt + 1 < attempts) {
      // Diagnostic contains neither browser profile names nor user details.
      console.warn('SW-189: offline Chrome startup failed; retrying in a fresh ephemeral profile.');
    }
  }

  throw new Error('Isolated Chrome DevTools endpoint did not start after bounded attempts.');
}
