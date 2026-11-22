#!/usr/bin/env node
/**
 * SW-177: real Chromium checks of the static PRELAUNCH teacher setup preview.
 * Opens a local file in a fresh ephemeral browser profile. No Internet, school
 * server, student record, real PIN or staff authentication is involved.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const chrome = process.env.CHROME_BIN ?? (process.platform === 'win32'
  ? String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`
  : 'google-chrome');
const html = pathToFileURL(resolve('teacher-kit/START-HERE.html')).href;
const profile = await mkdtemp(join(tmpdir(), 'schoolwide-preview-qa-'));
const child = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--disable-background-networking',
  '--disable-default-apps', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', '--remote-allow-origins=*',
  '--user-data-dir=' + profile, 'about:blank',
], { stdio: 'ignore' });

let socket;
try {
  let port;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 100));
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
    catch { if (child.exitCode !== null) break; }
  }
  assert.ok(port, 'Isolated Chrome DevTools endpoint did not start');
  const targets = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
  const page = targets.find(target => target.type === 'page');
  assert.ok(page?.webSocketDebuggerUrl, 'Chrome did not expose its isolated preview page');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let seq = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const reply = JSON.parse(data);
    const call = pending.get(reply.id);
    if (!call) return;
    pending.delete(reply.id);
    clearTimeout(call.timeout);
    if (reply.error) call.reject(new Error(reply.error.message));
    else call.resolve(reply.result);
  });
  function call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++seq;
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error('Chrome preview test command timed out'));
      }, 8000);
      pending.set(id, { resolve, reject, timeout });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const response = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error('Browser preview script failed: ' +
      (response.exceptionDetails.exception?.description ?? response.exceptionDetails.text));
    return response.result.value;
  }
  async function waitForPage() {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const ready = await evaluate('document.readyState==="complete" && document.querySelectorAll("[data-page]").length===6');
      if (ready) return;
      await new Promise(resolve => setTimeout(resolve, 60));
    }
    throw new Error('Offline teacher preview did not load');
  }
  await call('Page.enable');
  await call('Runtime.enable');

  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await call('Page.navigate', { url: html });
  await waitForPage();
  const mobile = await evaluate('({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,innerWidth})');
  assert.equal(mobile.width, 390);
  assert.equal(mobile.innerWidth, 390);
  assert.equal(mobile.scrollWidth, 390, 'Mobile preview must never scroll horizontally');
  await call('Emulation.setDeviceMetricsOverride', { width: 320, height: 640, deviceScaleFactor: 1, mobile: true });
  const small = await evaluate('({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth})');
  assert.equal(small.width, 320);
  assert.equal(small.scrollWidth, 320, 'Narrow 320px view must not scroll horizontally');
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

  await evaluate('document.querySelectorAll("[data-step-button]")[2].click()');
  assert.equal(await evaluate('document.querySelector("[data-page]:not([hidden])").getAttribute("data-page")'), '2');
  assert.match(await evaluate('(document.getElementById("device-run").click(),document.getElementById("device-results").innerText)'), /SW-LOCAL-101/);
  assert.match(await evaluate('document.getElementById("device-results").innerText'), /SW-REAL-003/);
  assert.match(await evaluate('document.getElementById("device-status").textContent'), /unverified/);

  await evaluate('document.querySelectorAll("[data-step-button]")[4].click()');
  assert.equal(await evaluate('document.querySelector("[data-page]:not([hidden])").getAttribute("data-page")'), '4');
  assert.equal(await evaluate('(document.getElementById("demo-five").click(),document.getElementById("demo-value").textContent)'), 'Sample request recorded');
  assert.equal(await evaluate('(window.dispatchEvent(new Event("blur")),document.getElementById("demo-value").textContent)'), 'Welcome', 'Kiosk session must reset on focus loss');
  assert.equal(await evaluate('(document.getElementById("demo-six").click(),document.getElementById("demo-clear").click(),document.getElementById("demo-value").textContent)'), 'Welcome', 'Kiosk session must reset on finish');
  assert.equal(await evaluate('(document.getElementById("demo-five").click(),window.dispatchEvent(new Event("pagehide")),document.getElementById("demo-value").textContent)'), 'Welcome', 'Kiosk session must reset on pagehide');
  assert.equal(await evaluate('(()=>{const original=window.setTimeout;let task;window.setTimeout=(fn,ms)=>{task={fn,ms};return 9999};document.getElementById("demo-five").click();window.setTimeout=original;if(task?.ms!==15000)return false;task.fn();return document.getElementById("demo-value").textContent==="Welcome"})()'), true, 'Fictional session must register a 15-second automatic reset');

  await evaluate('document.querySelectorAll("[data-step-button]")[5].click()');
  assert.equal(await evaluate('document.getElementById("review-button").disabled'), true);
  assert.equal(await evaluate('(document.querySelectorAll("#checks input").forEach(x=>{x.checked=true;x.dispatchEvent(new Event("change"))}),document.getElementById("review-button").disabled)'), false);
  await evaluate('document.getElementById("review-button").click()');
  assert.match(await evaluate('document.getElementById("review-status").textContent'), /administrator must authorize/);
  assert.equal(await evaluate('(()=>{window.print=()=>{window.__printed=true};document.getElementById("print-guide").click();return window.__printed})()'), true);
  await evaluate('document.querySelectorAll("[data-step-button]")[2].focus()');
  await evaluate('document.querySelectorAll("[data-step-button]")[2].dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}))');
  assert.equal(await evaluate('document.querySelector("[data-page]:not([hidden])").getAttribute("data-page")'), '3');
  assert.equal(await evaluate('document.activeElement.getAttribute("data-step-button")'), '3');

  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: html });
  await waitForPage();
  const desktop = await evaluate('({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth})');
  await evaluate('document.querySelectorAll("[data-step-button]")[2].click()');
  const desktopChecks = await evaluate('(document.getElementById("device-run").click(),document.getElementById("device-results").innerText)');
  assert.match(desktopChecks, /SW-LOCAL-110/);
  assert.match(desktopChecks, /SW-REAL-001/);
  assert.ok(desktop.width >= 1400 && desktop.width <= 1440, 'Desktop width must account for OS scrollbar');
  assert.equal(desktop.scrollWidth, desktop.width, 'Desktop preview must not overflow horizontally');
  await call('Emulation.setEmulatedMedia', { media: 'print' });
  assert.equal(await evaluate('getComputedStyle(document.querySelector("[data-page][hidden]")).display'), 'block', 'Printed guide must include all six stages');
  await call('Emulation.setEmulatedMedia', { media: 'screen' });
  assert.equal(await evaluate('document.querySelector("[data-page]:not([hidden])").getAttribute("data-page")'), '2');

  console.log(JSON.stringify({
    result: 'TEACHER_PRELAUNCH_CHROME_PASS',
    mobile, desktop,
    privacyReset: true,
    uncheckedReviewDenied: true,
    offlineDiagnostics: true,
    keyboardNavigation: true,
    printControl: true,
    realNetworkRequired: false,
    studentDataUsed: false,
  }));
} finally {
  try { socket?.close(); } catch {}
  child.kill();
  await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }).catch(() => {});
}
