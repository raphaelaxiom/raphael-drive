# Asset Credits — Raphael Drive

## Primary visuals (current build)
Car, city, road, sidewalk and facade textures are **original procedural PBR
works authored for Raphael Drive** (canvas-generated asphalt / concrete /
brick / glass textures, clearcoat paint, neon signs) — treated as CC0.
No real brands, no trademarked car replicas, no copied assets.
Physics: cannon-es (MIT). Rendering: Three.js (MIT).

## Legacy Kenney models (kept as unused fallback files only)
The files in `public/models/` are from Kenney (https://kenney.nl), released under
**Creative Commons Zero (CC0 1.0)** — https://creativecommons.org/publicdomain/zero/1.0/
They are NO LONGER used as primary visuals (the previous low-poly look was
replaced by the procedural PBR build above) and remain only so old references
do not break. Player car is presented as the generic fictional "Vanta GT".

## Sources (verified License.txt inside each source ZIP)

| File(s) in this repo | Original pack | Original file(s) | Source |
|---|---|---|---|
| `cars/player-vanta-gt.glb` | Car Kit 3.1 | `sedan-sports.glb` | https://kenney.nl/assets/car-kit |
| `cars/player-race.glb` | Car Kit 3.1 | `race-future.glb` | https://kenney.nl/assets/car-kit |
| `cars/traffic-sedan.glb` | Car Kit 3.1 | `sedan.glb` | https://kenney.nl/assets/car-kit |
| `cars/traffic-taxi.glb` | Car Kit 3.1 | `taxi.glb` | https://kenney.nl/assets/car-kit |
| `cars/traffic-van.glb` | Car Kit 3.1 | `van.glb` | https://kenney.nl/assets/car-kit |
| `cars/traffic-suv.glb` | Car Kit 3.1 | `suv.glb` | https://kenney.nl/assets/car-kit |
| `city/building-a..f.glb` | City Kit Commercial 2.1 | `low-detail-building-a..f.glb` | https://kenney.nl/assets/city-kit-commercial |
| `city/building-tall.glb` | City Kit Commercial 2.1 | `building-a.glb` | https://kenney.nl/assets/city-kit-commercial |
| `city/tower.glb` | City Kit Commercial 2.1 | `building-skyscraper-c.glb` | https://kenney.nl/assets/city-kit-commercial |
| `props/streetlight.glb`, `props/streetlight-curved.glb` | City Kit Roads 2.2 | `light-square.glb`, `light-curved.glb` | https://kenney.nl/assets/city-kit-roads |
| `props/cone.glb`, `props/barrier.glb` | City Kit Roads 2.2 | `construction-cone.glb`, `construction-barrier.glb` | https://kenney.nl/assets/city-kit-roads |

## Notes

- Files were renamed to canonical game names; geometry is otherwise unmodified.
- Total models size: ~1.5 MB. All files verified as glTF 2.0 (`glTF` magic header).
- If any model fails to load at runtime, the game falls back to an original
  procedural Three.js car / building so the build never breaks.
- All text, music, code, neon-sign wording, and the "Vanta GT" name are original
  works created for Raphael Drive. Kenney is not affiliated with or endorsing
  this project.
