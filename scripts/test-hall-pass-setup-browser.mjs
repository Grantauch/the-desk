import assert from 'node:assert/strict';
import {readFile, mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';

// Actual setup HTML, synthetic Google replies only. No school service is called.
const source = await readFile(new URL('../apps-script/hall-pass-template/SetupWizard.html', import.meta.url), 'utf8');
const output = new URL('../browser-results/hall-pass-setup/', import.meta.url);
await mkdir(output, {recursive: true});
const browser = await chromium.launch({headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage']});
const ready = {ok: true, appTitle: 'Test Hall Pass', ownerDomain: 'example.org', ownerEmail: 'test.teacher@example.org',
  studentEmailDomain: 'students.example.org', periods: [{period: 1, start: '08:00', end: '08:55'}],
  scriptEditorUrl: 'https://script.google.com/d/synthetic/edit', links: null, bellsReady: false};
try {
  for (const width of [390, 640]) {
    const context = await browser.newContext({viewport: {width, height: 720}, reducedMotion: 'reduce'});
    const page = await context.newPage();
    const errors = [], calls = [];
    let failure = 'We’re sorry, a server error occurred while reading from storage. Error code PERMISSION_DENIED.';
    let malformed = false, saveFails = false, published = false, linkFails = false;
    const appLink = 'https://script.google.com/macros/s/SyntheticSetupDeployment0000000000/exec';
    page.on('pageerror', error => errors.push(error.message));
    await page.exposeFunction('__gas', async ({name}) => {
      calls.push(name);
      if (name === 'setupWizardLoad') {
        if (failure) throw Error(failure);
        return malformed ? {} : ready;
      }
      if (name === 'setupWizardSave') {
        if (saveFails) throw Error('Synthetic save failure');
        return ready;
      }
      if (name === 'setupWizardFindLink') return published ? {link: appLink} : {};
      if (name === 'setupWizardSaveLink') {
        if (linkFails) throw Error('Synthetic verification failure');
        return {...ready, studentCount: 0, links: {student: appLink, teacher: appLink + '?mode=teacher', kiosk: appLink + '?mode=kiosk', classroomShare: 'https://classroom.google.com/share'}};
      }
      throw Error('Unexpected call: ' + name);
    });
    await page.addInitScript(() => {
      function runner(success, failure) {
        return new Proxy({}, {get(_, name) {
          if (name === 'withSuccessHandler') return fn => runner(fn, failure);
          if (name === 'withFailureHandler') return fn => runner(success, fn);
          return (...args) => window.__gas({name, args}).then(success).catch(error => failure?.({message: error.message}));
        }});
      }
      window.google = {script: {get run() {return runner();}, host: {close() {window.__closed = true;}}}};
    });
    await context.route('**/*', route => route.fulfill({body: source, contentType: 'text/html'}));
    await page.goto('https://hall-pass-setup.test/');
    await page.locator('#screen-recovery').waitFor({state: 'visible'});
    assert.equal(await page.locator('#screen-about').isVisible(), false);
    assert.equal(await page.locator('#steps').isVisible(), false);
    assert.equal(await page.locator('#about-next').isDisabled(), true);
    assert.match(await page.locator('#recovery-message').textContent(), /more than one/i);
    assert.match(await page.locator('#recovery-details').textContent(), /PERMISSION_DENIED/);
    // Even a stale/programmatically dispatched click cannot reach setup or save.
    for (const id of ['about-next', 'bells-save', 'link-save']) await page.locator('#' + id).dispatchEvent('click');
    assert.deepEqual(calls, ['setupWizardLoad']);
    await page.locator('#recovery-retry').click();
    await page.waitForFunction(() => !document.getElementById('screen-recovery').hidden);
    assert.deepEqual(calls, ['setupWizardLoad', 'setupWizardLoad']);
    const audit = await new AxeBuilder({page}).include('#screen-recovery').withTags(['wcag2a', 'wcag2aa']).analyze();
    assert.deepEqual(audit.violations, [], JSON.stringify(audit.violations));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({path: new URL('recovery-' + width + '.png', output).pathname, fullPage: true});

    failure = 'Synthetic connection failure';
    await page.locator('#recovery-retry').click();
    await page.waitForFunction(() => document.getElementById('recovery-details').textContent === 'Synthetic connection failure');
    assert.match(await page.locator('#recovery-message').textContent(), /could not be loaded/);
    failure = '';
    malformed = true;
    await page.locator('#recovery-retry').click();
    await page.waitForFunction(() => document.getElementById('recovery-details').textContent.includes('incomplete'));
    assert.equal(await page.locator('#about-next').isDisabled(), true);
    malformed = false;
    await page.locator('#recovery-retry').click();
    await page.locator('#screen-about').waitFor({state: 'visible'});
    assert.equal(await page.locator('#about-next').isEnabled(), true);
    assert.equal(await page.locator('#app-title').inputValue(), ready.appTitle);
    assert.equal(await page.locator('#steps li.done').count(), 1);
    await page.locator('#about-next').click();
    await page.locator('#screen-bells').waitFor({state: 'visible'});
    assert.equal(await page.locator('#steps li.done').count(), 2);
    saveFails = true;
    await page.locator('#bells-save').click();
    await page.waitForFunction(() => document.getElementById('bells-message').textContent === 'Synthetic save failure');
    assert.equal(await page.locator('#screen-bells').isVisible(), true);
    assert.equal(await page.locator('#bells-save').isEnabled(), true);
    assert.equal(await page.locator('#app-title').inputValue(), ready.appTitle);
    saveFails = false;
    await page.locator('#bells-save').click();
    await page.locator('#screen-turn-on').waitFor({state: 'visible'});
    assert.equal(await page.locator('#steps li.done').count(), 3);
    assert.match(await page.locator('#school-account').textContent(), /test.teacher@example.org/);
    await page.locator('#link-find').click();
    await page.waitForFunction(() => document.getElementById('link-message').textContent.includes('not reported'));
    assert.equal(await page.locator('#screen-done').isVisible(), false);
    published = true; linkFails = true;
    await page.locator('#link-find').click();
    await page.waitForFunction(() => document.getElementById('link-message').textContent === 'Synthetic verification failure');
    assert.equal(await page.locator('#screen-turn-on').isVisible(), true);
    assert.equal(await page.locator('#link-find').isEnabled(), true);
    linkFails = false;
    await page.locator('#link-find').click();
    await page.locator('#screen-done').waitFor({state: 'visible'});
    assert.equal(await page.locator('#open-kiosk').getAttribute('href'), appLink + '?mode=kiosk');
    assert.match(await page.locator('#students-next').textContent(), /No students/);
    assert.match(await page.locator('#screen-done h1').textContent(), /links are ready/);
    const doneAudit = await new AxeBuilder({page}).include('#screen-done').withTags(['wcag2a', 'wcag2aa']).analyze();
    assert.deepEqual(doneAudit.violations, [], JSON.stringify(doneAudit.violations));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({path: new URL('links-' + width + '.png', output).pathname, fullPage: true});
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('PASS: setup storage denial/repeated retry, unavailable/malformed responses, blocked navigation, recovery, preserved save answers, step progress, accessibility and phone/dialog fit.');
} finally {await browser.close();}
