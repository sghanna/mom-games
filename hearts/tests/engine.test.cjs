const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../engine.js');
function rng(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
function ready(seed){let s=E.newGame(rng(seed));return E.begin(E.pass(s,s.hands.map((_,p)=>E.choosePass(E.viewFor(s,p)))))}
test('passing is simultaneous and conserves all 52 unique cards',()=>{for(const offset of [1,3,2]){let s=E.newGame(rng(offset));s.passOffset=offset;const before=s.hands.map(h=>h.slice(0,3));const n=E.pass(s,before);for(let p=0;p<4;p++)assert(before[p].every(c=>n.hands[(p+offset)%4].includes(c)));assert.equal(new Set(n.hands.flat()).size,52);assert(s.hands.every(h=>h.length===13));}});
test('opening, following suit, first-trick penalties and forced exceptions',()=>{let s=ready(1);assert.deepEqual(E.legalCards(s),['2C']);s={...s,turn:0,trick:[{player:3,card:'2C'}],hands:[['4C','QS','2H'],[],[],[]]};assert.deepEqual(E.legalCards(s),['4C']);s.hands[0]=['QS','2H','AS'];assert.deepEqual(E.legalCards(s),['AS']);s.hands[0]=['QS','2H'];assert.deepEqual(E.legalCards(s),['QS','2H']);assert.throws(()=>E.play(s,1,'QS'));});
test('heart leads require breaking, except an all-heart hand; queen does not break',()=>{let s=ready(2);s={...s,turn:0,history:[{}],trick:[],hands:[['2H','AS'],[],[],[]]};assert.deepEqual(E.legalCards(s),['AS']);s.hands[0]=['2H','AH'];assert.deepEqual(E.legalCards(s),['2H','AH']);s.hands[0]=['QS'];assert.equal(E.play(s,0,'QS').heartsBroken,false);});
test('only the led suit can win and penalties are counted once',()=>assert.deepEqual(E.trickResult([{player:0,card:'2C'},{player:1,card:'AS'},{player:2,card:'QS'},{player:3,card:'AH'}]),{winner:0,points:14}));
test('moon adjustment, game threshold, and low-score ties',()=>{assert.deepEqual(E.scoreRound([6,0,6,14],[0,0,0,26]).totals,[32,26,32,14]);assert.equal(E.scoreRound([16,74,75,99],[0,5,19,2]).winner,0);const tie=E.scoreRound([10,10,40,90],[0,0,10,16]);assert.equal(tie.winner,null);assert.equal(tie.tied,true);});
test('save validation rejects missing/duplicate cards and impossible play',()=>{let s=ready(3);assert(E.validate(s));const bad=structuredClone(s);bad.hands[0][0]=bad.hands[1][0];assert(!E.validate(bad));assert(!E.validate({...s,phase:'made-up'}));assert(!E.validate({...s,turn:(s.turn+1)%4}));assert(!E.validate(null));});
test('AI view contains no opponents’ hands',()=>{const v=E.viewFor(ready(4),0);assert(!('hands' in v));assert.equal(v.hand.length,13);assert.equal(v.counts.length,4);});
test('120 complete matches remain legal, conserve cards, restore, and finish',()=>{
 let hands=0,moons=0,hold=0;
 for(let seed=1;seed<=120;seed++){
  const random=rng(seed);let s=E.newGame(random),steps=0;
  while(s.phase!=='game-over'){
   assert(++steps<20000,'Match did not finish');assert(E.validate(s),JSON.stringify({phase:s.phase,hand:s.handNumber,seed}));
   if(s.phase==='pass')s=E.pass(s,s.hands.map((_,p)=>E.choosePass(E.viewFor(s,p))));
   else if(s.phase==='received'){if(!s.passOffset)hold++;s=E.begin(s);}
   else if(s.phase==='play'){const p=s.turn;const c=E.choosePlay(E.viewFor(s,p));assert(E.legalCards(s).includes(c));s=E.play(s,p,c);}
   else if(s.phase==='trick-end')s=E.collect(s);
   else if(s.phase==='hand-end'){hands++;if(s.result.moon!==-1)moons++;assert.equal(s.handPoints.reduce((a,b)=>a+b),26);s=E.nextHand(s,random);}
  }
  hands++;assert(E.validate(s));assert(s.history.length===13);assert(s.scores[s.result.winner]===Math.min(...s.scores));
 }
 console.log({completeMatches:120,hands,moons,holdHands:hold});
});
