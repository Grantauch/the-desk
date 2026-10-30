/* All names and answers are invented. No school account or live save endpoint. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createServer } = require('node:http');
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;

const normal = {
  'lab-heel': 'The Iron Sheik',
  'lab-identity': 'The Iron Sheik was played by Hossein Khosrow Vaziri, who was born in Iran. He became especially famous in American wrestling in the early 1980s. His character used Iranian identity and national symbols to make American crowds see him as a threatening opponent.',
  'lab-initial-hypothesis': 'My first idea was that the hostage crisis created the Iron Sheik character. I expected the wrestling story to follow the news almost immediately, but I needed to check when he first used the character.',
  'lab-character-clue': 'The Iranian flag made his national identity visible before the match began. That detail connected a wrestling entrance to an international conflict that many fans already knew from television.',
  'lab-history': 'On November 4, 1979, militants seized the United States embassy in Tehran. Fifty two Americans remained hostages for 444 days, until January 20, 1981. The crisis made relations with Iran a major subject in American news and politics.',
  'lab-event-date': '1979-11-04',
  'lab-character-date': '1972',
  'lab-match-date': '1984-01-23',
  'lab-timeline-meaning': 'The character existed before the hostage crisis. The news could have intensified its meaning for American audiences, but the sequence does not support my original claim that the crisis invented the character. The title match came after the hostages returned.',
  'lab-wrestling': 'The flag connected the entrance to Iran, while the rivalry with Hulk Hogan gave fans an American hero to support. Hogan defeated the Iron Sheik at Madison Square Garden on January 23, 1984. These choices turned a national contrast into a championship story.',
  'lab-audience': 'Many American viewers associated Iran with the hostage crisis. A promoter could use that anger to make an Iranian character an effective villain. The crowd reaction shows that wrestling could borrow existing fears, although a recording alone cannot tell us what every individual fan believed.',
  'lab-america': 'The character shows how entertainment can turn a national conflict into a stereotype. The portrayal was unfair when it encouraged viewers to treat an entire nationality as an enemy. The difference between a real person and a scripted role matters when judging the story.',
  'lab-revised-hypothesis': 'At first I thought the crisis created the character. The earlier character date changed that explanation. My revised argument is that a familiar villain became more useful to promoters after the news gave audiences a new reason to respond to the act.',
  'lab-source-one': 'United States National Archives. Hostage. Archival film about the Iran hostage crisis. https://www.archives.gov/',
  'lab-source-one-claim': 'The archival footage documents the crisis as a real international event. It helps establish historical context. It does not prove that every wrestling fan reacted to the character for exactly the same reason.',
  'lab-source-two': 'WWE. Hulk Hogan versus the Iron Sheik. Madison Square Garden, January 23, 1984. Match recording on the official WWE channel.',
  'lab-source-two-claim': 'The recording shows the presentation of the wrestlers and the response of that crowd. It is a primary source for what the company put in the ring, rather than an independent explanation of American public opinion.',
  'lab-independent': 'The National Archives is outside WWE. Its historical footage can be checked against other records of the hostage crisis. I would still distinguish a film made by a government from a neutral account of every part of the conflict.',
  'lab-visual': 'I would use a brief part of the official January 23, 1984 match recording, showing the entrance and national symbols. The clip supports my claim about how the company presented the character, rather than proving what all Americans thought.',
  'lab-slide-one': 'The Iron Sheik: the person and the role. Identify Vaziri and Iran, then show the difference between his biography and the wrestling character. Use one entrance image rather than a slide full of text.',
  'lab-slide-two': 'Place the character date beside the 1979 crisis and the 1984 title match. Explain why the order changes my claim. The headline gave an existing character a different meaning, rather than creating him.',
  'lab-slide-three': 'My conclusion is that wrestling sold a national conflict through a personal rivalry. The evidence supports a claim about promotion and portrayal. It does not justify treating an entire nationality as a villain.',
  'lab-talk': 'Begin with the flag as the opening clue. Identify the person, explain the hostage crisis, then compare the dates. Describe two promotional choices and connect them to the audience. End with my judgment about the stereotype and the limits of my evidence.',
  'lab-defense-answer': 'My strongest evidence is the recorded match alongside the verified timeline. The match establishes what was presented, and the dates challenge the idea that the crisis created the act. Neither source can tell me the private beliefs of every person in the arena.'
};

async function run() {
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, 'browser-results', 'heel-report');
  await fs.mkdir(output, { recursive: true });
  const publicRoot = path.join(root, 'public');
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp' };
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const file = path.resolve(publicRoot, '.' + decodeURIComponent(url.pathname));
      assert.ok(file.startsWith(publicRoot + path.sep));
      const content = await fs.readFile(file);
      res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(content);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser;
  const results = [];
  try {
    browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const long = Array.from({ length: 12 }, (_, i) => 'The evidence in paragraph ' + (i + 1) + ' shows how the same symbol can change meaning when the audience connects it to a different event. A recorded reaction supports a careful claim about that moment, while a timeline helps us avoid confusing sequence with cause.').join('\n\n');
    assert.ok(long.split(/\s+/).length > 400);
    for (const test of ['A', 'B', 'C']) {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, hasTouch: true });
      await context.addInitScript(() => { window.__deskSaveTest = { endpoint: '', gate: false, snapshotMs: 200 }; });
      // Replace unrelated remote thumbnails locally rather than creating
      // intentional failed requests or contacting a school service.
      await context.route('**/*', route => route.request().url().startsWith(origin + '/')
        ? route.continue() : route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"/>' }));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
      page.on('dialog', d => d.type() === 'beforeunload' ? d.accept() : (errors.push('Unexpected dialog: ' + d.message()), d.dismiss()));
      await page.goto(origin + '/hubs/bts-americas-most-hated-research.html', { waitUntil: 'load' });
      await page.waitForFunction(() => window.__deskSave?.ready && document.querySelector('.hr-access'));
      await page.evaluate(() => document.fonts.ready);
      if (test === 'A') {
        for (const width of [320, 390, 1366]) {
          await page.setViewportSize({ width, height: 768 });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Project header and Report button fit ' + width);
          const reportButton = await page.locator('.hr-access').boundingBox();
          assert.ok(reportButton.x >= 0 && reportButton.x + reportButton.width <= width);
        }
      }
      const answers = { ...normal };
      if (test === 'B') {
        answers['lab-history'] = long;
        answers['lab-character-clue'] = 'Symbols shape reactions';
        answers['lab-talk'] = 'Opening: name the person.\nThen explain the character.\n\nCompare the dates before making a claim.\nEnd by explaining what the evidence cannot tell us.';
        answers['lab-source-one-claim'] = '<script>alert(1)</script> <b>These are literal words.</b> & not HTML.';
        answers['lab-revised-hypothesis'] = 'I first thought “villain” meant a real enemy. Now I ask, "Who wrote the story?" The evidence changed my view. 🥊 📚';
      }
      if (test === 'C') {
        for (const id of ['lab-wrestling', 'lab-audience', 'lab-america', 'lab-revised-hypothesis', 'lab-source-one', 'lab-source-one-claim', 'lab-source-two', 'lab-source-two-claim', 'lab-independent', 'lab-visual']) answers[id] = '';
      }
      for (let round = 1; round <= 5; round++) {
        await page.locator('[data-lab-tab="' + round + '"]').click();
        for (const field of await page.locator('#lab-round-' + round + ' textarea, #lab-round-' + round + ' input[type=text]').all()) {
          const id = await field.getAttribute('id');
          assert.ok(Object.hasOwn(answers, id), 'Every text field has a fixture: ' + id);
          await field.fill(answers[id]);
        }
      }
      for (let n = 1; n <= 9; n++) await page.locator('input[name="lab_check_' + n + '"][value="Yes"]').check();
      await page.locator('#hr-finish').click();
      assert.equal(await page.locator('#heel-report').evaluate(el => el.open), true);
      await page.locator('#hr-name').fill('Alex Morgan');
      await page.locator('#hr-hour').fill('5');
      await page.locator('#hr-date').fill('2026-10-30');
      await page.waitForTimeout(250);
      // Exact text comparison, including every line break and malicious string.
      for (const [id, text] of Object.entries(answers)) {
        const block = page.locator('.hr-report [data-field="' + id + '"]');
        if (text) assert.equal(await block.locator('.hr-answer').textContent(), text, id);
        else assert.equal(await block.locator('.hr-incomplete a').count(), 1, id);
      }
      assert.equal(await page.locator('.hr-report script, .hr-report b').count(), 0);
      assert.doesNotMatch(await page.locator('.hr-report').textContent(), /\b(?:undefined|null)\b/);
      const expectedQuote = (test === 'C' ? normal['lab-identity'] : normal['lab-america']).split('. ')[0] + '.';
      assert.equal(await page.locator('.hr-quote').textContent(), expectedQuote);
      const sent = await page.evaluate(() => window.__deskSave.answers());
      assert.ok(!sent.some(a => /hr-name|hr-hour|hr-date|heel-report/.test(a.k)), 'Report identity never joins submitted answers');
      assert.equal(sent.length, 33, 'Existing 24 text fields and 9 self-check groups unchanged');
      if (test === 'A') {
        for (const width of [320, 390, 1366]) {
          await page.setViewportSize({ width, height: 768 });
          assert.equal(await page.locator('#heel-report').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, 'Report fits ' + width);
          const audit = await new AxeBuilder({ page }).include('#heel-report').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
          assert.deepEqual(audit.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), [], 'Report accessibility at ' + width);
        }
      }
      for (const size of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
        await page.setViewportSize(size);
        const dir = path.join(output, 'Test' + test, String(size.width)); await fs.mkdir(dir, { recursive: true });
        await page.locator('.hr-report > .hr-cover').screenshot({ path: path.join(dir, '00-cover.png') });
        for (let n = 1; n <= 5; n++) {
          await page.locator('#hr-chapter-0' + n).screenshot({ path: path.join(dir, '0' + n + '-section.png') });
        }
        assert.equal(await page.locator('.hr-report').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
        const readOverflow = await page.locator('.hr-report .hr-answer').evaluateAll(elements => elements.filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.parentElement.dataset.field));
        assert.deepEqual(readOverflow, []);
        await page.locator('[data-hr-present]').click();
        await page.waitForTimeout(400);
        assert.equal(await page.evaluate(() => Boolean(document.fullscreenElement)), true, 'Presentation enters real full screen');
        const slideTexts = {};
        const total = Number((await page.locator('.hr-slide-count').textContent()).split('/')[1].trim());
        assert.ok(total >= 4);
        for (let index = 0; index < total; index++) {
          const metrics = await page.locator('.hr-slide').evaluate(slide => {
            const body = slide.querySelector('.hr-slide-body');
            const bounds = slide.getBoundingClientRect();
            const clipped = [];
            slide.querySelectorAll('h1,h2,h3,p,blockquote,span').forEach(el => {
              if (!el.textContent.trim()) return;
              const range = document.createRange(); range.selectNodeContents(el);
              for (const r of range.getClientRects()) if (r.left < bounds.left - 1 || r.right > bounds.right + 1 || r.bottom > bounds.bottom + 1) clipped.push(el.textContent.slice(0, 80));
            });
            return { overflow: slide.scrollHeight > slide.clientHeight + 1 || slide.scrollWidth > slide.clientWidth + 1 || (body && body.scrollHeight > body.clientHeight + 1), clipped, font: body ? parseFloat(getComputedStyle(body).fontSize) : 99 };
          });
          assert.equal(Boolean(metrics.overflow), false, JSON.stringify({ test, size, index, metrics }));
          assert.deepEqual(metrics.clipped, [], JSON.stringify({ test, size, index, metrics }));
          assert.ok(metrics.font >= 32, 'Classroom size text');
          const pieces = await page.locator('.hr-slide-response').evaluateAll(nodes => nodes.map(n => [n.dataset.field, n.querySelector('.hr-answer').textContent]));
          for (const [id, text] of pieces) slideTexts[id] = (slideTexts[id] || '') + text;
          await page.screenshot({ path: path.join(dir, 'slide-' + String(index).padStart(2, '0') + '.png') });
          if (index < total - 1) await page.keyboard.press(index % 2 ? 'Space' : 'ArrowRight');
        }
        for (const [id, text] of Object.entries(answers)) if (text) assert.equal(slideTexts[id], text, 'No content lost across slides: ' + id);
        assert.equal(await page.locator('.hr-deck .hr-incomplete').count(), 0);
        // Real mouse and touch inputs, back keys, and exit controls.
        await page.keyboard.press('Home'); await page.locator('.hr-stage').click({ position: { x: 100, y: 100 } });
        assert.match(await page.locator('.hr-slide-count').textContent(), /^2 /);
        await page.keyboard.press('ArrowLeft');
        assert.match(await page.locator('.hr-slide-count').textContent(), /^1 /);
        await page.locator('.hr-stage').tap({ position: { x: 120, y: 120 } });
        assert.match(await page.locator('.hr-slide-count').textContent(), /^2 /);
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('#heel-report').classList.contains('hr-presenting'));
        assert.equal(await page.locator('.hr-report').isVisible(), true);
        results.push({ test, viewport: size, slides: total, errors: errors.length });
      }
      await page.emulateMedia({ media: 'print' });
      assert.equal(await page.locator('.hr-toolbar').isVisible(), false);
      assert.equal(await page.locator('.hr-incomplete:visible').count(), 0);
      await page.pdf({ path: path.join(output, 'Test' + test, 'report.pdf'), format: 'Letter', printBackground: true, preferCSSPageSize: true, tagged: true });
      await page.emulateMedia({ media: 'screen' });
      await page.evaluate(() => { window.print = () => { window.__reportPrintRequested = true; }; });
      await page.getByRole('button', { name: 'Save as PDF', exact: true }).click();
      assert.equal(await page.evaluate(() => window.__reportPrintRequested), true, 'PDF button calls window.print');
      if (test === 'B') {
        // Exercise the fallback for a single huge sentence and an unbroken URL.
        await page.getByRole('button', { name: 'Back to project', exact: true }).click();
        await page.locator('[data-lab-tab="1"]').click();
        const stress = 'A claim needs evidence '.repeat(130) + 'https://example.test/' + 'W'.repeat(1200);
        await page.locator('#lab-character-clue').fill(stress);
        await page.locator('.hr-access').click();
        await page.setViewportSize({ width: 1366, height: 768 });
        await page.locator('[data-hr-present]').click();
        await page.waitForTimeout(300);
        let recovered = '';
        const count = Number((await page.locator('.hr-slide-count').textContent()).split('/')[1]);
        for (let i = 0; i < count; i++) {
          assert.equal(await page.locator('.hr-slide-body').count() ? await page.locator('.hr-slide-body').evaluate(el => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1) : true, true);
          const fragment = page.locator('.hr-slide [data-field="lab-character-clue"] .hr-answer');
          if (await fragment.count()) recovered += await fragment.textContent();
          if (i < count - 1) await page.keyboard.press('ArrowRight');
        }
        assert.equal(recovered, stress, 'Oversized sentences and tokens preserve every grapheme');
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'Back to project', exact: true }).click();
        await page.locator('#lab-character-clue').fill(answers['lab-character-clue']);
        await page.locator('[data-lab-tab="3"]').click();
        const longClaim = 'A claim needs evidence '.repeat(130).trim();
        await page.locator('#lab-america').fill(longClaim);
        await page.locator('.hr-access').click();
        assert.equal(await page.locator('.hr-cover .hr-quote').count(), 0, 'A very long claim does not turn the title card into several cover pages');
        assert.equal(await page.locator('.hr-opening .hr-quote').textContent(), longClaim, 'The full selected sentence appears in the opening section');
        await page.emulateMedia({ media: 'print' });
        await page.pdf({ path: path.join(output, 'TestB', 'long-claim.pdf'), format: 'Letter', printBackground: true, preferCSSPageSize: true });
        await page.emulateMedia({ media: 'screen' });
        await page.getByRole('button', { name: 'Back to project', exact: true }).click();
        await page.locator('#lab-america').fill(answers['lab-america']);
        await page.locator('.hr-access').click();
      }
      // Earlier edits, reload and metadata must be reflected immediately.
      await page.getByRole('button', { name: 'Back to project', exact: true }).click();
      await page.locator('[data-lab-tab="1"]').click();
      const revised = answers['lab-identity'] + '\n\nA final revision after checking the record.';
      await page.locator('#lab-identity').fill(revised);
      await page.locator('.hr-access').click();
      assert.equal(await page.locator('[data-field="lab-identity"] .hr-answer').textContent(), revised);
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => window.__deskSave?.ready);
      await page.locator('.hr-access').click();
      assert.equal(await page.locator('[data-field="lab-identity"] .hr-answer').textContent(), revised);
      assert.equal(await page.locator('#hr-name').inputValue(), 'Alex Morgan');
      assert.equal(await page.locator('#hr-hour').inputValue(), '5');
      assert.equal(await page.locator('#hr-date').inputValue(), '2026-10-30');
      if (test === 'C') {
        await page.locator('[data-field="lab-wrestling"] .hr-incomplete a').click();
        assert.equal(await page.locator('#lab-round-3').isVisible(), true);
        assert.equal(await page.locator('#lab-wrestling').evaluate(el => el === document.activeElement), true);
      } else await page.getByRole('button', { name: 'Back to project', exact: true }).click();
      // Simulate the existing shared-device reset, not a new report save path.
      await page.evaluate(() => window.dispatchEvent(new Event('desk-save:reset')));
      assert.equal(await page.locator('#heel-report').evaluate(el => el.open), false);
      assert.equal(await page.evaluate(() => sessionStorage.getItem('bts-heels:report:v1')), null);
      assert.deepEqual(errors, [], 'Zero page or console errors');
      await context.close();
    }
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    return { passed: true, results, output };
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
module.exports = run;
if (require.main === module) run().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
