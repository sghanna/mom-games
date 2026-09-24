# Codex Hearts for Mom

A complete, ad-free Hearts game for one person and three computer opponents. Open `index.html` through an HTTP server; there is no build step or runtime dependency.

## Playing

Choose three cards and confirm the pass. Review the three received cards, then continue. On your turn, select a highlighted legal card and press **Play card**. Each completed trick stays on the table until you press **Next trick**. The final trick leads to the score sheet.

**Menu** contains total scores, your current hand points, the last completed trick, settings, and a guarded New game action. Progress saves after every action. Settings include English, Spanish, Vietnamese, opponent speed, and optional soft sounds. The device language supplies the initial choice; `?lang=es` and `?lang=vi` also work.

On iPhone, open the deployed page in Safari, choose **Share → Add to Home Screen**, and open it once online. The service worker caches all game assets for offline play.

## Rules

- Pass three cards left, right, across, then keep your cards; repeat each match.
- The 2 of clubs starts each hand. Follow the led suit when possible.
- Avoid hearts and the queen of spades on the first trick when a non-point card is available.
- Lead hearts only after a heart has been played, unless you have only hearts. The queen does not break hearts.
- The highest card in the led suit takes the trick. Hearts count 1 each; the queen of spades counts 13.
- Taking all 26 points adds 26 to each opponent and zero to the shooter.
- When someone reaches 100, the unique lowest total wins. A tie for lowest continues for another hand.

The opponents use only their own hands and public play history. Their strategy is deliberately simple: shed dangerous cards, follow suit, and try to avoid taking penalties. Deals use browser cryptographic randomness.

## Files and saved games

`engine.js` owns immutable rule transitions and save validation. `app.js` handles interaction, timers, rendering, sound, and storage. `i18n.js` contains translations. `deck.js` supplies the traced SVG card faces. The three CSS files cover the table, score/review screens, and responsive gameplay additions.

The new save format uses `codex-hearts-game-v2`, with the preceding valid save in `codex-hearts-game-v2-backup`. Restoration checks all 52 cards and replays the hand to reject impossible states. Invalid saves fall back to the backup; otherwise a new game starts. The earlier Hearts implementation's save is left untouched and is not imported. Preferences use `codex-hearts-settings-v2`. Storage failure is reported in Menu.

Opponent timers pause while a dialog is open or the page is hidden. Completed tricks never advance automatically. At short heights, hand rows overlap while played cards retain the same dimensions as hand cards. Ranks and corner suits stay visible. A received card's text badge is omitted in deeply overlapping rows so it cannot cover a rank; the gold outline and the received-card display remain.

## Development and validation

From the repository root:

```sh
python3 -m http.server 8767
```

In another terminal:

```sh
cd codex
npm ci
npx playwright install webkit chromium
npm test
npm run test:browser
```

Set `HEARTS_URL` to test another deployment. `PLAYWRIGHT_MODULE` can point to an existing Playwright module, and `CHROME_PATH` can select a local Chrome binary. Browser screenshots and metrics go to the ignored `.artifacts/` directory.

Validation includes 120 seeded complete matches (1,321 hands), every pass direction, forced-play exceptions, moon scoring, ties, save validation, and card conservation. Browser checks exercise a full hand with real clicks, reloads, guarded restart, language persistence, paused opponents, offline play, damaged saves, and storage failure. The visual suite renders 14 game states at 390×740, 375×667, and 844×390 in all three languages, including moon/tie combinations and received cards in overlapping rows.

These checks use desktop WebKit and Chrome. The release still needs a physical iPhone playtest with Mom, including Safari toolbars, Home Screen installation, and her preferred text/display settings.

## Release

Publish this version at `https://sghanna.github.io/mom-games/codex/`. Keep its cache and storage names separate from other game versions.

Current cache version: `codex-hearts-v1`. After changing runtime assets, bump the version in `service-worker.js` and the asset query strings in `index.html`, then commit, push, and verify that GitHub Pages serves the new worker. Tests and development files are not precached.
