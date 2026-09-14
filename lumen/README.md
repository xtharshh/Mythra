# MYTHRA — forge any story into a playable world (MVP Phase 1–2)

Browser 3D mystery game engine: any genre, any story in — interactive realistic 3D world out. See `/architecture.md` at repo root for the full spec.

## License — proprietary, all rights reserved

MYTHRA is NOT open source. See [`LICENSE`](../LICENSE) at repo root: no use, copying, distribution, or derivatives without HARSH KUMAR's written permission. Playing the hosted game is allowed; everything else needs a yes in writing.

## Setup

Requirements: Node.js 20+, npm.

```bash
cd lumen
npm install
npm run dev      # http://localhost:5173
npm test         # vitest (8 tests: conditions, validation, missions, puzzles)
npm run build    # production build
```

No AI key needed — generation uses `MockProvider`, demo world ships in `src/data/demo-world.json`.

## Play the loop

`/play` → WASD move, drag mouse to look, **E** interact, Shift sprint.
Enter → inspect helmet/rover → collect metal/circuits → solve solar `4213` → complete missions → unlock ridge/lab (`7349`) → endings. Save/Load/Reset in the top bar. Progress persists in localStorage.

Puzzle answers (demo): solar `4213`, symbols `ORION`, lab `7349`.

## Structure

- `src/types.ts`, `src/schemas.ts` — domain model + Zod contracts
- `src/game/` — `conditions.ts` (pure evaluator), `engines.ts` (validation, missions, clues, puzzles)
- `src/three/` — `factory.ts` (procedural assets), `LumenScene.tsx` (renderer + FPS controls + raycast)
- `src/state/store.ts` — Zustand progress + localStorage saves
- `src/ai/mockProvider.ts` — deterministic no-key generation
- `src/pages/` — Landing, Explore, Play, Create (prompt→world), Studio (edit + validate + test tools)
- `tests/unit/` — evaluator + world validation + mission/puzzle tests

## Troubleshooting

- Blank 3D: check console for WebGL; scene needs GPU-enabled browser.
- `npm run build` fails on types: run `npx tsc -b` for the exact error.
- Port in use: `npx vite --port 5174`.
- Reset stuck progress: Play → Reset, or clear `lumen-save-v1:*` in localStorage.
