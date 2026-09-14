# MYTHRA · `lumen/` app — forge any story into a playable world

[![Typing SVG](https://readme-typing-svg.demolab.com?font=Fira+Code&size=20&pause=1000&color=FFB45E&width=600&lines=Inspect.+Collect.+Solve.;Unlock+the+hidden+zone.;Mint+the+milestone+card.)](https://github.com/xtharshh/apexus-trending)

![Tests](https://img.shields.io/badge/tests-60+_vitest-green?style=flat-square)
![3D](https://img.shields.io/badge/3D-Three.js_0.186-c1553b?style=flat-square)
![API](https://img.shields.io/badge/API-Fastify_%3A4000-8b5cf6?style=flat-square)
![License](https://img.shields.io/badge/license-proprietary-red?style=flat-square)

Browser 3D mystery game engine: any genre, any story in — interactive realistic 3D world out.

## License — proprietary, all rights reserved

MYTHRA is NOT open source. See [`LICENSE`](../LICENSE) at repo root: no use, copying, distribution, or derivatives without HARSH KUMAR's written permission. Playing the hosted game is allowed; everything else needs a yes in writing.

## Setup

Requirements: Node.js 20+, npm.

```bash
cd lumen
npm install
npm run dev      # game → http://localhost:5173
npm run dev:api  # API  → http://localhost:4000 (multiplayer, leaderboard, cloud saves)
npm test         # vitest, all green
npm run build    # production build
```

No AI key needed — stamp worlds keyless with Mock, or bring OpenAI / Anthropic / Gemini / OpenRouter / Groq / Mistral / Ollama / custom keys on the Planner. Demo world ships in `src/data/demo-world.json`.

## Play the loop

`/play` → WASD move, drag look, **E** interact, **Space** jump, **F** fly (with suit), Shift sprint — every action remaps in the Control deck.
Enter → inspect helmet/rover → collect metal/circuits → solve solar `4213` → complete missions → unlock ridge/lab (`7349`) → endings → milestone brag card. Save/Load/Checkpoints in the top bar. Progress persists per explorer (email sign-in) with cloud sync when the API is up.

Puzzle answers (demo): solar `4213`, symbols `ORION`, lab `7349`.

## Structure

- `src/types.ts`, `src/schemas.ts` — domain model + Zod contracts
- `src/game/` — conditions, engines, checkpoints, controls (remappable binds), suits, share codes
- `src/three/` — `factory.ts` (realistic per-genre assets, correct motion per model), `LumenScene.tsx` (renderer + FPS/jump/fly + trigger FX), `HeroScene.tsx` (animated landing backdrop)
- `src/audio/` — TTS narration, mic commands, voice notes, SFX synth
- `src/auth/`, `src/api/` — email code login + Fastify client (local fallback)
- `src/social/` — milestone brag-card painter + share lanes
- `src/state/store.ts` — Zustand progress, saves, checkpoints, plays, ratings
- `src/ai/` — Mock + universal providers (any key)
- `src/pages/` — Dossier, Archive (discovery + leaderboard), Surface, Planner, Control
- `server/` — Fastify API: auth, worlds, progress, leaderboard, presence
- `tests/unit/` — 60+ suites: engines, controls, voice, checkpoints, share, suits, providers, theme, factory models

## Troubleshooting

- Blank 3D: check console for WebGL; scene needs GPU-enabled browser.
- `npm run build` fails on types: run `npx tsc -b` for the exact error.
- Port in use: `npx vite --port 5174`.
- No mic/audio: Play → **Audio test** proves speaker + mic on your machine.
- Stale dev errors after an update: restart `npm run dev` + hard refresh (Ctrl+Shift+R).
- Reset stuck progress: Play → Reset, or clear `lumen-save-v1:*` in localStorage.
