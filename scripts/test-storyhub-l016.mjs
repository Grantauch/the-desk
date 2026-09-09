import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';

export async function testL016({runCase,visit,viewports,artifact}) {
  const route='/hubs/ush9-l016-the-one-that-passed.html';
  for(const viewport of viewports) {
    await runCase('L016 document interactions',viewport,async page=>{
      await visit(page,route);
      assert.equal(await page.locator('section.chapter').count(),16);
      assert.equal(await page.locator('.terms details').count(),10);
      assert.equal(await page.locator('.repairs details').count(),6);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'No page overflow');
      await page.screenshot({path:artifact(`l016-${viewport.name}-opening.png`)});
      await page.locator('#index-open').click();assert.ok(await page.locator('#index-dialog').isVisible());
      await page.keyboard.press('Escape');assert.ok(await page.locator('#index-open').evaluate(el=>el===document.activeElement));
      for(const box of await page.locator('.outcome-box').all())await box.press('Enter');
      assert.equal(await page.locator('.stamped').count(),5);assert.match(await page.locator('.outcome-box[data-index="4"]').textContent(),/PUBLIC LAW/);
      await page.locator('#outcome').screenshot({path:artifact(`l016-${viewport.name}-register.png`)});
      await page.locator('#outcome-reset').click();assert.equal(await page.locator('.stamped').count(),0);
      await page.locator('[data-year="1890"]').click();assert.match(await page.locator('#ratio-display').textContent(),/Twenty-seven/);
      await page.locator('#historical-growth').click();assert.match(await page.locator('#growth-value').textContent(),/73.8/);
      await page.locator('#method').selectOption('killed');assert.equal(await page.locator('.log-entry').count(),3);
      await page.locator('#method').selectOption('burned');assert.equal(await page.locator('.log-entry').count(),1);
      await page.locator('#log-reset').click();assert.equal(await page.locator('.log-entry').count(),6);
      await page.locator('#crossing').press('End');assert.equal(await page.locator('#crossing').inputValue(),'64');
      await page.locator('#void-stamp').waitFor({state:'visible'});assert.ok(await page.locator('#voyage-arrival').isVisible());
      await page.locator('#voyage').screenshot({path:artifact(`l016-${viewport.name}-crossing.png`)});
      await page.locator('#voyage-reset').click();assert.ok(await page.locator('#void-stamp').isHidden());
      for(const button of await page.locator('.proof-attach').all())await button.click();
      assert.match(await page.locator('#proof-finding').textContent(),/not yours/);assert.equal(await page.locator('.fixed-requirement input,.fixed-requirement button').count(),0);
      await page.locator('#proof-reset').click();assert.equal(await page.locator('.proof-attach:visible').count(),3);
      assert.equal(await page.locator('#ledger-all tr').count(),62);
      await page.locator('#ledger-window').evaluate(el=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event('scroll'));});await page.locator('#ledger-end').waitFor({state:'visible'});
      await page.locator('#reading-mode').click();assert.equal(await page.locator('.reading details[open]').count(),28);assert.ok(await page.locator('#ratio-static').isVisible());
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'No reading-view overflow');
      const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
      assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),[],'L016 complete reading-view accessibility');
      await page.locator('#reading-mode').click();
      for(const n of [1,2,4,5,6,7,8,10,11,12,13,14,15,16]) {await page.locator('#s'+n).scrollIntoViewIfNeeded();await page.screenshot({path:artifact(`l016-${viewport.name}-section-${n}.png`)});}
    });
    await runCase('L016 reduced motion',viewport,async page=>{
      await visit(page,route);assert.equal(await page.locator('.stamped').count(),5);assert.ok(await page.locator('#stamp-tool').isHidden());
      assert.ok(await page.locator('#ratio-static').isVisible());assert.ok(await page.locator('#voyage-arrival').isVisible());assert.ok(await page.locator('.ledger-table').isVisible());
      assert.ok(await page.locator('#ledger-end').isVisible());assert.equal(await page.locator('#ledger-all tr').count(),62);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));
    },'reduce');
  }
}
