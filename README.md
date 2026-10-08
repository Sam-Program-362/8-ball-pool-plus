# 8 Ball Pool Plus

A complete 8-ball pool game that runs entirely in the browser — built with **Vite**, **TypeScript**, **React 19** and **Tailwind CSS 4**.

The headline feature is a real rigid-body pool physics engine rather than the simplified arcade model most casual pool games use. Cue-ball spin, english, throw, swerve and squirt are all simulated, so a shot played with side spin genuinely behaves the way it would on a real table.

---

## Table of contents

- [Features](#features)
- [Physics engine](#physics-engine)
- [Rules implemented](#rules-implemented)
- [Getting started](#getting-started)
- [Running on Android (Termux)](#running-on-android-termux)
- [Controls](#controls)
- [Project structure](#project-structure)
- [Tech stack](#tech-stack)
- [Design system](#design-system)
- [Notes](#notes)

---

## Features

### Match modes
- **Vs AI** — play a rack against the computer at one of four skill tiers.
- **Local 2-player** — two humans share the device and alternate turns.

### Physics
- Two selectable engines, switchable in Settings:
  - **High** — full rigid-body model with spin, english, throw, swerve, squirt and speed-dependent restitution.
  - **Simple** — arcade model with a forgiving pocket-capture bonus.
- Modelled on a **9 ft tournament table**: 100" × 50" playfield, 2.25" balls.
- Cushion noses and angled pocket jaws are real collision segments, so balls rattle in the jaws and can be rejected from the pocket.

### Progression
- Coins, XP, levels and lifetime stats (wins, losses, pots, best break, longest run).
- **8 cues** — Rookie Maple → Celestial Ace — each with its own power / spin / aim / time ratings.
- **5 table skins** — two free, three purchasable.
- **Shop** for cues and table skins; earnings scale with AI difficulty.
- Progress is persisted to `localStorage` (key `eightball.profile.v1`), so your profile survives a reload.

### Presentation
- All artwork is **procedural** — cloth, wood, brass and ball shading are drawn to canvas at runtime, so there are no image assets to load.
- Sound effects are **synthesised with the Web Audio API**, not audio files.
- Optional haptic feedback on supported devices.
- Aim guides with configurable guide lines and cushion-bounce prediction (cue-dependent).
- Responsive layout that works on desktop and touch devices; multi-touch pinch-zoom is suppressed.

---

## Physics engine

`src/game/physics.ts` integrates a solid sphere with full angular velocity: `wx`/`wy` are the roll axes and `wz` is side spin (english).

The tunable constants live in `src/game/constants.ts`:

| Parameter | High | Simple | Meaning |
| --- | --- | --- | --- |
| `slide` | 0.2 | 0.2 | Sliding (cloth) friction coefficient |
| `roll` | 0.02 | 0.025 | Rolling resistance coefficient |
| `drag` | 0.0025 | 0.0029 | Quadratic cloth drag |
| `spin` | 0.11 | 0 | Spinning friction coefficient |
| `stopSpeed` | 13 | 13 | Below this speed the ball is snapped to rest (in/s) |
| `ballE` | 0.975 | 1.0 | Ball–ball restitution |
| `ballMu` | 0.062 | 0 | Ball–ball friction (throw) |
| `cushE` | 0.84 | 0.92 | Cushion restitution |
| `cushMu` | 0.2 | 0 | Cushion friction (english off the rail) |
| `swerve` | 0.055 | 0 | Lateral curve from side spin |
| `squirt` | 1 | 0 | Cue-ball deflection from english |
| `capture` | 0 | 0.22 | Extra pocket capture radius |
| `pocketGuard` | 4 | 4 | Radius (in) around a pocket where the rest cutoff is suppressed |

The cue ball can be struck up to `MAX_SPIN_OFFSET` = **0.58** of a ball radius off centre.

### Shot settling

Cloth resistance is applied in `substep()` whether the ball is sliding or rolling.
This matters: the slide test is an absolute `cs > 0.75` in/s threshold, so a ball in
near-pure rolling that carries a little residual contact slip from a collision would
take the *sliding* branch — where rolling resistance used not to run — and coast at a
constant speed with nothing left to slow it down. Decelerating along the velocity
direction in both branches guarantees motion always dies out.

On top of that, any ball below `stopSpeed` is snapped to rest rather than being
allowed to creep. The snap is skipped inside `pocketGuard` of a pocket centre, so a
ball trickling into a jaw still drops instead of freezing on the lip.

Measured over 20 full AI racks per row, settling time is now effectively independent
of frame rate:

| Step size | Avg settle | Median | p90 | Max | Shots > 5 s |
| --- | --- | --- | --- | --- | --- |
| 1/60 (60 fps) | 1.89 s | 1.93 s | 2.70 s | 3.83 s | 0 / 601 |
| 1/120 | 1.85 s | 1.84 s | 2.67 s | 3.88 s | 0 / 582 |
| 1/240 | 1.82 s | 1.86 s | 2.65 s | 3.56 s | 0 / 595 |

The AI in `src/game/ai.ts` uses the **same** `simulateShot` routine the game uses, so it evaluates candidate shots against the exact physics you are playing against — it has no special knowledge.

---

## Rules implemented

`src/game/rules.ts` enforces standard 8-ball:

- **Open table** until a group is legally claimed; the 8-ball is never a legal first contact while the table is open.
- **Fouls** — scratch, no ball contacted, wrong group hit first, no rail after contact.
- **Illegal break** — you must drive 4 balls to a rail or pot a ball on the break.
- **8-ball on the break** — re-spotted, table stays open, shooter continues.
- **8-ball resolution** — clean win when your group is clear and the 8 drops legally; instant loss if the 8 is potted early, on a foul, or on a scratch.
- **Three consecutive fouls** loses the rack (with a warning on the second).
- **Ball in hand** after a foul, restricted to the kitchen where applicable.
- **Shot clock**, scaled by AI difficulty and the cue's `time` rating.

---

## Getting started

Requires **Node.js 18+** (Vite 7 requires it).

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev

# 3. Production build (outputs a single self-contained HTML file into dist/)
npm run build

# 4. Preview the production build locally
npm run preview
```

`npm run build` uses [`vite-plugin-singlefile`](https://github.com/richardtallent/vite-plugin-singlefile), so the entire game — JS, CSS and all procedural assets — is inlined into **one `index.html`** that can be opened directly or hosted anywhere as a static file.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Type-free production bundle into `dist/` |
| `npm run preview` | Serve the built output locally |

TypeScript is configured with `noEmit` and strict mode, so type-checking runs separately from the build:

```bash
npx tsc --noEmit
```

---

## Running on Android (Termux)

```bash
pkg update
pkg install nodejs git
git clone https://github.com/Sam-Program-362/8-ball-pool-plus.git
cd 8-ball-pool-plus
npm install
npm run dev -- --host 0.0.0.0
```

Then open the printed URL in your browser. To reach the dev server from another device on the same network, `--host 0.0.0.0` is required; otherwise Vite only binds to localhost.

If `npm install` is slow on-device, build once and open the single-file output instead:

```bash
npm run build
termux-open dist/index.html
```

---

## Controls

The game is input-agnostic — mouse, touch and keyboard all work.

### Pointer / touch

| Action | Input |
| --- | --- |
| Aim | Move or drag on the table; mouse wheel nudges the aim angle |
| Adjust power | Power slider |
| Set spin / english | Drag on the cue-ball pad (offset up to 58% of the ball radius) |
| Shoot | Shoot control |
| Place cue ball | Drag when you have ball in hand |

Multi-touch gestures are disabled so a second finger cannot zoom the page mid-shot.

> The english/spin pad is only active with the **High** physics engine selected. In **Simple** mode the pad is locked, since that engine does not model spin.

### Keyboard

| Key | Action |
| --- | --- |
| `←` / `→` | Aim |
| `Shift` + `←` / `→` | Fine aim (≈7× smaller step) |
| `↑` / `↓` | Power, in 2% steps (clamped 5%–100%) |
| `Space` | Shoot |
| `G` | Toggle aim guides |
| `Esc` | Pause / resume |

Keyboard input is ignored while it is the AI's turn, while paused, or after the rack is over.

---

## Project structure

```
8-ball-pool-plus/
├── index.html                 # Entry HTML, fonts, meta/viewport config
├── package.json
├── package-lock.json
├── tsconfig.json              # strict, bundler resolution, "@/*" path alias
├── vite.config.ts             # react + tailwind + singlefile, "@" → src alias
└── src/
    ├── main.tsx               # React root bootstrap
    ├── App.tsx                # Screen router: menu | game | shop | settings
    ├── index.css              # Tailwind theme tokens, textures, animations
    ├── components/
    │   ├── Game.tsx           # Match screen — canvas loop, aiming, HUD, toasts
    │   ├── Menu.tsx           # Main menu and match setup
    │   ├── Shop.tsx           # Cue and table-skin store
    │   ├── Settings.tsx       # Physics mode, sound, guides, timer, haptics
    │   ├── Background.tsx     # Ambient hall backdrop
    │   └── ui.tsx             # Shared UI primitives and icons
    ├── game/
    │   ├── constants.ts       # Table geometry, physics tuning, content catalogue
    │   ├── physics.ts         # Rigid-body world, collisions, shot simulation
    │   ├── rules.ts           # Match state machine and 8-ball rule enforcement
    │   ├── ai.ts              # Candidate generation, scoring and difficulty noise
    │   ├── render.ts          # Canvas renderer
    │   ├── textures.ts        # Procedural cloth, wood, brass and ball textures
    │   ├── audio.ts           # Web Audio synthesis, SFX bus, haptics
    │   ├── store.ts           # localStorage profile store and level curve
    │   └── hooks.ts           # React bindings onto the store
    └── utils/
        └── cn.ts              # className helper (clsx + tailwind-merge)
```

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Build tool | Vite 7 |
| Language | TypeScript 5.9 (strict) |
| UI | React 19 |
| Styling | Tailwind CSS 4 via `@tailwindcss/vite` |
| Design system | `src/index.css` tokens + `src/components/ui.tsx` primitives |
| Rendering | 2D canvas, fully procedural |
| Audio | Web Audio API, fully synthesised |
| Packaging | `vite-plugin-singlefile` — one self-contained HTML file |

Direct runtime dependencies are minimal: `react`, `react-dom`, `clsx` and `tailwind-merge`.

---

## Design system

The UI is a modern esports look built from two layers.

**`src/index.css`** holds the theme tokens and reusable surfaces:

| Token | Value | Role |
| --- | --- | --- |
| `--color-accent` | `#22d3ee` | Electric cyan, primary accent |
| `--color-accent2` | `#86fbff` | Cyan highlight, glowing text |
| `--color-magenta` | `#ff2e88` | Secondary accent, CTA endpoint |
| `--color-violet` | `#8b5cf6` | Tertiary accent, XP |
| `--color-lime` | `#a3ff12` | Success / equipped |
| `--color-amber` | `#ffb020` | Coins, warnings |
| `--color-crimson` | `#ff3b5c` | Fouls, danger |
| `--color-ink` / `panel` | `#04060d` / `#0b1020` | Stage and card base |

`--color-brass` and `--color-brass2` remain as aliases of the cyan accents so older
markup keeps working.

Surface and effect utilities: `.glass` (frosted card), `.edge-glow` (lit top hairline),
`.clip-panel` / `.clip-tag` (clipped corners instead of soft rounding), `.neon-cta`
(cyan → magenta gradient CTA), `.neon-line` (outlined neon), `.neon-text`, `.sweep`
(diagonal light pass). Motion respects `prefers-reduced-motion`.

**`src/components/ui.tsx`** holds the primitives every screen composes from:
`Btn` (`primary` / `secondary` / `success` / `ghost` / `danger`), `IconBtn`, `Panel`,
`Tag`, `Toggle`, `StatBar`, `CoinPill`, `LevelRing`, `Modal`, `SectionTitle`, `BallDot`
and the `Ico` icon set.

---

## Notes

- **No binary assets.** Everything visual is drawn procedurally and every sound is synthesised, which is what makes the single-file build small enough to be practical.
- **Fonts** are pulled from Google Fonts at runtime (Chakra Petch for display, Barlow for body). Without network access the CSS fallback stacks are used instead.
- **`package.json` `name`** is still the scaffold default `react-vite-tailwind`. Rename it to `8-ball-pool-plus` if you want the package name to match the repository — it has no effect on the build.
- `node_modules/`, `dist/`, `.env`, `.env.local`, `*.log`, `.DS_Store` and `Thumbs.db` are ignored by Git; see `.gitignore`.

---

## License

No license file has been added yet. Add a `LICENSE` if you intend to distribute this publicly.
