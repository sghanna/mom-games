(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HeartsEngine = api;
})(globalThis, function () {
  'use strict';
  const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const SUITS = ['C','D','S','H'];
  const OFFSETS = [1,3,2,0];
  const PHASES = ['pass','received','play','trick-end','hand-end','game-over'];
  const deck = () => SUITS.flatMap(suit => RANKS.map(rank => rank + suit));
  const copy = value => JSON.parse(JSON.stringify(value));
  const rank = card => RANKS.indexOf(card.slice(0,-1)) + 2;
  const suit = card => card.slice(-1);
  const points = card => card === 'QS' ? 13 : suit(card) === 'H' ? 1 : 0;
  const sort = cards => [...cards].sort((a,b) => SUITS.indexOf(suit(a)) - SUITS.indexOf(suit(b)) || rank(a) - rank(b));
  function requireThat(test, message) { if (!test) throw new Error(message); }

  function deal(scores, handNumber, random = Math.random) {
    const cards = deck();
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [cards[i],cards[j]] = [cards[j],cards[i]];
    }
    const hands = Array.from({length:4}, (_,p) => sort(cards.filter((_,i) => i % 4 === p)));
    const passOffset = OFFSETS[(handNumber - 1) % 4];
    return { version:1, handNumber, scores:[...scores], passOffset, phase:passOffset ? 'pass' : 'received', hands,
      received:[], trick:[], history:[], handPoints:[0,0,0,0], heartsBroken:false, turn:null, result:null };
  }
  const newGame = random => deal([0,0,0,0],1,random);

  function pass(state, choices) {
    requireThat(state.phase === 'pass' && choices.length === 4, 'Not passing');
    choices.forEach((cards,p) => requireThat(cards.length === 3 && new Set(cards).size === 3 && cards.every(card => state.hands[p].includes(card)), 'Invalid pass'));
    const next = copy(state);
    next.hands = state.hands.map((hand,p) => hand.filter(card => !choices[p].includes(card)));
    choices.forEach((cards,p) => next.hands[(p + state.passOffset) % 4].push(...cards));
    next.hands = next.hands.map(sort);
    next.received = [...choices[(4 - state.passOffset) % 4]];
    next.phase = 'received';
    return next;
  }
  function begin(state) {
    requireThat(state.phase === 'received', 'Not ready to play');
    const next = copy(state);
    next.phase = 'play'; next.received = [];
    next.turn = next.hands.findIndex(hand => hand.includes('2C'));
    return next;
  }
  function legalCards(state, player = state.turn) {
    if (state.phase !== 'play' || player !== state.turn || !state.hands[player]) return [];
    const hand = state.hands[player];
    const first = state.history.length === 0;
    if (!state.trick.length) {
      if (first) return hand.filter(card => card === '2C');
      const others = hand.filter(card => suit(card) !== 'H');
      return state.heartsBroken || !others.length ? [...hand] : others;
    }
    const following = hand.filter(card => suit(card) === suit(state.trick[0].card));
    if (following.length) return following;
    const safe = hand.filter(card => points(card) === 0);
    return first && safe.length ? safe : [...hand];
  }
  function trickResult(trick) {
    requireThat(trick.length === 4, 'Incomplete trick');
    const led = suit(trick[0].card);
    const winner = trick.filter(play => suit(play.card) === led).reduce((best, play) => rank(play.card) > rank(best.card) ? play : best).player;
    return { winner, points:trick.reduce((sum,play) => sum + points(play.card),0) };
  }
  function play(state, player, card) {
    requireThat(legalCards(state,player).includes(card), 'Illegal card');
    const next = copy(state);
    next.hands[player] = next.hands[player].filter(c => c !== card);
    next.trick.push({player,card});
    if (suit(card) === 'H') next.heartsBroken = true;
    next.turn = (player + 1) % 4;
    if (next.trick.length === 4) { next.phase = 'trick-end'; next.turn = null; }
    return next;
  }
  function scoreRound(before, handPoints) {
    requireThat(before.length === 4 && before.every(n => Number.isInteger(n) && n >= 0) && handPoints.length === 4 && handPoints.every(n => Number.isInteger(n) && n >= 0) && handPoints.reduce((a,b) => a+b,0) === 26, 'Invalid hand points');
    const moon = handPoints.findIndex(n => n === 26);
    const added = moon === -1 ? [...handPoints] : handPoints.map((_,p) => p === moon ? 0 : 26);
    const totals = before.map((score,p) => score + added[p]);
    const lowest = Math.min(...totals);
    const winners = totals.map((score,p) => score === lowest ? p : -1).filter(p => p !== -1);
    const threshold = Math.max(...totals) >= 100;
    return { before:[...before], added, totals, moon, winner:threshold && winners.length === 1 ? winners[0] : null, tied:threshold && winners.length > 1 };
  }
  function collect(state) {
    requireThat(state.phase === 'trick-end', 'No completed trick');
    const next = copy(state);
    const result = trickResult(next.trick);
    next.handPoints[result.winner] += result.points;
    next.history.push({ cards:next.trick, ...result });
    next.trick = []; next.turn = result.winner; next.phase = 'play';
    if (next.history.length === 13) {
      next.result = scoreRound(next.scores,next.handPoints);
      next.scores = [...next.result.totals]; next.turn = null;
      next.phase = next.result.winner === null ? 'hand-end' : 'game-over';
    }
    return next;
  }
  function nextHand(state, random) {
    requireThat(state.phase === 'hand-end', 'Hand is not complete');
    return deal(state.scores,state.handNumber + 1,random);
  }
  function viewFor(state, player) {
    // AI receives its own cards and public information only.
    return { player, hand:[...state.hands[player]], legal:legalCards(state,player), trick:copy(state.trick), history:copy(state.history),
      scores:[...state.scores], handPoints:[...state.handPoints], counts:state.hands.map(h => h.length), heartsBroken:state.heartsBroken, first:state.history.length === 0 };
  }
  function choosePass(view) {
    const counts = Object.fromEntries(SUITS.map(s => [s,view.hand.filter(c => suit(c) === s).length]));
    const danger = c => (c === 'QS' ? 32 : 0) + (suit(c) === 'S' && rank(c) >= 13 && counts.S < 5 ? 22 : 0) +
      (suit(c) === 'H' ? rank(c) + 7 : rank(c)) + (suit(c) !== 'S' && counts[suit(c)] <= 3 ? 8 : 0) - (c === '2C' ? 8 : 0);
    return [...view.hand].sort((a,b) => danger(b) - danger(a) || rank(b) - rank(a)).slice(0,3);
  }
  function choosePlay(view) {
    requireThat(view.legal.length > 0, 'No legal moves');
    const low = cards => [...cards].sort((a,b) => rank(a) - rank(b) || points(a) - points(b))[0];
    if (!view.trick.length) return low(view.legal);
    const led = suit(view.trick[0].card);
    if (suit(view.legal[0]) !== led) return [...view.legal].sort((a,b) => points(b) - points(a) || rank(b) - rank(a))[0];
    const high = Math.max(...view.trick.filter(p => suit(p.card) === led).map(p => rank(p.card)));
    const losing = view.legal.filter(c => rank(c) < high);
    if (losing.length) return [...losing].sort((a,b) => rank(b) - rank(a))[0];
    const penalty = view.trick.some(p => points(p.card)) || view.legal.some(c => c === 'QS');
    return view.trick.length === 3 && !penalty ? [...view.legal].sort((a,b) => rank(b) - rank(a))[0] : low(view.legal);
  }

  function validate(state) {
    try {
      if (!state || state.version !== 1 || !PHASES.includes(state.phase)) return false;
      if (!Number.isInteger(state.handNumber) || state.handNumber < 1 || state.handNumber > 10000) return false;
      if (state.passOffset !== OFFSETS[(state.handNumber - 1) % 4]) return false;
      if (!Array.isArray(state.scores) || state.scores.length !== 4 || !state.scores.every(n => Number.isInteger(n) && n >= 0 && n < 100000)) return false;
      if (!Array.isArray(state.hands) || state.hands.length !== 4 || !state.hands.every(Array.isArray)) return false;
      if (!Array.isArray(state.history) || state.history.length > 13 || !Array.isArray(state.trick) || state.trick.length > 4) return false;
      if (!Array.isArray(state.received) || state.received.length > 3 || new Set(state.received).size !== state.received.length || !state.received.every(c => state.hands[0].includes(c))) return false;
      if (typeof state.heartsBroken !== 'boolean') return false;
      const plays = [...state.history.flatMap(t => t.cards),...state.trick];
      if (!plays.every(p => p && Number.isInteger(p.player) && p.player >= 0 && p.player < 4)) return false;
      const cards = [...state.hands.flat(),...plays.map(p => p.card)];
      if (cards.length !== 52 || new Set(cards).size !== 52 || !cards.every(c => deck().includes(c))) return false;
      if (!state.hands.every((hand,p) => hand.length + plays.filter(play => play.player === p).length === 13)) return false;
      const computedPoints = [0,0,0,0];
      for (const trick of state.history) {
        const result = trickResult(trick.cards);
        if (result.winner !== trick.winner || result.points !== trick.points) return false;
        computedPoints[result.winner] += result.points;
      }
      if (JSON.stringify(computedPoints) !== JSON.stringify(state.handPoints)) return false;
      if (state.heartsBroken !== plays.some(p => suit(p.card) === 'H')) return false;
      // Replay public play from the reconstructed post-pass hands to reject corrupt saves.
      const replay = { phase:'play', hands:state.hands.map((hand,p) => [...hand,...plays.filter(play => play.player === p).map(play => play.card)]), history:[], trick:[], heartsBroken:false };
      replay.turn = replay.hands.findIndex(hand => hand.includes('2C'));
      for (const play of plays) {
        if (!legalCards(replay,play.player).includes(play.card)) return false;
        replay.hands[play.player] = replay.hands[play.player].filter(c => c !== play.card);
        replay.trick.push(play);
        replay.heartsBroken ||= suit(play.card) === 'H';
        replay.turn = (play.player + 1) % 4;
        if (replay.trick.length === 4) { replay.turn = trickResult(replay.trick).winner; replay.history.push({cards:replay.trick}); replay.trick = []; }
      }
      if (state.phase === 'pass' || state.phase === 'received') return !plays.length && state.turn === null && !state.result && (state.phase !== 'pass' || state.passOffset !== 0);
      if (state.phase === 'play') return state.history.length < 13 && state.trick.length < 4 && state.turn === replay.turn && !state.result && !state.received.length;
      if (state.phase === 'trick-end') return state.trick.length === 4 && state.turn === null && !state.result && !state.received.length;
      if (state.history.length !== 13 || state.trick.length || state.turn !== null || !state.result) return false;
      const result = scoreRound(state.result.before,computedPoints);
      return JSON.stringify(result) === JSON.stringify(state.result) && JSON.stringify(result.totals) === JSON.stringify(state.scores) &&
        (state.phase === 'game-over') === (result.winner !== null);
    } catch { return false; }
  }
  return { deck, rank, suit, points, sort, newGame, pass, begin, legalCards, play, trickResult, collect, nextHand, scoreRound, viewFor, choosePass, choosePlay, validate };
});
