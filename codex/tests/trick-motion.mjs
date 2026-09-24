import {webkit,E,KEY,url,artifacts} from './support.mjs';
import assert from 'node:assert/strict';

const winners = {};
let finalTrick;
let seed = 17;
const random = () => { seed = (Math.imul(seed,1664525)+1013904223) >>> 0; return seed / 4294967296; };
let state = E.newGame(random);
while (Object.keys(winners).length < 4 || !finalTrick) {
  if (state.phase === 'pass') state = E.pass(state,state.hands.map((_,p) => E.choosePass(E.viewFor(state,p))));
  else if (state.phase === 'received') state = E.begin(state);
  else if (state.phase === 'play') state = E.play(state,state.turn,E.choosePlay(E.viewFor(state,state.turn)));
  else if (state.phase === 'trick-end') {
    winners[E.trickResult(state.trick).winner] ||= structuredClone(state);
    if (state.history.length === 12) finalTrick = structuredClone(state);
    state = E.collect(state);
  } else state = state.phase === 'game-over' ? E.newGame(random) : E.nextHand(state,random);
}
const browser = await webkit.launch();
const read = page => page.evaluate(KEY => JSON.parse(localStorage.getItem(KEY)).game,KEY);
async function open(state,viewport={width:390,height:740},reducedMotion='no-preference') {
  const context = await browser.newContext({viewport,deviceScaleFactor:2,serviceWorkers:'block',reducedMotion});
  const page = await context.newPage();
  page.on('pageerror',error => { throw error; });
  await page.addInitScript(({KEY,state}) => localStorage.setItem(KEY,JSON.stringify({version:2,game:state,selected:[]})),{KEY,state});
  await page.clock.install();
  await page.goto(url);
  return {context,page};
}
async function finish(page) {
  await page.evaluate(() => document.getAnimations().forEach(animation => animation.finish()));
  await page.waitForFunction(() => document.querySelector('.table').dataset.collection === 'done');
}
try {
  for (const viewport of [{width:390,height:740},{width:375,height:667},{width:844,height:390}]) {
    for (const [winner,state] of Object.entries(winners)) {
      const {context,page} = await open(state,viewport);
      assert(await page.locator('#primary-action').isDisabled());
      assert.equal(await page.locator('.trick-card').count(),4);
      await page.clock.runFor(1250);
      assert.equal(await page.locator('.trick-flight-card').count(),4);
      await page.evaluate(() => document.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = 620; }));
      await page.screenshot({path:`${artifacts}/trick-flight-${winner}-${viewport.width}.png`});
      const before = state.history.filter(trick => trick.winner === Number(winner)).length;
      await finish(page);
      assert.equal(await page.locator(`[data-pile-for="${winner}"]`).getAttribute('data-tricks'),String(before + 1));
      assert.equal(await page.locator('.trick-flight').count(),0);
      assert(await page.locator('#primary-action').isEnabled());
      assert.deepEqual(await read(page),state,'Animation must not change saved scores or advance the hand');
      await page.screenshot({path:`${artifacts}/trick-pile-${winner}-${viewport.width}.png`});
      await page.locator('#primary-action').click();
      assert.deepEqual(await read(page),E.collect(state),'Next trick must collect exactly once');
      await context.close();
    }
  }
  {
    const {context,page} = await open(winners[0]);
    await page.locator('#menu-button').click();
    await page.clock.runFor(5000);
    assert.equal(await page.locator('.trick-flight').count(),0,'Menu pauses the pre-animation delay');
    await page.locator('#menu-dialog .dialog-action').click();
    await page.clock.runFor(1250);
    await page.locator('#menu-button').click();
    assert(await page.evaluate(() => document.getAnimations().every(animation => animation.playState === 'paused')));
    await page.locator('#menu-dialog .dialog-action').click();
    await page.reload();
    assert.deepEqual(await read(page),winners[0],'Reload during flight must preserve the completed trick');
    await page.clock.runFor(1250);
    await page.setViewportSize({width:844,height:390});
    await page.waitForFunction(() => document.querySelector('.table').dataset.collection === 'done');
    assert.equal(await page.locator('.trick-flight').count(),0,'Rotation must not leave flying cards behind');
    await context.close();
  }
  {
    const {context,page} = await open(finalTrick,{width:375,height:667},'reduce');
    await page.clock.runFor(1250);
    assert.equal(await page.locator('.trick-flight').count(),0,'Reduced motion must skip travel');
    assert(await page.locator('#primary-action').isEnabled());
    await page.locator('#primary-action').click();
    assert.deepEqual(await read(page),E.collect(finalTrick),'The final trick must lead to the correct scores');
    assert(await page.locator('#result-screen').isVisible());
    await context.close();
  }
  {
    const context = await browser.newContext({viewport:{width:390,height:740},serviceWorkers:'block'});
    const page = await context.newPage();
    await page.addInitScript(({KEY,state}) => localStorage.setItem(KEY,JSON.stringify({version:2,game:state,selected:[]})),{KEY,state:winners[3]});
    await page.goto(url);
    await page.waitForFunction(() => document.querySelector('.table').dataset.collection === 'done',{},{timeout:6000});
    assert(await page.locator('#primary-action').isEnabled(),'The real-time animation must finish without a test-driven clock');
    assert.equal(await page.locator('.trick-flight').count(),0);
    await context.close();
  }
  console.log('PASS: all four winners at three sizes; pile destination, one-time scoring, menu pause, interrupted reload, rotation, reduced motion, and final trick.');
} finally { await browser.close(); }
