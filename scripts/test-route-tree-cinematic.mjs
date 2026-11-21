import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const output = resolve('browser-results/route-tree');
await mkdir(output, { recursive: true });
const baseline = execFileSync('git', ['show', '5a580d1a5939eee6d6f0b78f4d41edcdad43cde5:public/hubs/bts-the-route-tree.html']);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.webp':'image/webp', '.woff2':'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://test').pathname;
    const file = resolve('public', '.' + path);
    assert.ok(file.startsWith(resolve('public') + sep));
    const data = path === '/__baseline.html' ? baseline : await readFile(file);
    res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream'); res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const results = [];
// Tall element captures otherwise stitch sticky navigation into the artwork.
// The separate viewport captures retain the untouched live navigation and tools.
const sectionCapture = { quality:90, style:'.nav{position:static!important}' };
try {
  // A and B are alternatives with equal output, disjoint cases and separate drafts.
  for (const width of [320,390,1440]) {
    for (const reducedMotion of ['no-preference','reduce']) {
      const context=await browser.newContext({viewport:{width,height:1000},reducedMotion});
      await context.addInitScript(()=>{window.__deskSaveTest={gate:false,endpoint:''};});
      await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
      const page=await context.newPage(),errors=[],missing=[],groups=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)missing.push(r.url());});
      const name=`split-${width}-${reducedMotion}`;
      try {
        for (const variant of ['a','b']) {
          await page.goto(`${origin}/hubs/bts-route-tree-${variant}.html`);
          await page.waitForFunction(()=>window.__deskSave?.mode==='assignment');
          assert.equal(await page.locator('.case-section').count(),5);
          assert.equal(await page.locator('.bonus-case').count(),1);
          assert.equal(await page.locator('textarea').count(),3);
          assert.equal(await page.locator('textarea').first().inputValue(),'','A/B begin with separate blank drafts');
          assert.equal(await page.locator('.claim-card').count(),5);
          groups.push(await page.locator('.case-section').evaluateAll(nodes=>nodes.map(n=>n.id)));
          await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode();}));});
          await page.screenshot({path:resolve(output,`${name}-${variant}-hero.jpg`),quality:85});
          await page.locator('.funnel button[data-step="draft"]').click();
          assert.equal(await page.locator('.funnel').getAttribute('data-step'),'draft');
          assert.match(await page.locator('.funnel output').textContent(),/cohort comparisons/);
          for(const card of await page.locator('.claim-card').all())await card.locator('button').first().click();
          assert.match(await page.locator('#claim-progress').textContent(),/^5 of 5/);
          assert.equal(await page.locator('.ink-controls').count(),0,'Student editions must show the original photos, not AI ink sliders');
          assert.ok(await page.locator('.authentic-photo img').count()>=2);
          for(const range of await page.locator('.ink-controls input').all()){
            await range.focus();await page.keyboard.press('Home');
            assert.match(await range.getAttribute('aria-valuetext'),/^0% ink/);
            await page.keyboard.press('End');
            assert.match(await range.getAttribute('aria-valuetext'),/^100% ink/);
          }
          for(const summary of await page.locator('.context-packet summary').all()){
            await summary.focus();await page.keyboard.press('Enter');
            assert.equal(await summary.evaluate(e=>e.parentElement.open),true);
          }
          assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Fits viewport');
          const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
          await writeFile(resolve(output,`${name}-${variant}-axe.json`),JSON.stringify(axe,null,2));
          assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),[]);
          await page.locator(variant==='a'?'#case-unitas':'#case-lane').screenshot({path:resolve(output,`${name}-${variant}-case.jpg`),quality:85,style:'.topbar{position:static!important}'});
          await page.locator('textarea').first().fill(`Synthetic ${variant.toUpperCase()} response for draft-isolation verification.`);
          await page.waitForFunction(()=>document.querySelector('textarea').value.length>0);
          await page.locator('#responses').screenshot({path:resolve(output,`${name}-${variant}-responses.jpg`),quality:85});
          if(variant==='a')assert.equal(await page.locator('#rt-a-1-count').textContent(),'6 words · target 90–110 words');
        }
        assert.equal(new Set([...groups[0],...groups[1]]).size,10);
        await page.goto(origin+'/hubs/bts-route-tree-a.html');
        await page.waitForFunction(()=>document.querySelector('textarea')?.value.startsWith('Synthetic A'));
        assert.match(await page.locator('textarea').first().inputValue(),/^Synthetic A/);
        await page.goto(origin+'/hubs/bts-the-route-tree.html');
        await page.waitForFunction(()=>window.__deskSave?.mode==='reading');
        assert.equal(await page.locator('textarea').count(),0);
        assert.equal(await page.getByRole('link',{name:'Open Assignment A',exact:true}).count(),1);
        assert.equal(await page.getByRole('link',{name:'Open Assignment B',exact:true}).count(),1);
        const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
        assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)})),[]);
        await page.screenshot({path:resolve(output,`${name}-chooser.jpg`),quality:85});
        assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
        results.push({name,status:'passed',groups});
        console.log(`PASS ${name}: equal workload, authentic images, claims, WCAG, fit and isolated drafts`);
      } catch(error){results.push({name,status:'failed',message:error.message});console.error(`FAIL ${name}: ${error.message}`);await page.screenshot({path:resolve(output,`${name}-failed.jpg`),quality:85}).catch(()=>{});}
      finally{await context.close();}
    }
  }
  {
    const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}}),page=await context.newPage();
    await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    for(const v of ['a','b']){
      await page.goto(`${origin}/hubs/bts-route-tree-${v}.html`);
      assert.equal(await page.locator('textarea').count(),3);
      const disclosure=page.locator('.claim-card details').first();await disclosure.locator('summary').click();
      assert.equal(await disclosure.evaluate(el=>el.open),true);
      if(v==='b'){assert.equal(await page.locator('#case-lane .ink-stage').count(),0);assert.equal(await page.locator('#case-lane .authentic-photo img').count(),1);}
    }
    await context.close();
  }
  for (const width of [320, 390, 1440]) {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion });
      await context.addInitScript(() => { window.__deskSaveTest = { gate: false, endpoint: '' }; });
      await context.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
      const page = await context.newPage();
      const errors = [], missing = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.url().startsWith(origin) && r.status() >= 400) missing.push(r.url()); });
      const name = `${width}-${reducedMotion}`;
      try {
        assert.equal((await page.goto(origin + '/hubs/bts-route-tree-full-reference.html')).status(), 200);
        await page.locator('.cover h1').waitFor();
        const landing = await page.evaluate(async () => {
          await document.fonts.ready;
          await document.querySelector('.cover .ink-layer img').decode();
          return {
            scope:'Unthrottled local Chromium; loaded resources before screenshot-only eager decoding',
            loadedResourceBytes:performance.getEntriesByType('resource').reduce((sum,r)=>sum+r.encodedBodySize,0),
            heroSources:[...document.querySelectorAll('.cover .ink-stage img')].map(img=>({source:new URL(img.currentSrc).pathname,renderedWidth:img.getBoundingClientRect().width})),
          };
        });
        await page.screenshot({ path:resolve(output, `after-viewport-${name}.jpg`), quality:90 });
        await page.evaluate(async () => {
          await document.fonts.ready;
          const images = [...document.querySelectorAll('img[src]')].filter(img => img.getAttribute('src'));
          images.forEach(img => { img.loading = 'eager'; });
          await Promise.all(images.map(img => img.decode()));
        });
        assert.equal(await page.locator('.cinema-scene').count(), 4);
        assert.equal(await page.locator('.art-kind').filter({ hasText: 'Artistic reconstruction' }).count(), 2);
        assert.equal(await page.locator('#cast li:not([hidden])').count(), 10);
        // Photo/ink comparison works from keyboard at both endpoints, with meaningful values.
        for (const range of await page.locator('.ink-controls input').all()) {
          await range.focus(); await page.keyboard.press('Home');
          assert.match(await range.getAttribute('aria-valuetext'), /^0% ink interpretation, 100% source photograph$/);
          await page.keyboard.press('End');
          assert.match(await range.getAttribute('aria-valuetext'), /^100% ink interpretation, 0% source photograph$/);
        }
        for (const summary of await page.locator('.source-note summary').all()) {
          await summary.focus(); await page.keyboard.press('Enter');
          assert.equal(await summary.evaluate(el => el.parentElement.open), true);
          await page.keyboard.press('Enter');
        }
        // The page tells its own making-of story and tests each kind of evidence.
        assert.equal(await page.locator('#making-of h2').textContent(), 'Behind the ink');
        assert.equal(await page.locator('#making-of .method-check').count(), 3);
        for (const summary of await page.locator('.method-check summary').all()) {
          await summary.focus(); await page.keyboard.press('Enter');
          assert.equal(await summary.evaluate(el => el.parentElement.open), true);
          await page.keyboard.press('Enter');
        }
        // Existing classroom interactions retain their behavior.
        await page.locator('#claims .claim').first().getByRole('button', { name:'History', exact:true }).click();
        assert.match(await page.locator('#hoh-score').innerText(), /^1 of 10 called/i);
        await page.locator('#claims .claim').nth(1).getByRole('button', {name:'History', exact:true}).click();
        await page.locator('#claims .claim').nth(7).getByRole('button', {name:'History', exact:true}).click();
        for (const verdict of ['history', 'hollywood', 'remixed']) assert.equal(await page.locator('.stamp.' + verdict).count(), 1);
        assert.match(await page.locator('#hoh-score').innerText(), /^3 of 10 called/i);
        await page.locator('#oddsctl button[data-step="2"]').click();
        assert.equal(await page.locator('#oddsctl button[data-step="2"]').getAttribute('aria-pressed'), 'true');
        await page.locator('#doors button').first().click();
        assert.equal(await page.locator('#routes .dim').count() > 0, true);
        await page.locator('#dctl button[data-view="undrafted"]').click();
        assert.equal(await page.locator('#dctl button[data-view="undrafted"]').getAttribute('aria-pressed'), 'true');
        if (width < 960) {
          await page.locator('.dscroll').focus(); await page.keyboard.press('ArrowRight');
          await page.waitForFunction(() => document.querySelector('.dscroll').scrollLeft > 0);
        }
        await page.locator('#card-name').fill('The Test Route');
        assert.equal(await page.locator('#cc-name').textContent(), 'The Test Route');
        assert.equal(await page.locator('textarea').count(), 5);
        for (const scene of await page.locator('.cinema-scene').all()) {
          await scene.scrollIntoViewIfNeeded();
          await scene.locator('img').first().evaluate(img => img.decode());
        }
        const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
        assert.ok(overflow.scroll <= overflow.width + 1, `Page width: ${JSON.stringify(overflow)}`);
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
        await writeFile(resolve(output, `axe-${name}.json`), JSON.stringify(axe, null, 2));
        assert.deepEqual(axe.violations.map(v => ({ id:v.id, nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary})) })), []);
        assert.deepEqual(errors, []); assert.deepEqual(missing, []);
        await page.locator('.cover').screenshot({ ...sectionCapture, path: resolve(output, `after-cover-${name}.jpg`) });
        for (const id of ['reel', 'u-bleier', 'u-warner', 'tree', 'making-of']) {
          await page.locator('#' + id).screenshot({ ...sectionCapture, path: resolve(output, `after-${id}-${name}.jpg`) });
        }
        // Native source disclosures and full photographic anchors still exist without JS.
        const staticPage = await context.newPage();
        await staticPage.route('https://fonts.googleapis.com/**', r => r.continue());
        await staticPage.route('https://fonts.gstatic.com/**', r => r.continue());
        await staticPage.goto(origin + '/__baseline.html');
        await staticPage.evaluate(() => document.fonts.ready);
        await staticPage.screenshot({ path:resolve(output, `before-viewport-${name}.jpg`), quality:90 });
        await staticPage.locator('.cover').screenshot({ ...sectionCapture, path: resolve(output, `before-cover-${name}.jpg`) });
        await staticPage.close();
        results.push({ width, reducedMotion, status:'passed', errors, missing, landing });
        console.log(`PASS Route Tree: keyboard comparison, existing interactions, source labels, WCAG and fit at ${name}`);
      } catch (error) {
        results.push({ width, reducedMotion, status:'failed', message:error.message });
        console.error(`FAIL ${name}: ${error.message}`);
        await page.screenshot({ path: resolve(output, `failed-${name}.jpg`), fullPage:true, quality:85 }).catch(()=>{});
      } finally { await context.close(); }
    }
  }
  const context = await browser.newContext({ javaScriptEnabled:false, viewport:{width:390,height:844} });
  const page = await context.newPage();
  await context.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
  await page.goto(origin + '/hubs/bts-route-tree-full-reference.html');
  assert.ok(await page.locator('.rv').evaluateAll(nodes => nodes.length > 0 && nodes.every(el => getComputedStyle(el).opacity === '1')), 'Preserved narrative stays visible without JavaScript');
  assert.equal(await page.locator('.source-note summary').count(), 2);
  assert.equal(await page.locator('#cast li:not([hidden])').count(), 10);
  await page.locator('.source-note summary').first().click();
  assert.equal(await page.locator('.source-note').first().evaluate(el=>el.open), true);
  assert.equal(await page.locator('.method-check summary').count(), 3);
  await page.locator('.method-check summary').last().click();
  assert.equal(await page.locator('.method-check').last().evaluate(el=>el.open), true);
  await context.close();
} finally {
  await writeFile(resolve(output, 'results.json'), JSON.stringify(results, null, 2));
  await browser.close(); await new Promise(ok => server.close(ok));
}
assert.equal(results.filter(r=>r.status==='failed').length, 0, 'All Route Tree viewports and motion modes pass');
