# Arcade

Eleven browser game entries, live at **https://games.labtoso.de**.

| Game | What it is | Controls |
| --- | --- | --- |
| **Orbit** (`games/orbit`) | Circle a planet, let go at the right moment, get caught by the next one. | Tap, click or Space |
| **Sonar** (`games/sonar`) | Steer a submarine through dark water. Pings show the walls, cost battery and wake things up. | Hold and tap, or WASD/arrows and Space |
| **Prism** (`games/prism`) | Turn mirrors until the beam lights every crystal. | Tap or click, Z undo, H hint, R restart |
| **Rainmaker** (`games/rainmaker`) | Push clouds over dry fields as the wind. | Mouse or finger |
| **Switchyard** (`games/switchyard`) | Flip switches so every parcel reaches its chute. | Tap or 1–7 |
| **Starwatch** (`games/starwatch`) | Space shooter with wardens and a shop of upgrades. | Drag or WASD, Shift, X bomb, B/Space shop |
| **Rally** (`games/rally`) | Paddle duel against the computer or a friend. | W/S and ↑/↓, on phones both screen halves |
| **Mosaic** (`games/mosaic`) | Logic puzzle of numbered tiles that turns into a picture. | Tap and drag, H hint, M mode |
| **What does it sell?** (`games/guess`) | Guess what a real website sells from a blurred screenshot. | Tap, or 1–4 and Enter |
| **Casino** (`games/casino`) | Slots, Crash, Plinko and Blackjack with play credits, daily bonus, levels and achievements. No real money. | Space, H/S/D in Blackjack |

**Nexora** (`games/nexora`) adds 12 arcade games and 13 casino games, with virtual chips,
search, favourites and design settings. It is the uploaded NEXORA Arcade application split into
`index.html`, `style.css` and `app.js`, without a framework or build step. System fonts keep it
self-contained. The existing Casino remains a separate game.

Every game except Casino and Nexora has Easy, Normal and Hard (best scores are kept per difficulty). `/debug` opens a
public test mode with cheats, start level, difficulty, currency, FPS and hitboxes; the same
options work as URL parameters on every game, for example
`/games/starwatch/?debug=1&level=5&god=1&money=800`.

Plain HTML, CSS and JavaScript, no build step and no external assets. Run it locally with:

```sh
python3 -m http.server 8000
```

Scores and saves live only in the browser's `localStorage`. Art, animation, text, storage keys
and the debug parameters are described in the [style guide](STYLEGUIDE.md). The website pool for
"What does it sell?" is built by [tools/guess-pipeline](tools/guess-pipeline/README.md) as a
weekly GitHub Action and served from the `pool` branch.

Nexora saves use `labtoso-games:nexora:`. Legacy `pixelkiste_*` and `nexora_favs`
values are copied on first use without overwriting newer saves or removing old ones.
The imported game design and optional themes are retained; they are scoped to Nexora.
Pushes to `main` publish through `.github/workflows/static.yml` to GitHub Pages with
the existing custom domain `games.labtoso.de`.
