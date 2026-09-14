# LUMEN — MVP (Phase 1–2)

Browser 3D mystery game. See `/skills.md`, `/architecture.md`, `/implementations.md` at repo root and `LUMEN_Full_Game_Documentation.md` for the full spec.

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
