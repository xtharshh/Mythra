# MYTHRA — forge any story into a playable world

[![Typing SVG](https://readme-typing-svg.demolab.com?font=Fira+Code&size=22&pause=1000&color=FFB45E&width=650&lines=Every+world+is+a+mystery.;Every+mystery+is+playable.;Any+genre+in+%E2%80%94+3D+world+out.)](https://github.com/xtharshh/apexus-trending)

![Mars](https://img.shields.io/badge/genre-any_(mars_%E2%80%A2_ocean_%E2%80%A2_forest_%E2%80%A2_fantasy)-c1553b?style=for-the-badge)
![Engine](https://img.shields.io/badge/engine-React_%2B_Three.js_%2B_Fastify-8b5cf6?style=for-the-badge)
![License](https://img.shields.io/badge/license-proprietary_(all_rights_reserved)-red?style=for-the-badge)

> **MYTHRA** is a proprietary 3D mystery-game engine by **HARSH KUMAR**.
> Type a story brief — walk it as a living world: realistic hardware, correct
> per-object animations, voice narration, multiplayer explorers, checkpoints,
> leaderboards, and milestone brag cards.

<details>
<summary><b>✨ What it does (click to expand)</b></summary>

| Pillar | Feel |
|---|---|
| 🌍 **Any story in** | Mars, ocean, forest, fantasy, horror — the engine dresses every object for its genre |
| 🤖 **Any AI director** | OpenAI · Anthropic · Gemini · OpenRouter · Groq · Mistral · Ollama · custom — or keyless Mock |
| 🧍 **Many solvers, one tale** | Live explorers in scenario suits, name tags, per-tale leaderboard |
| 🎙️ **Voice everywhere** | TTS narration, mic commands, record-your-own story clips, audio self-test |
| 💾 **Never lose a run** | Per-explorer saves + named checkpoints (manual + auto) |
| 🏆 **Show off** | 100% completion mints a shareable milestone card (X / WhatsApp / Telegram / …) |

</details>

<details>
<summary><b>🗺️ How a run plays</b></summary>

```mermaid
flowchart LR
    A[Brief] --> B[AI compiles world]
    B --> C[Descend to surface]
    C --> D[Inspect · collect · talk]
    D --> E[Solve puzzles]
    E --> F[Unlock hidden zones]
    F --> G[Truth + milestone card]
```

Enter → clue → resource → puzzle → mission → hidden location → secret ending.

</details>

<details>
<summary><b>🚀 Run it</b></summary>

```bash
cd mythra
npm install
npm run dev        # game  → http://localhost:5173
npm run dev:api    # API   → http://localhost:4000  (optional; game plays offline without it)
npm test           # 60+ vitest suites, all green
npm run build      # production build
```

Set `VITE_API_URL=http://localhost:4000` to light up multiplayer presence,
the shared leaderboard, and cloud saves. No key, no account needed to play.

</details>

<details>
<summary><b>🎮 Controls</b></summary>

Move **WASD**, look with mouse, **E** interact, **Space** jump, **F** flight suit
(with suit), **Shift** sprint — and every action remaps to your own keys in the
in-game **Control deck** (strict browser keys can never be captured).

</details>

---

### ⚖️ License — proprietary, all rights reserved

MYTHRA is **NOT open source**. See [`LICENSE`](./LICENSE): no use, copying,
distribution, or derivatives — and no ownership claims — without HARSH KUMAR's
written permission. Playing the hosted game is allowed; everything else needs
a yes in writing. 🎮 Build worlds. Give credit.
