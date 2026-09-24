import {webkit,url,KEY,artifacts,createFixtures} from './support.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const fixtures=createFixtures();
const browser=await webkit.launch();const report=[];
try{
 for(const language of ['en','es','vi'])for(const [width,height] of [[390,740],[375,667],[844,390]]){
  for(const fixture of ['pass','received','receivedTop','hold','play','late','trick','handEnd','moon','tie','moonTie','moonWin','win','lose']){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(({state,language,KEY})=>{
    localStorage.setItem(KEY,JSON.stringify({version:2,game:state,selected:[]}));localStorage.setItem('codex-hearts-settings-v2',JSON.stringify({language,pace:'slow',sound:false}));
   },{state:fixtures[fixture],language,KEY});
   await page.goto(url);
   const metrics=await page.evaluate(()=>{
    const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}};
    const results=document.getElementById('result-screen');
    const action=document.querySelector(results.hidden?'#primary-action':'.result-continue');
    return {viewport:[innerWidth,innerHeight],scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],action:box(action),resultsScroll:results.hidden?null:[results.clientHeight,results.scrollHeight],cards:[...document.querySelectorAll('#hand .card')].map(box),text:document.body.innerText};
   });
   assert.deepEqual(errors,[]);
   assert.deepEqual(metrics.scroll,[width,height],JSON.stringify({language,width,height,fixture,metrics}));
   assert(metrics.action.bottom<=height+1,JSON.stringify({language,width,height,fixture,action:metrics.action}));
   if(width<500 && metrics.resultsScroll)assert(metrics.resultsScroll[1]<=metrics.resultsScroll[0]+1,JSON.stringify({language,width,height,fixture,scroll:metrics.resultsScroll}));
   if(language==='en'||fixture==='moon'||fixture==='pass')await page.screenshot({path:`${artifacts}/game-${fixture}-${language}-${width}-${height}.png`});
   report.push({language,width,height,fixture,metrics});await context.close();
  }
 }
 await fs.writeFile(artifacts+'/screens.json',JSON.stringify(report,null,2));
 console.log(`PASS: ${report.length} localized WebKit screen renders with no page errors or clipped primary actions.`);
}finally{await browser.close()}
