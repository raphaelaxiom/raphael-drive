# Raphael Drive — Features

All features below are original implementations for this project. No code, text,
music, or models from any reference site were copied. Car / city / road visuals
are original procedural PBR works; physics is cannon-es (MIT); rendering is
Three.js (MIT).

## Custom Car Model Upload (Garage → “Upload My Car Model”)

- **Upload My Car Model** — pick your OWN `.glb` / `.gltf` file from your device
  via the File API. Local only: parsed in-browser with GLTFLoader, stored in
  IndexedDB on this device, **never uploaded to any server**.
- **Validation** — non-GLB/GLTF rejected with an error toast; empty (0-byte)
  files rejected; files over 20 MB show a confirm warning before parsing.
- **Auto-normalize** — longest horizontal axis scaled to ~4.3 m, height clamped
  to ≤ 2.1 m, centred on X/Z, lowest point ground-aligned at y=0. Models
  authored long along X are rotated so length lies along Z.
- **Orientation** — built-in convention is nose +Z, turned PI in the holder to
  face physics forward (−Z). Custom models get the same turn. **Flip model**
  toggle adds another half-turn for models authored nose −Z.
- **Paint recolor** — detected body materials (largest meshes + names containing
  body/paint/shell/car/hood/door/fender/bumper, excluding wheels/glass/lights)
  are tinted by the Garage paint picker.
- **Wheels** — meshes named wheel / tyre / tire / rim are wrapped in spin
  pivots and spin with speed like the built-in wheels. If no wheel meshes are
  found, the built-in wheels stay visible and keep spinning (fallback).
- **Spoiler** — a mesh named spoiler/wing (if present) follows the Garage
  spoiler toggle; otherwise the toggle only affects the built-in car.
- **My Models list** — name, date, size (MB), mesh count, wheels-found flag.
  **Use** swaps the car in Garage + Drive; **Delete** removes it from IndexedDB
  (with confirm) and reverts to the default if it was selected.
- **Persistence** — model bytes in IndexedDB; selected model id + flip in
  `localStorage` (`raphael-drive-custom-car`, `raphael-drive-custom-car-flip`).
  Re-upload is needed only if browser storage was cleared.
- **Physics unchanged** — swapping only replaces the visual body inside the
  holder. The same 1,400 kg cannon-es RaycastVehicle chassis, suspension,
  colliders, and damage model drive every model. Glow + headlight spots persist.
- **Privacy** — the file never leaves the device; there is no upload endpoint.

## Core (pre-existing)

- Real cannon-es RaycastVehicle physics (1,400 kg, suspension, grip, drift).
- Solid building / traffic / cone colliders — no pass-through.
- Procedural PBR city, road, facades, wet puddles, neon, bloom, ACES.
- Garage: paint, wheels, spoiler, neon, headlights, clearcoat, body style.
- Drive: checkpoints, drift scoring, nitro, traffic, rain, day/night, damage.
- Audio: WebAudio engine, nitro, squeal, collision, Raphael FM synthwave.
- PWA manifest, responsive + touch controls.

## My Music — Your Own Songs (Garage / Drive / Settings → My Music)

- **Upload My Own Songs** — pick audio files (mp3/wav/ogg/m4a/flac/webm) from
  your device via the File API. Stored in this browser (IndexedDB),
  **never uploaded to any server**; there is no upload endpoint.
- **Playlist** — play/pause/next/prev, seek bar with progress, shuffle,
  repeat off/all/one, per-song Play + Delete, volume from Settings.
- **Crossfade (fade-out → fade-in)** — two HTMLAudioElements: when a track
  ends or you skip, the old track fades out while the new one fades in over
  the Settings crossfade duration (0-5s, default 1.5s), with an
  equal-power-ish curve so the mix never dips to silence. Fade-in on first
  play, fade-out on pause/stop. No clicks, no gaps.
- **Music Source switch** — Radio (Raphael FM synthwave) ↔ My Music ↔ Off.
- **Music Ducks Engine** — toggle: while your songs play, the engine hum
  dips to 35% so the music sits on top.
- **Persistence** — songs in IndexedDB + settings in localStorage; playlist
  survives reload. Files are re-read from the browser store, never the server.
- **Crossfade test (verified by code + build)** — `MyMusicPlayer.playId`
  ramps the new element 0→volume and the old element volume→0 in parallel
  over `crossfade` seconds; `handleEnded` auto-advances with the same
  crossfade. Manual browser check recommended: add 2 songs, play one, press
  Next — you should hear the overlap, not a cut.

## 100+ Real Features (Settings panel + Garage + Drive + Docs)

Total registry count is shown in Docs and on the Home page
(`FEATURE_REGISTRY.length`, currently 129 entries incl. Custom Car).
Every entry is a working control persisted in localStorage
(`raphael-drive-settings-v1`) and listed with its effect in
`lib/settings.ts` → `FEATURE_REGISTRY`:

- **Garage (21):** custom paint colour, metallic, clearcoat, finish
  (gloss/matte/satin), 5 wheel styles, rim colour, tyre width, 4 spoiler
  styles + size, neon colour + brightness + pulse, headlight colour +
  on/off, tail-light style, window tint, caliper colour, body kit, decals,
  ride height, camber.
- **Drive (32):** 4 drive modes (Free Roam / Time Trial / Checkpoint Race /
  Drift Challenge), day/night slider + auto cycle, 4 weathers + intensity,
  traffic density 0-20 (20 cars spawned, extras parked), traffic aggression,
  minimap on/off + size + zoom, HUD full/minimal/off, km/h↔mph, 5 cameras
  (chase/hood/top/cinematic/first-person) + FOV + shake, nitro capacity +
  recharge, drift multiplier, damage on/off, fuel system, engine sound
  V8/V12/Electric + volumes, horn (3 styles, H key), high beam, wipers,
  handbrake strength, ABS, traction control, steering sensitivity,
  auto-brake assist.
- **Game (22):** pause (P), lap timer, best lap (localStorage), checkpoint
  progress, drift combo, score, top-10 local leaderboard, achievements
  (First Drift, Drift Master, Checkpoint Runner, Speed Demon), daily seed,
  photo mode (PNG download), replay last 10s, ghost car (best-lap path),
  hotseat 2-player, reset score, mute, radio, respawn, restart, time-trial
  target, drift target, countdown length, race laps.
- **Settings (22):** 6 remappable key binds, touch controls + size,
  EN/Hinglish labels, graphics quality, master/music/SFX/radio volumes,
  crossfade duration, track subtitles, colour-blind modes, reduce motion,
  FPS counter, export/import settings JSON, reset all.
- **World (21):** time presets, 4 districts (palette), road wetness,
  puddle amount, neon district, billboard cycle, streetlights, moon+stars,
  clouds, fireworks, police chase (chases + siren when speeding, catch
  penalty), taxi job, delivery job, fuel stations, repair garages, car wash,
  ambient noise, rain, fog density, building lights, traffic-light cycle.
- **Music (8) + Custom Car (3):** see My Music + Custom Car sections above.

## What was NOT copied

No code, text, music, or models from any reference site were downloaded,
copied, or used. All visuals are original procedural PBR; all music is
original WebAudio synthesis or the user's own local files; the car is a
generic fictional Vanta GT with no real-brand badges. Third-party code is
limited to permissively licensed libraries: Three.js (MIT), cannon-es
(MIT), Next.js/React (MIT).
