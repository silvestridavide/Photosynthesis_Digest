const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base=process.env.BASE_URL || 'http://127.0.0.1:8780';
  await page.goto(base);await page.locator('#edition-date').filter({hasText:'Edizione curata'}).waitFor();
  assert.equal(await page.locator('#paper-count').textContent(),'50');assert.equal(await page.locator('#news-count').textContent(),'20');
  await page.screenshot({path:'/tmp/resonance-desktop.png',fullPage:false});
  const perf=await page.evaluate(()=>({resources:performance.getEntriesByType('resource').map(r=>({name:r.name,duration:r.duration,transfer:r.transferSize})),dom:document.querySelectorAll('*').length}));
  await page.locator('[data-view=articles]').first().click();
  assert.equal(await page.locator('#result-list article').count(),12);
  await page.locator('#load-more').click();assert.equal(await page.locator('#result-list article').count(),24);
  await page.locator('#result-list [data-open]').first().click();await page.locator('#reader').waitFor({state:'visible'});
  assert.equal(await page.locator('#reader-close').evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.closest('dialog')!==null),true);
  await page.locator('#reader-save').click();await page.locator('#reader-read').click();
  await page.keyboard.press('Escape');await page.locator('#reader').waitFor({state:'hidden'});
  await page.locator('[data-view=saved]').click();assert.equal(await page.locator('#result-list article').count(),1);
  await page.reload();await page.locator('#result-list article').first().waitFor();assert.equal(await page.locator('#saved-count').textContent(),'1');
  await page.locator('#search-toggle').click();await page.locator('#only-unread').check();await page.locator('.empty').waitFor();
  await page.locator('#reset-filters').click();await page.locator('[data-view=articles]').first().click();
  await page.locator('#search-input').fill('Farquhar');await page.waitForTimeout(250);assert.ok((await page.locator('#result-list article').count())>0);
  await page.locator('#search-input').fill('zzzz-no-such-photosystem');await page.locator('.empty').waitFor();
  await page.locator('#reset-filters').click();await page.locator('[data-view=articles]').first().click();await page.locator('#sort-order').selectOption('citations');
  await page.locator('#result-list [data-open]').first().click();const deep=page.url();await page.reload();await page.locator('#reader').waitFor({state:'visible'});assert.equal(page.url(),deep);await page.keyboard.press('Escape');
  await page.locator('#reset-filters').click();
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/resonance-mobile.png',fullPage:false});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#search-toggle').click(); // hide filter panel
  await page.locator('.cover-main [data-open]').first().click();
  await page.screenshot({path:'/tmp/resonance-reader-mobile.png'});assert.equal(await page.locator('#reader').evaluate(e=>e.scrollWidth>e.clientWidth),false);await page.keyboard.press('Escape');
  // A load failure must provide a retry, not silently restore an old catalogue.
  const fail=await browser.newPage();await fail.route('**/assets/data/articles.json',r=>r.abort());await fail.goto(base);await fail.locator('[data-action=retry]').waitFor();await fail.close();
  assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'PASS',checks:['counts','pagination','reader','focus containment','save','read','persistence','unread filter','search','empty state','reset','citation sort','deep link','mobile overflow','load error'],performance:perf},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
