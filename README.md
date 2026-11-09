# Arcade

Nine small browser games, live at **https://games.labtoso.de**.

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

Every game has Easy, Normal and Hard (best scores are kept per difficulty). `/debug` opens a
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
