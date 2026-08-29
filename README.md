# Operation: Iron Viper

An original 1–4 player LAN co-op run-and-gun campaign inspired by the pace, visual constraints, and readable action of classic 8-bit console games. It uses original AI-assisted pixel art and procedural sound effects; no extracted game images, music, maps, or character assets are included.

## Play on the same Wi-Fi

```bash
npm install
npm run lan
```

The terminal prints a URL ending in `?local`. Share that exact address with up to three other players on the same Wi-Fi. Everyone chooses **READY UP**; the squad leader starts the operation. A solo mode is also available from the title screen.

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move / aim | WASD or arrow keys | D-pad / left stick |
| Fire | J or X | X / B |
| Jump | K, Z, or Space | A |
| Rescue teammate | L or E | Y |
| Start / skip briefing | Enter | Start |
| Pause | P or Escape | Select |

## Campaign and rules

- Four sectors: jungle perimeter, steel foundry, vertical waterfall ascent, and the Iron Viper fortress.
- Each soldier has three lives. A downed soldier can be rescued before a life is spent.
- The squad shares three continues. The mission fails when every soldier is eliminated and no continues remain.
- Defeat each sector commander and destroy General Viper to win.
- Enemy reinforcements and boss health scale with 1–4 players.
- Fire close to a teammate to charge **SYNC FIRE**, a temporary team damage and fire-rate boost.
- Rifle, machine gun, spread gun, laser, barrier, and extra-life drops support complementary squad roles.

## Development

```bash
npm run dev
npm run dev:server
npm test
npm run build
```

The simulation is deterministic and serializable, runs at 60 Hz in both browser and server, and is tested through real WebSocket clients.
