(() => {
  "use strict";

  const SUITS = [
    { id: "spades", symbol: "♠", name: "spades", color: "black" },
    { id: "hearts", symbol: "♥", name: "hearts", color: "red" },
    { id: "clubs", symbol: "♣", name: "clubs", color: "black" },
    { id: "diamonds", symbol: "♦", name: "diamonds", color: "red" }
  ];
  const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const RANK_NAMES = ["", "Ace", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Jack", "Queen", "King"];
  const STORAGE_KEY = "solitaire-saved-game-v1";
  const PLAYED_BEFORE_KEY = "solitaire-played-before-v1";
  const MAX_UNDO_STEPS = 100;
  const DOUBLE_TAP_MS = 360;

  // Each of these 52-card orderings was found and verified winnable by an
  // offline solver (full replay of a legal move sequence to all 4
  // foundations, matching this file's exact deal/recycle rules). Used only
  // for a player's very first game, so their first experience is a win.
  const FIRST_GAME_DECKS = [
    ["hearts-5", "spades-9", "diamonds-9", "spades-7", "clubs-8", "clubs-10", "diamonds-3", "diamonds-10", "hearts-6", "diamonds-11", "diamonds-7", "hearts-4", "clubs-9", "hearts-8", "hearts-11", "hearts-13", "clubs-11", "spades-6", "hearts-12", "clubs-4", "hearts-2", "diamonds-6", "hearts-7", "hearts-9", "clubs-12", "hearts-10", "clubs-6", "hearts-3", "spades-12", "spades-5", "spades-3", "diamonds-4", "diamonds-12", "clubs-2", "clubs-5", "spades-10", "spades-4", "clubs-7", "clubs-3", "hearts-1", "diamonds-2", "spades-2", "spades-8", "spades-1", "diamonds-1", "diamonds-5", "diamonds-8", "spades-13", "clubs-13", "spades-11", "diamonds-13", "clubs-1"],
    ["diamonds-7", "diamonds-5", "clubs-5", "spades-6", "spades-12", "diamonds-9", "clubs-9", "spades-8", "diamonds-1", "hearts-3", "spades-9", "spades-5", "clubs-12", "clubs-7", "hearts-7", "diamonds-6", "clubs-3", "clubs-1", "hearts-11", "spades-11", "diamonds-13", "hearts-2", "spades-7", "clubs-6", "diamonds-3", "hearts-9", "diamonds-2", "spades-4", "hearts-6", "diamonds-11", "clubs-13", "clubs-4", "spades-1", "hearts-8", "diamonds-8", "diamonds-10", "hearts-12", "clubs-8", "hearts-4", "hearts-1", "spades-2", "diamonds-4", "clubs-2", "spades-10", "spades-3", "clubs-11", "diamonds-12", "hearts-13", "spades-13", "hearts-5", "clubs-10", "hearts-10"],
    ["spades-6", "spades-13", "hearts-4", "spades-4", "hearts-5", "spades-11", "clubs-5", "hearts-2", "hearts-3", "spades-5", "diamonds-2", "spades-9", "clubs-8", "diamonds-8", "clubs-12", "diamonds-1", "clubs-6", "clubs-9", "diamonds-11", "diamonds-4", "hearts-9", "spades-12", "hearts-6", "diamonds-13", "hearts-13", "clubs-7", "clubs-11", "diamonds-3", "clubs-4", "diamonds-12", "clubs-13", "hearts-8", "hearts-10", "diamonds-9", "diamonds-5", "spades-3", "spades-1", "hearts-11", "diamonds-6", "diamonds-10", "spades-10", "clubs-1", "spades-8", "spades-2", "hearts-12", "clubs-3", "diamonds-7", "hearts-1", "spades-7", "clubs-10", "hearts-7", "clubs-2"]
  ];

  const appShell = document.getElementById("app");
  const board = document.getElementById("game-board");
  const stockPile = document.getElementById("stock-pile");
  const wastePile = document.getElementById("waste-pile");
  const foundationPiles = [...document.querySelectorAll(".foundation-pile")];
  const tableauPiles = [...document.querySelectorAll(".tableau-pile")];
  const undoButton = document.getElementById("undo-button");
  const newGameButton = document.getElementById("new-game-button");
  const helpButton = document.getElementById("help-button");
  const helpModal = document.getElementById("help-modal");
  const helpCloseButton = document.getElementById("help-close-button");
  const helpDoneButton = document.getElementById("help-done-button");
  const winOverlay = document.getElementById("win-overlay");
  const winNextNote = document.getElementById("win-next-note");
  const celebrationPreview = document.getElementById("celebration-preview");
  const celebrationTip = document.getElementById("celebration-tip");
  const playAgainButton = document.getElementById("play-again-button");
  const statusMessage = document.getElementById("status-message");

  let game = loadGame() || createNewGame();
  let undoStack = [];
  let selected = null;
  let clearPathMoveCount = null;
  const revealDelayIds = new Set();
  const flipRevealIds = new Set();
  let lastTap = { key: "", time: 0 };
  let statusTimer = 0;
  let previousFocus = null;
  let dragInProgress = false;

  function last(items) {
    return items[items.length - 1];
  }

  function createDeck() {
    return SUITS.flatMap((suit) =>
      Array.from({ length: 13 }, (_, index) => ({
        id: `${suit.id}-${index + 1}`,
        suit: suit.id,
        rank: index + 1,
        color: suit.color,
        faceUp: false
      }))
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

  function hasPlayedBefore() {
    try {
      return localStorage.getItem(PLAYED_BEFORE_KEY) === "1";
    } catch (error) {
      return true;
    }
  }

  function markPlayedBefore() {
    try {
      localStorage.setItem(PLAYED_BEFORE_KEY, "1");
    } catch (error) {
      // If storage is unavailable, every game will simply be a random shuffle.
    }
  }

  function buildFirstGameDeck() {
    const ids = FIRST_GAME_DECKS[Math.floor(randomNumber() * FIRST_GAME_DECKS.length)];
    const cardsById = new Map(createDeck().map((card) => [card.id, card]));
    return ids.map((id) => ({ ...cardsById.get(id) }));
  }

  function dealFromDeck(deck) {
    const tableau = Array.from({ length: 7 }, () => []);

    for (let row = 0; row < 7; row += 1) {
      for (let column = row; column < 7; column += 1) {
        const card = deck.pop();
        card.faceUp = row === column;
        tableau[column].push(card);
      }
    }

    deck.forEach((card) => { card.faceUp = false; });

    return {
      version: 1,
      stock: deck,
      waste: [],
      foundations: Array.from({ length: 4 }, () => []),
      tableau,
      moveCount: 0,
      wasFirstGuaranteed: false
    };
  }

  function createNewGame() {
    const playingFirstGame = !hasPlayedBefore();
    const deck = playingFirstGame ? buildFirstGameDeck() : shuffle(createDeck());
    if (playingFirstGame) markPlayedBefore();
    const dealt = dealFromDeck(deck);
    dealt.wasFirstGuaranteed = playingFirstGame;
    return dealt;
  }

  function isValidSavedGame(candidate) {
    if (!candidate || candidate.version !== 1) return false;
    if (!Array.isArray(candidate.stock) || !Array.isArray(candidate.waste)) return false;
    if (!Array.isArray(candidate.foundations) || candidate.foundations.length !== 4) return false;
    if (!Array.isArray(candidate.tableau) || candidate.tableau.length !== 7) return false;

    const cards = [
      ...candidate.stock,
      ...candidate.waste,
      ...candidate.foundations.flat(),
      ...candidate.tableau.flat()
    ];
    const expectedCards = new Map(createDeck().map((card) => [card.id, card]));
    return cards.length === 52
      && new Set(cards.map((card) => card.id)).size === 52
      && cards.every((card) => {
        const expected = expectedCards.get(card.id);
        return expected
          && card.suit === expected.suit
          && card.rank === expected.rank
          && card.color === expected.color
          && typeof card.faceUp === "boolean";
      });
  }

  function loadGame() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return isValidSavedGame(saved) ? saved : null;
    } catch (error) {
      return null;
    }
  }

  function saveGame() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
    } catch (error) {
      // The game still works if private browsing prevents local storage.
    }
  }

  function cloneGame() {
    return JSON.parse(JSON.stringify(game));
  }

  function rememberForUndo() {
    undoStack.push(cloneGame());
    if (undoStack.length > MAX_UNDO_STEPS) undoStack.shift();
  }

  function cardName(card) {
    return `${RANK_NAMES[card.rank]} of ${card.suit}`;
  }

  function suitFor(card) {
    return SUITS.find((suit) => suit.id === card.suit);
  }

  function isValidTableauSequence(cards, startIndex = 0) {
    for (let index = startIndex; index < cards.length - 1; index += 1) {
      const lowerCard = cards[index];
      const upperCard = cards[index + 1];
      if (!lowerCard.faceUp || !upperCard.faceUp) return false;
      if (lowerCard.rank !== upperCard.rank + 1 || lowerCard.color === upperCard.color) return false;
    }
    return Boolean(cards[startIndex]?.faceUp);
  }

  function makeLocation(element) {
    const zone = element.dataset.zone;
    return {
      zone,
      pileIndex: Number(element.dataset.pileIndex || 0),
      cardIndex: Number(element.dataset.cardIndex || 0),
      cardId: element.dataset.cardId || ""
    };
  }

  function getCardAt(location) {
    if (!location) return null;
    if (location.zone === "waste") return last(game.waste) || null;
    if (location.zone === "foundation") return last(game.foundations[location.pileIndex] || []) || null;
    if (location.zone === "tableau") {
      const pile = game.tableau[location.pileIndex];
      return pile?.find((card) => card.id === location.cardId) || null;
    }
    return null;
  }

  function currentLocation(location) {
    const card = getCardAt(location);
    if (!card) return null;
    if (location.zone !== "tableau") return { ...location, cardId: card.id };
    const cardIndex = game.tableau[location.pileIndex].findIndex((item) => item.id === card.id);
    return { ...location, cardIndex, cardId: card.id };
  }

  function canSelect(location) {
    const current = currentLocation(location);
    if (!current) return false;

    if (current.zone === "waste") return Boolean(game.waste.length);
    if (current.zone === "foundation") return Boolean(game.foundations[current.pileIndex].length);
    if (current.zone === "tableau") {
      return isValidTableauSequence(game.tableau[current.pileIndex], current.cardIndex);
    }
    return false;
  }

  function movableCards(location) {
    const current = currentLocation(location);
    if (!current) return [];
    if (current.zone === "waste") return game.waste.length ? [last(game.waste)] : [];
    if (current.zone === "foundation") {
      const card = last(game.foundations[current.pileIndex]);
      return card ? [card] : [];
    }
    if (current.zone === "tableau") return game.tableau[current.pileIndex].slice(current.cardIndex);
    return [];
  }

  function sameSource(first, second) {
    return Boolean(first && second && first.zone === second.zone && first.pileIndex === second.pileIndex && first.cardId === second.cardId);
  }

  function samePile(first, second) {
    return Boolean(first && second && first.zone === second.zone && first.pileIndex === second.pileIndex);
  }

  function selectCard(location) {
    const current = currentLocation(location);
    if (!current || !canSelect(current)) {
      invalidFeedback(pileElementFor(location), "That card cannot move yet.");
      return;
    }
    selected = current;
    render();
    announce(`${cardName(getCardAt(current))} selected.`);
  }

  function canPlaceOnTableau(card, destination) {
    const topCard = last(destination);
    if (!topCard) return card.rank === 13;
    return topCard.faceUp && topCard.rank === card.rank + 1 && topCard.color !== card.color;
  }

  function canPlaceOnFoundation(card, foundationIndex) {
    if (SUITS[foundationIndex].id !== card.suit) return false;
    const foundation = game.foundations[foundationIndex];
    const topCard = last(foundation);
    return topCard ? card.rank === topCard.rank + 1 : card.rank === 1;
  }

  function removeFromSource(location) {
    if (location.zone === "waste") return [game.waste.pop()];
    if (location.zone === "foundation") return [game.foundations[location.pileIndex].pop()];
    if (location.zone === "tableau") {
      const sourcePile = game.tableau[location.pileIndex];
      const cards = sourcePile.splice(location.cardIndex);
      const newTop = last(sourcePile);
      if (newTop && !newTop.faceUp) {
        newTop.faceUp = true;
        revealDelayIds.add(newTop.id);
      }
      return cards;
    }
    return [];
  }

  function moveSelectedTo(destinationZone, destinationIndex, automatic = false) {
    if (!selected) return false;
    const source = currentLocation(selected);
    if (!source || !canSelect(source)) {
      selected = null;
      render();
      return false;
    }

    const cards = movableCards(source);
    const leadCard = cards[0];
    let valid = false;

    if (destinationZone === "tableau" && !(source.zone === "tableau" && source.pileIndex === destinationIndex)) {
      valid = canPlaceOnTableau(leadCard, game.tableau[destinationIndex]);
    } else if (destinationZone === "foundation" && cards.length === 1 && !(source.zone === "foundation" && source.pileIndex === destinationIndex)) {
      valid = canPlaceOnFoundation(leadCard, destinationIndex);
    }

    if (!valid) {
      if (!automatic) invalidFeedback(pileElementFor({ zone: destinationZone, pileIndex: destinationIndex }), "That card does not fit there.");
      return false;
    }

    const movingIds = cards.map((card) => card.id);
    const oldRects = captureCardRects(movingIds);

    rememberForUndo();
    const movedCards = removeFromSource(source);
    movedCards.forEach((card) => { card.faceUp = true; });
    if (prefersReducedMotion()) revealDelayIds.clear();

    if (destinationZone === "tableau") game.tableau[destinationIndex].push(...movedCards);
    if (destinationZone === "foundation") game.foundations[destinationIndex].push(movedCards[0]);

    game.moveCount += 1;
    selected = null;
    lastTap = { key: "", time: 0 };
    saveGame();
    render();
    playSlideAnimation(oldRects);
    if (revealDelayIds.size) {
      window.setTimeout(() => {
        if (!prefersReducedMotion()) {
          revealDelayIds.forEach((id) => flipRevealIds.add(id));
        }
        revealDelayIds.clear();
        render();
        flipRevealIds.clear();
      }, 200);
    }
    announce(`${cardName(leadCard)} moved.`);
    checkForWin();
    return true;
  }

  function captureCardRects(cardIds) {
    const rects = new Map();
    cardIds.forEach((id) => {
      const element = board.querySelector(`[data-card-id="${id}"]`);
      if (element) rects.set(id, element.getBoundingClientRect());
    });
    return rects;
  }

  function playSlideAnimation(oldRects) {
    if (prefersReducedMotion()) return;
    oldRects.forEach((oldRect, id) => {
      const element = board.querySelector(`[data-card-id="${id}"]`);
      if (!element) return;
      const newRect = element.getBoundingClientRect();
      const deltaX = oldRect.left - newRect.left;
      const deltaY = oldRect.top - newRect.top;
      if (!deltaX && !deltaY) return;
      element.style.transition = "none";
      element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
      element.style.zIndex = "90";
      void element.offsetWidth;
      requestAnimationFrame(() => {
        element.style.transition = "transform 0.3s ease";
        element.style.transform = "";
      });
      element.addEventListener("transitionend", () => {
        element.style.transition = "";
      }, { once: true });
    });
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function autoMove(location) {
    const current = currentLocation(location);
    if (!current || !canSelect(current)) {
      invalidFeedback(pileElementFor(location), "That card cannot move yet.");
      return;
    }

    selected = current;
    const cards = movableCards(current);
    const leadCard = cards[0];
    const foundationIndex = SUITS.findIndex((suit) => suit.id === leadCard.suit);

    if (cards.length === 1 && moveSelectedTo("foundation", foundationIndex, true)) return;

    for (let index = 0; index < game.tableau.length; index += 1) {
      if (current.zone === "tableau" && current.pileIndex === index) continue;
      if (canPlaceOnTableau(leadCard, game.tableau[index])) {
        moveSelectedTo("tableau", index, true);
        return;
      }
    }

    selected = current;
    render();
    invalidFeedback(pileElementFor(current), "No open place for that card yet.");
  }

  function drawFromStock() {
    selected = null;
    lastTap = { key: "", time: 0 };
    if (game.stock.length) {
      rememberForUndo();
      const card = game.stock.pop();
      card.faceUp = true;
      game.waste.push(card);
      game.moveCount += 1;
      announce(`${cardName(card)} drawn.`);
    } else if (game.waste.length) {
      rememberForUndo();
      game.stock = game.waste.reverse();
      game.stock.forEach((card) => { card.faceUp = false; });
      game.waste = [];
      game.moveCount += 1;
      announce("Deck recycled.");
    } else {
      invalidFeedback(stockPile, "The deck is empty.");
      return;
    }
    saveGame();
    render();
  }

  function undo() {
    const previous = undoStack.pop();
    if (!previous) return;
    game = previous;
    selected = null;
    lastTap = { key: "", time: 0 };
    hideWin();
    saveGame();
    render();
    announce("Last move undone.");
  }

  function startNewGame() {
    game = createNewGame();
    undoStack = [];
    selected = null;
    lastTap = { key: "", time: 0 };
    hideWin();
    saveGame();
    render();
    announce("New game ready.");
  }

  function handleCardTap(cardElement) {
    if (dragInProgress) return;
    const location = makeLocation(cardElement);
    const tapKey = location.cardId;
    const now = performance.now();
    const isDoubleTap = tapKey && lastTap.key === tapKey && now - lastTap.time <= DOUBLE_TAP_MS;
    lastTap = isDoubleTap ? { key: "", time: 0 } : { key: tapKey, time: now };

    if (isDoubleTap) {
      selected = null;
      autoMove(location);
      return;
    }

    if (!selected) {
      selectCard(location);
      return;
    }

    if (sameSource(selected, location)) {
      selected = null;
      lastTap = { key: "", time: 0 };
      render();
      announce("Selection cleared.", false);
      return;
    }

    if (samePile(selected, location)) {
      selectCard(location);
      return;
    }

    moveSelectedTo(location.zone, location.pileIndex);
  }

  function handleBoardClick(event) {
    const cardElement = event.target.closest(".card.face-up");
    if (cardElement) {
      handleCardTap(cardElement);
      return;
    }

    const pile = event.target.closest(".pile");
    if (!pile) return;
    const location = makeLocation(pile);

    if (location.zone === "stock") {
      drawFromStock();
      return;
    }

    if (selected && (location.zone === "tableau" || location.zone === "foundation")) {
      moveSelectedTo(location.zone, location.pileIndex);
    }
  }

  function pileElementFor(location) {
    if (!location) return null;
    if (location.zone === "stock") return stockPile;
    if (location.zone === "waste") return wastePile;
    if (location.zone === "foundation") return foundationPiles[location.pileIndex];
    if (location.zone === "tableau") return tableauPiles[location.pileIndex];
    return null;
  }

  function invalidFeedback(element, message) {
    if (element) {
      element.classList.remove("invalid");
      void element.offsetWidth;
      element.classList.add("invalid");
      window.setTimeout(() => element.classList.remove("invalid"), 450);
    }
    announce(message);
  }

  function announce(message, visible = true) {
    window.clearTimeout(statusTimer);
    statusMessage.textContent = "";
    requestAnimationFrame(() => {
      statusMessage.textContent = message;
      statusMessage.classList.toggle("show", visible);
    });
    statusTimer = window.setTimeout(() => statusMessage.classList.remove("show"), visible ? 1800 : 100);
  }

  function createCardElement(card, location, offset = "-2px", zIndex = 1) {
    const displayFaceUp = card.faceUp && !revealDelayIds.has(card.id);
    const element = document.createElement(displayFaceUp ? "button" : "div");
    element.className = `card ${displayFaceUp ? "face-up" : "face-down"}${flipRevealIds.has(card.id) ? " flip-reveal" : ""}`;
    element.style.top = offset;
    element.style.zIndex = String(zIndex);
    element.dataset.zone = location.zone;
    element.dataset.pileIndex = String(location.pileIndex || 0);
    element.dataset.cardIndex = String(location.cardIndex || 0);
    element.dataset.cardId = card.id;

    if (displayFaceUp) {
      const suit = suitFor(card);
      element.type = "button";
      element.classList.toggle("red-card", card.color === "red");
      element.draggable = true;
      element.setAttribute("aria-label", `${cardName(card)}. Tap to select; double-tap to move automatically.`);
      const rankLabel = RANKS[card.rank];
      // Two-character ranks ("10") get condensed to a fixed width so they can
      // never push the index suit off the card edge.
      const fitWide = rankLabel.length > 1 ? ' textLength="50" lengthAdjust="spacingAndGlyphs"' : "";
      element.innerHTML = `
        <svg class="card-face" viewBox="0 0 100 142" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
          <text class="card-rank" x="28" y="52"${fitWide}>${rankLabel}</text>
          <text class="card-index-suit" x="76" y="48">${suit.symbol}</text>
          <text class="card-main-suit" x="50" y="130">${suit.symbol}</text>
        </svg>
      `;

      if (selected && selected.cardId === card.id) element.classList.add("selected");
      if (selected && selected.zone === "tableau" && location.zone === "tableau" && selected.pileIndex === location.pileIndex && location.cardIndex >= selected.cardIndex) {
        element.classList.add("selected-chain");
      }
    } else {
      element.setAttribute("aria-hidden", "true");
      element.innerHTML = '<span class="back-mark">♠</span>';
    }
    return element;
  }

  function renderStock() {
    stockPile.replaceChildren();
    if (game.stock.length) {
      const card = last(game.stock);
      stockPile.appendChild(createCardElement(card, { zone: "stock", pileIndex: 0, cardIndex: game.stock.length - 1 }));
      const count = document.createElement("span");
      count.className = "stock-count";
      count.textContent = String(game.stock.length);
      count.setAttribute("aria-hidden", "true");
      stockPile.appendChild(count);
      stockPile.setAttribute("aria-label", `Stock, ${game.stock.length} cards. Tap to draw.`);
    } else {
      const recycle = document.createElement("span");
      recycle.className = "recycle-mark";
      recycle.textContent = "↻";
      recycle.setAttribute("aria-hidden", "true");
      stockPile.appendChild(recycle);
      stockPile.setAttribute("aria-label", game.waste.length ? "Empty stock. Tap to recycle the waste." : "Empty stock.");
    }
  }

  function renderWaste() {
    wastePile.replaceChildren();
    const card = last(game.waste);
    if (card) {
      wastePile.appendChild(createCardElement(card, { zone: "waste", pileIndex: 0, cardIndex: game.waste.length - 1 }));
      wastePile.setAttribute("aria-label", `Waste, ${cardName(card)} on top.`);
    } else {
      wastePile.setAttribute("aria-label", "Empty waste pile.");
    }
  }

  function renderFoundations() {
    foundationPiles.forEach((pile, pileIndex) => {
      pile.querySelectorAll(".card").forEach((card) => card.remove());
      const card = last(game.foundations[pileIndex]);
      if (card) {
        pile.setAttribute("role", "group");
        pile.tabIndex = -1;
        pile.appendChild(createCardElement(card, {
          zone: "foundation",
          pileIndex,
          cardIndex: game.foundations[pileIndex].length - 1
        }));
        pile.setAttribute("aria-label", `${SUITS[pileIndex].name} foundation, ${cardName(card)} on top.`);
      } else {
        pile.setAttribute("role", "button");
        pile.tabIndex = 0;
        pile.setAttribute("aria-label", `Empty ${SUITS[pileIndex].name} foundation. Start with the Ace.`);
      }
    });
  }

  function renderTableau() {
    tableauPiles.forEach((pile, pileIndex) => {
      pile.replaceChildren();
      const cards = game.tableau[pileIndex];
      pile.classList.toggle("has-placeholder", cards.length === 0);

      if (!cards.length) {
        pile.setAttribute("role", "button");
        pile.tabIndex = 0;
        const king = document.createElement("span");
        king.className = "empty-king";
        king.textContent = "K";
        king.setAttribute("aria-hidden", "true");
        pile.appendChild(king);
        pile.setAttribute("aria-label", `Empty tableau column ${pileIndex + 1}. Only a King can move here.`);
        return;
      }

      pile.setAttribute("role", "group");
      pile.tabIndex = -1;

      let faceDownBefore = 0;
      let faceUpBefore = 0;
      cards.forEach((card, cardIndex) => {
        const offset = `calc(${faceDownBefore} * var(--down-step) + ${faceUpBefore} * var(--up-step) - 2px)`;
        const element = createCardElement(card, { zone: "tableau", pileIndex, cardIndex }, offset, cardIndex + 1);
        pile.appendChild(element);
        if (card.faceUp) faceUpBefore += 1;
        else faceDownBefore += 1;
      });
      const faceUpCount = cards.filter((card) => card.faceUp).length;
      pile.setAttribute("aria-label", `Tableau column ${pileIndex + 1}, ${cards.length} cards, ${faceUpCount} face up.`);
    });
  }

  function render() {
    renderStock();
    renderWaste();
    renderFoundations();
    renderTableau();
    undoButton.disabled = undoStack.length === 0;
    updateCelebrationPreview();
  }

  function isFullyWon() {
    return game.foundations.every((foundation) => foundation.length === 13);
  }

  function hasClearPathToVictory() {
    return !isFullyWon() && game.tableau.every((pile) => pile.every((card) => card.faceUp));
  }

  function updateCelebrationPreview() {
    const clearPath = hasClearPathToVictory();
    if (clearPath) {
      if (clearPathMoveCount === null) clearPathMoveCount = game.moveCount;
    } else {
      clearPathMoveCount = null;
    }
    const showPreview = clearPath && game.moveCount === clearPathMoveCount;
    celebrationPreview.hidden = !showPreview;
    celebrationPreview.setAttribute("aria-hidden", String(!showPreview));
    celebrationTip.hidden = !showPreview;
  }

  function checkForWin() {
    if (isFullyWon()) {
      appShell.inert = true;
      appShell.setAttribute("aria-hidden", "true");
      winNextNote.hidden = !game.wasFirstGuaranteed;
      winOverlay.hidden = false;
      winOverlay.setAttribute("aria-hidden", "false");
      window.setTimeout(() => playAgainButton.focus(), 80);
    }
  }

  function hideWin() {
    appShell.inert = false;
    appShell.removeAttribute("aria-hidden");
    winOverlay.hidden = true;
    winOverlay.setAttribute("aria-hidden", "true");
  }

  function openHelp() {
    previousFocus = document.activeElement;
    appShell.inert = true;
    appShell.setAttribute("aria-hidden", "true");
    helpModal.hidden = false;
    helpModal.setAttribute("aria-hidden", "false");
    window.setTimeout(() => helpCloseButton.focus(), 50);
  }

  function closeHelp() {
    appShell.inert = false;
    appShell.removeAttribute("aria-hidden");
    helpModal.hidden = true;
    helpModal.setAttribute("aria-hidden", "true");
    if (previousFocus) previousFocus.focus();
  }

  function handleModalTab(event, container) {
    if (event.key !== "Tab") return;
    const focusable = [...container.querySelectorAll("button:not(:disabled), [href], [tabindex]:not([tabindex='-1'])")];
    if (!focusable.length) return;
    const first = focusable[0];
    const lastFocusable = last(focusable);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      lastFocusable.focus();
    } else if (!event.shiftKey && document.activeElement === lastFocusable) {
      event.preventDefault();
      first.focus();
    }
  }

  board.addEventListener("click", handleBoardClick);
  board.addEventListener("keydown", (event) => {
    const pile = event.target.closest(".pile[role='button']");
    if (pile && (event.key === "Enter" || event.key === " ") && !event.target.closest("button.card")) {
      event.preventDefault();
      pile.click();
    }
  });

  board.addEventListener("dragstart", (event) => {
    const card = event.target.closest(".card.face-up");
    if (!card) return;
    const location = makeLocation(card);
    if (!canSelect(location)) {
      event.preventDefault();
      return;
    }
    dragInProgress = true;
    selected = currentLocation(location);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", selected.cardId);
    requestAnimationFrame(render);
  });

  board.addEventListener("dragover", (event) => {
    const pile = event.target.closest("[data-zone='tableau'], [data-zone='foundation']");
    if (!pile || !selected) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    pile.classList.add("drop-ready");
  });

  board.addEventListener("dragleave", (event) => {
    const pile = event.target.closest(".pile");
    if (pile && !pile.contains(event.relatedTarget)) pile.classList.remove("drop-ready");
  });

  board.addEventListener("drop", (event) => {
    event.preventDefault();
    const pile = event.target.closest(".pile");
    document.querySelectorAll(".drop-ready").forEach((element) => element.classList.remove("drop-ready"));
    if (pile && selected) {
      const destination = makeLocation(pile);
      moveSelectedTo(destination.zone, destination.pileIndex);
    }
  });

  board.addEventListener("dragend", () => {
    document.querySelectorAll(".drop-ready").forEach((element) => element.classList.remove("drop-ready"));
    window.setTimeout(() => { dragInProgress = false; }, 80);
  });

  newGameButton.addEventListener("click", startNewGame);
  undoButton.addEventListener("click", undo);
  helpButton.addEventListener("click", openHelp);
  helpCloseButton.addEventListener("click", closeHelp);
  helpDoneButton.addEventListener("click", closeHelp);
  helpModal.addEventListener("click", (event) => {
    if (event.target === helpModal) closeHelp();
  });
  helpModal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeHelp();
    handleModalTab(event, helpModal);
  });
  winOverlay.addEventListener("keydown", (event) => handleModalTab(event, winOverlay));
  playAgainButton.addEventListener("click", startNewGame);

  function playPluckNote(ctx, frequency, startTime, duration) {
    const oscillator = ctx.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.22, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.05);
  }

  function playOpeningTune() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === "suspended") ctx.resume();

      // An original gentle A-minor fingerstyle-style arpeggio (Am - G - F - E),
      // written from scratch for this app - not based on any existing song.
      const chords = [
        [220.00, 261.63, 329.63, 440.00],
        [196.00, 246.94, 293.66, 392.00],
        [174.61, 220.00, 261.63, 349.23],
        [164.81, 207.65, 246.94, 329.63]
      ];
      const noteDuration = 0.32;
      const noteGap = 0.28;
      let time = ctx.currentTime + 0.02;
      chords.forEach((chord) => {
        chord.forEach((frequency) => {
          playPluckNote(ctx, frequency, time, noteDuration);
          time += noteGap;
        });
      });
      window.setTimeout(() => ctx.close(), (time - ctx.currentTime + 1) * 1000);
    } catch (error) {
      // If audio isn't available in this context, the game still works fine without it.
    }
  }

  document.addEventListener("pointerdown", playOpeningTune, { once: true });

  render();
  saveGame();
  checkForWin();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {
        // Offline installation is optional during local file previews.
      });
    });
  }
})();
