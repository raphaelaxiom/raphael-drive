# Raphael Drive — Neon City Driving

An original open-source browser driving game by **Raphael**.
Next.js + Three.js (WebGL) + cannon-es real physics. Drive a neon city at night:
free-roam, drift for points, nitro, traffic, checkpoints, police chases, taxi
and delivery jobs — with 129 working features.

**Live demo:** https://raphael-drive.vercel.app
**Portfolio:** https://portfolio.theraphael.online

> All code, text, music, and visuals in this repo are original works created
> for this project. Nothing was copied from any reference site. The car is a
> generic fictional "Vanta GT" — no real-brand badges. 3D models are original
> procedural PBR works plus CC0 assets credited in `public/models/README.md`.

## Features (129)

- **Real physics** — cannon-es `RaycastVehicle`, 1,400 kg chassis, suspension,
  wheel friction, drift, solid building / traffic / cone colliders. No
  pass-through: cars stop, slide, and bounce on impact.
- **Realistic PBR neon city** — procedural asphalt, facades, wet puddles,
  neon signs, bloom, ACES tone mapping, fog, rain, day/night cycle.
- **Garage** — paint + metallic + clearcoat + matte/gloss, 5 wheel styles,
  rim colour, tyre width, 4 spoiler styles + size, neon + pulse, headlights,
  tail-lights, tint, calipers, body kit, decals, ride height, camber.
- **Drive modes** — Free Roam, Time Trial, Checkpoint Race, Drift Challenge.
  Weather (Clear / Rain / Storm / Fog), traffic density 0–20, police chase,
  taxi & delivery jobs, fuel stations, repair garages, car wash.
- **Custom Music (My Music)** — pick your own audio files from your device.
  Stored in your browser only (IndexedDB), never uploaded. Playlist, seek,
  shuffle, repeat, and **crossfade** (fade-out → fade-in, 0–5 s, default 1.5 s).
- **Custom Car Model Upload** — pick your own `.glb` / `.gltf` car from your
  device. Local only, auto-normalized, paint/wheels/spoiler re-applied.
  Same physics chassis drives every model.
- **Plus** — 5 cameras, minimap, HUD layouts, km/h ↔ mph, key-bind remap,
  EN/Hinglish, graphics quality, colour-blind modes, FPS counter, photo mode
  (PNG), 10-second replay, ghost car, hotseat 2-player, achievements,
  local top-10 leaderboard, settings export/import. Full list in `FEATURES.md`.

## Controls

| Action | Keys |
|---|---|
| Accelerate | `W` / `↑` |
| Brake / Reverse | `S` / `↓` |
| Steer | `A` / `D` or `←` / `→` |
| Drift / Handbrake | `Space` |
| Nitro | `Shift` |
| Camera | `C` |
| Horn | `H` |
| Respawn | `R` |
| Mute | `M` |
| Pause / Menu | `Esc` |

Touch buttons are shown on mobile. Key binds are remappable in Settings.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm start
```

Requires Node 20+. No API keys, no backend, no env files.

## Deploy

Any Next.js host works. This project deploys to Vercel:

```bash
npx vercel --prod
```

## Credits

- Rendering: Three.js (MIT)
- Physics: cannon-es (MIT)
- 3D models: original procedural works + CC0 assets — see
  `public/models/README.md` for the full mapping.
- Music: original WebAudio synthesis (Raphael FM) or the player's own local
  files. No third-party music is distributed.

## License

MIT — see [LICENSE](LICENSE).
