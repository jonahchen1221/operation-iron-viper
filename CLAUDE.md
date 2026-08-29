# Operation: Iron Viper architecture

This is a deterministic 1–4 player run-and-gun game inspired by 8-bit military arcade games.

## Invariants

1. `src/game/` is the pure, serializable simulation. It must not import DOM, Canvas, timers, WebSocket, or `Math.random`.
2. Gameplay advances at a fixed 60 Hz through `updateGame(state, inputs)`.
3. The LAN server is authoritative. Clients send only current input and render snapshots.
4. Renderer code only reads `GameState`; it never changes the simulation.
5. Visual assets are original AI-assisted pixel art and audio is generated in code. Do not add extracted copyrighted game assets.

## Commands

- `npm run dev` — Vite client on port 5173
- `npm run dev:server` — LAN server on port 8080 during development
- `npm run lan` — build and run the complete game on one LAN-visible port
- `npm test` — gameplay, protocol, and real WebSocket tests
- `npm run build` — strict typecheck and production bundle
