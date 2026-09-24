import {webkit,chromium,E,KEY,url} from './support.mjs';
import assert from 'node:assert/strict';
const browser=await webkit.launch();
try{
 const page=await browser.newPage({viewport:{width:390,height:740},serviceWorkers:'block'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();await page.goto(url);
 const read=()=>page.evaluate(KEY=>JSON.parse(localStorage.getItem(KEY)),KEY);
 let saved=await read();const cards=E.choosePass(E.viewFor(saved.game,0));
 for(const card of cards)await page.locator(`[data-card="${card}"]`).click({position:{x:25,y:20}});
 assert.equal(await page.locator('[aria-pressed="true"]').count(),3);
 const fourth=saved.game.hands[0].find(c=>!cards.includes(c));await page.locator(`[data-card="${fourth}"]`).click({position:{x:25,y:20}});assert.equal(await page.locator('[aria-pressed="true"]').count(),3);
 await page.reload();assert.equal(await page.locator('#hand [aria-pressed="true"]').count(),3);
 await page.locator('#primary-action').click();assert.equal((await read()).game.phase,'received');assert.equal(await page.locator('.card.received').count(),3);
 await page.reload();assert.equal((await read()).game.phase,'received');
 await page.locator('#primary-action').click();
 let moves=0,dialogsChecked=false,restoreChecked=false;
 while(true){
  saved=await read();const s=saved.game;assert(E.validate(s));
  if(s.phase==='hand-end'||s.phase==='game-over')break;
  assert(++moves<100);
  if(s.phase==='play'&&s.turn!==0){
   if(!dialogsChecked){await page.locator('#menu-button').click();const before=JSON.stringify((await read()).game);await page.clock.runFor(8000);assert.equal(JSON.stringify((await read()).game),before);await page.locator('#menu-dialog [data-close].dialog-action').click();dialogsChecked=true;}
   await page.clock.runFor(1600);
  }else if(s.phase==='play'){
   const legal=E.legalCards(s,0),off=s.hands[0].find(c=>!legal.includes(c));
   if(off){const b=await page.locator(`[data-card="${off}"]`).boundingBox();await page.mouse.click(b.x+20,b.y+20);assert(await page.locator('#primary-action').isDisabled());}
   const card=E.choosePlay(E.viewFor(s,0));await page.locator(`[data-card="${card}"]`).click({position:{x:25,y:20}});await page.locator('#primary-action').click();
  }else if(s.phase==='trick-end'){
   if(!restoreChecked){await page.reload();assert.equal((await read()).game.phase,'trick-end');await page.locator('#menu-button').click();await page.locator('#last-trick-button').click();assert.equal(await page.locator('.review-card').count(),4);await page.locator('#last-trick-dialog [data-close]').click();restoreChecked=true;}
   await page.locator('#primary-action').click();
  }
 }
 saved=await read();assert.equal(saved.game.history.length,13);assert.equal(saved.game.handPoints.reduce((a,b)=>a+b),26);
 await page.locator('#menu-button').click();await page.locator('#last-trick-button').click();assert.equal(await page.locator('.review-card').count(),4);await page.locator('#last-trick-dialog [data-close]').click();
 const totals=saved.game.scores;await page.locator('.result-continue').click();saved=await read();assert.equal(saved.game.handNumber,2);assert.equal(saved.game.passOffset,3);assert.deepEqual(saved.game.scores,totals);
 await page.locator('#menu-button').click();await page.locator('#settings-button').click();await page.locator('#language').selectOption('es');assert.equal(await page.locator('html').getAttribute('lang'),'es');await page.locator('#settings-dialog [data-close].dialog-action').click();await page.reload();assert.equal(await page.locator('html').getAttribute('lang'),'es');
 await page.locator('#menu-button').click();await page.locator('#new-game').click();await page.locator('#new-dialog [data-close]').click();assert.equal((await read()).game.handNumber,2);
 await page.locator('#menu-button').click();await page.locator('#new-game').click();await page.locator('#restart').click();assert.deepEqual((await read()).game.scores,[0,0,0,0]);
 assert.deepEqual(errors,[]);console.log('PASS: physical taps through a full 13-trick hand; legal-card guards, selection cap, selected/received/trick restore, menu pauses AI, last trick, score carry, pass-right next hand, language persistence, and guarded restart.');
}finally{await browser.close()}
const chrome=await chromium.launch(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {});
try{
 const context=await chrome.newContext({viewport:{width:390,height:740}});const page=await context.newPage();
 await page.goto(url);await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();
 assert(await page.evaluate(()=>Boolean(navigator.serviceWorker.controller)));
 const before=await page.locator('#hand .card').evaluateAll(cards=>cards.map(c=>c.dataset.card));
 await context.setOffline(true);await page.reload();assert.deepEqual(await page.locator('#hand .card').evaluateAll(cards=>cards.map(c=>c.dataset.card)),before);
 for(const card of before.slice(0,3))await page.locator(`[data-card="${card}"]`).click({position:{x:25,y:20}});await page.locator('#primary-action').click();assert.equal(await page.locator('.card.received').count(),3);
 await page.reload();assert.equal(await page.locator('.card.received').count(),3);console.log('PASS: Chrome service worker installed; offline reload, preserved hand, passing, received-card save, and offline resume.');
}finally{await chrome.close()}
