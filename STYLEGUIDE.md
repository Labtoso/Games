# Style guide

The arcade looks like print on black paper: a few strong inks, slight misregistration, halftone and
hatching instead of gradients. Every game has its own technique within that family. These rules
are binding for the landing page, every game, the shop screens and `/debug`.

## 1. Foundation (`shared/shell.js`, `Shell.art`)

**Palette.** Everything is printed on black paper. The page tokens in `shared/style.css` are
`--paper #131116`, `--paper-2 #1d1a22`, `--card #1b1820`, `--ink #efe7d7` (cream ink),
`--ink-soft #a8a1ae`, and the print colours `--pink #ff5e95`, `--blue #6f96ff`, `--yellow #ffd056`,
`--green #3dcc8c`, `--orange #ff8d58`. Canvas games read them through `Shell.palette()`.
The shared family of 16 tones in `Shell.art.pal` is the source for game-specific accents.
Games use a subset plus at most two accents from the same family. Grain is a light speckle
blended with `screen`, so it reads like fibres in dark stock.

| Tone | Value | Use |
| --- | --- | --- |
| paper / paper2 / paperShade | `#f1eadb` `#e5dcc8` `#cfc3aa` | grounds, cards, shaded paper |
| ink / inkSoft | `#221f2b` `#5f5967` | outlines, text |
| night / night2 / nightLine | `#121019` `#1d1a26` `#3a3546` | dark grounds (Starwatch, Sonar) |
| pink / pinkDeep | `#f2457f` `#b8285a` | player, light, misregistration |
| blue / blueDeep | `#2a5fc4` `#1b3e86` | water, second ink |
| yellow / yellowDeep | `#f6bf31` `#c48c12` | rewards, currency |
| green / greenDeep | `#139a63` `#0c6a44` | success, growth |
| orange | `#f2702f` | danger, heat |
| light | `#fff8ea` | highlights |

**Light.** Always from the top left (`Shell.art.light`). Highlights sit top left, halftone gets
denser and offset shadows fall to the bottom right (3 px, no blur: `Shell.art.shadow`).

**Line weights.** Three steps, multiplied by the device pixel ratio by the stage transform:
outline 2.5 px, detail 1.5 px, fine 0.75 px (`Shell.art.lw`).

**Grain.** Procedural paper grain and ink wear (`Shell.tex.grain`, `Shell.tex.wear`) are
painted once into tiles and cached. The grain is offset with the camera, never re-randomised per
frame, so it does not flicker.

**Type.** System fonts only, nothing is loaded from outside: a book serif stack for titles
(Iowan Old Style, Palatino, Georgia), the system sans for text, and the system monospace for
HUD and numbers.

## 2. Style per game

| Game (path) | Style |
| --- | --- |
| Orbit (`orbit`) | Risograph on cream paper. Planets are halftone spheres lit from the top left, with orbit rings in dashed ink and a pink misregistration layer. |
| Sonar (`sonar`) | Chalk and ink on blueprint paper. The cave exists only as stipple where an echo returned; pings are slightly uneven hand-drawn rings, metal shows as hatched yellow plates. No glow. |
| Prism (`prism`) | Etched glass on a drafting board. Mirrors and crystals are cut shapes with bevel highlights; the beam is a solid ink line in its colour. |
| Rainmaker (`rainmaker`) | Gouache on rough paper, seen from above. Fields are hatched patches that fill with colour as they bloom; clouds are soft paper cut-outs with an offset shadow. |
| Switchyard (`switchyard`) | Linocut factory plan. Belts are thick cut lines with tread marks, parcels are printed blocks with a symbol, chutes are tinted bins. |
| Starwatch (`starwatch`) | Two-ink screen print on black stock. Halftone nebula, ships with pink and paper misregistration, every upgrade visible as a printed part on the ship. |
| Rally (`rally`) | Letterpress sports poster. Court in halftone ink, paddles as heavy bars, the score in big serif numerals. |
| Mosaic (`mosaic`) | Glazed ceramic tiles. Grout lines, glaze highlight top left, and a colour mosaic that appears when the puzzle is solved. |
| What does it sell? (`guess`) | Newsprint frame with registration marks and a pink offset. Grain sits on the frame, never on the screenshot. |

## 3. Never (the AI-slop list)

- Smooth empty areas without any structure.
- Generic two-colour gradients as backgrounds, vignettes made from radial gradients.
- Glow and bloom everywhere, neon kit looks, lens flares.
- Clipart shapes, emoji used as graphics, stock icons, decorative blobs.
- Decoration without a job.
- Cards with hard drop shadows and rounded pill tags as a layout crutch.
- Text that explains what is already visible, "Welcome to…" intros, feature lists, marketing words
  ("immersive", "epic"), tooltips for the obvious. Controls go in one short line, in the start or
  pause menu. The landing page has one short "How to play" per game because the owner asked for it.

## 4. Animation

- Easing from `Shell.ease`: `outCubic`, `inOutQuad`, `inOut`, `outBack`, `outElastic`. Nothing in UI,
  hits, jumps or banners moves linearly.
- Squash and stretch on jumps, landings, hits and pickups (scale x and y in opposite directions and
  ease back).
- Anticipation before big actions (wind-up, short pause) and overshoot then settle after them.
- Particles only for impact, destruction, pickups and engines. They come from a fixed pool
  (`Shell.particles(cap)`, `burst`, `spark`) so the main loop does not allocate.
- Screen shake only for big events, short, decaying, capped. Multiply by `Shell.shakeScale`.
- Hit feedback: `Shell.hitstop(30–80 ms)`, a light flash on the hit object, a matching sound.
- `requestAnimationFrame` with delta time (`Shell.loop`, capped step). Expensive textures are
  pre-rendered.
- `prefers-reduced-motion`: `Shell.reduced` is true, shake is 0, particles drop to a quarter,
  flashes and blinking are off, transitions become short fades. Gameplay stays the same.

## 5. Language and text

- All visible text is English, written like a good indie game: short, plain, no puns for their own
  sake. Buttons: Play, Shop, Resume, Retry, Easy / Normal / Hard.
- Each game keeps its strings in one `T` object at the top of `game.js`.
- Folders and URLs are English (`/games/orbit/` …). The old German folders only hold a redirect, so old links still work.
  Storage keys keep the old German slugs (`umlauf:…`, `echolot:…`) so nobody loses their saves.

## 6. Difficulty

- `Shell.difficulty(slug)` shows Easy / Normal / Hard in the start and game over menus. Default is
  Normal. The choice is stored under `<slug>:diff`; old values `leicht` and `schwer` are read as
  `easy` and `hard`.
- Each game has one config object (`D()` / `DF()` / `DIFF`) with what changes: speed, damage,
  lives, counts, time limits, blur strength, prices.
- Best scores are stored per difficulty under `<slug>:best:<diff>`. The old key `<slug>:best` is
  read as Normal and never removed.
- Rally: the computer's skill is the difficulty (old `schlagabtausch:level` values `leicht`,
  `mittel`, `schwer` are migrated). Prism: difficulty sets the number of decoy mirrors and how many
  extra moves still earn two stars.

## 7. Debug

Open `/debug` to set options, or pass them in the URL of any game:

`?debug=1&level=3&diff=hard&god=1&fps=1&hitbox=1&money=500&speed=0.5&textures=0`

What does it sell? also takes `solution=1`, `site=<id>`, `stage=<n>` and `resetseen=1`.
`debug=0` turns debug off. While debug is on, a small DEBUG box shows the frame rate and
<kbd>N</kbd> skips ahead. Every game key is written to `debug:<key>` instead, so normal saves
and best scores are never touched. Only `muted` and `debug` itself are shared.

## 8. Storage keys

All keys are prefixed with `labtoso-games:` in `localStorage`. New fields are only ever added,
with defaults; old ones are still read.

| Key | Content |
| --- | --- |
| `muted` | sound off (shared by all games) |
| `debug` | debug settings |
| `<slug>:diff` | `easy`, `normal` or `hard` |
| `<slug>:best:<diff>` | best score per difficulty (`<slug>:best` is the old Normal value) |
| `lichtweg:level`, `lichtweg:score`, `lichtweg:stars` | Prism progress |
| `mosaik:score`, `mosaik:done:<diff>` | Mosaic score and solved puzzles (old `:leicht`, `:schwer` read too) |
| `schlagabtausch:mode`, `:extras`, `:level` | Rally settings |
| `sternwacht:ship` | `{ v: 1, shards, up }`, Starwatch currency and upgrade tiers |
| `guess:seed` | the player's shuffle seed |
| `guess:seen` | first 8 hex digits of every site id already shown |
| `guess:reported` | ids the player reported, never shown again |
| `guess:mode`, `guess:cycle` | answer mode, how often the whole pool was played through |

## 9. Starwatch shop

Prices come from one table (`UPG` in `sternwacht/game.js`): tier n costs `base × growth^n`,
rounded to 5, times 0.85 / 1 / 1.2 for Easy / Normal / Hard. Shards drop per enemy type
(`SHARD_DROP`). B, Space or the Shop button open the shop and pause everything; B, Escape or
Resume close it, followed by a short countdown. Space does not fire, the ship shoots on its own,
and X drops a bomb.

## 10. What does it sell?

The pool is built by `tools/guess-pipeline` (see its README) as a GitHub Action and published from
the `pool` branch under `/pool/`. Format: `meta.json`, `categories.json`, 32 index shards
`i/<n>.json` with `{ id, c, r, d, t, a }` and screenshots `s/<id>.webp`. Domain and title are
XOR-encoded, images only carry a random id. Each player gets a seed; shards and entries are
ordered by a hash of seed and id, so every player sees a different order, new entries mix in on
their own, and nothing repeats until the whole pool has been seen. Removal requests go into
`tools/guess-pipeline/removal-list.json`.
