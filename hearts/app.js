(() => {
  "use strict";

  const SUITS = [
    { id: "clubs", symbol: "♣", name: "Clubs", color: "black", order: 0 },
    { id: "diamonds", symbol: "♦", name: "Diamonds", color: "red", order: 1 },
    { id: "spades", symbol: "♠", name: "Spades", color: "black", order: 2 },
    { id: "hearts", symbol: "♥", name: "Hearts", color: "red", order: 3 }
  ];
  const RANK_LABELS = { 11: "J", 12: "Q", 13: "K", 14: "A" };
  const RANK_NAMES = { 11: "Jack", 12: "Queen", 13: "King", 14: "Ace" };
  const PLAYERS = [
    { name: "You", seat: "South" },
    { name: "West", seat: "West" },
    { name: "North", seat: "North" },
    { name: "East", seat: "East" }
  ];
  const PASS_CYCLE = [
    { id: "left", label: "left", offset: 1 },
    { id: "right", label: "right", offset: 3 },
    { id: "across", label: "across", offset: 2 },
    { id: "hold", label: "none", offset: 0 }
  ];
  const STORAGE_KEY = "hearts-saved-game-v1";
  const SAVE_VERSION = 1;
  const COMPUTER_DELAY_MIN = 460;
  const COMPUTER_DELAY_RANGE = 180;
  const TRICK_PAUSE = 760;

  const appShell = document.getElementById("app");
  const scoreboard = document.getElementById("scoreboard");
  const trickCenter = document.getElementById("trick-center");
  const trickSlots = [...document.querySelectorAll("[data-trick-player]")];
  const humanHand = document.getElementById("human-hand");
  const yourSeat = document.getElementById("player-0");
  const yourCardCount = document.getElementById("your-card-count");
  const turnMessage = document.getElementById("turn-message");
  const turnDetail = document.getElementById("turn-detail");
  const passPanel = document.getElementById("pass-panel");
  const passTitle = document.getElementById("pass-title");
  const passCount = document.getElementById("pass-count");
  const passButton = document.getElementById("pass-button");
  const newGameButton = document.getElementById("new-game-button");
  const helpButton = document.getElementById("help-button");
  const helpModal = document.getElementById("help-modal");
  const helpCloseButton = document.getElementById("help-close-button");
  const helpDoneButton = document.getElementById("help-done-button");
  const newGameModal = document.getElementById("new-game-modal");
  const cancelNewGameButton = document.getElementById("cancel-new-game-button");
  const confirmNewGameButton = document.getElementById("confirm-new-game-button");
  const summaryModal = document.getElementById("summary-modal");
  const summaryNote = document.getElementById("summary-note");
  const handResults = document.getElementById("hand-results");
  const continueButton = document.getElementById("continue-button");
  const gameOverOverlay = document.getElementById("game-over-overlay");
  const gameOverTitle = document.getElementById("game-over-title");
  const gameOverMessage = document.getElementById("game-over-message");
  const finalStandings = document.getElementById("final-standings");
  const playAgainButton = document.getElementById("play-again-button");
  const announcer = document.getElementById("announcer");

  let game = loadGame() || createGame();
  let selectedPassIds = new Set();
  let progressTimer = 0;
  let activeUtilityModal = null;
  let previousFocus = null;

  function suitFor(card) {
    return SUITS.find((suit) => suit.id === card.suit);
  }

  function rankLabel(rank) {
    return RANK_LABELS[rank] || String(rank);
  }

  function rankName(rank) {
    return RANK_NAMES[rank] || String(rank);
  }

  function cardName(card) {
    return `${rankName(card.rank)} of ${suitFor(card).name}`;
  }

  function cardPoints(card) {
    if (card.suit === "hearts") return 1;
    if (card.id === "spades-12") return 13;
    return 0;
  }

  function createDeck() {
    return SUITS.flatMap((suit) =>
      Array.from({ length: 13 }, (_, index) => {
        const rank = index + 2;
        return { id: `${suit.id}-${rank}`, suit: suit.id, rank };
      })
    );
  }

  function randomNumber() {
    if (window.crypto && window.crypto.getRandomValues) {
      const value = new Uint32Array(1);
      window.crypto.getRandomValues(value);
      return value[0] / 4294967296;
    }
    return Math.random();
  }

  function shuffle(cards) {
    for (let index = cards.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(randomNumber() * (index + 1));
      [cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
    }
    return cards;
  }

  function sortHand(hand) {
    hand.sort((first, second) => {
      const suitDifference = suitFor(first).order - suitFor(second).order;
      return suitDifference || first.rank - second.rank;
    });
  }

  function createGame() {
    const newGame = {
      version: SAVE_VERSION,
      scores: [0, 0, 0, 0],
      handNumber: 1
    };
    dealHand(newGame);
    return newGame;
  }

  function dealHand(targetGame) {
    const hands = Array.from({ length: 4 }, () => []);
    shuffle(createDeck()).forEach((card, index) => {
      hands[index % 4].push(card);
    });
    hands.forEach(sortHand);

    const passIndex = (targetGame.handNumber - 1) % PASS_CYCLE.length;
    const passDirection = PASS_CYCLE[passIndex].id;
    Object.assign(targetGame, {
      version: SAVE_VERSION,
      passIndex,
      passDirection,
      phase: passDirection === "hold" ? "no-pass" : "passing",
      hands,
      trick: [],
      trickNumber: 0,
      currentPlayer: null,
      heartsBroken: false,
      takenCards: Array.from({ length: 4 }, () => []),
      moonPlans: [false, false, false, false],
      handResult: null,
      gameEnded: false,
      lastAction: passDirection === "hold" ? "No cards pass this hand." : "Choose three cards to pass."
    });
  }

  function isValidSavedGame(candidate) {
    if (!candidate || candidate.version !== SAVE_VERSION) return false;
    if (!Array.isArray(candidate.scores) || candidate.scores.length !== 4) return false;
    if (!candidate.scores.every((score) => Number.isInteger(score) && score >= 0)) return false;
    if (!Number.isInteger(candidate.handNumber) || candidate.handNumber < 1) return false;
    if (!Array.isArray(candidate.hands) || candidate.hands.length !== 4) return false;
    if (!Array.isArray(candidate.trick) || !Array.isArray(candidate.takenCards) || candidate.takenCards.length !== 4) return false;
    if (!["passing", "no-pass", "playing", "resolving", "hand-summary", "game-over"].includes(candidate.phase)) return false;

    const cards = [
      ...candidate.hands.flat(),
      ...candidate.trick.map((play) => play.card),
      ...candidate.takenCards.flat()
    ];
    const expected = new Map(createDeck().map((card) => [card.id, card]));
    if (cards.length !== 52 || new Set(cards.map((card) => card.id)).size !== 52) return false;
    return cards.every((card) => {
      const match = card && expected.get(card.id);
      return match && match.suit === card.suit && match.rank === card.rank;
    });
  }

  function loadGame() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!isValidSavedGame(saved)) return null;
      saved.hands.forEach(sortHand);
      if (!Array.isArray(saved.moonPlans) || saved.moonPlans.length !== 4) saved.moonPlans = [false, false, false, false];
      return saved;
    } catch (error) {
      return null;
    }
  }

  function saveGame() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
    } catch (error) {
      // The game remains playable if private browsing blocks local storage.
    }
  }

  function passRule() {
    return PASS_CYCLE[game.passIndex];
  }

  function findCardOwner(cardId) {
    return game.hands.findIndex((hand) => hand.some((card) => card.id === cardId));
  }

  function evaluateMoonHand(hand) {
    const hearts = hand.filter((card) => card.suit === "hearts");
    const heartRanks = new Set(hearts.map((card) => card.rank));
    const strongCards = hand.filter((card) => card.rank >= 13).length;
    const hasTopHearts = heartRanks.has(14) && heartRanks.has(13) && heartRanks.has(12);
    return (hearts.length >= 7 && hasTopHearts && strongCards >= 5)
      || (hearts.length >= 8 && heartRanks.has(14) && heartRanks.has(13) && strongCards >= 4);
  }

  function preparePlay(message) {
    game.phase = "playing";
    game.currentPlayer = findCardOwner("clubs-2");
    game.moonPlans = game.hands.map((hand, player) => player > 0 && evaluateMoonHand(hand));
    game.lastAction = message || `${PLAYERS[game.currentPlayer].name} has the 2 of Clubs.`;
    selectedPassIds.clear();
    saveGame();
    render();
    announce(game.lastAction);
    scheduleProgress();
  }

  function passValue(card, hand) {
    const suitCount = hand.filter((other) => other.suit === card.suit).length;
    let value = card.rank;

    if (card.id === "spades-12") value += 1000;
    else if (card.suit === "hearts" && card.rank >= 10) value += 700 + card.rank * 12;
    else if (card.suit === "spades" && card.rank >= 13) value += 600 + card.rank * 8;
    else if (card.suit === "hearts") value += 280 + card.rank * 10;
    else if (card.rank === 14) value += 440;
    else if (card.rank === 13) value += 360;
    else if (card.rank === 12) value += 270;
    else if (card.rank === 11) value += 150;

    if (suitCount <= 3 && card.rank >= 10) value += (4 - suitCount) * 32;
    if (card.id === "clubs-2") value -= 300;
    return value;
  }

  function choosePassCards(hand) {
    return [...hand]
      .sort((first, second) => passValue(second, hand) - passValue(first, hand))
      .slice(0, 3);
  }

  function completePassing() {
    if (game.phase !== "passing" || selectedPassIds.size !== 3) return;

    const passing = game.hands.map((hand, player) => {
      if (player === 0) return hand.filter((card) => selectedPassIds.has(card.id));
      return choosePassCards(hand);
    });
    const incoming = Array.from({ length: 4 }, () => []);
    const offset = passRule().offset;

    passing.forEach((cards, player) => {
      const passedIds = new Set(cards.map((card) => card.id));
      game.hands[player] = game.hands[player].filter((card) => !passedIds.has(card.id));
      incoming[(player + offset) % 4].push(...cards);
    });
    incoming.forEach((cards, player) => {
      game.hands[player].push(...cards);
      sortHand(game.hands[player]);
    });

    const receivedNames = incoming[0].map(cardName).join(", ");
    preparePlay(`You received ${receivedNames}.`);
  }

  function legalCardsFor(player) {
    const hand = game.hands[player];
    if (!hand.length) return [];

    if (!game.trick.length) {
      if (game.trickNumber === 0) {
        const twoOfClubs = hand.find((card) => card.id === "clubs-2");
        return twoOfClubs ? [twoOfClubs] : [];
      }
      if (!game.heartsBroken) {
        const nonHearts = hand.filter((card) => card.suit !== "hearts");
        return nonHearts.length ? nonHearts : [...hand];
      }
      return [...hand];
    }

    const leadSuit = game.trick[0].card.suit;
    const followingSuit = hand.filter((card) => card.suit === leadSuit);
    let legal = followingSuit.length ? followingSuit : [...hand];

    if (game.trickNumber === 0) {
      const withoutPoints = legal.filter((card) => card.suit !== "hearts" && card.id !== "spades-12");
      if (withoutPoints.length) legal = withoutPoints;
    }
    return legal;
  }

  function currentWinningPlay() {
    if (!game.trick.length) return null;
    const leadSuit = game.trick[0].card.suit;
    return game.trick
      .filter((play) => play.card.suit === leadSuit)
      .reduce((winner, play) => play.card.rank > winner.card.rank ? play : winner);
  }

  function pointsTaken(player) {
    return game.takenCards[player].reduce((total, card) => total + cardPoints(card), 0);
  }

  function queenIsAccountedFor() {
    return game.trick.some((play) => play.card.id === "spades-12")
      || game.takenCards.some((cards) => cards.some((card) => card.id === "spades-12"));
  }

  function wantsMoon(player) {
    if (game.moonPlans[player]) return true;
    const ownPoints = pointsTaken(player);
    const otherPoints = game.takenCards.reduce((total, cards, index) => {
      if (index === player) return total;
      return total + cards.reduce((sum, card) => sum + cardPoints(card), 0);
    }, 0);
    if (ownPoints < 8 || otherPoints > 0) return false;

    const remaining = game.hands[player];
    const highCards = remaining.filter((card) => card.rank >= 12).length;
    const highHearts = remaining.filter((card) => card.suit === "hearts" && card.rank >= 11).length;
    return highCards >= 4 || highHearts >= 2;
  }

  function chooseMoonCard(legal) {
    if (!game.trick.length) {
      const highHearts = legal.filter((card) => card.suit === "hearts").sort((a, b) => b.rank - a.rank);
      if (highHearts.length) return highHearts[0];
      return [...legal].sort((a, b) => b.rank - a.rank)[0];
    }

    const leadSuit = game.trick[0].card.suit;
    const followsSuit = legal[0].suit === leadSuit;
    if (followsSuit) {
      const winningRank = currentWinningPlay().card.rank;
      const winners = legal.filter((card) => card.rank > winningRank).sort((a, b) => a.rank - b.rank);
      if (winners.length) return winners[0];
    }

    const nonPoints = legal.filter((card) => cardPoints(card) === 0).sort((a, b) => a.rank - b.rank);
    return nonPoints[0] || [...legal].sort((a, b) => a.rank - b.rank)[0];
  }

  function chooseLeadCard(player, legal) {
    let candidates = [...legal];
    const nonHearts = candidates.filter((card) => card.suit !== "hearts");
    if (nonHearts.length) candidates = nonHearts;

    if (!queenIsAccountedFor()) {
      const nonSpades = candidates.filter((card) => card.suit !== "spades");
      if (nonSpades.length) candidates = nonSpades;
    }

    const nonQueen = candidates.filter((card) => card.id !== "spades-12");
    if (nonQueen.length) candidates = nonQueen;

    const suitSizes = new Map(SUITS.map((suit) => [
      suit.id,
      game.hands[player].filter((card) => card.suit === suit.id).length
    ]));
    return candidates.sort((first, second) => {
      const sizeDifference = suitSizes.get(first.suit) - suitSizes.get(second.suit);
      return sizeDifference || first.rank - second.rank;
    })[0];
  }

  function chooseAiCard(player) {
    const legal = legalCardsFor(player);
    if (legal.length === 1) return legal[0];
    if (wantsMoon(player)) return chooseMoonCard(legal);
    if (!game.trick.length) return chooseLeadCard(player, legal);

    const leadSuit = game.trick[0].card.suit;
    const followsSuit = legal[0].suit === leadSuit;
    if (!followsSuit) {
      const queen = legal.find((card) => card.id === "spades-12");
      if (queen) return queen;
      const hearts = legal.filter((card) => card.suit === "hearts").sort((a, b) => b.rank - a.rank);
      if (hearts.length) return hearts[0];
      return [...legal].sort((a, b) => b.rank - a.rank)[0];
    }

    const winningRank = currentWinningPlay().card.rank;
    const queen = legal.find((card) => card.id === "spades-12");
    if (queen && winningRank > queen.rank) return queen;

    const pointsOnTable = game.trick.reduce((total, play) => total + cardPoints(play.card), 0);
    const isLastToPlay = game.trick.length === 3;
    const winners = legal.filter((card) => card.rank > winningRank);
    const under = legal.filter((card) => card.rank < winningRank).sort((a, b) => b.rank - a.rank);

    if (isLastToPlay && pointsOnTable === 0) {
      const cleanWinners = winners
        .filter((card) => cardPoints(card) === 0)
        .sort((a, b) => b.rank - a.rank);
      if (cleanWinners.length) return cleanWinners[0];
    }
    if (under.length) return under[0];

    const nonQueenWinners = winners.filter((card) => card.id !== "spades-12").sort((a, b) => b.rank - a.rank);
    if (nonQueenWinners.length) return nonQueenWinners[0];
    return [...legal].sort((a, b) => a.rank - b.rank)[0];
  }

  function playCard(player, cardId) {
    if (game.phase !== "playing" || game.currentPlayer !== player) return;
    const legal = legalCardsFor(player);
    const card = legal.find((candidate) => candidate.id === cardId);
    if (!card) return;

    const handIndex = game.hands[player].findIndex((candidate) => candidate.id === cardId);
    game.hands[player].splice(handIndex, 1);
    game.trick.push({ player, card });
    if (card.suit === "hearts") game.heartsBroken = true;
    game.lastAction = `${PLAYERS[player].name} played ${cardName(card)}.`;

    if (game.trick.length === 4) {
      game.phase = "resolving";
    } else {
      game.currentPlayer = (player + 1) % 4;
    }
    saveGame();
    render();
    announce(game.lastAction);
    scheduleProgress();
  }

  function resolveTrick() {
    if (game.phase !== "resolving" || game.trick.length !== 4) return;
    const winner = currentWinningPlay().player;
    game.takenCards[winner].push(...game.trick.map((play) => play.card));
    game.trick = [];
    game.trickNumber += 1;
    game.lastAction = `${PLAYERS[winner].name} took the trick.`;

    if (game.trickNumber >= 13) {
      finishHand();
      return;
    }

    game.currentPlayer = winner;
    game.phase = "playing";
    saveGame();
    render();
    announce(game.lastAction);
    scheduleProgress();
  }

  function calculateHandResult(takenCards, currentScores) {
    const rawPoints = takenCards.map((cards) =>
      cards.reduce((total, card) => total + cardPoints(card), 0)
    );
    const moonShooter = rawPoints.findIndex((points) => points === 26);
    const addedPoints = moonShooter >= 0
      ? rawPoints.map((points, player) => player === moonShooter ? 0 : 26)
      : [...rawPoints];
    const totals = currentScores.map((score, player) => score + addedPoints[player]);
    return {
      rawPoints,
      addedPoints,
      totals,
      moonShooter,
      gameEnded: totals.some((score) => score >= 100)
    };
  }

  function finishHand() {
    const result = calculateHandResult(game.takenCards, game.scores);
    game.scores = result.totals;
    game.gameEnded = result.gameEnded;
    game.handResult = {
      rawPoints: result.rawPoints,
      addedPoints: result.addedPoints,
      totals: [...result.totals],
      moonShooter: result.moonShooter
    };
    game.phase = "hand-summary";
    game.currentPlayer = null;
    game.lastAction = result.moonShooter >= 0
      ? `${PLAYERS[result.moonShooter].name} shot the moon.`
      : "The hand is complete.";
    saveGame();
    render();
    announce(game.lastAction);
  }

  function scheduleProgress() {
    window.clearTimeout(progressTimer);
    if (activeUtilityModal) return;

    if (game.phase === "no-pass") {
      progressTimer = window.setTimeout(() => preparePlay("No cards passed this hand."), 900);
      return;
    }
    if (game.phase === "resolving") {
      progressTimer = window.setTimeout(resolveTrick, TRICK_PAUSE);
      return;
    }
    if (game.phase === "playing" && game.currentPlayer !== 0) {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const delay = prefersReducedMotion ? 100 : COMPUTER_DELAY_MIN + Math.floor(randomNumber() * COMPUTER_DELAY_RANGE);
      progressTimer = window.setTimeout(() => {
        if (game.phase !== "playing" || game.currentPlayer === 0) return;
        const player = game.currentPlayer;
        const card = chooseAiCard(player);
        if (card) playCard(player, card.id);
      }, delay);
    }
  }

  function makeCardElement(card, options = {}) {
    const element = document.createElement(options.interactive ? "button" : "div");
    const suit = suitFor(card);
    element.className = `playing-card${suit.color === "red" ? " red-card" : ""}${options.trick ? " trick-card" : ""}`;
    if (options.interactive) {
      element.type = "button";
      element.dataset.cardId = card.id;
    }
    element.setAttribute("aria-label", options.ariaLabel || cardName(card));
    element.innerHTML = `
      <span class="card-face" aria-hidden="true">
        <span class="card-rank">${rankLabel(card.rank)}</span>
        <span class="card-suit-big">${suit.symbol}</span>
      </span>
    `;
    return element;
  }

  function renderScoreboard() {
    scoreboard.replaceChildren();
    PLAYERS.forEach((player, index) => {
      const cell = document.createElement("div");
      cell.className = `score-cell${index === 0 ? " you" : ""}`;
      const handPoints = pointsTaken(index);
      cell.innerHTML = `
        <span class="score-name">${player.name}</span>
        <span class="score-total">${game.scores[index]}</span>
        <span class="score-hand">Hand +${handPoints}</span>
      `;
      cell.setAttribute("aria-label", `${player.name}: ${game.scores[index]} total points, ${handPoints} this hand.`);
      scoreboard.appendChild(cell);
    });
  }

  function renderOpponents() {
    for (let player = 1; player < 4; player += 1) {
      const element = document.getElementById(`player-${player}`);
      const count = game.hands[player].length;
      const isCurrent = game.phase === "playing" && game.currentPlayer === player;
      element.classList.toggle("current", isCurrent);
      element.innerHTML = `
        <span class="opponent-name"><span class="turn-dot" aria-hidden="true"></span>${PLAYERS[player].name}</span>
        <span class="mini-hand" aria-hidden="true">
          ${count ? '<i class="mini-card"></i><i class="mini-card"></i><i class="mini-card"></i>' : ""}
        </span>
        <span class="opponent-count">${count}</span>
      `;
      element.setAttribute("aria-label", `${PLAYERS[player].name}, ${count} cards${isCurrent ? ", their turn" : ""}.`);
    }
  }

  function renderTrick() {
    trickSlots.forEach((slot) => {
      slot.replaceChildren();
      const player = Number(slot.dataset.trickPlayer);
      const play = game.trick.find((candidate) => candidate.player === player);
      if (play) slot.appendChild(makeCardElement(play.card, { trick: true }));
    });

    const trickDisplay = Math.min(game.trickNumber + 1, 13);
    trickCenter.innerHTML = `<span>Trick ${trickDisplay} of 13</span><br><span>${game.heartsBroken ? "Hearts broken" : "Hearts not broken"}</span>`;
  }

  function humanTurnGuidance() {
    if (!game.trick.length) {
      if (game.trickNumber === 0) return "Lead the 2 of Clubs.";
      if (!game.heartsBroken && game.hands[0].some((card) => card.suit !== "hearts")) return "Hearts have not been broken.";
      return "Lead any highlighted card.";
    }

    const leadSuit = game.trick[0].card.suit;
    const suit = SUITS.find((candidate) => candidate.id === leadSuit);
    if (game.hands[0].some((card) => card.suit === leadSuit)) return `Follow suit: ${suit.name}.`;
    return `You have no ${suit.name}. Play any highlighted card.`;
  }

  function renderStatus() {
    if (game.phase === "passing") {
      turnMessage.textContent = `Choose 3 cards to pass ${passRule().label}.`;
      turnDetail.textContent = "Tap a card to select or unselect it.";
      return;
    }
    if (game.phase === "no-pass") {
      turnMessage.textContent = "Hold hand — no passing.";
      turnDetail.textContent = `Hand ${game.handNumber} begins in a moment.`;
      return;
    }
    if (game.phase === "resolving") {
      turnMessage.textContent = "Finishing the trick…";
      turnDetail.textContent = game.lastAction;
      return;
    }
    if (game.phase === "playing" && game.currentPlayer === 0) {
      turnMessage.textContent = "Your turn";
      turnDetail.textContent = humanTurnGuidance();
      return;
    }
    if (game.phase === "playing") {
      turnMessage.textContent = `${PLAYERS[game.currentPlayer].name} is thinking…`;
      turnDetail.textContent = game.lastAction;
      return;
    }
    turnMessage.textContent = game.phase === "game-over" ? "Game over" : "Hand complete";
    turnDetail.textContent = game.lastAction;
  }

  function renderPassPanel() {
    const showPanel = game.phase === "passing" || game.phase === "no-pass";
    passPanel.hidden = !showPanel;
    if (!showPanel) return;

    if (game.phase === "no-pass") {
      passTitle.textContent = "No pass this hand";
      passCount.textContent = "Everyone keeps the cards they were dealt.";
      passButton.hidden = true;
      return;
    }

    passButton.hidden = false;
    passTitle.textContent = `Pass ${passRule().label}`;
    passCount.textContent = `${selectedPassIds.size} of 3 selected`;
    passButton.disabled = selectedPassIds.size !== 3;
  }

  function renderHumanHand() {
    humanHand.replaceChildren();
    const legalIds = game.phase === "playing" && game.currentPlayer === 0
      ? new Set(legalCardsFor(0).map((card) => card.id))
      : new Set();

    game.hands[0].forEach((card) => {
      const selected = selectedPassIds.has(card.id);
      const passingAvailable = game.phase === "passing" && (selected || selectedPassIds.size < 3);
      const playable = game.phase === "playing" && game.currentPlayer === 0 && legalIds.has(card.id);
      let ariaLabel = cardName(card);
      const element = makeCardElement(card, { interactive: true });

      if (game.phase === "passing") {
        element.classList.toggle("selected", selected);
        element.classList.toggle("unavailable", !passingAvailable);
        element.disabled = !passingAvailable;
        ariaLabel += selected ? ". Selected for passing. Tap to unselect." : ". Tap to select for passing.";
      } else if (playable) {
        element.classList.add("legal");
        ariaLabel += ". Legal card. Tap to play.";
      } else {
        element.classList.add(game.phase === "playing" && game.currentPlayer === 0 ? "illegal" : "waiting");
        element.disabled = true;
        ariaLabel += game.phase === "playing" && game.currentPlayer === 0 ? ". Cannot be played now." : ". Wait for your turn.";
      }

      element.setAttribute("aria-label", ariaLabel);
      humanHand.appendChild(element);
    });

    const count = game.hands[0].length;
    yourCardCount.textContent = `${count} card${count === 1 ? "" : "s"}`;
    yourSeat.classList.toggle("current", game.phase === "playing" && game.currentPlayer === 0);
  }

  function renderSummary() {
    if (!game.handResult) return;
    const result = game.handResult;
    summaryNote.textContent = result.moonShooter >= 0
      ? `${PLAYERS[result.moonShooter].name} shot the moon. Everyone else adds 26.`
      : `Points from hand ${game.handNumber} have been added.`;
    summaryNote.classList.toggle("moon-note", result.moonShooter >= 0);
    handResults.innerHTML = `
      <div class="result-row header"><span>Player</span><span>Taken</span><span>Added</span><span>Total</span></div>
      ${PLAYERS.map((player, index) => `
        <div class="result-row">
          <span>${player.name}</span>
          <span>${result.rawPoints[index]}</span>
          <span>+${result.addedPoints[index]}</span>
          <span>${result.totals[index]}</span>
        </div>
      `).join("")}
    `;
    continueButton.textContent = game.gameEnded ? "See Final Standings" : "Continue";
  }

  function renderGameOver() {
    const ordered = PLAYERS.map((player, index) => ({ ...player, index, score: game.scores[index] }))
      .sort((first, second) => first.score - second.score || first.index - second.index);
    let currentPlace = 0;
    let previousScore = null;
    const ranked = ordered.map((player, index) => {
      if (player.score !== previousScore) currentPlace = index + 1;
      previousScore = player.score;
      return { ...player, place: currentPlace };
    });
    const lowestScore = ordered[0].score;
    const winners = ordered.filter((player) => player.score === lowestScore);
    const humanWon = winners.some((player) => player.index === 0);

    if (humanWon && winners.length === 1) {
      gameOverTitle.textContent = "You Win!";
      gameOverMessage.textContent = "You finished with the lowest score.";
    } else if (humanWon) {
      gameOverTitle.textContent = "Tied for First!";
      gameOverMessage.textContent = `You share the lowest score of ${lowestScore}.`;
    } else if (winners.length > 1) {
      gameOverTitle.textContent = "A Tie!";
      gameOverMessage.textContent = `${winners.map((player) => player.name).join(" and ")} share the lowest score.`;
    } else {
      gameOverTitle.textContent = `${winners[0].name} Wins`;
      gameOverMessage.textContent = `${winners[0].name} finished with the lowest score.`;
    }

    finalStandings.innerHTML = ranked.map((player) => `
      <div class="standing-row">
        <span class="standing-place">${player.place}</span>
        <span>${player.name}</span>
        <span class="standing-score">${player.score} pts</span>
      </div>
    `).join("");
  }

  function setOverlayVisible(element, visible, focusTarget) {
    const wasHidden = element.hidden;
    element.hidden = !visible;
    element.setAttribute("aria-hidden", visible ? "false" : "true");
    if (visible && wasHidden && focusTarget) window.setTimeout(() => focusTarget.focus(), 60);
  }

  function renderPhaseOverlays() {
    const showSummary = game.phase === "hand-summary";
    const showGameOver = game.phase === "game-over";
    if (showSummary) renderSummary();
    if (showGameOver) renderGameOver();
    setOverlayVisible(summaryModal, showSummary, continueButton);
    setOverlayVisible(gameOverOverlay, showGameOver, playAgainButton);
    updateAppInert();
  }

  function render() {
    renderScoreboard();
    renderOpponents();
    renderTrick();
    renderStatus();
    renderPassPanel();
    renderHumanHand();
    renderPhaseOverlays();
  }

  function announce(message) {
    announcer.textContent = "";
    window.setTimeout(() => { announcer.textContent = message; }, 20);
  }

  function handleHumanCard(cardId) {
    if (game.phase === "passing") {
      if (selectedPassIds.has(cardId)) selectedPassIds.delete(cardId);
      else if (selectedPassIds.size < 3) selectedPassIds.add(cardId);
      renderPassPanel();
      renderHumanHand();
      announce(`${selectedPassIds.size} of 3 cards selected.`);
      return;
    }
    if (game.phase === "playing" && game.currentPlayer === 0) playCard(0, cardId);
  }

  function startNextHand() {
    game.handNumber += 1;
    selectedPassIds.clear();
    dealHand(game);
    saveGame();
    render();
    announce(`Hand ${game.handNumber}.`);
    scheduleProgress();
  }

  function continueAfterSummary() {
    if (game.phase !== "hand-summary") return;
    if (game.gameEnded) {
      game.phase = "game-over";
      saveGame();
      render();
      return;
    }
    startNextHand();
  }

  function startNewGame() {
    window.clearTimeout(progressTimer);
    game = createGame();
    selectedPassIds.clear();
    saveGame();
    render();
    announce("New game ready.");
    scheduleProgress();
  }

  function updateAppInert() {
    const overlayVisible = Boolean(activeUtilityModal)
      || game.phase === "hand-summary"
      || game.phase === "game-over";
    appShell.inert = overlayVisible;
    if (overlayVisible) appShell.setAttribute("aria-hidden", "true");
    else appShell.removeAttribute("aria-hidden");
  }

  function openUtilityModal(modal, focusTarget) {
    if (activeUtilityModal) return;
    window.clearTimeout(progressTimer);
    previousFocus = document.activeElement;
    activeUtilityModal = modal;
    setOverlayVisible(modal, true, focusTarget);
    updateAppInert();
  }

  function closeUtilityModal(modal, restoreFocus = true) {
    if (activeUtilityModal !== modal) return;
    setOverlayVisible(modal, false);
    activeUtilityModal = null;
    updateAppInert();
    if (restoreFocus && previousFocus) previousFocus.focus();
    previousFocus = null;
    scheduleProgress();
  }

  function handleModalTab(event, container) {
    if (event.key !== "Tab") return;
    const focusable = [...container.querySelectorAll("button:not(:disabled), [href], [tabindex]:not([tabindex='-1'])")];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  humanHand.addEventListener("click", (event) => {
    const card = event.target.closest("button[data-card-id]");
    if (card) handleHumanCard(card.dataset.cardId);
  });
  passButton.addEventListener("click", completePassing);
  continueButton.addEventListener("click", continueAfterSummary);
  playAgainButton.addEventListener("click", startNewGame);

  helpButton.addEventListener("click", () => openUtilityModal(helpModal, helpCloseButton));
  helpCloseButton.addEventListener("click", () => closeUtilityModal(helpModal));
  helpDoneButton.addEventListener("click", () => closeUtilityModal(helpModal));
  helpModal.addEventListener("click", (event) => {
    if (event.target === helpModal) closeUtilityModal(helpModal);
  });

  newGameButton.addEventListener("click", () => openUtilityModal(newGameModal, cancelNewGameButton));
  cancelNewGameButton.addEventListener("click", () => closeUtilityModal(newGameModal));
  confirmNewGameButton.addEventListener("click", () => {
    closeUtilityModal(newGameModal, false);
    startNewGame();
  });

  [helpModal, newGameModal, summaryModal, gameOverOverlay].forEach((modal) => {
    modal.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && modal === helpModal) closeUtilityModal(helpModal);
      if (event.key === "Escape" && modal === newGameModal) closeUtilityModal(newGameModal);
      handleModalTab(event, modal);
    });
  });

  render();
  saveGame();
  scheduleProgress();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {
        // Offline installation is optional during local file previews.
      });
    });
  }
})();
