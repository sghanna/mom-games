# Mom Solitaire and Hearts: Development Recap

Dates: 2026-09-17 to 2026-09-18 (round 1), 2026-09-21 to 2026-09-22 (round 2)
Repo: ~/mom-games (github.com/sghanna/mom-games)
Live: sghanna.github.io/mom-games/solitaire/ and /hearts/

## The original ask

Your opening prompt, in full:

"I have $75.93 left. How can I best use that money to create a few games to put on my mom's iPhone? Today is 9/17 and her last full day here is 9/25. I would like to ask you to inspect the games that she likes, figure out how I could make a version that is clean and not full of adds with hidden close x's. Oh, I also have a paid version of Codex, and you can order around Codex to do stuff too. Where should we begin, and should we create a skill for this task so I can keep building games if this goes well?"

Three things were baked into that from the start: a hard deadline, a specific complaint about mobile game ads (deceptive close buttons), and a mixed-tool workflow (Claude plus Codex). All three shaped everything that followed.

## What got built

- A hosting approach with zero App Store friction: static web apps installed via Safari's "Add to Home Screen," served free from GitHub Pages, fully offline-capable via a service worker. No Apple Developer account, no App Store review, no ads because nothing third-party is loaded at all (the CSP blocks outside network calls outright).
- Mom Solitaire: full Klondike rules, tap-to-select-then-tap-destination controls (no fiddly drag needed on a phone), undo, a solver-verified guaranteed-winnable first game, a "clear path to victory" celebration preview (replaced in round 2 by a gold glow and one-tap finish), an original opening tune, and a jumbo card-face design built around your mom's vision needs (replaced in round 2 by the bake-off winner).
- Hearts: full 4-player rules including passing, shooting the moon, and three heuristic AI opponents, built to the same visual standard.
- A card-game-builder skill (~/.claude/skills/card-game-builder/) so the next game starts from the lessons here instead of relearning them.

## How the process actually went

1. Diagnosed the real constraint fast: a 78-year-old with vision in one eye, floaters in that eye. This became the single most load-bearing fact in the whole project and reshaped nearly every later decision.
2. Split the work: Codex wrote the two full games from detailed specs; Claude handled architecture, review, and the accessibility pass.
3. The accessibility pass itself went through several rounds before landing: text too small, then a redesign that was too large for a favicon-derived ratio, then a "two independent halves" layout that looked fine in isolation but left a dead gap in the middle once actually on your phone. Each of these got caught by looking at either a rendered test or a real screenshot, not by guessing harder.
4. A long tail of small, specific requests followed: ring color and size, pulse on and off more than once, confetti content and speed, an opening tune (declined a version modeled on a copyrighted song, landed on an original one, then swapped to a public-domain Beethoven theme, then reverted), a rename, a few animation-timing fixes.

## What to do differently next time (process)

- Batch related sizing decisions before shipping. A good chunk of the back-and-forth on card sizing, gaps, and ring thickness was several single-property changes in a row where a short round of "here are 3 options rendered side by side, pick one" would have gotten to the same answer in one exchange instead of five.
- Ask for a real-device screenshot earlier, proactively, right after any layout-affecting change. The alignment bug (dead gap from the two-halves layout) sat live for a little while before a screenshot caught it. A quick "does this look right?" checkpoint after each visual change would catch that sooner.
- State copyright-sensitive requests as a question, not a build task, when they involve a specific named song or work. That happened correctly once ("Shape of My Heart") but the pattern is worth naming so it is automatic on the first pass, not something that needs to be flagged mid-build.
- Decide up front whether an animation stays or goes (the selection pulse toggled four separate times). Not wrong to iterate on taste, but a single "try it, then decide" moment would have saved several round trips.

## What to do differently next time (making the game itself delightful)

- Small wins deserve small acknowledgment. The clear-path celebration and the guaranteed-first-win are good instincts; consider extending that idea modestly to other games (Hearts could acknowledge a well-played hand, a shot moon, or a personal-best score) without turning it into a habit-loop-style app.
- Keep feedback layered, not just visual. A win already has color, animation, and sound. Consider giving ordinary good moves a very light touch too, like a soft plink on a valid placement, since audio confirmation matters when a visual glance is harder.
- Protect predictability. Every change in this session that improved things kept the layout stable and just made existing elements clearer or bigger. Resist adding new UI elements or moving existing ones for a "delight" moment. For this player, familiarity is itself a feature.
- Consider a light settings memory (last card size preference, last chosen orientation reminder dismissed or not) so the app feels like it remembers her, without adding a settings screen that has to be understood the first time.

## Round 2: the card bake-off (2026-09-21 to 2026-09-22)

### The ask

You shared a screenshot of a commercial solitaire app (on the same iPhone 16e your mom uses) and asked for a head-to-head: Claude, Codex, and Antigravity would each build their best SVG copy of that card design, shown in a realistic Solitaire layout with long stacked columns. In your words: "each AI should do it's absolute best to match the card design of the number and suit and the card size and the color... I'll tell you who wins the right to be the face of mom-games."

### How it ran

1. Claude measured the reference at full resolution (card size, stack spacing, rank height, suit size, colors) and wrote one shared spec, so all three entries were judged against the same brief and the same layout.
2. Each AI built its entry in its own folder. Codex and Antigravity ran from the command line; Claude built its own entry in parallel.
3. A comparison page showed the reference and all three entries side by side at the exact phone size, plus zoomed crops of the same cards for close judging.
4. You asked for a re-evaluation four times as entries changed, and for file sizes twice. Antigravity's entry was revised three times during judging. Between rounds you spotted each of its errors yourself and gave it detailed fix instructions, for example: "i think club, spade, and diamond are getting clipped on the top and right along the top of the card." Its climb from last place to winner came from that directed feedback, not from a fresh attempt.

### How the entries differed

- Claude used a font already on the iPhone (Bodoni 72) and adjusted it. Smallest file (3 KB compressed), but a built-in font could not match traced shapes. Finished third.
- Codex traced the rank and suit shapes directly from the screenshot and measured exact pixel colors. Cleanest shapes and truest red. 18 KB compressed.
- Antigravity started with a font, had a bug (every 10 showed as "0"), fixed it, then switched to traced shapes too. Its final entry was nearly identical to Codex on shapes, better on the felt color, slightly duller on red, and about half the file size (10 KB).

Claude's final call was a near tie with Codex ahead by a hair on red contrast. You chose Antigravity.

### Applying the winner to Mom Solitaire

You asked for only the card face (numbers and suits) to carry over, keeping the game's own colors, backs, and layout. Rendering at the real phone sizes before shipping caught two problems that would have gone live otherwise:

- The new ranks are taller, so in stacked columns the next card covered their bottoms in landscape (a Q read as an O, the J lost its hook). Fix: the stacked-card peek is now at least 64% of card width.
- The game's cards are slightly shorter than the reference, so a sliver of the big center suit peeked out under each rank. Fix: the big suit is 85% size.

### Gameplay changes in the same round

- Empty-column King marker: five options rendered side by side next to the Ace piles for weight comparison; you picked a small crown over a big K. (This is the "show 3 options side by side" lesson from round 1, applied.)
- Double-tap window lengthened from 360 ms to 800 ms because your mom taps slowly.
- A small gold ring and sparkle burst when an Ace lands on its pile.
- The pre-win celebration was replaced. Once every card is face up, the Ace piles glow gold for 5 seconds, a single tap sends any card home, and the magenta selection is switched off.

Everything was checked at the exact iPhone 16e sizes, upright and sideways, then pushed live on 2026-09-22.

### What to do differently next time (round 2)

- Running Antigravity unattended needs file-read permission set up ahead of time. Its safe mode stopped at the first file read, and Claude was not allowed to loosen its settings, so you had to launch it yourself. Set that permission once before the next multi-AI round.
- Browser testing needs the Chrome extension connected. Without it, Claude fell back to headless Chrome, and the first test harness failed silently because the game's own security rules block inline scripts. The fix took a few tries; connecting the extension first would have saved them.
- A bake-off works best with a fixed judging moment. Entries kept changing mid-judging, which meant four re-evaluations. Either lock entries before judging or treat revisions as a deliberate second round.

[To add: your mom's reaction to the new cards and the one-tap finish. Ask her on 2026-09-22.]

Why Antigravity over the recommendation: you found it a bit more appealing visually, and liked that it was ever so slightly different from the reference game. In your words: "i want this to be my own work with my own style when i can." Pixel-perfect copying was the brief for the contest, not the goal for the product.

## Where things stand

Solitaire and Hearts are both live and polished to the current accessibility standard. As of 2026-09-22, Solitaire uses Antigravity's traced card faces and the new finish mode; Hearts still has the round 1 card design. Euchre and a word game were discussed as next candidates. The card-game-builder skill captures the reusable parts (sizing formulas, the qlmanage render-test workflow, the cache-busting requirement, the Codex/Claude split) so the next build should move faster and need fewer correction rounds.
