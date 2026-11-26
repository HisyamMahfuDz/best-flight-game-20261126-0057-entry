# best-flight-game-20261126-0057

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/HisyamMahfuDz/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/HisyamMahfuDz/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

# Tradewind Rally — Island Air Challenge

A complete 3D flight game that runs offline in a desktop browser from static
files. Fly the Kestrel-9 bush plane across a tropical archipelago: golden
rings, island airstrips, boats, birds and storm checkpoints.

## Play

Serve `game/` with any static server (or `node serve.ts`, then open
http://localhost:8080) and fly with keyboard and mouse. No network request,
no build step.

## How to fly

| Key | Action |
| --- | --- |
| W / S | Throttle up / down |
| ← / → (or A / D) | Bank left / right |
| ↑ / ↓ | Pitch up / down (mouse drag also pitches) |
| Space | Boost (burns fuel fast) |
| G | Landing gear up / down |
| R | Restart the sortie |
| P | Pause |
| M | Sound on / off |
| 1 / 2 / 3 | Pick a sortie on the title screen |
| Enter | Take off |

## Sorties

- **Ring Rally** — fly through all 8 golden rings in order. A clean pass
  banks bonus fuel; the clock is the enemy.
- **Island Hop** — land on all 3 airstrips (Kestrel Isle, Turtle Cay,
  Palm Shoal). Every landing refuels and patches the airframe.
- **Storm Courier** — hit 6 checkpoints before the storm timer runs out.
  Each checkpoint buys 12 more seconds.

Pick a loadout before take-off: Swift Wing (+speed, −fuel), Long Tank
(+fuel, −speed) or Sturdy Frame (half damage from rough landings).

## Landing

Gear down (G), slow to under 40 knots, line up with the strip and sink
gently. A hard touchdown damages the airframe; water and rock end the sortie.

## Tech

- Three.js (vendored under `game/vendor/`) renders the archipelago;
  everything else is original code in `game/src/`, one file per job.
- Sound is synthesised with WebAudio — no audio files.
- `main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to
  `/output` and writes `/output/dossier.json`.

## License

MIT — see [LICENSE](LICENSE).

## Run it

```sh
node serve.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=0a6j83jv&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
