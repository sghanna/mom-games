import {webkit,KEY,url,artifacts,createFixtures} from './support.mjs';
import assert from 'node:assert/strict';
const fixtures=createFixtures();
const browser=await webkit.launch();
try {
 for(const lang of ['en','es','vi']) {
  const context=await browser.newContext({viewport:{width:375,height:667},deviceScaleFactor:2,serviceWorkers:'block'});
  const page=await context.newPage();await page.clock.install();
  await page.addInitScript(({KEY,state,lang})=>{localStorage.setItem(KEY,JSON.stringify({version:2,game:state,selected:[]}));localStorage.setItem('mom-hearts-settings-v2',JSON.stringify({language:lang,pace:'slow',sound:false}));},{KEY,state:fixtures.received,lang});
  await page.goto(url);
  await page.screenshot({path:`${artifacts}/game-received-${lang}.png`});
  assert.equal(await page.locator('.card.received').count(),3);
  assert(await page.locator('.card.received').evaluateAll(cards=>cards.every(card=>parseFloat(getComputedStyle(card,'::after').height)<=20)), 'Received badges must not cover card faces');
  await page.locator('#menu-button').click();await page.screenshot({path:`${artifacts}/game-menu-${lang}.png`});
  await page.locator('#settings-button').click();await page.screenshot({path:`${artifacts}/game-settings-${lang}.png`});
  await page.locator('#settings-dialog .dialog-action').click();
  await page.addInitScript(({KEY,state})=>localStorage.setItem(KEY,JSON.stringify({version:2,game:state,selected:[]})),{KEY,state:fixtures.trick});await page.reload();
  await page.locator('#menu-button').click();await page.locator('#last-trick-button').click();
  await page.screenshot({path:`${artifacts}/game-last-trick-${lang}.png`});
  assert(await page.locator('#last-trick-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth));
  await context.close();
 }
 for(const scenario of ['backup','invalid','quota']) {
  const context=await browser.newContext({viewport:{width:390,height:740},serviceWorkers:'block'});
  const page=await context.newPage();await page.clock.install();
  await page.addInitScript(({KEY,state,scenario})=>{
   if(scenario==='quota')Storage.prototype.setItem=()=>{throw new DOMException('Quota exceeded','QuotaExceededError')};
   else {localStorage.setItem(KEY,'broken');localStorage.setItem(KEY+'-backup',scenario==='backup'?JSON.stringify({version:2,game:state,selected:[]}):'broken');}
  },{KEY,state:fixtures.moon,scenario});
  await page.goto(url);
  if(scenario==='backup'){assert.deepEqual(await page.evaluate(KEY=>JSON.parse(localStorage.getItem(KEY)).game,KEY),fixtures.moon);assert.match(await page.locator('#live-status').textContent(),/recovered/);}
  if(scenario==='invalid'){assert.equal(await page.locator('#hand .card').count(),13);assert.match(await page.locator('#live-status').textContent(),/new game/);}
  if(scenario==='quota'){await page.locator('#menu-button').click();assert.match(await page.locator('#save-note').textContent(),/could not be saved/);}
  await context.close();
 }
 console.log('PASS: localized received/menu/settings/last-trick screens; backup recovery, invalid-save replacement, and visible storage-failure notice.');
}finally{await browser.close()}
