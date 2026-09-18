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
  const MAX_UNDO_STEPS = 100;
  const DOUBLE_TAP_MS = 360;

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
  const playAgainButton = document.getElementById("play-again-button");
  const statusMessage = document.getElementById("status-message");

  let game = loadGame() || createNewGame();
  let undoStack = [];
  let selected = null;
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

  function createNewGame() {
    const deck = shuffle(createDeck());
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
      moveCount: 0
    };
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
      if (newTop && !newTop.faceUp) newTop.faceUp = true;
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

    rememberForUndo();
    const movedCards = removeFromSource(source);
    movedCards.forEach((card) => { card.faceUp = true; });

    if (destinationZone === "tableau") game.tableau[destinationIndex].push(...movedCards);
    if (destinationZone === "foundation") game.foundations[destinationIndex].push(movedCards[0]);

    game.moveCount += 1;
    selected = null;
    lastTap = { key: "", time: 0 };
    saveGame();
    render();
    announce(`${cardName(leadCard)} moved.`);
    checkForWin();
    return true;
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
    const element = document.createElement(card.faceUp ? "button" : "div");
    element.className = `card ${card.faceUp ? "face-up" : "face-down"}`;
    element.style.top = offset;
    element.style.zIndex = String(zIndex);
    element.dataset.zone = location.zone;
    element.dataset.pileIndex = String(location.pileIndex || 0);
    element.dataset.cardIndex = String(location.cardIndex || 0);
    element.dataset.cardId = card.id;

    if (card.faceUp) {
      const suit = suitFor(card);
      element.type = "button";
      element.classList.toggle("red-card", card.color === "red");
      element.draggable = true;
      element.setAttribute("aria-label", `${cardName(card)}. Tap to select; double-tap to move automatically.`);
      element.innerHTML = `
        <span class="card-face" aria-hidden="true">
          <span class="card-rank">${RANKS[card.rank]}</span>
          <span class="card-suit-big">${suit.symbol}</span>
        </span>
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
  }

  function checkForWin() {
    if (game.foundations.every((foundation) => foundation.length === 13)) {
      appShell.inert = true;
      appShell.setAttribute("aria-hidden", "true");
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
