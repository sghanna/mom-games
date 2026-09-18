# Granny Solitaire and Hearts: Development Recap

Dates: 2026-09-17 to 2026-09-18
Repo: ~/mom-games (github.com/sghanna/mom-games)
Live: sghanna.github.io/mom-games/solitaire/ and /hearts/

## The original ask

Your opening prompt, in full:

"I have $75.93 left. How can I best use that money to create a few games to put on my mom's iPhone? Today is 9/17 and her last full day here is 9/25. I would like to ask you to inspect the games that she likes, figure out how I could make a version that is clean and not full of adds with hidden close x's. Oh, I also have a paid version of Codex, and you can order around Codex to do stuff too. Where should we begin, and should we create a skill for this task so I can keep building games if this goes well?"

Three things were baked into that from the start: a hard deadline, a specific complaint about mobile game ads (deceptive close buttons), and a mixed-tool workflow (Claude plus Codex). All three shaped everything that followed.

## What got built

- A hosting approach with zero App Store friction: static web apps installed via Safari's "Add to Home Screen," served free from GitHub Pages, fully offline-capable via a service worker. No Apple Developer account, no App Store review, no ads because nothing third-party is loaded at all (the CSP blocks outside network calls outright).
- Granny Solitaire: full Klondike rules, tap-to-select-then-tap-destination controls (no fiddly drag needed on a phone), undo, a solver-verified guaranteed-winnable first game, a "clear path to victory" celebration preview, an original opening tune, and a jumbo card-face design built around your mom's vision needs.
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

## Where things stand

Solitaire and Hearts are both live and polished to the current accessibility standard. Euchre and a word game were discussed as next candidates. The card-game-builder skill captures the reusable parts (sizing formulas, the qlmanage render-test workflow, the cache-busting requirement, the Codex/Claude split) so the next build should move faster and need fewer correction rounds.
