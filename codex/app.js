'use strict';
(() => {
  const E = HeartsEngine, L = HeartsText, $ = id => document.getElementById(id);
  const KEY = 'codex-hearts-game-v2', BACKUP = KEY + '-backup', PREFS = 'codex-hearts-settings-v2';
  const params = new URLSearchParams(location.search);
  let preferences = { language:(navigator.languages || [navigator.language]).map(s => s.slice(0,2)).find(s => ['en','es','vi'].includes(s)) || 'en', pace:'slow', sound:false };
  try { const p = JSON.parse(localStorage.getItem(PREFS)); if (p) preferences = { language:['en','es','vi'].includes(p.language) ? p.language : preferences.language, pace:['slow','normal','fast'].includes(p.pace) ? p.pace : 'slow', sound:p.sound === true }; } catch {}
  if (['en','es','vi'].includes(params.get('lang'))) preferences.language = params.get('lang');
  L.set(preferences.language);
  const t = L.t;
  const names = () => [t('you'),'Michael','Jerry','Barbara'];
  const suitKey = {C:'clubs',D:'diamonds',S:'spades',H:'hearts'};
  const rankKey = {A:'ace',J:'jack',Q:'queen',K:'king'};
  const cardName = code => t('cardName',{rank:rankKey[code.slice(0,-1)] ? t(rankKey[code.slice(0,-1)]) : code.slice(0,-1),suit:t(suitKey[E.suit(code)])});
  const face = code => cardSVG(code.slice(0,-1),E.suit(code));
  const esc = text => String(text).replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const check = '<span class="check" aria-hidden="true"><svg viewBox="0 0 18 18"><path d="m3 9 4 4 8-8" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  const random = () => { const bytes = new Uint32Array(1); crypto.getRandomValues(bytes); return bytes[0] / 4294967296; };
  let game, selected = [], timer = null, saveProblem = false, recovery = '', audio = null;
  const read = key => { try { const value = JSON.parse(localStorage.getItem(key)); return value?.version === 2 && E.validate(value.game) ? value : null; } catch { return null; } };
  const saved = read(KEY) || read(BACKUP);
  if (saved) {
    game = saved.game;
    selected = Array.isArray(saved.selected) ? [...new Set(saved.selected)].filter(c => game.hands[0].includes(c)) : [];
    selected = game.phase === 'pass' ? selected.slice(0,3) : game.phase === 'play' && game.turn === 0 ? selected.filter(c => E.legalCards(game,0).includes(c)).slice(0,1) : [];
    if (!read(KEY)) recovery = t('recovered');
  } else {
    game = E.newGame(random);
    try { if (localStorage.getItem(KEY)) recovery = t('damaged'); } catch {}
  }
  document.documentElement.dataset.layout = 'overlap';

  function save() {
    try {
      const old = localStorage.getItem(KEY);
      if (old && read(KEY)) localStorage.setItem(BACKUP,old);
      localStorage.setItem(KEY,JSON.stringify({version:2,game,selected}));
      localStorage.setItem(PREFS,JSON.stringify(preferences));
      saveProblem = false;
    } catch { saveProblem = true; }
    $('save-note').textContent = t(saveProblem ? 'savedProblem' : 'saveNote');
  }
  function announce(message) { $('live-status').textContent = message; }
  function stopTimer() { clearTimeout(timer); timer = null; }
  function schedule() {
    stopTimer();
    if (document.hidden || document.querySelector('dialog[open]') || game.phase !== 'play' || game.turn === 0) return;
    timer = setTimeout(() => {
      timer = null;
      if (document.hidden || document.querySelector('dialog[open]') || game.phase !== 'play' || game.turn === 0) return;
      const player = game.turn;
      commit(E.play(game,player,E.choosePlay(E.viewFor(game,player))));
    },{slow:1500,normal:1000,fast:550}[preferences.pace]);
  }
  function unlockSound() {
    if (!preferences.sound) return;
    try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume().catch(()=>{}); } catch {}
  }
  function sound() {
    if (!preferences.sound || !audio || audio.state !== 'running') return;
    const oscillator = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
    oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(360,now);
    gain.gain.setValueAtTime(.025,now); gain.gain.exponentialRampToValueAtTime(.001,now + .07);
    oscillator.connect(gain).connect(audio.destination); oscillator.start(now); oscillator.stop(now + .08);
  }
  function commit(next) {
    stopTimer(); game = next; selected = []; save(); render(); sound();
    if (!$('result-screen').hidden) $('result-title').focus({preventScroll:true});
    announce($('result-screen').hidden ? $('table-status').textContent : $('result-title').textContent);
  }
  const passDirection = offset => ({1:'left',3:'right',2:'across'}[offset]);
  const actionForPass = () => ({1:'passLeft',3:'passRight',2:'passAcross'}[game.passOffset]);
  const currentTrick = () => game.phase === 'trick-end' ? {cards:game.trick,...E.trickResult(game.trick)} : game.history.at(-1);
  const isResult = () => game.phase === 'hand-end' || game.phase === 'game-over';

  function renderHand() {
    const focused = document.activeElement?.dataset?.card;
    const hand = game.hands[0], legal = E.legalCards(game,0);
    const rows = [hand.slice(0,5),hand.slice(5,9),hand.slice(9,13)].filter(row => row.length);
    $('hand').style.setProperty('--row-count',rows.length);
    $('hand').style.setProperty('--row-gaps',Math.max(0,rows.length - 1));
    $('hand').innerHTML = rows.map(row => `<div class="hand-row">${row.map(code => {
      const playable = game.phase === 'play' && legal.includes(code);
      const unavailable = game.phase !== 'pass' && !playable;
      return `<button type="button" class="card ${playable ? 'playable' : ''} ${unavailable ? 'unavailable' : ''} ${game.received.includes(code) ? 'received' : ''}" data-card="${code}" data-new="${esc(t('newLabel'))}" aria-label="${esc(cardName(code))}" aria-pressed="${selected.includes(code)}"${unavailable ? ' aria-disabled="true"' : ''}>${face(code)}${check}</button>`;
    }).join('')}</div>`).join('');
    $('hand').querySelectorAll('.card').forEach(button => button.addEventListener('click',() => selectCard(button.dataset.card)));
    $('hand').querySelectorAll('.card-svg').forEach(svg => svg.setAttribute('aria-hidden','true'));
    if (focused) $('hand').querySelector(`[data-card="${focused}"]`)?.focus({preventScroll:true});
  }
  function renderTable() {
    const passing = game.phase === 'pass' || game.phase === 'received';
    document.querySelector('.table').classList.toggle('play',!passing);
    if (passing) {
      const cards = game.phase === 'received' ? game.received : selected;
      $('center-cards').innerHTML = game.passOffset ? Array.from({length:3},(_,i) => `<div class="pass-slot ${cards[i] ? 'filled' : ''}">${cards[i] ? face(cards[i]) : i+1}</div>`).join('') : '';
      $('center-cards').setAttribute('aria-label',cards.map(cardName).join(', '));
      $('table-status').textContent = !game.passOffset ? t('hold') : game.phase === 'received' ? t('receivedFrom',{name:names()[(4-game.passOffset)%4]}) : t('passTo',{direction:t(passDirection(game.passOffset)),name:names()[game.passOffset]});
    } else {
      const positions = ['you-played','west','north','east'];
      $('center-cards').innerHTML = game.trick.map(play => `<div class="trick-card ${positions[play.player]}" aria-label="${esc(names()[play.player] + ': ' + cardName(play.card))}" role="img">${face(play.card)}</div>`).join('');
      $('center-cards').setAttribute('aria-label',game.trick.map(play => names()[play.player] + ': ' + cardName(play.card)).join(', '));
      if (game.phase === 'trick-end') {
        const result = E.trickResult(game.trick);
        $('table-status').textContent = t(result.winner === 0 ? 'yourTrick' : 'trickWon',{name:names()[result.winner],n:result.points});
      } else if (game.turn === 0) {
        $('table-status').textContent = game.trick.length ? t('follow',{suit:t(suitKey[E.suit(game.trick[0].card)])}) : t('yourTurn');
        if (game.trick.length && !game.hands[0].some(c => E.suit(c) === E.suit(game.trick[0].card))) $('table-status').textContent = t('yourTurn');
      } else $('table-status').textContent = t('turn',{name:names()[game.turn]});
    }
    $('center-cards').querySelectorAll('svg').forEach(svg => svg.setAttribute('aria-hidden','true'));
    document.querySelectorAll('.seat').forEach((seat,i) => seat.classList.toggle('is-turn',game.phase === 'play' && game.turn === i+1));
  }
  function renderAction() {
    const action = $('primary-action'), detail = $('action-detail');
    detail.hidden = false;
    if (game.phase === 'pass') {
      $('instruction').textContent = t(selected.length === 3 ? 'ready' : 'choose3');
      $('action-label').textContent = t(actionForPass()); detail.textContent = t('count3',{n:selected.length}); action.disabled = selected.length !== 3;
    } else if (game.phase === 'received') {
      $('instruction').textContent = t(game.passOffset ? 'received' : 'chooseCard');
      $('action-label').textContent = t(game.passOffset ? 'continue' : 'begin'); detail.hidden = true; action.disabled = false;
    } else if (game.phase === 'trick-end') {
      $('instruction').textContent = t('cardPlayed');
      $('action-label').textContent = t(game.history.length === 12 ? 'seeScores' : 'nextTrick'); detail.hidden = true; action.disabled = false;
    } else {
      const legal = E.legalCards(game,0);
      $('instruction').textContent = game.turn !== 0 ? t('wait') : !game.history.length && !game.trick.length ? t('leadTwo') : t('chooseCard');
      $('action-label').textContent = t(game.turn === 0 ? 'playCard' : 'wait');
      detail.textContent = selected.length ? selected[0].replace(/C$/,'♣').replace(/D$/,'♦').replace(/S$/,'♠').replace(/H$/,'♥') : t('choose1');
      detail.hidden = game.turn !== 0; action.disabled = game.turn !== 0 || selected.length !== 1 || !legal.includes(selected[0]);
    }
    document.querySelector('.action-arrow').style.transform = game.phase === 'pass' ? ({1:'',3:'rotate(180deg)',2:'rotate(90deg)'}[game.passOffset]) : 'rotate(180deg)';
  }
  function renderResult() {
    const result = game.result, over = game.phase === 'game-over';
    const order = [0,1,2,3]; if (over) order.sort((a,b) => game.scores[a] - game.scores[b]);
    const nextOffset = [1,3,2,0][game.handNumber % 4];
    $('result-screen').innerHTML = `<div class="result-heading"><h2 id="result-title" tabindex="-1">${esc(over ? result.winner === 0 ? t('youWon') : t('won',{name:names()[result.winner]}) : t('handComplete'))}</h2>${result.moon === -1 && !result.tied ? `<p>${esc(over ? t('lowestScore',{n:game.scores[result.winner]}) : t('lowest'))}</p>` : ''}</div>
      ${result.moon !== -1 ? `<div class="result-notice"><strong>${esc(t('moon',{name:names()[result.moon]}))}</strong><p>${esc(t('moonDetail'))}</p></div>` : ''}
      ${over && result.moon === -1 ? `<p class="game-end-reason">${esc(t('endReason'))}</p>` : ''}
      <table class="result-scores"><caption class="sr-only">${esc(t('totalScores'))}</caption><thead><tr><th scope="col">${esc(t('player'))}</th><th scope="col">${esc(t('thisHand'))}</th><th scope="col">${esc(t('total'))}</th></tr></thead><tbody>${order.map(p => `<tr class="${p===0?'your-score-row':''}"><th scope="row">${esc(names()[p])}</th><td class="score-added">${result.added[p] ? '+' : ''}${result.added[p]}</td><td class="score-total">${game.scores[p]}</td></tr>`).join('')}</tbody></table>
      <div class="result-footer">${over ? '' : `<p>${esc(result.tied ? t('tie') : nextOffset ? t('nextPass',{direction:t(passDirection(nextOffset))}) : t('nextHold'))}</p>`}<button class="result-continue" type="button">${esc(t(over ? 'playAgain' : 'continue'))}</button></div>`;
    $('result-screen').querySelector('.result-continue').addEventListener('click',() => commit(over ? E.newGame(random) : E.nextHand(game,random)));
  }
  function render() {
    document.querySelectorAll('[data-i18n]').forEach(node => node.textContent = t(node.dataset.i18n));
    document.title = t('title');
    document.querySelectorAll('[data-close].close-button').forEach(button => button.setAttribute('aria-label',t('close')));
    $('help-button').setAttribute('aria-label',t('help'));
    document.querySelectorAll('[data-total-for]').forEach(node => node.textContent = game.scores[['You','Michael','Jerry','Barbara'].indexOf(node.dataset.totalFor)]);
    document.querySelector('.you-score').setAttribute('aria-label',t('you') + ': ' + t('points',{n:game.scores[0]}));
    const pending = game.phase === 'trick-end' ? E.trickResult(game.trick) : null;
    $('hand-points-note').textContent = t('handPoints',{n:game.handPoints[0] + (pending?.winner === 0 ? pending.points : 0)});
    $('last-trick-button').disabled = !currentTrick();
    $('save-note').textContent = t(saveProblem ? 'savedProblem' : 'saveNote');
    const results = isResult();
    document.querySelector('.game').classList.toggle('showing-results',results);
    $('result-screen').hidden = !results;
    if (results) renderResult(); else { renderHand(); renderTable(); renderAction(); }
    $('language').value = preferences.language; $('pace').value = preferences.pace; $('sound').value = preferences.sound ? 'on' : 'off';
    schedule();
  }
  function selectCard(code) {
    unlockSound();
    if (game.phase !== 'pass' && (game.phase !== 'play' || game.turn !== 0)) return;
    if (game.phase === 'play' && !E.legalCards(game,0).includes(code)) { announce(t('chooseLegal')); return; }
    if (selected.includes(code)) selected = selected.filter(c => c !== code);
    else if (game.phase === 'pass') {
      if (selected.length === 3) { announce(t('limit3')); return; }
      selected.push(code);
    } else selected = [code];
    save(); render();
    announce(game.phase === 'pass' ? t('count3',{n:selected.length}) : selected.length ? t('selected',{card:cardName(code)}) : t('chooseCard'));
  }
  $('primary-action').addEventListener('click',() => {
    unlockSound();
    if (game.phase === 'pass' && selected.length === 3) commit(E.pass(game,[selected,...[1,2,3].map(p => E.choosePass(E.viewFor(game,p)))]));
    else if (game.phase === 'received') commit(E.begin(game));
    else if (game.phase === 'trick-end') commit(E.collect(game));
    else if (game.phase === 'play' && game.turn === 0 && selected.length === 1) commit(E.play(game,0,selected[0]));
  });
  function openDialog(id) { stopTimer(); $(id).showModal(); }
  function showLastTrick() {
    const trick = currentTrick(); if (!trick) return;
    if ($('menu-dialog').open) $('menu-dialog').close();
    const led = E.suit(trick.cards[0].card), hearts = trick.cards.filter(p => E.suit(p.card) === 'H').length;
    const details = [...(trick.cards.some(p => p.card === 'QS') ? [t('queenPoints')] : []),...(hearts ? [t('heartPoints',{n:hearts})] : [])];
    $('last-trick-content').innerHTML = `<p class="trick-winner">${esc(t(trick.winner === 0 ? 'youTookTrick' : 'tookTrick',{name:names()[trick.winner]}))}</p><p class="trick-led">${esc(t('led',{name:names()[trick.cards[0].player],suit:t(suitKey[led])}))}</p><div class="review-cards">${trick.cards.map(play => `<figure class="review-play ${play.player===trick.winner?'review-winner':''}"><figcaption>${esc(names()[play.player])}</figcaption><div class="review-card" role="img" aria-label="${esc(cardName(play.card))}">${face(play.card)}</div></figure>`).join('')}</div><div class="trick-points"><strong>${esc(t('points',{n:trick.points}))}</strong><p>${esc(details.length ? details.join(' · ') : t('noPoints'))}</p></div>`;
    $('last-trick-content').querySelectorAll('svg').forEach(svg => svg.setAttribute('aria-hidden','true'));
    openDialog('last-trick-dialog');
  }
  $('menu-button').addEventListener('click',() => openDialog('menu-dialog'));
  $('help-button').addEventListener('click',() => openDialog('help-dialog'));
  $('last-trick-button').addEventListener('click',showLastTrick);
  $('settings-button').addEventListener('click',() => { $('menu-dialog').close(); openDialog('settings-dialog'); });
  $('new-game').addEventListener('click',() => { $('menu-dialog').close(); openDialog('new-dialog'); });
  $('restart').addEventListener('click',() => { $('new-dialog').close(); commit(E.newGame(random)); });
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click',() => button.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('close',schedule));
  $('language').addEventListener('change',() => { preferences.language = $('language').value; L.set(preferences.language); save(); render(); });
  $('pace').addEventListener('change',() => { preferences.pace = $('pace').value; save(); schedule(); });
  $('sound').addEventListener('change',() => { preferences.sound = $('sound').value === 'on'; unlockSound(); sound(); save(); });
  document.addEventListener('visibilitychange',() => { if (document.hidden) { stopTimer(); save(); } else schedule(); });
  window.addEventListener('pagehide',() => { stopTimer(); save(); });
  window.addEventListener('storage',event => {
    if (event.key !== KEY || !event.newValue) return;
    const latest = read(KEY); if (!latest) return;
    stopTimer(); game = latest.game; selected = []; render();
  });
  render(); save(); if (recovery) announce(recovery);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('service-worker.js').catch(()=>{});
})();
