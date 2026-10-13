export const MODEL_PATHS = {
  playerVanta: "/models/cars/player-vanta-gt.glb",
  playerRace: "/models/cars/player-race.glb",
  traffic: [
    "/models/cars/traffic-sedan.glb",
    "/models/cars/traffic-taxi.glb",
    "/models/cars/traffic-van.glb",
    "/models/cars/traffic-suv.glb",
  ],
  buildings: [
    "/models/city/building-a.glb",
    "/models/city/building-b.glb",
    "/models/city/building-c.glb",
    "/models/city/building-d.glb",
    "/models/city/building-e.glb",
    "/models/city/building-f.glb",
    "/models/city/building-tall.glb",
    "/models/city/tower.glb",
  ],
  streetlight: "/models/props/streetlight.glb",
  streetlightCurved: "/models/props/streetlight-curved.glb",
  cone: "/models/props/cone.glb",
  barrier: "/models/props/barrier.glb",
};

export type CarConfig = {
  paint: string;
  wheelStyle: number;
  spoiler: boolean;
  neon: string;
  headlights: boolean;
  clearcoat: number;
  body: "vanta" | "race";
};

export const PAINTS = [
  { name: "Magenta", value: "#ff2e88" },
  { name: "Cyan", value: "#00e5ff" },
  { name: "Violet", value: "#7b2eff" },
  { name: "Amber", value: "#ffb020" },
  { name: "Lime", value: "#a3e635" },
  { name: "Crimson", value: "#ef4444" },
  { name: "Pearl", value: "#e8ecff" },
  { name: "Midnight", value: "#1b2438" },
];

export const NEONS = [
  { name: "Cyan", value: "#00e5ff" },
  { name: "Pink", value: "#ff2e88" },
  { name: "Violet", value: "#a855f7" },
  { name: "Amber", value: "#ffb020" },
  { name: "Green", value: "#22ff88" },
];

export const DEFAULT_CONFIG: CarConfig = {
  paint: "#ff2e88",
  wheelStyle: 1,
  spoiler: true,
  neon: "#00e5ff",
  headlights: true,
  clearcoat: 70,
  body: "vanta",
};
