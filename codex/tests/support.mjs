import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
export const {webkit,chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
export const E=createRequire(import.meta.url)('../engine.js');
export const url=process.env.HEARTS_URL || 'http://127.0.0.1:8767/codex/';
export const KEY='codex-hearts-game-v2';
export const artifacts=fileURLToPath(new URL('../.artifacts/',import.meta.url));
await fs.mkdir(artifacts,{recursive:true});
export function createFixtures(){
const clone=x=>structuredClone(x);
const fixtures={};
function rng(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
for(let seed=1;seed<100 && Object.keys(fixtures).length<10;seed++){
 const random=rng(seed);let s=E.newGame(random);
 fixtures.pass ||= clone(s);
 while(s.phase!=='game-over'){
  if(s.phase==='pass')s=E.pass(s,s.hands.map((_,p)=>E.choosePass(E.viewFor(s,p))));
  else if(s.phase==='received'){if(!s.passOffset)fixtures.hold ||= clone(s);else fixtures.received ||= clone(s);s=E.begin(s);}
  else if(s.phase==='play'){
   if(s.turn===0 && s.trick.length===3 && s.hands[0].length>=9)fixtures.play ||= clone(s);
   if(s.hands[0].length<=3 && s.turn===0)fixtures.late ||= clone(s);
   s=E.play(s,s.turn,E.choosePlay(E.viewFor(s,s.turn)));
  }else if(s.phase==='trick-end'){fixtures.trick ||= clone(s);s=E.collect(s);}
  else if(s.phase==='hand-end'){fixtures[s.result.moon!==-1?'moon':'handEnd'] ||= clone(s);s=E.nextHand(s,random);}
 }
 fixtures[s.result.winner===0?'win':'lose'] ||= clone(s);
}
assert.equal(Object.keys(fixtures).length,10);assert(Object.values(fixtures).every(E.validate));
for(let seed=1;seed<100;seed++) {
 const state=E.newGame(rng(seed));const clubs=state.hands[3].filter(c=>E.suit(c)==='C');
 if(clubs.includes('QC') && clubs.length>=3){
  const choices=state.hands.map((_,p)=>E.choosePass(E.viewFor(state,p)));choices[3]=['QC',...clubs.filter(c=>c!=='QC').slice(0,2)];
  fixtures.receivedTop=E.pass(state,choices);break;
 }
}
function scored(source,before){const state=clone(source);state.result=E.scoreRound(before,state.handPoints);state.scores=state.result.totals;state.phase=state.result.winner===null?'hand-end':'game-over';assert(E.validate(state));return state;}
fixtures.tie=scored(fixtures.handEnd,fixtures.handEnd.result.added.map((n,p)=>([40,40,70,110][p])-n));
const shooter=fixtures.moon.result.moon;
const high=(shooter+1)%4;
fixtures.moonTie=scored(fixtures.moon,[0,1,2,3].map(p=>p===shooter?26:p===high?90:0));
fixtures.moonWin=scored(fixtures.moon,[0,1,2,3].map(p=>p===shooter?20:90));
assert(Object.values(fixtures).every(E.validate));
return fixtures;
}
