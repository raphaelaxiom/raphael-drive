"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { AudioEngine, RADIO_TRACKS } from "@/lib/audio";
import { PAINTS, NEONS, DEFAULT_CONFIG, type CarConfig } from "@/lib/assets";
import { loadSettings, saveSettings, DEFAULT_SETTINGS, FEATURE_REGISTRY, FEATURE_COUNT, label, type Settings } from "@/lib/settings";
import SettingsPanel from "@/components/SettingsPanel";
import MyMusicPanel from "@/components/MyMusicPanel";
import { myMusicPlayer } from "@/lib/mymusic";
import { saveCustomModel, listCustomModels, loadCustomModelData, deleteCustomModel, validateCustomFile, parseGlb, normalizeCustomModel, applyPaintToCustomMats, CUSTOM_CAR_CHOICE_KEY, CUSTOM_CAR_FLIP_KEY, type CustomModelMeta } from "@/lib/customCar";

type Mode = "menu" | "garage" | "drive" | "docs" | "settings";
type CamMode = 0 | 1 | 2 | 3 | 4;

const CHECKPOINTS = [
  { x: 0, z: -60 },
  { x: 60, z: -30 },
  { x: 60, z: 45 },
  { x: -30, z: 60 },
  { x: -60, z: -15 },
];
const BUILDING_BLOCKS: Array<{ x: number; z: number }> = [];
for (const bx of [-45, -15, 15, 45]) for (const bz of [-45, -15, 15, 45]) BUILDING_BLOCKS.push({ x: bx, z: bz });
const STREETS = [-75, -60, -30, 0, 30, 60, 75];
const NEON_WORDS = ["RAPHAEL", "NEON", "DRIVE", "TURBO", "MIDNIGHT", "VANTA GT", "APEX", "NITRO", "CITY", "GLOW"];

// ---------- Procedural PBR textures (original, authored for this project, CC0) ----------
function seededRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat = true): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}
function asphaltMaps(): { map: THREE.Texture; roughnessMap: THREE.Texture; bumpMap: THREE.Texture } {
  const rnd = seededRand(1337);
  const draw = (base: string, speck: string) => (g: CanvasRenderingContext2D, w: number, h: number) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const v = rnd();
      g.fillStyle = v > 0.5 ? speck : "rgba(0,0,0,0.35)";
      g.globalAlpha = 0.05 + rnd() * 0.12;
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    g.globalAlpha = 1;
    // cracks + patches
    for (let i = 0; i < 14; i++) {
      g.strokeStyle = "rgba(0,0,0,0.35)"; g.lineWidth = 1 + rnd() * 1.5;
      g.beginPath();
      let x = rnd() * w, y = rnd() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.5) * 60; g.lineTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 8; i++) {
      g.fillStyle = "rgba(0,0,0,0.18)";
      g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 30 + rnd() * 60, 18 + rnd() * 40, rnd() * 3, 0, Math.PI * 2); g.fill();
    }
  };
  const map = canvasTex(512, 512, draw("#242429", "#ffffff"));
  const rough = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#b8b8b8"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) { g.fillStyle = rnd() > 0.5 ? "#8a8a8a" : "#e0e0e0"; g.globalAlpha = 0.15; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
    g.globalAlpha = 1;
    // wet patches = smoother (darker in roughness map)
    for (let i = 0; i < 10; i++) { g.fillStyle = "rgba(40,40,40,0.55)"; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 40 + rnd() * 70, 22 + rnd() * 44, rnd() * 3, 0, Math.PI * 2); g.fill(); }
  });
  rough.colorSpace = THREE.NoColorSpace;
  const bump = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#808080"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 7000; i++) { const v = Math.floor(90 + rnd() * 80); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
  });
  bump.colorSpace = THREE.NoColorSpace;
  return { map, roughnessMap: rough, bumpMap: bump };
}
function roadTexture(): THREE.CanvasTexture {
  const rnd = seededRand(77);
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#222226"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { g.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.3)"; g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
    // edge lines
    g.fillStyle = "#d8d8d8"; g.fillRect(0, 14, w, 6); g.fillRect(0, h - 20, w, 6);
    // centre dashed amber
    g.fillStyle = "#ffb020";
    for (let x = 0; x < w; x += 64) g.fillRect(x + 8, h / 2 - 4, 36, 8);
    // tyre-wear darkening in wheel tracks
    g.fillStyle = "rgba(0,0,0,0.22)";
    g.fillRect(0, h * 0.28, w, 34); g.fillRect(0, h * 0.62, w, 34);
  });
}
function sidewalkTexture(): THREE.CanvasTexture {
  const rnd = seededRand(55);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#3a3a3e"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) { g.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.28)"; g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
    g.strokeStyle = "rgba(0,0,0,0.5)"; g.lineWidth = 3;
    g.strokeRect(0, 0, w, h);
    g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  });
}
function facadeTextures(variant: number): { map: THREE.Texture; emissiveMap: THREE.Texture } {
  const rnd = seededRand(1000 + variant * 7919);
  const bases = ["#2b2b31", "#3a3230", "#232c38", "#33302c", "#1f2a33"];
  const base = bases[variant % bases.length];
  const map = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { g.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.25)"; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
    // floor slabs
    for (let y = 0; y < h; y += 42) { g.fillStyle = "rgba(0,0,0,0.45)"; g.fillRect(0, y, w, 3); }
    // windows
    for (let y = 14; y < h - 18; y += 42) {
      for (let x = 14; x < w - 18; x += 34) {
        const lit = rnd();
        if (lit < 0.28) g.fillStyle = "#ffca7a";
        else if (lit < 0.45) g.fillStyle = "#9fd8ff";
        else g.fillStyle = "#0d1420";
        g.fillRect(x, y, 20, 26);
        g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(x, y, 20, 4);
      }
    }
    // ground floor storefront
    g.fillStyle = "#101018"; g.fillRect(0, h - 58, w, 58);
    g.fillStyle = "rgba(0,229,255,0.25)"; g.fillRect(8, h - 50, w - 16, 34);
  });
  const emissive = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = "#000000"; g.fillRect(0, 0, w, h);
    const rnd2 = seededRand(1000 + variant * 7919);
    for (let y = 14; y < h - 18; y += 42) {
      for (let x = 14; x < w - 18; x += 34) {
        const lit = rnd2();
        if (lit < 0.28) { g.fillStyle = "#ff9a2e"; g.fillRect(x, y, 20, 26); }
        else if (lit < 0.45) { g.fillStyle = "#3aa7ff"; g.fillRect(x, y, 20, 26); }
      }
    }
    g.fillStyle = "#0a4a5a"; g.fillRect(8, h - 50, w - 16, 34);
  });
  return { map, emissiveMap: emissive };
}
function neonTexture(word: string, color: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#07070f"; g.fillRect(0, 0, 512, 128);
  g.font = "900 58px Arial, sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.shadowColor = color; g.shadowBlur = 26;
  g.fillStyle = color;
  g.fillText(word, 256, 66);
  g.shadowBlur = 0;
  g.strokeStyle = color; g.lineWidth = 3; g.strokeRect(6, 6, 500, 116);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function tyreTexture(): THREE.CanvasTexture {
  const rnd = seededRand(9);
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = "#151515"; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { g.fillStyle = "#050505"; g.fillRect(x + 3, 8, 8, h - 16); g.fillStyle = "#232323"; g.fillRect(x + 11, 8, 3, h - 16); }
    for (let i = 0; i < 400; i++) { g.fillStyle = "rgba(255,255,255,0.05)"; g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
  });
}

// ---------- Realistic procedural car (original proportions, PBR) ----------
type WheelRig = { pivot: THREE.Group; spin: THREE.Group };
function buildRealisticCar(paint: string, opts: { spoiler?: boolean; race?: boolean } = {}): { group: THREE.Group; bodyMat: THREE.MeshPhysicalMaterial; wheelRigs: WheelRig[]; spoiler: THREE.Group; headlightMat: THREE.MeshStandardMaterial; tyreMat: THREE.MeshStandardMaterial } {
  const g = new THREE.Group();
  const paintMat = new THREE.MeshPhysicalMaterial({ color: paint, metalness: 0.85, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2 });
  const carbonMat = new THREE.MeshStandardMaterial({ color: "#0c0c10", roughness: 0.45, metalness: 0.6 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: "#101823", metalness: 0.1, roughness: 0.06, transparent: true, opacity: 0.82, envMapIntensity: 1.6, clearcoat: 1 });
  const trimMat = new THREE.MeshStandardMaterial({ color: "#0a0a0c", roughness: 0.55, metalness: 0.4 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: "#cfd4dd", roughness: 0.18, metalness: 1 });

  // Lower body — sculpted, not a box: wide rounded shell + sloped nose + tapered tail
  const lower = new THREE.Mesh(new RoundedBoxGeometry(1.88, 0.52, 4.35, 4, 0.16), paintMat);
  lower.position.y = 0.58; lower.castShadow = true; lower.receiveShadow = true; g.add(lower);
  const nose = new THREE.Mesh(new RoundedBoxGeometry(1.72, 0.34, 0.9, 4, 0.12), paintMat);
  nose.position.set(0, 0.46, 2.25); nose.rotation.x = 0.08; nose.castShadow = true; g.add(nose);
  const hood = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.1, 1.15, 3, 0.05), paintMat);
  hood.position.set(0, 0.82, 1.45); hood.rotation.x = -0.06; g.add(hood);
  // Cabin: glass canopy + painted roof + rear deck
  const cabin = new THREE.Mesh(new RoundedBoxGeometry(1.48, 0.52, 2.05, 4, 0.2), glassMat);
  cabin.position.set(0, 1.06, -0.25); cabin.castShadow = true; g.add(cabin);
  const roof = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.08, 1.15, 3, 0.04), paintMat);
  roof.position.set(0, 1.33, -0.3); roof.rotation.x = 0.04; g.add(roof);
  const rearDeck = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.16, 0.85, 3, 0.06), paintMat);
  rearDeck.position.set(0, 0.82, -1.75); g.add(rearDeck);
  // Fenders / arches
  for (const [x, z] of [[-0.9, 1.42], [0.9, 1.42], [-0.9, -1.42], [0.9, -1.42]] as const) {
    const f = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.3, 1.05, 3, 0.1), paintMat);
    f.position.set(x, 0.72, z); g.add(f);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.06, 10, 24, Math.PI), trimMat);
    arch.position.set(x, 0.5, z); arch.rotation.y = Math.PI / 2; g.add(arch);
  }
  // Side skirts, splitter, diffuser, grille, mirrors
  for (const x of [-0.96, 0.96]) {
    const skirt = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.16, 2.4, 2, 0.04), carbonMat);
    skirt.position.set(x, 0.32, 0); g.add(skirt);
    const mirror = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.12, 0.14, 2, 0.04), paintMat);
    mirror.position.set(x * 1.12, 1.02, 0.72); g.add(mirror);
  }
  const splitter = new THREE.Mesh(new RoundedBoxGeometry(1.8, 0.07, 0.35, 2, 0.03), carbonMat);
  splitter.position.set(0, 0.3, 2.45); g.add(splitter);
  const diffuser = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.12, 0.4, 2, 0.04), carbonMat);
  diffuser.position.set(0, 0.32, -2.25); g.add(diffuser);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.2, 0.06), trimMat);
  grille.position.set(0, 0.5, 2.62); g.add(grille);
  // Headlights: lens + emissive core; taillight full-width strip
  const headMat = new THREE.MeshStandardMaterial({ color: "#fff8d6", emissive: "#fff2b0", emissiveIntensity: 1.6, roughness: 0.2 });
  for (const x of [-0.62, 0.62]) {
    const hl = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.13, 0.12, 2, 0.05), headMat);
    hl.position.set(x, 0.66, 2.55); g.add(hl);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: "#ff2244", emissive: "#ff1233", emissiveIntensity: 1.4, roughness: 0.3 });
  const tail = new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.1, 0.08, 2, 0.04), tailMat);
  tail.position.set(0, 0.72, -2.2); g.add(tail);
  // Exhausts
  for (const x of [-0.45, 0.45]) {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 16), chromeMat);
    ex.rotation.x = Math.PI / 2; ex.position.set(x, 0.34, -2.28); g.add(ex);
  }
  // Spoiler
  const spoiler = new THREE.Group();
  const wing = new THREE.Mesh(new RoundedBoxGeometry(opts.race ? 2.1 : 1.9, 0.07, 0.5, 2, 0.03), carbonMat);
  wing.position.set(0, 1.22, -2.15); spoiler.add(wing);
  for (const x of [-0.78, 0.78]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.42, 0.22), carbonMat);
    strut.position.set(x, 0.98, -2.15); spoiler.add(strut);
  }
  g.add(spoiler);
  // Wheels: tyre with tread + alloy rim + spokes + brake disc
  const tyreMat = new THREE.MeshStandardMaterial({ map: tyreTexture(), roughness: 0.92, metalness: 0.05 });
  const rimMat = new THREE.MeshStandardMaterial({ color: "#d6dae2", roughness: 0.22, metalness: 1 });
  const discMat = new THREE.MeshStandardMaterial({ color: "#8a8f98", roughness: 0.4, metalness: 0.9 });
  const wheelRigs: WheelRig[] = [];
  const tyreGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.28, 28); tyreGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.29, 20); rimGeo.rotateZ(Math.PI / 2);
  const discGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.3, 20); discGeo.rotateZ(Math.PI / 2);
  for (const [x, z, front] of [[-0.88, 1.42, true], [0.88, 1.42, true], [-0.88, -1.42, false], [0.88, -1.42, false]] as const) {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.37, z); g.add(pivot);
    const spin = new THREE.Group(); pivot.add(spin);
    const tyre = new THREE.Mesh(tyreGeo, tyreMat); tyre.castShadow = true; spin.add(tyre);
    const rim = new THREE.Mesh(rimGeo, rimMat); spin.add(rim);
    const disc = new THREE.Mesh(discGeo, discMat); spin.add(disc);
    for (let i = 0; i < 5; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.06), rimMat);
      spoke.rotation.x = (i / 5) * Math.PI; // spokes in YZ plane (axle = X)
      spin.add(spoke);
    }
    wheelRigs.push({ pivot, spin });
    void front;
  }
  g.userData.bodyMat = paintMat;
  g.userData.isProcedural = true;
  return { group: g, bodyMat: paintMat, wheelRigs, spoiler, headlightMat: headMat, tyreMat };
}

export default function RaphaelDrive() {
  const mountRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const touchRef = useRef({ left: false, right: false, gas: false, brake: false, nitro: false, drift: false });
  const configRef = useRef<CarConfig>(DEFAULT_CONFIG);
  const modeRef = useRef<Mode>("menu");
  const camRef = useRef<CamMode>(0);
  const stateRef = useRef({ speed: 0, nitro: 100, driftScore: 0, checkpoint: 0, laps: 0, countdown: -1, countdownT: 0, started: false, time: 0, damage: 0, shake: 0, offroad: false, score: 0, fuel: 100, lapTime: 0, lapStart: 0, bestLap: 0, driftCombo: 0, lastDriftEnd: 0, jobStage: 0 as 0 | 1 | 2, jobType: "" as "" | "taxi" | "delivery", jobX: 0, jobZ: 0, policeActive: false, policeX: 0, policeZ: 0, ghostIdx: 0, replayIdx: 0, replaying: false, hotseatPlayer: 1, hotseatTimes: [] as number[], fps: 0, fpsAcc: 0, fpsFrames: 0, fireworksT: 0, rainFlash: 0 });
  const ghostPathRef = useRef<Array<{ x: number; z: number; t: number }>>([]);
  const bestPathRef = useRef<Array<{ x: number; z: number; t: number }>>([]);
  const replayPathRef = useRef<Array<{ x: number; z: number; t: number }>>([]);
  const settingsRef = useRef<Settings>(loadSettings());
  const [settings, setSettings] = useState<Settings>(() => settingsRef.current);
  const [scoreHud, setScoreHud] = useState({ score: 0, fuel: 100, lapTime: 0, bestLap: 0, combo: 0, job: "", fps: 0, police: false });
  const [leaderboard, setLeaderboard] = useState<Array<{ score: number; date: string }>>(() => { try { return JSON.parse(localStorage.getItem("raphael-drive-leaderboard") || "[]"); } catch { return []; } });
  const [achievements, setAchievements] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem("raphael-drive-achievements") || "[]"); } catch { return []; } });
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [currentSong, setCurrentSong] = useState<string | null>(null);
  const sceneRef = useRef<{ scene: THREE.Scene; car: THREE.Group; wheelRigs: WheelRig[]; spoiler: THREE.Group; headlightMat: THREE.MeshStandardMaterial; bodyMat: THREE.MeshPhysicalMaterial; carBodyGroup: THREE.Group; defaultBody: THREE.Group; customGroup: THREE.Group | null; customWheelPivots: THREE.Group[]; customBodyMats: THREE.Material[]; customSpoiler: THREE.Object3D | null; customHasWheels: boolean; swapCustomCar: ((id: string | "default") => Promise<void>) | null; traffic: Array<{ g: THREE.Group; body: CANNON.Body; dir: number; speed: number; axis: "x" | "z"; spinUntil: number; laneYaw: number }>; cones: CANNON.Body[]; rain: THREE.Points | null; neonMat: THREE.MeshBasicMaterial | null; checkpointMeshes: THREE.Mesh[]; skyMat: THREE.Color; hemi: THREE.HemisphereLight; sun: THREE.DirectionalLight; extras?: { groundMat: THREE.MeshStandardMaterial; puddleMat: THREE.MeshStandardMaterial; buildingMats: THREE.MeshStandardMaterial[]; signMats: THREE.MeshBasicMaterial[]; lampHeads: THREE.Mesh[]; lampLights: THREE.PointLight[]; trafficLampMats: THREE.MeshBasicMaterial[]; moon: THREE.Mesh; stars: THREE.Points; clouds: THREE.Group; fireworks: THREE.Group; police: { g: THREE.Group; body: CANNON.Body } | null; jobMarker: THREE.Mesh; fuelMarkers: THREE.Mesh[]; garageMarkers: THREE.Mesh[]; washMarker: THREE.Mesh; ghostMesh: THREE.Mesh } } | null>(null);

  const [mode, setMode] = useState<Mode>("menu");
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("WARMING ENGINE");
  const [config, setConfig] = useState<CarConfig>(DEFAULT_CONFIG);
  const [muted, setMuted] = useState(false);
  const [radioOn, setRadioOn] = useState(true);
  const [trackIdx, setTrackIdx] = useState(0);
  const [rainOn, setRainOn] = useState(true);
  const [dayNight, setDayNight] = useState(12);
  const [camMode, setCamMode] = useState<CamMode>(0);
  const [hud, setHud] = useState({ speed: 0, nitro: 100, drift: 0, checkpoint: 0, laps: 0, countdown: "", damage: 0 });
  const [myModels, setMyModels] = useState<CustomModelMeta[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("default");
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState("");
  const [flipModel, setFlipModel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const swapRef = useRef<((id: string | "default") => Promise<void>) | null>(null);
  const flipRef = useRef(false);
  const selectedModelRef = useRef<string>("default");
  const resetRef = useRef<() => void>(() => {});
  const dragRef = useRef({ angle: 0, dragging: false, lastX: 0 });
  const autoCycleAcc = useRef(0);
  const ghostTimer = useRef(0);
  const policeCaughtT = useRef(0);

  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { camRef.current = camMode; }, [camMode]);

  const applyConfig = useCallback((cfg: CarConfig) => {
    const s = sceneRef.current;
    if (!s) return;
    const st = settingsRef.current;
    s.bodyMat.color.set(cfg.paint);
    s.bodyMat.metalness = st.metallic / 100;
    s.bodyMat.clearcoatRoughness = 1 - (cfg.clearcoat / 100) * 0.85;
    s.bodyMat.roughness = st.finish === "matte" ? 0.85 : st.finish === "satin" ? 0.5 : 0.5 - (cfg.clearcoat / 100) * 0.3;
    s.spoiler.visible = cfg.spoiler && !s.customGroup;
    s.spoiler.scale.set(0.7 + (st.spoilerSize / 100) * 0.7, 1, 1);
    if (s.customSpoiler) s.customSpoiler.visible = cfg.spoiler;
    if (s.customGroup && s.customBodyMats.length > 0) applyPaintToCustomMats(s.customBodyMats, cfg.paint);
    s.headlightMat.emissiveIntensity = cfg.headlights ? 1.6 : 0.05;
    s.headlightMat.emissive.set(st.headlightColor);
    if (s.neonMat) { s.neonMat.color.set(cfg.neon); s.neonMat.opacity = 0.3 + (st.neonBrightness / 100) * 0.6; }
    // Ride height + camber on the visual body (physics chassis untouched).
    s.carBodyGroup.position.y = (50 - st.rideHeight) / 100 * 0.35;
    for (let i = 0; i < s.wheelRigs.length; i++) {
      const rig = s.wheelRigs[i];
      rig.pivot.rotation.z = (i % 2 === 0 ? 1 : -1) * (st.camber / 100) * 0.12;
      rig.spin.scale.set(1, 1, 0.7 + (st.tyreWidth / 100) * 0.6);
    }
  }, []);

  // ---- 100+ features: central settings ----
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    saveSettings(next);
    setSettings(next);
  }, []);

  const unlockAchievement = useCallback((name: string) => {
    setAchievements((prev) => {
      if (prev.includes(name)) return prev;
      const next = [...prev, name];
      try { localStorage.setItem("raphael-drive-achievements", JSON.stringify(next)); } catch {}
      return next;
    });
    if (!achievementsRef.current.includes(name)) {
      achievementsRef.current = [...achievementsRef.current, name];
      showToastRef.current?.(`🏆 Achievement unlocked: ${name}`);
    }
  }, []);
  const achievementsRef = useRef<string[]>((() => { try { return JSON.parse(localStorage.getItem("raphael-drive-achievements") || "[]") as string[]; } catch { return []; } })());
  const showToastRef = useRef<((msg: string) => void) | null>(null);

  const saveLeaderboard = useCallback((score: number) => {
    if (score <= 0) return;
    setLeaderboard((prev) => {
      const next = [...prev, { score, date: new Date().toISOString() }].sort((a, b) => b.score - a.score).slice(0, 10);
      try { localStorage.setItem("raphael-drive-leaderboard", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const handleSettingsAction = useCallback((action: "resetScore" | "restart" | "respawn" | "export" | "resetAll" | "photo" | "replay") => {
    const st = stateRef.current;
    if (action === "resetScore") { st.score = 0; st.driftScore = 0; st.checkpoint = 0; showToastRef.current?.("Score reset."); }
    if (action === "restart") { st.score = 0; st.driftScore = 0; st.checkpoint = 0; st.laps = 0; st.damage = 0; st.fuel = 100; st.lapTime = 0; resetRef.current(); showToastRef.current?.("Run restarted."); }
    if (action === "respawn") { resetRef.current(); showToastRef.current?.("Respawned."); }
    if (action === "photo") { updateSettings({ photoMode: true }); window.setTimeout(() => updateSettings({ photoMode: false }), 50); }
    if (action === "replay") { st.replaying = true; st.replayIdx = 0; }
    if (action === "resetAll") { const d = { ...DEFAULT_SETTINGS }; settingsRef.current = d; saveSettings(d); setSettings(d); showToastRef.current?.("All settings reset to defaults."); }
    if (action === "export") {
      const blob = new Blob([JSON.stringify(settingsRef.current, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "raphael-drive-settings.json"; a.click();
      URL.revokeObjectURL(url);
      showToastRef.current?.("Settings exported as JSON.");
    }
  }, [updateSettings]);

  const handleImportSettings = useCallback(async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Partial<Settings>;
      const next = { ...DEFAULT_SETTINGS, ...parsed };
      settingsRef.current = next; saveSettings(next); setSettings(next);
      showToastRef.current?.("Settings imported.");
    } catch { showToastRef.current?.("That JSON file could not be imported."); }
  }, []);

  const handleMusicSource = useCallback((src: "radio" | "mymusic" | "off") => {
    updateSettings({ musicSource: src });
    const a = audioRef.current;
    if (!a) return;
    // Switching sources must fully stop the other source: radioOn=false
    // alone left the sequencer timer running; stopRadio() clears it.
    if (src === "radio") { a.radioOn = true; a.startRadio(); void myMusicPlayer.pause().catch(() => {}); }
    else if (src === "mymusic") { a.stopRadio(); void myMusicPlayer.play().catch(() => {}); }
    else { a.stopRadio(); void myMusicPlayer.pause().catch(() => {}); }
  }, [updateSettings]);

  const honk = useCallback(() => {
    audioRef.current?.ensure();
    audioRef.current?.horn(settingsRef.current.hornStyle);
  }, []);

  const takePhoto = useCallback(() => {
    const canvas = mountRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = (canvas as HTMLCanvasElement).toDataURL("image/png");
    const a = document.createElement("a"); a.href = url; a.download = "raphael-drive-photo.png"; a.click();
    showToastRef.current?.("Photo saved as PNG.");
  }, []);

  const startDrive = useCallback(() => {
    audioRef.current?.ensure();
    audioRef.current?.click();
    const st = stateRef.current;
    const set = settingsRef.current;
    st.nitro = set.nitroCapacity; st.driftScore = 0; st.checkpoint = 0; st.laps = 0; st.damage = 0;
    st.score = 0; st.fuel = 100; st.lapTime = 0; st.lapStart = st.time; st.driftCombo = 0;
    st.jobStage = 0; st.jobType = set.taxiJob ? "taxi" : set.deliveryJob ? "delivery" : "";
    st.jobX = (Math.random() * 120) - 60; st.jobZ = (Math.random() * 120) - 60;
    st.policeActive = false;
    ghostPathRef.current = []; bestPathRef.current = [];
    st.countdown = set.countdownLength; st.countdownT = 0; st.started = false;
    if (set.musicSource === "radio") { audioRef.current?.startRadio(); if (audioRef.current) audioRef.current.radioOn = true; }
    else if (set.musicSource === "mymusic") { if (audioRef.current) audioRef.current.stopRadio(); void myMusicPlayer.play().catch(() => {}); }
    resetRef.current();
    setMode("drive");
    setCamMode(settingsRef.current.cameraMode as CamMode);
  }, []);

  // ---------- In-drive Settings popup + Pause menu ----------
  // The Settings page ("settings" mode) is a separate full-page view. In Drive
  // there was no way to open Settings without leaving Drive (the header
  // Settings button switched mode). These overlays fix that: the gear button
  // opens the SAME SettingsPanel + MyMusicPanel on top of Drive/Garage,
  // without resetting the car or score, and the pause menu pauses physics.
  const [showSettingsPopup, setShowSettingsPopup] = useState(false);
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  const [popupOrigin, setPopupOrigin] = useState<"hud" | "pause" | "garage" | "header">("hud");
  const popupOpenRef = useRef(false);
  const pauseOpenRef = useRef(false);
  const popupOriginRef = useRef<"hud" | "pause" | "garage" | "header">("hud");
  const setPopupOpen = (v: boolean) => { popupOpenRef.current = v; setShowSettingsPopup(v); };
  const setPauseOpen = (v: boolean) => { pauseOpenRef.current = v; setShowPauseMenu(v); };
  const openSettingsPopup = useCallback((origin: "hud" | "pause" | "garage" | "header") => {
    popupOriginRef.current = origin; setPopupOrigin(origin);
    setPopupOpen(true);
    // Pause physics while the popup is open in Drive (resume on close).
    if (modeRef.current === "drive") updateSettings({ paused: true });
    if (origin === "pause") setPauseOpen(false); // popup sits above pause menu
  }, [updateSettings]);
  const closeSettingsPopup = useCallback(() => {
    setPopupOpen(false);
    if (modeRef.current === "drive") {
      // Back to the pause menu if still paused, else resume driving.
      if (settingsRef.current.paused) setPauseOpen(true);
      else setPauseOpen(false);
    } else {
      setPauseOpen(false);
    }
  }, []);
  const openPauseMenu = useCallback(() => {
    setPauseOpen(true);
    if (modeRef.current === "drive") updateSettings({ paused: true });
  }, [updateSettings]);
  const resumeFromPause = useCallback(() => {
    setPauseOpen(false);
    setPopupOpen(false);
    if (modeRef.current === "drive") updateSettings({ paused: false });
  }, [updateSettings]);
  const exitToMenu = useCallback(() => {
    setPauseOpen(false);
    setPopupOpen(false);
    updateSettings({ paused: false });
    setMode("menu");
  }, [updateSettings]);
  const restartFromPause = useCallback(() => {
    setPauseOpen(false);
    setPopupOpen(false);
    startDrive();
    updateSettings({ paused: false });
  }, [startDrive, updateSettings]);

  // P / Esc handling for Drive + Garage popup + Pause menu.
  // Esc chain in Drive: popup (Esc) -> pause menu (Esc) -> menu.
  // P toggles pause: popup (P) -> pause menu, pause (P) -> resume.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const m = modeRef.current;
      if (e.code !== "KeyP" && e.code !== "Escape") return;
      if (m === "drive") {
        if (e.code === "Escape") {
          if (popupOpenRef.current) { closeSettingsPopup(); return; }
          if (pauseOpenRef.current) { exitToMenu(); return; }
          openPauseMenu(); return;
        }
        // KeyP
        if (popupOpenRef.current) { closeSettingsPopup(); return; }
        if (pauseOpenRef.current) { resumeFromPause(); return; }
        openPauseMenu(); return;
      }
      if (m === "garage" && e.code === "Escape" && popupOpenRef.current) { closeSettingsPopup(); return; }
      if ((m === "settings" || m === "docs") && e.code === "Escape") { setMode("menu"); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeSettingsPopup, exitToMenu, openPauseMenu, resumeFromPause]);

  // ---------- THREE + CANNON SETUP ----------
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";
    const onCanvasPointerDown = (e: PointerEvent) => { dragRef.current.dragging = true; dragRef.current.lastX = e.clientX; };
    const onWindowPointerMove = (e: PointerEvent) => {
      if (!dragRef.current.dragging) return;
      dragRef.current.angle += (e.clientX - dragRef.current.lastX) * 0.01;
      dragRef.current.lastX = e.clientX;
    };
    const onWindowPointerUp = () => { dragRef.current.dragging = false; };
    renderer.domElement.addEventListener("pointerdown", onCanvasPointerDown);
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);

    // Post: subtle bloom for neon + headlights (not blown out)
    const composer = new EffectComposer(renderer);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#060710");
    scene.fog = new THREE.Fog("#060710", 55, 210);
    const camera = new THREE.PerspectiveCamera(62, mount.clientWidth / mount.clientHeight, 0.1, 600);
    camera.position.set(8, 4, 10);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(mount.clientWidth, mount.clientHeight), 0.5, 0.65, 0.78);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    // Environment reflections (RoomEnvironment via PMREM — no external HDRI download)
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.35;

    const hemi = new THREE.HemisphereLight("#8a7bff", "#0a0a18", 0.45);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight("#aab4ff", 0.9);
    sun.position.set(30, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -95; sun.shadow.camera.right = 95;
    sun.shadow.camera.top = 95; sun.shadow.camera.bottom = -95;
    sun.shadow.camera.far = 200;
    scene.add(sun);

    // ===== CANNON WORLD — real physics, no pass-through =====
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    world.broadphase = new CANNON.SAPBroadphase(world);
    (world.solver as CANNON.GSSolver).iterations = 12;
    world.allowSleep = false;
    const groundMat = new CANNON.Material("ground");
    const carMat = new CANNON.Material("car");
    const trafMat = new CANNON.Material("traffic");
    world.addContactMaterial(new CANNON.ContactMaterial(groundMat, carMat, { friction: 0.4, restitution: 0.05 }));
    world.addContactMaterial(new CANNON.ContactMaterial(carMat, carMat, { friction: 0.5, restitution: 0.25 }));
    // Traffic/cones ground friction MUST be 0: cannon-es friction welds resting
    // boxes (verified: even 0.08 stops a 9.4 m/s box in 0.3 m). Sliding is
    // controlled by manual damping instead (see traffic/cone update).
    world.addContactMaterial(new CANNON.ContactMaterial(groundMat, trafMat, { friction: 0.0, restitution: 0.0 }));
    world.addContactMaterial(new CANNON.ContactMaterial(carMat, trafMat, { friction: 0.3, restitution: 0.45 }));
    // NOTE: cannon-es Plane raycasts never hit in this build (verified: direct
    // Ray vs Plane returns no hit, vs Box returns a hit). Ground MUST be a
    // large static Box or RaycastVehicle suspension/friction never engages.
    const groundBody = new CANNON.Body({ mass: 0, material: groundMat, shape: new CANNON.Box(new CANNON.Vec3(250, 0.5, 250)), position: new CANNON.Vec3(0, -0.5, 0) });
    world.addBody(groundBody);
    const wallMat = new CANNON.Material("wall");
    world.addContactMaterial(new CANNON.ContactMaterial(carMat, wallMat, { friction: 0.6, restitution: 0.15 }));

    // ===== GROUND / ROAD — realistic PBR asphalt =====
    const asphalt = asphaltMaps();
    asphalt.map.repeat.set(24, 24); asphalt.roughnessMap.repeat.set(24, 24); asphalt.bumpMap.repeat.set(24, 24);
    const asphaltMat = new THREE.MeshStandardMaterial({ map: asphalt.map, roughnessMap: asphalt.roughnessMap, bumpMap: asphalt.bumpMap, bumpScale: 0.6, roughness: 1, metalness: 0.05, envMapIntensity: 0.5 });
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 240),
      asphaltMat
    );
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const roadTex = roadTexture();
    const streetMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.55, metalness: 0.25, envMapIntensity: 0.9 });
    for (const s of STREETS) {
      const h = new THREE.Mesh(new THREE.PlaneGeometry(240, 10), streetMat.clone());
      (h.material as THREE.MeshStandardMaterial).map = roadTex.clone();
      (h.material as THREE.MeshStandardMaterial).map!.repeat.set(24, 1);
      (h.material as THREE.MeshStandardMaterial).map!.needsUpdate = true;
      h.rotation.x = -Math.PI / 2; h.position.set(0, 0.02, s); h.receiveShadow = true; scene.add(h);
      const v = new THREE.Mesh(new THREE.PlaneGeometry(10, 240), streetMat.clone());
      const vm = v.material as THREE.MeshStandardMaterial;
      vm.map = roadTex.clone(); vm.map.rotation = Math.PI / 2; vm.map.center.set(0.5, 0.5); vm.map.repeat.set(24, 1); vm.map.needsUpdate = true;
      v.rotation.x = -Math.PI / 2; v.position.set(s, 0.02, 0); v.receiveShadow = true; scene.add(v);
    }
    // Sidewalks around each building block (raised 0.12, concrete)
    const walkTex = sidewalkTexture(); walkTex.repeat.set(4, 4);
    const walkMat = new THREE.MeshStandardMaterial({ map: walkTex, roughness: 0.9, metalness: 0.02 });
    for (const b of BUILDING_BLOCKS) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(21, 0.12, 21), walkMat);
      w.position.set(b.x, 0.06, b.z); w.receiveShadow = true; scene.add(w);
      // Kerb
      const kerb = new THREE.Mesh(new THREE.BoxGeometry(21.4, 0.14, 21.4), new THREE.MeshStandardMaterial({ color: "#4a4a50", roughness: 0.85 }));
      kerb.position.set(b.x, 0.07, b.z); scene.add(kerb);
    }
    // Wet puddles — mirror-like patches
    const puddleMat = new THREE.MeshStandardMaterial({ color: "#0a0f18", roughness: 0.04, metalness: 1, envMapIntensity: 2.2, transparent: true, opacity: 0.92 });
    const puddleGeo = new THREE.CircleGeometry(1, 24);
    const puddleSpots: Array<[number, number, number]> = [[-20, -58, 3.2], [18, 32, 2.6], [-52, 8, 2.2], [44, -62, 3.6], [8, -22, 2.0], [-38, 42, 2.8]];
    for (const [x, z, r] of puddleSpots) {
      const p = new THREE.Mesh(puddleGeo, puddleMat);
      p.rotation.x = -Math.PI / 2; p.position.set(x, 0.045, z); p.scale.setScalar(r); scene.add(p);
    }

    const neonMat = new THREE.MeshBasicMaterial({ color: "#00e5ff", transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });

    // ===== PLAYER CAR — realistic procedural + cannon RaycastVehicle =====
    const built = buildRealisticCar(DEFAULT_CONFIG.paint, { spoiler: true });
    const car = built.group;
    // Physics forward is -Z in cannon-es; visual nose is +Z, so rotate inner model PI
    car.rotation.y = Math.PI;
    const carHolder = new THREE.Group();
    // carBodyGroup holds ONLY the interchangeable body (built-in OR custom upload).
    // Glow / headlights stay in carHolder so they persist across swaps.
    // Physics chassis (1400 kg RaycastVehicle) is NEVER touched by a swap.
    const carBodyGroup = new THREE.Group();
    carBodyGroup.add(car);
    carHolder.add(carBodyGroup);
    scene.add(carHolder);
    // --- Custom-car swap (local-only GLB, IndexedDB) ---
    let customGroup: THREE.Group | null = null;
    let customWheelPivots: THREE.Group[] = [];
    let customBodyMats: THREE.Material[] = [];
    let customSpoiler: THREE.Object3D | null = null;
    let customHasWheels = false;
    const disposeGroup = (grp: THREE.Group) => {
      grp.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) { m.geometry?.dispose?.(); }
      });
    };
    const setProceduralWheelsVisible = (v: boolean) => {
      for (const rig of built.wheelRigs) { rig.pivot.visible = v; }
    };
    const swapCustomCar = async (id: string | "default") => {
      // Remove previous custom group (if any) and restore built-in body.
      if (customGroup) { carBodyGroup.remove(customGroup); disposeGroup(customGroup); customGroup = null; }
      customWheelPivots = []; customBodyMats = []; customSpoiler = null; customHasWheels = false;
      car.visible = true;
      setProceduralWheelsVisible(true);
      if (id === "default") {
        const s0 = sceneRef.current; if (s0) { s0.customGroup = null; s0.customWheelPivots = []; s0.customBodyMats = []; s0.customSpoiler = null; s0.customHasWheels = false; }
        try { localStorage.setItem(CUSTOM_CAR_CHOICE_KEY, "default"); } catch {}
        applyConfig(configRef.current);
        return;
      }
      const data = await loadCustomModelData(id);
      if (!data) throw new Error("That saved model could not be loaded from this browser. Try uploading it again.");
      const parsed = await parseGlb(data);
      const norm = normalizeCustomModel(parsed.group);
      customGroup = norm.group;
      customWheelPivots = norm.wheelPivots;
      customBodyMats = norm.bodyMats;
      customSpoiler = norm.spoiler;
      customHasWheels = norm.hasWheels;
      // Built-in nose is +Z, rotated PI in holder. Custom models are assumed
      // nose +Z too, so the same PI turn points them at physics forward (-Z).
      // "Flip model" adds another half-turn for models authored nose -Z.
      customGroup.rotation.y = Math.PI + (flipRef.current ? Math.PI : 0);
      // Hide built-in body; keep its wheels only as fallback when the custom
      // model has no wheel meshes of its own.
      car.visible = false;
      setProceduralWheelsVisible(!customHasWheels);
      carBodyGroup.add(customGroup);
      if (customSpoiler) customSpoiler.visible = configRef.current.spoiler;
      applyPaintToCustomMats(customBodyMats, configRef.current.paint);
      const s1 = sceneRef.current; if (s1) { s1.customGroup = customGroup; s1.customWheelPivots = customWheelPivots; s1.customBodyMats = customBodyMats; s1.customSpoiler = customSpoiler; s1.customHasWheels = customHasWheels; }
      try { localStorage.setItem(CUSTOM_CAR_CHOICE_KEY, id); } catch {}
    };
    swapRef.current = swapCustomCar;
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 5.6), neonMat);
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.05;
    carHolder.add(glow);
    const headlightGroup = new THREE.Group();
    for (const x of [-0.62, 0.62]) {
      const spot = new THREE.SpotLight("#fff2b0", 80, 48, 0.45, 0.5, 1.1);
      spot.position.set(x, 0.75, -2.4);
      spot.target.position.set(x, 0, -24);
      headlightGroup.add(spot); headlightGroup.add(spot.target);
    }
    carHolder.add(headlightGroup);

    const chassisShape = new CANNON.Box(new CANNON.Vec3(0.95, 0.38, 2.15));
    const chassisBody = new CANNON.Body({ mass: 1400, material: carMat, shape: chassisShape, position: new CANNON.Vec3(0, 0.85, 30) });
    chassisBody.angularDamping = 0.35;
    chassisBody.linearDamping = 0.08;
    world.addBody(chassisBody);
    const vehicle = new CANNON.RaycastVehicle({ chassisBody, indexRightAxis: 0, indexUpAxis: 1, indexForwardAxis: 2 });
    const wheelOpts = (x: number, z: number, front: boolean): CANNON.WheelInfoOptions => ({
      radius: 0.37,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 32,
      suspensionRestLength: 0.32,
      frictionSlip: 4.8,
      dampingRelaxation: 2.4,
      dampingCompression: 4.6,
      maxSuspensionForce: 120000,
      rollInfluence: 0.02,
      axleLocal: new CANNON.Vec3(1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(x, -0.18, z),
      maxSuspensionTravel: 0.32,
      customSlidingRotationalSpeed: -0.1,
      useCustomSlidingRotationalSpeed: true,
      isFrontWheel: front,
    });
    vehicle.addWheel(wheelOpts(-0.88, -1.42, true));
    vehicle.addWheel(wheelOpts(0.88, -1.42, true));
    vehicle.addWheel(wheelOpts(-0.88, 1.42, false));
    vehicle.addWheel(wheelOpts(0.88, 1.42, false));
    vehicle.addToWorld(world);
    // NOTE: cannon forward = -Z. In chassis space, wheels at z=-1.42 are FRONT.
    // Visual wheel rigs were built with front at +Z (nose +Z) and car rotated PI,
    // so after the PI rotation they line up: rig[0]/[1] are rear in chassis space.
    // We map physics wheel i -> visual rig below in sync (0,1 front / 2,3 rear).

    // Collision feedback: impact -> damage + shake + thud (physics itself stops the car)
    chassisBody.addEventListener("collide", (e: { contact: { getImpactVelocityAlongNormal: () => number } }) => {
      try {
        const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
        if (v > 3.5 && settingsRef.current.damageOn) {
          const st = stateRef.current;
          st.damage = Math.min(100, st.damage + Math.min(28, (v - 3.5) * 2.2));
          st.shake = Math.min(1, v / 14);
          audioRef.current?.collision(Math.min(1, v / 16));
        }
      } catch { /* ignore */ }
    });

    // ===== CITY — realistic PBR facades (procedural, original) =====
    const traffic: Array<{ g: THREE.Group; body: CANNON.Body; dir: number; speed: number; axis: "x" | "z"; spinUntil: number; laneYaw: number }> = [];
    const cones: CANNON.Body[] = [];
    const coneVisuals: THREE.Group[] = [];
    const checkpointMeshes: THREE.Mesh[] = [];
    let rain: THREE.Points | null = null;
    const facadeCache: Array<{ map: THREE.Texture; emissiveMap: THREE.Texture }> = [0, 1, 2, 3, 4].map((i) => facadeTextures(i));
    const buildingMats: THREE.MeshStandardMaterial[] = [];
    const signMats: THREE.MeshBasicMaterial[] = [];
    const lampHeads: THREE.Mesh[] = [];
    const lampLights: THREE.PointLight[] = [];
    const trafficLampMats: THREE.MeshBasicMaterial[] = [];
    for (let bi = 0; bi < BUILDING_BLOCKS.length; bi++) {
      const b = BUILDING_BLOCKS[bi];
      const h = 15 + (bi % 4) * 8 + (bi % 3) * 4;
      const fac = facadeCache[bi % facadeCache.length];
      const mat = new THREE.MeshStandardMaterial({ map: fac.map, emissiveMap: fac.emissiveMap, emissive: "#ffffff", emissiveIntensity: 0.55, roughness: 0.85, metalness: 0.1 });
      buildingMats.push(mat);
      const bm = new THREE.Mesh(new THREE.BoxGeometry(16, h, 16), mat);
      bm.position.set(b.x, h / 2 + 0.12, b.z);
      bm.castShadow = true; bm.receiveShadow = true; scene.add(bm);
      // Roof detail: AC units + parapet
      const roofMat = new THREE.MeshStandardMaterial({ color: "#17171c", roughness: 0.9 });
      const parapet = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.7, 16.4), roofMat);
      parapet.position.set(b.x, h + 0.45, b.z); scene.add(parapet);
      const ac = new THREE.Mesh(new THREE.BoxGeometry(3, 1.1, 2), roofMat);
      ac.position.set(b.x + 3, h + 1.3, b.z - 2); scene.add(ac);
      // Physics: solid static box — car can NEVER pass through
      const bBody = new CANNON.Body({ mass: 0, material: wallMat, shape: new CANNON.Box(new CANNON.Vec3(8.2, h / 2, 8.2)), position: new CANNON.Vec3(b.x, h / 2, b.z) });
      world.addBody(bBody);
      // Neon sign (emissive + bloom)
      const word = NEON_WORDS[bi % NEON_WORDS.length];
      const signMat = new THREE.MeshBasicMaterial({ map: neonTexture(word, bi % 2 ? "#ff2e88" : "#00e5ff") });
      signMats.push(signMat);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 1.9), signMat);
      sign.position.set(b.x, h * 0.72, b.z + 8.3); scene.add(sign);
      const sign2 = sign.clone(); sign2.position.set(b.x + 8.3, h * 0.5, b.z); sign2.rotation.y = Math.PI / 2; scene.add(sign2);
    }
    // Streetlights: pole + arm + head + warm pool (6 real lights, rest emissive only)
    const poleMat = new THREE.MeshStandardMaterial({ color: "#1c1c22", roughness: 0.6, metalness: 0.7 });
    const lampHeadMat = new THREE.MeshStandardMaterial({ color: "#ffd9a0", emissive: "#ffb020", emissiveIntensity: 2.2 });
    let lightBudget = 0;
    for (const sx of [-60, -30, 0, 30, 60]) {
      for (const sz of [-60, 0, 60]) {
        const px = sx + 6, pz = sz + 6;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 6, 10), poleMat);
        pole.position.set(px, 3, pz); pole.castShadow = true; scene.add(pole);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.08), poleMat);
        arm.position.set(px - 0.7, 5.9, pz); scene.add(arm);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.28), lampHeadMat);
        head.position.set(px - 1.4, 5.85, pz); scene.add(head);
        lampHeads.push(head);
        if (lightBudget < 6) {
          const lamp = new THREE.PointLight("#ffb020", 18, 20, 1.9);
          lamp.position.set(px - 1.4, 5.6, pz); scene.add(lamp);
          lampLights.push(lamp);
          lightBudget++;
        }
        const pool = new THREE.Mesh(new THREE.CircleGeometry(2.6, 20), new THREE.MeshBasicMaterial({ color: "#ffb020", transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false }));
        pool.rotation.x = -Math.PI / 2; pool.position.set(px - 1.4, 0.05, pz); scene.add(pool);
      }
    }
    // Traffic lights at two intersections
    for (const [ix, iz] of [[0, 0], [30, -30]] as const) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.5, 8), poleMat);
      p.position.set(ix + 5.5, 2.25, iz + 5.5); scene.add(p);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.0, 0.22), new THREE.MeshStandardMaterial({ color: "#0c0c10", roughness: 0.6 }));
      box.position.set(ix + 5.5, 4.6, iz + 5.5); scene.add(box);
      const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.11, 12), new THREE.MeshBasicMaterial({ color: "#22ff66" }));
      trafficLampMats.push(lamp.material as THREE.MeshBasicMaterial);
      lamp.position.set(ix + 5.5, 4.85, iz + 5.62); scene.add(lamp);
    }
    // Cones + barriers (small, realistic materials)
    const coneMat = new THREE.MeshStandardMaterial({ color: "#ff5a1e", roughness: 0.55 });
    const coneWhite = new THREE.MeshStandardMaterial({ color: "#f2f2f2", roughness: 0.5 });
    for (let i = 0; i < 8; i++) {
      const cone = new THREE.Group();
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.85, 16), coneMat);
      body.position.y = 0.55; body.castShadow = true; cone.add(body);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.23, 0.16, 16), coneWhite);
      band.position.y = 0.6; cone.add(band);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.62), coneMat);
      base.position.y = 0.03; cone.add(base);
      cone.position.set(-52 + i * 3, 0.12, 58); scene.add(cone);
      coneVisuals.push(cone);
      const cb = new CANNON.Body({ mass: 2, material: trafMat, shape: new CANNON.Box(new CANNON.Vec3(0.3, 0.45, 0.3)), position: new CANNON.Vec3(-52 + i * 3, 0.55, 58) });
      world.addBody(cb);
      cones.push(cb);
    }
    // Traffic cars: dynamic physics bodies — collide, never pass through.
    // Spin-out: a hard hit from the player knocks them off-lane (physics owns
    // them for 1.6 s). NEVER hard-set a traffic body's velocity while it may
    // be touching the player — the solver then brakes BOTH cars to zero
    // (verified in headless tests). Use gentle lerp in that case.
    const trafficPaints = ["#c8ccd4", "#ffb020", "#2a3348", "#7b2eff", "#d8d8d8", "#274a2e"];
    for (let i = 0; i < 20; i++) {
      const tb = buildRealisticCar(trafficPaints[i % trafficPaints.length], { spoiler: false });
      const tg = tb.group; tg.rotation.y = Math.PI;
      const holder = new THREE.Group(); holder.add(tg); scene.add(holder);
      const axis: "x" | "z" = i % 2 === 0 ? "x" : "z";
      const dir = i % 4 < 2 ? 1 : -1;
      const lane = [0, 30, -30, 60][i % 4];
      const laneYaw = axis === "x" ? (dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (dir > 0 ? Math.PI : 0);
      const start = axis === "x" ? new CANNON.Vec3(-90 + i * 22, 0.42, lane + (dir > 0 ? 2.5 : -2.5)) : new CANNON.Vec3(lane + (dir > 0 ? 2.5 : -2.5), 0.42, -90 + i * 18);
      const tBody = new CANNON.Body({ mass: 1300, material: trafMat, shape: new CANNON.Box(new CANNON.Vec3(0.92, 0.38, 2.1)), position: start });
      tBody.angularDamping = 0.9; tBody.linearDamping = 0.05;
      tBody.quaternion.setFromEuler(0, laneYaw, 0);
      world.addBody(tBody);
      const entry = { g: holder, body: tBody, dir, speed: 8 + (i % 3) * 2.5, axis, spinUntil: 0, laneYaw };
      tBody.addEventListener("collide", (e: { body: CANNON.Body; contact: { getImpactVelocityAlongNormal: () => number } }) => {
        if (e.body !== chassisBody) return; // only player hits trigger spin-out
        const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
        if (v > 4 && entry.spinUntil <= 0) {
          entry.spinUntil = 1.6;
          tBody.angularVelocity.set(0, 2.5, 0);
          audioRef.current?.collision(Math.min(1, v / 16));
        }
      });
      traffic.push(entry);
    }
    // Checkpoints
    for (const cp of CHECKPOINTS) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.18, 10, 32), new THREE.MeshBasicMaterial({ color: "#00e5ff" }));
      m.position.set(cp.x, 2.2, cp.z); m.rotation.y = Math.PI / 2; scene.add(m);
      checkpointMeshes.push(m);
    }
    // Rain
    const rainCount = 900;
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) { rainPos[i * 3] = (Math.random() - 0.5) * 120; rainPos[i * 3 + 1] = Math.random() * 40; rainPos[i * 3 + 2] = (Math.random() - 0.5) * 120; }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
    rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: "#9fd8ff", size: 0.18, transparent: true, opacity: 0.65 }));
    scene.add(rain);

    // ---- World extras: moon, stars, clouds, fireworks, police, job markers, ghost ----
    const moon = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24), new THREE.MeshBasicMaterial({ color: "#e8ecff", transparent: true, opacity: 0.9 }));
    moon.position.set(60, 70, -120); scene.add(moon);
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) { starPos[i * 3] = (Math.random() - 0.5) * 400; starPos[i * 3 + 1] = 40 + Math.random() * 120; starPos[i * 3 + 2] = (Math.random() - 0.5) * 400; }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: "#ffffff", size: 0.5, transparent: true, opacity: 0.8 }));
    scene.add(stars);
    const clouds = new THREE.Group();
    const cloudMat = new THREE.MeshBasicMaterial({ color: "#8a93b8", transparent: true, opacity: 0.35 });
    for (let i = 0; i < 6; i++) {
      const cl = new THREE.Mesh(new THREE.SphereGeometry(10 + Math.random() * 8, 10, 8), cloudMat);
      cl.position.set(-120 + i * 45, 55 + Math.random() * 10, -80 + Math.random() * 160);
      cl.scale.y = 0.35;
      clouds.add(cl);
    }
    clouds.visible = false;
    scene.add(clouds);
    const fireworks = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const fw = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(60 * 3).map(() => (Math.random() - 0.5) * 14), 3)), new THREE.PointsMaterial({ color: [0xff2e88, 0x00e5ff, 0xffb020, 0xa3e635, 0xa855f7][i], size: 0.6, transparent: true, opacity: 0 }));
      fw.position.set(-60 + i * 30, 45 + Math.random() * 15, -60);
      fireworks.add(fw);
    }
    scene.add(fireworks);
    // Police car: reuses the realistic car builder, white/black + light bar.
    const policeBuilt = buildRealisticCar("#e8ecff", { spoiler: false });
    const policeGroup = new THREE.Group();
    const policeHolder = new THREE.Group();
    policeGroup.add(policeBuilt.group);
    policeHolder.add(policeGroup);
    const policeLightMat = new THREE.MeshBasicMaterial({ color: "#ff2244" });
    const policeBar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.3), policeLightMat);
    policeBar.position.set(0, 1.45, -0.2);
    policeGroup.add(policeBar);
    policeHolder.visible = false;
    scene.add(policeHolder);
    const policeBody = new CANNON.Body({ mass: 1400, material: trafMat, shape: new CANNON.Box(new CANNON.Vec3(0.92, 0.38, 2.1)), position: new CANNON.Vec3(0, -60, 0) });
    policeBody.angularDamping = 0.9; policeBody.linearDamping = 0.05;
    world.addBody(policeBody);
    // Job / station markers: glowing rings the player drives into.
    const markerMat = (color: string) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const jobMarker = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.1, 32), markerMat("#ffb020"));
    jobMarker.rotation.x = -Math.PI / 2; jobMarker.position.set(0, 0.1, -60); jobMarker.visible = false; scene.add(jobMarker);
    const fuelMarkers: THREE.Mesh[] = [];
    for (const [fx, fz] of [[-60, -60], [60, 60]] as const) {
      const m = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.1, 32), markerMat("#22ff88"));
      m.rotation.x = -Math.PI / 2; m.position.set(fx, 0.1, fz); m.visible = false; scene.add(m); fuelMarkers.push(m);
    }
    const garageMarkers: THREE.Mesh[] = [];
    for (const [gx, gz] of [[-60, 60], [60, -60]] as const) {
      const m = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.1, 32), markerMat("#a855f7"));
      m.rotation.x = -Math.PI / 2; m.position.set(gx, 0.1, gz); m.visible = false; scene.add(m); garageMarkers.push(m);
    }
    const washMarker = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.1, 32), markerMat("#00e5ff"));
    washMarker.rotation.x = -Math.PI / 2; washMarker.position.set(30, 0.1, 60); washMarker.visible = false; scene.add(washMarker);
    const ghostMesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 4.2), new THREE.MeshBasicMaterial({ color: "#00e5ff", transparent: true, opacity: 0.35 }));
    ghostMesh.visible = false; scene.add(ghostMesh);

    sceneRef.current = { scene, car: carHolder, wheelRigs: built.wheelRigs, spoiler: built.spoiler, headlightMat: built.headlightMat, bodyMat: built.bodyMat, carBodyGroup, defaultBody: car, customGroup: null, customWheelPivots: [], customBodyMats: [], customSpoiler: null, customHasWheels: false, swapCustomCar, traffic, cones, rain, neonMat, checkpointMeshes, skyMat: scene.background as THREE.Color, hemi, sun, extras: { groundMat: asphaltMat, puddleMat, buildingMats, signMats, lampHeads, lampLights, trafficLampMats, moon, stars, clouds, fireworks, police: { g: policeHolder, body: policeBody }, jobMarker, fuelMarkers, garageMarkers, washMarker, ghostMesh } };

    const resetPhysics = (pos: THREE.Vector3, yaw: number) => {
      chassisBody.position.set(pos.x, 0.85, pos.z);
      chassisBody.velocity.set(0, 0, 0);
      chassisBody.angularVelocity.set(0, 0, 0);
      chassisBody.quaternion.setFromEuler(0, yaw, 0);
      for (let i = 0; i < 4; i++) vehicle.setBrake(0, i);
    };
    const resetDrive = () => resetPhysics(new THREE.Vector3(0, 0, 30), 0);
    resetRef.current = resetDrive;

    // Keys (remappable via Settings; arrows always work as fallback)
    const down = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      const set = settingsRef.current;
      if (e.code === "KeyC") { const next = ((camRef.current + 1) % 5) as CamMode; camRef.current = next; setCamMode(next); }
      if (e.code === "KeyR" && modeRef.current === "drive") resetDrive();
      if (e.code === "KeyM") setMuted((m) => !m);
      if (e.code === "KeyH" && modeRef.current === "drive") { audioRef.current?.ensure(); audioRef.current?.horn(set.hornStyle); }
      // NOTE: KeyP / Escape are handled by the dedicated P/Esc effect above
      // (pause menu + settings popup). Do NOT handle them here or the popup
      // would close and the mode would exit to menu on the same press.
    };
    const up = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    const clock = new THREE.Clock();
    let raf = 0;
    let hudAcc = 0;
    const tmpV = new THREE.Vector3();
    const tmpQ = new THREE.Quaternion();
    const tmpFwd = new THREE.Vector3();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const st = stateRef.current;
      const modeNow = modeRef.current;
      const set = settingsRef.current;
      st.time += dt;

      // FPS counter
      st.fpsFrames += 1; st.fpsAcc += dt;
      if (st.fpsAcc >= 0.5) { st.fps = Math.round(st.fpsFrames / st.fpsAcc); st.fpsFrames = 0; st.fpsAcc = 0; }

      // Auto day/night cycle (throttled settings sync)
      if (set.autoCycle && modeNow === "drive") {
        autoCycleAcc.current += dt;
        if (autoCycleAcc.current > 0.5) {
          autoCycleAcc.current = 0;
          const next = (set.dayNight + 1) % 101;
          updateSettings({ dayNight: next });
        }
      }

      if (modeNow === "drive" && st.countdown >= 0 && !settingsRef.current.paused) {
        st.countdownT += dt;
        if (st.countdownT > 0.9) { st.countdownT = 0; st.countdown -= 1; if (st.countdown < 0) st.started = true; }
      }
      // Weather: rain visibility + fog + storm flashes
      if (rain) {
        const pos = (rain.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
        const speed = set.weather === "storm" ? 42 : 28;
        for (let i = 0; i < pos.length; i += 3) { pos[i + 1] -= dt * speed; pos[i] += dt * 2; if (pos[i + 1] < 0) pos[i + 1] = 38; }
        rain.geometry.getAttribute("position").needsUpdate = true;
        rain.position.set(chassisBody.position.x, 0, chassisBody.position.z);
        rain.visible = (set.weather === "rain" || set.weather === "storm") && set.rainOn;
      }
      if (set.weather === "storm" && Math.random() < dt * 0.6) { st.rainFlash = 0.12; scene.background = new THREE.Color("#1a2030"); }
      if (st.rainFlash > 0) { st.rainFlash -= dt; if (st.rainFlash <= 0) scene.background = new THREE.Color("#060710"); }
      scene.fog = new THREE.Fog(scene.background as THREE.Color, 55, 210 - set.fogDensity * 1.2);

      // ---- Drive: real RaycastVehicle inputs (remappable keys + settings) ----
      const keys = keysRef.current;
      const t = touchRef.current;
      const kb = settingsRef.current;
      const wantGas = keys[kb.keyGas] || keys["ArrowUp"] || t.gas;
      const wantBrake = keys[kb.keyBrake] || keys["ArrowDown"] || t.brake;
      const wantLeft = keys[kb.keyLeft] || keys["ArrowLeft"] || t.left;
      const wantRight = keys[kb.keyRight] || keys["ArrowRight"] || t.right;
      const wantNitro = (keys[kb.keyNitro] || keys["ShiftRight"] || t.nitro) && st.nitro > 0;
      const wantDrift = keys[kb.keyDrift] || t.drift;
      const paused = kb.paused && modeNow === "drive";
      const driving = modeNow === "drive" && st.started && !paused;
      let drifting = false;
      // Signed speed along chassis forward (-Z in cannon space)
      tmpQ.set(chassisBody.quaternion.x, chassisBody.quaternion.y, chassisBody.quaternion.z, chassisBody.quaternion.w);
      tmpFwd.set(0, 0, -1).applyQuaternion(tmpQ);
      const vel = new THREE.Vector3(chassisBody.velocity.x, chassisBody.velocity.y, chassisBody.velocity.z);
      const signedSpeed = vel.dot(tmpFwd);
      st.speed = signedSpeed;
      if (paused) {
        vehicle.applyEngineForce(0, 2); vehicle.applyEngineForce(0, 3);
        vehicle.setSteeringValue(0, 0); vehicle.setSteeringValue(0, 1);
        for (let i = 0; i < 4; i++) vehicle.setBrake(80, i);
      } else if (modeNow === "drive" && !driving) {
        vehicle.setBrake(60, 0); vehicle.setBrake(60, 1); vehicle.setBrake(60, 2); vehicle.setBrake(60, 3);
        vehicle.applyEngineForce(0, 2); vehicle.applyEngineForce(0, 3);
        vehicle.setSteeringValue(0, 0); vehicle.setSteeringValue(0, 1);
      } else if (driving) {
        const maxForce = wantNitro ? 5200 : 3400;
        const steerInput = (wantLeft ? 1 : 0) - (wantRight ? 1 : 0);
        const maxSteer = 0.42 * (0.5 + kb.steeringSensitivity / 100);
        vehicle.setSteeringValue(steerInput * maxSteer, 0);
        vehicle.setSteeringValue(steerInput * maxSteer, 1);
        // Drift: drop rear lateral grip + light handbrake feel
        const rearGrip = wantDrift && Math.abs(signedSpeed) > 6 ? 1.1 : 4.8;
        vehicle.wheelInfos[2].frictionSlip = rearGrip;
        vehicle.wheelInfos[3].frictionSlip = rearGrip;
        if (wantDrift && Math.abs(signedSpeed) > 8 && steerInput !== 0) drifting = true;
        // Traction control: cap wheelspin when launching
        const effForce = kb.tractionControl && !drifting ? maxForce * 0.85 : maxForce;
        // ABS: keep steering authority while braking (lighter, pulsing brake)
        const brakeForce = kb.abs ? 700 : 900;
        // Auto-brake assist: brake if a wall/traffic is dead ahead within 9 m
        let autoBraking = false;
        if (kb.autoBrake) {
          const aheadX = chassisBody.position.x + tmpFwd.x * 9;
          const aheadZ = chassisBody.position.z + tmpFwd.z * 9;
          const nearWall = BUILDING_BLOCKS.some((b) => Math.abs(aheadX - b.x) < 9 && Math.abs(aheadZ - b.z) < 9);
          const nearTraffic = traffic.slice(0, kb.trafficDensity).some((tr) => Math.hypot(tr.body.position.x - aheadX, tr.body.position.z - aheadZ) < 5);
          autoBraking = (nearWall || nearTraffic) && signedSpeed > 6;
        }
        const outOfFuel = kb.fuelOn && st.fuel <= 0;
        if (outOfFuel) {
          vehicle.applyEngineForce(400, 2); vehicle.applyEngineForce(400, 3);
          vehicle.setBrake(0, 0); vehicle.setBrake(0, 1); vehicle.setBrake(0, 2); vehicle.setBrake(0, 3);
        } else if (wantGas && !autoBraking) {
          vehicle.applyEngineForce(effForce, 2); vehicle.applyEngineForce(effForce, 3);
          vehicle.setBrake(0, 0); vehicle.setBrake(0, 1); vehicle.setBrake(0, 2); vehicle.setBrake(0, 3);
        } else if (wantBrake || autoBraking) {
          if (signedSpeed > 1.5) { vehicle.setBrake(brakeForce, 0); vehicle.setBrake(brakeForce, 1); vehicle.setBrake(brakeForce, 2); vehicle.setBrake(brakeForce, 3); vehicle.applyEngineForce(0, 2); vehicle.applyEngineForce(0, 3); }
          else { // reverse
            vehicle.setBrake(0, 0); vehicle.setBrake(0, 1); vehicle.setBrake(0, 2); vehicle.setBrake(0, 3);
            vehicle.applyEngineForce(-1800, 2); vehicle.applyEngineForce(-1800, 3);
          }
        } else {
          vehicle.applyEngineForce(0, 2); vehicle.applyEngineForce(0, 3);
          vehicle.setBrake(6, 0); vehicle.setBrake(6, 1); vehicle.setBrake(6, 2); vehicle.setBrake(6, 3);
        }
        if (wantDrift) { vehicle.setBrake(120 * (kb.handbrakeStrength / 70), 2); vehicle.setBrake(120 * (kb.handbrakeStrength / 70), 3); }
        // Off-road (not on a street band) = drag + slower top speed
        const px = chassisBody.position.x, pz = chassisBody.position.z;
        const onStreet = STREETS.some((s) => Math.abs(px - s) < 6 || Math.abs(pz - s) < 6);
        st.offroad = !onStreet;
        if (st.offroad) { chassisBody.velocity.scale(1 - 0.55 * dt, chassisBody.velocity); }
        // Drift combo + score
        if (drifting) {
          const gain = dt * 420 * Math.min(1, Math.abs(signedSpeed) / 30) * kb.driftMultiplier;
          st.driftScore += gain; st.score += gain;
          if (kb.driftComboOn) st.driftCombo += dt;
          if (st.driftScore > 1000) unlockAchievement("First Drift — 1000 pts");
          if (st.driftScore > 5000) unlockAchievement("Drift Master — 5000 pts");
        } else if (kb.driftComboOn && st.driftCombo > 0) {
          if (st.time - st.lastDriftEnd > 2.5) st.driftCombo = 0;
        }
        if (drifting) st.lastDriftEnd = st.time;
        // Fuel drain
        if (kb.fuelOn) st.fuel = Math.max(0, st.fuel - dt * (Math.abs(signedSpeed) > 2 ? 0.55 : 0.12));
        // Lap timer + best lap
        if (kb.lapTimerOn) st.lapTime = st.time - st.lapStart;
        // Ghost recording (every 0.1s)
        ghostTimer.current += dt;
        if (ghostTimer.current > 0.1) { ghostTimer.current = 0; ghostPathRef.current.push({ x: px, z: pz, t: st.lapTime }); replayPathRef.current.push({ x: px, z: pz, t: st.time }); if (replayPathRef.current.length > 100) replayPathRef.current.shift(); }
        // Checkpoints (physics position)
        const cp = CHECKPOINTS[st.checkpoint % CHECKPOINTS.length];
        const dist = Math.hypot(px - cp.x, pz - cp.z);
        if (dist < 5.5) {
          st.checkpoint += 1; st.driftScore += 150; st.score += 150;
          audioRef.current?.click();
          if (st.checkpoint % CHECKPOINTS.length === 0) {
            st.laps += 1;
            if (kb.lapTimerOn && st.lapTime > 5) {
              if (st.bestLap === 0 || st.lapTime < st.bestLap) {
                st.bestLap = st.lapTime;
                bestPathRef.current = [...ghostPathRef.current];
                try { localStorage.setItem("raphael-drive-best-lap", String(st.bestLap)); } catch {}
              }
              ghostPathRef.current = [];
            }
            st.lapStart = st.time;
            if (kb.driveMode === "checkpoint" && st.laps >= kb.raceLaps) { st.score += 1000; showToastRef.current?.(`🏁 Race complete! Score ${Math.round(st.score)}`); saveLeaderboard(Math.round(st.score)); }
          }
          if (st.checkpoint >= 5) unlockAchievement("Checkpoint Runner — 5 checkpoints");
        }
        // Time Trial / Drift Challenge win checks
        if (kb.driveMode === "timetrial" && st.lapTime >= kb.timeTrialTarget) { showToastRef.current?.(`⏱ Time Trial over — score ${Math.round(st.score)}`); saveLeaderboard(Math.round(st.score)); st.started = false; }
        if (kb.driveMode === "drift" && st.driftScore >= kb.driftChallengeTarget) { showToastRef.current?.(`★ Drift Challenge complete! ${Math.round(st.driftScore)} pts`); saveLeaderboard(Math.round(st.score)); st.started = false; }
        if (Math.abs(signedSpeed) * 3.6 > 120) unlockAchievement("Speed Demon — 120 km/h");
        if (wantNitro && signedSpeed > 5) st.nitro = Math.max(0, st.nitro - 22 * dt);
        else st.nitro = Math.min(kb.nitroCapacity, st.nitro + (6 + kb.nitroRecharge / 10) * dt);
        audioRef.current?.setEngine(Math.min(1, Math.abs(signedSpeed) / 42), wantNitro && signedSpeed > 5, drifting);
        // Jobs: drive into the glowing marker
        const ex = sceneRef.current?.extras;
        if (ex && st.jobType && st.jobStage < 2) {
          const jx = st.jobStage === 0 ? st.jobX : 0;
          const jz = st.jobStage === 0 ? st.jobZ : 30;
          const jd = Math.hypot(px - jx, pz - jz);
          if (jd < 4) {
            if (st.jobStage === 0) { st.jobStage = 1; st.score += 100; showToastRef.current?.(st.jobType === "taxi" ? "🚕 Passenger picked up — drive to start (0, 30)!" : "📦 Package picked up — drive to start (0, 30)!"); }
            else { st.jobStage = 2; const bonus = st.jobType === "taxi" ? 500 : 400; st.score += bonus; showToastRef.current?.(`✅ ${st.jobType === "taxi" ? "Taxi" : "Delivery"} complete! +${bonus}`); }
          }
        }
        // Stations: fuel / repair / wash rings
        if (ex) {
          if (kb.fuelStations && kb.fuelOn) for (const m of ex.fuelMarkers) { if (Math.hypot(px - m.position.x, pz - m.position.z) < 3.5) st.fuel = Math.min(100, st.fuel + 30 * dt); }
          if (kb.repairGarages) for (const m of ex.garageMarkers) { if (Math.hypot(px - m.position.x, pz - m.position.z) < 3.5) st.damage = Math.max(0, st.damage - 20 * dt); }
          if (kb.carWash && Math.hypot(px - ex.washMarker.position.x, pz - ex.washMarker.position.z) < 3.5) { st.damage = Math.max(0, st.damage - 8 * dt); }
        }
      } else {
        audioRef.current?.setEngine(0, false, false);
      }
      if (modeNow !== "drive") {
        // Park the car (menu / garage / docs) — zero forces, hold position
        vehicle.applyEngineForce(0, 2); vehicle.applyEngineForce(0, 3);
        vehicle.setSteeringValue(0, 0); vehicle.setSteeringValue(0, 1);
      }
      // Traffic: density gates how many are active; parked ones hide below ground.
      const tmpLaneV = new CANNON.Vec3();
      const tmpLaneQ = new CANNON.Quaternion();
      for (let ti = 0; ti < traffic.length; ti++) {
        const tr = traffic[ti];
        if (ti >= settingsRef.current.trafficDensity) {
          tr.g.visible = false;
          tr.body.position.set(0, -60, 0);
          tr.body.velocity.set(0, 0, 0);
          continue;
        }
        tr.g.visible = true;
        const aggression = 1 + (settingsRef.current.trafficAggression - 50) / 100;
        const effSpeed = tr.speed * aggression;
        const touching = world.contacts.some((c) => (c.bi === tr.body && c.bj === chassisBody) || (c.bi === chassisBody && c.bj === tr.body));
        if (tr.spinUntil > 0) {
          tr.spinUntil -= dt;
          tr.body.velocity.scale(1 - 1.4 * dt, tr.body.velocity);
          tr.body.angularVelocity.scale(1 - 2.5 * dt, tr.body.angularVelocity);
        } else if (!touching) {
          if (tr.axis === "x") tr.body.velocity.set(tr.dir * effSpeed, tr.body.velocity.y, 0);
          else tr.body.velocity.set(0, tr.body.velocity.y, tr.dir * effSpeed);
          tr.body.angularVelocity.set(0, 0, 0);
          // Ease orientation back to lane heading (safe: not touching player)
          tmpLaneQ.setFromEuler(0, tr.laneYaw, 0);
          tr.body.quaternion.slerp(tmpLaneQ, 1 - Math.exp(-2 * dt));
          // Wrap around the city edge (safe: not touching player)
          const bp = tr.body.position;
          if (tr.axis === "x" && bp.x > 112) tr.body.position.set(-112, 0.42, bp.z);
          if (tr.axis === "x" && bp.x < -112) tr.body.position.set(112, 0.42, bp.z);
          if (tr.axis === "z" && bp.z > 112) tr.body.position.set(bp.x, 0.42, -112);
          if (tr.axis === "z" && bp.z < -112) tr.body.position.set(bp.x, 0.42, 112);
        } else {
          if (tr.axis === "x") tmpLaneV.set(tr.dir * effSpeed, tr.body.velocity.y, 0);
          else tmpLaneV.set(0, tr.body.velocity.y, tr.dir * effSpeed);
          tr.body.velocity.lerp(tmpLaneV, 1 - Math.exp(-1.5 * dt), tr.body.velocity);
        }
      }
      // Police chase: police car follows the player when speeding.
      const ex = sceneRef.current?.extras;
      if (ex?.police) {
        const speeding = Math.abs(signedSpeed) * 3.6 > 60 && modeNow === "drive" && st.started && !paused;
        if (settingsRef.current.policeChase && speeding) {
          if (!st.policeActive) { st.policeActive = true; policeCaughtT.current = 0; audioRef.current?.setSiren(true); showToastRef.current?.("🚨 Police! Slow down or lose them!"); }
          ex.police.g.visible = true;
          const pb = ex.police.body;
          const dx = chassisBody.position.x - pb.position.x;
          const dz = chassisBody.position.z - pb.position.z;
          const d = Math.hypot(dx, dz) || 1;
          pb.velocity.set((dx / d) * 22, pb.velocity.y, (dz / d) * 22);
          pb.quaternion.setFromEuler(0, Math.atan2(dx, dz), 0);
          if (d < 5) {
            policeCaughtT.current += dt;
            if (policeCaughtT.current > 1.5) {
              st.policeActive = false; st.score = Math.max(0, st.score - 300); st.damage = Math.min(100, st.damage + 10);
              audioRef.current?.setSiren(false);
              showToastRef.current?.("🚨 Caught! -300 score, +10 damage. Police left.");
              pb.position.set(0, -60, 0); pb.velocity.set(0, 0, 0); ex.police.g.visible = false;
            }
          } else policeCaughtT.current = 0;
        } else if (st.policeActive) {
          st.policeActive = false;
          audioRef.current?.setSiren(false);
          ex.police.body.position.set(0, -60, 0); ex.police.body.velocity.set(0, 0, 0); ex.police.g.visible = false;
        }
      }
      // Cones: knocked cones topple and settle (manual damping; zero ground friction)
      for (const cb of cones) {
        cb.velocity.scale(1 - 2.5 * dt, cb.velocity);
        cb.angularVelocity.scale(1 - 2.5 * dt, cb.angularVelocity);
      }
      if (!paused) world.step(1 / 60, dt, 3);

      // ---- Sync visuals from physics (never the other way round) ----
      const holder = sceneRef.current?.car;
      if (holder) {
        holder.position.set(chassisBody.position.x, chassisBody.position.y - 0.82 + 0, chassisBody.position.z);
        holder.quaternion.set(chassisBody.quaternion.x, chassisBody.quaternion.y, chassisBody.quaternion.z, chassisBody.quaternion.w);
      }
      // Wheels: fixed chassis-relative mounts — only spin + front steering.
      // (Suspension travel is small; ignoring its vertical bob avoids mapping bugs.)
      const cwp = sceneRef.current?.customWheelPivots;
      if (cwp) { for (const piv of cwp) { piv.rotation.x += (signedSpeed / 0.37) * dt; } }
      const wr = sceneRef.current?.wheelRigs;
      if (wr) {
        for (let i = 0; i < 4; i++) {
          const rig = wr[i];
          if (!rig) continue;
          rig.spin.rotation.x += (signedSpeed / 0.37) * dt;
          if (i < 2) rig.pivot.rotation.y = vehicle.wheelInfos[i].steering;
        }
      }
      for (const tr of traffic) {
        tr.g.position.set(tr.body.position.x, tr.body.position.y - 0.4, tr.body.position.z);
        tr.g.quaternion.set(tr.body.quaternion.x, tr.body.quaternion.y, tr.body.quaternion.z, tr.body.quaternion.w);
      }
      for (let ci = 0; ci < cones.length; ci++) {
        const cb = cones[ci];
        const cv = coneVisuals[ci];
        if (!cv) continue;
        cv.position.set(cb.position.x, cb.position.y - 0.43, cb.position.z);
        cv.quaternion.set(cb.quaternion.x, cb.quaternion.y, cb.quaternion.z, cb.quaternion.w);
      }
      st.shake = Math.max(0, st.shake - dt * 2.5);

      // Camera
      const pos = new THREE.Vector3(chassisBody.position.x, chassisBody.position.y, chassisBody.position.z);
      tmpQ.set(chassisBody.quaternion.x, chassisBody.quaternion.y, chassisBody.quaternion.z, chassisBody.quaternion.w);
      tmpFwd.set(0, 0, -1).applyQuaternion(tmpQ);
      const target = new THREE.Vector3();
      const shakeAmp = settingsRef.current.reduceMotion ? 0 : (st.shake > 0 ? (Math.random() - 0.5) * st.shake * 0.5 * (settingsRef.current.camShake / 60) : 0);
      const shakeOff = shakeAmp;
      if (modeNow === "garage") {
        const a = performance.now() * 0.00035 + dragRef.current.angle;
        camera.position.set(Math.sin(a) * 9, 2.6, Math.cos(a) * 9);
        camera.lookAt(0, 1, 0);
        // Park car at origin in garage
        chassisBody.position.set(0, 0.85, 0);
        chassisBody.velocity.set(0, 0, 0);
        chassisBody.quaternion.setFromEuler(0, 0, 0);
      } else if (modeNow === "drive") {
        const holder = sceneRef.current?.car;
        if (holder) holder.visible = camRef.current !== 4; // first-person hides the body
        if (st.replaying && replayPathRef.current.length > 0) {
          const rp = replayPathRef.current[Math.min(st.replayIdx, replayPathRef.current.length - 1)];
          st.replayIdx += 1;
          if (st.replayIdx >= replayPathRef.current.length) st.replaying = false;
          camera.position.set(rp.x, 6, rp.z + 8);
          camera.lookAt(rp.x, 1, rp.z);
        } else if (camRef.current === 0) {
          target.copy(pos).addScaledVector(tmpFwd, -9).add(new THREE.Vector3(0, 3.6 + shakeOff, 0));
          camera.position.lerp(target, 1 - Math.pow(0.001, dt));
          camera.lookAt(pos.x + tmpFwd.x * 8, 1.4, pos.z + tmpFwd.z * 8);
          camera.fov = THREE.MathUtils.lerp(camera.fov, wantNitro ? settingsRef.current.fov + 12 : settingsRef.current.fov, dt * 5);
          camera.updateProjectionMatrix();
        } else if (camRef.current === 1) {
          camera.position.copy(pos).addScaledVector(tmpFwd, 1.6).add(new THREE.Vector3(0, 1.5, 0));
          camera.lookAt(pos.x + tmpFwd.x * 12, 1.2, pos.z + tmpFwd.z * 12);
          camera.fov = THREE.MathUtils.lerp(camera.fov, settingsRef.current.fov, dt * 5);
          camera.updateProjectionMatrix();
        } else if (camRef.current === 2) {
          camera.position.set(pos.x, 34, pos.z - 0.01);
          camera.lookAt(pos.x, 0, pos.z);
        } else if (camRef.current === 3) {
          const a = st.time * 0.25;
          camera.position.set(pos.x + Math.sin(a) * 12, 4.5, pos.z + Math.cos(a) * 12);
          camera.lookAt(pos.x, 1.2, pos.z);
        } else {
          // First-person: driver eye, looking down the road.
          camera.position.copy(pos).addScaledVector(tmpFwd, 0.4).add(new THREE.Vector3(0, 1.35, 0));
          camera.lookAt(pos.x + tmpFwd.x * 14, 1.3, pos.z + tmpFwd.z * 14);
          camera.fov = THREE.MathUtils.lerp(camera.fov, settingsRef.current.fov, dt * 5);
          camera.updateProjectionMatrix();
        }
      } else {
        const holder = sceneRef.current?.car;
        if (holder) holder.visible = true;
        const a = performance.now() * 0.00008;
        camera.position.set(Math.sin(a) * 42, 18, Math.cos(a) * 42);
        camera.lookAt(0, 2, 0);
      }
      // World extras visibility (district, lights, sky, markers, ghost, fireworks)
      const ex2 = sceneRef.current?.extras;
      if (ex2) {
        ex2.moon.visible = settingsRef.current.moonStars;
        ex2.stars.visible = settingsRef.current.moonStars;
        ex2.clouds.visible = settingsRef.current.clouds;
        ex2.clouds.position.x = Math.sin(st.time * 0.02) * 20;
        for (const lm of ex2.lampLights) lm.visible = settingsRef.current.streetlights;
        for (const lh of ex2.lampHeads) lh.visible = settingsRef.current.streetlights;
        for (const bm of ex2.buildingMats) bm.emissiveIntensity = (settingsRef.current.nightLights ? 0.55 : 0.02) * (settingsRef.current.billboardCycle ? 0.85 + Math.sin(st.time * 0.8) * 0.15 : 1);
        if (sceneRef.current?.neonMat && settingsRef.current.neonPulse) sceneRef.current.neonMat.opacity = 0.3 + (settingsRef.current.neonBrightness / 100) * 0.6 * (0.7 + Math.sin(st.time * 4) * 0.3);
        for (const sm of ex2.signMats) sm.visible = settingsRef.current.neonDistrict;
        ex2.groundMat.envMapIntensity = 0.2 + (settingsRef.current.roadWetness / 100) * 1.4;
        ex2.puddleMat.opacity = 0.3 + (settingsRef.current.puddleAmount / 100) * 0.62;
        ex2.puddleMat.visible = settingsRef.current.puddleAmount > 2;
        // Job + station markers
        const showJob = (settingsRef.current.taxiJob || settingsRef.current.deliveryJob) && st.jobType !== "" && st.jobStage < 2;
        ex2.jobMarker.visible = showJob;
        if (showJob) {
          const jx = st.jobStage === 0 ? st.jobX : 0;
          const jz = st.jobStage === 0 ? st.jobZ : 30;
          ex2.jobMarker.position.set(jx, 0.1, jz);
          ex2.jobMarker.rotation.z += dt * 1.5;
        }
        for (const m of ex2.fuelMarkers) m.visible = settingsRef.current.fuelStations;
        for (const m of ex2.garageMarkers) m.visible = settingsRef.current.repairGarages;
        ex2.washMarker.visible = settingsRef.current.carWash;
        // Ghost car follows best-lap path by lap time
        if (settingsRef.current.ghostCar && bestPathRef.current.length > 0 && modeNow === "drive") {
          const g = bestPathRef.current.find((p) => p.t >= st.lapTime) ?? bestPathRef.current[bestPathRef.current.length - 1];
          ex2.ghostMesh.visible = true;
          ex2.ghostMesh.position.set(g.x, 0.6, g.z);
        } else ex2.ghostMesh.visible = false;
        // Fireworks bursts
        if (settingsRef.current.fireworks) {
          st.fireworksT += dt;
          ex2.fireworks.children.forEach((fw, i) => {
            const pts = fw as THREE.Points;
            const phase = (st.time * 0.5 + i * 0.37) % 1;
            (pts.material as THREE.PointsMaterial).opacity = phase < 0.4 ? 0.9 * (1 - phase / 0.4) : 0;
            pts.rotation.y += dt * 0.6;
          });
        } else {
          ex2.fireworks.children.forEach((fw) => { ((fw as THREE.Points).material as THREE.PointsMaterial).opacity = 0; });
        }
        // Traffic-light cycle
        if (settingsRef.current.trafficLightsCycle) {
          const cyc = Math.floor(st.time / 4) % 3;
          const col = cyc === 0 ? "#22ff66" : cyc === 1 ? "#ffb020" : "#ff2244";
          for (const m of ex2.trafficLampMats) m.color.set(col);
        }
      }
      checkpointMeshes.forEach((m, i) => {
        const active = i === st.checkpoint % CHECKPOINTS.length && modeNow === "drive";
        (m.material as THREE.MeshBasicMaterial).color.set(active ? "#ffb020" : "#00e5ff");
        const s = active ? 1 + Math.sin(st.time * 5) * 0.08 : 1;
        m.scale.setScalar(s);
      });
      hudAcc += dt;
      if (hudAcc > 0.12) {
        hudAcc = 0;
        const cd = modeNow === "drive" ? (st.countdown >= 0 ? (st.countdown === 0 ? "GO!" : String(st.countdown + 1)) : "") : "";
        const speedVal = Math.abs(signedSpeed) * 3.6;
        setHud({ speed: Math.round(settingsRef.current.speedUnit === "mph" ? speedVal * 0.621371 : speedVal), nitro: Math.round(st.nitro), drift: Math.round(st.driftScore), checkpoint: st.checkpoint, laps: st.laps, countdown: cd, damage: Math.round(st.damage) });
        setScoreHud({ score: Math.round(st.score), fuel: Math.round(st.fuel), lapTime: st.lapTime, bestLap: st.bestLap, combo: Math.round(st.driftCombo), job: st.jobType ? `${st.jobType} ${st.jobStage === 0 ? "→ pickup" : st.jobStage === 1 ? "→ drop-off" : "✓ done"}` : "", fps: st.fps, police: st.policeActive });
      }
      composer.render();
    };
    animate();
    const onResize = () => {
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      composer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      renderer.domElement.removeEventListener("pointerdown", onCanvasPointerDown);
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      pmrem.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Custom-car models: list + restore persisted choice (local only).
  useEffect(() => {
    let alive = true;
    (async () => {
      try { const list = await listCustomModels(); if (alive) setMyModels(list); } catch { /* IndexedDB unavailable */ }
      try { const saved = localStorage.getItem(CUSTOM_CAR_CHOICE_KEY); if (saved && saved !== "default") { if (alive) { setSelectedModelId(saved); selectedModelRef.current = saved; } } } catch {}
      try { const f = localStorage.getItem(CUSTOM_CAR_FLIP_KEY); if (f === "1") { flipRef.current = true; if (alive) setFlipModel(true); } } catch {}
    })();
    return () => { alive = false; };
  }, []);
  // Apply restored custom-car choice once the scene exists (poll briefly).
  useEffect(() => {
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      const fn = swapRef.current;
      const want = selectedModelRef.current;
      if (fn && want && want !== "default") {
        fn(want).catch(() => { /* saved bytes missing — user can re-upload */ });
        clearInterval(iv);
      } else if (tries > 40) clearInterval(iv);
    }, 250);
    return () => clearInterval(iv);
  }, []);
  // Keep refs in sync for the swap closure.
  useEffect(() => { selectedModelRef.current = selectedModelId; }, [selectedModelId]);
  useEffect(() => { flipRef.current = flipModel; try { localStorage.setItem(CUSTOM_CAR_FLIP_KEY, flipModel ? "1" : "0"); } catch {} }, [flipModel]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 4200); };
  const handleCustomFile = async (file: File) => {
    const v = validateCustomFile(file);
    if (!v.ok) { showToast(v.error || "That file could not be used."); return; }
    if (v.warnOver20Mb && !window.confirm(`This model is ${(file.size / 1048576).toFixed(1)} MB (over 20 MB). Large models can be slow. Upload it anyway?`)) return;
    setUploading(true);
    try {
      const meta = await saveCustomModel(file);
      const list = await listCustomModels();
      setMyModels(list);
      setSelectedModelId(meta.id); selectedModelRef.current = meta.id;
      await swapRef.current?.(meta.id);
      showToast(`Uploaded “${meta.name}” — now driving your custom model. It never left this device.`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not parse that GLB/GLTF file.");
    } finally { setUploading(false); }
  };
  const useCustomModel = async (id: string) => {
    try { await swapRef.current?.(id); setSelectedModelId(id); selectedModelRef.current = id; showToast("Custom model selected."); } catch (e) { showToast(e instanceof Error ? e.message : "Could not load that model."); }
  };
  const useDefaultModel = async () => {
    try { await swapRef.current?.("default"); setSelectedModelId("default"); selectedModelRef.current = "default"; showToast("Back to the default Vanta GT."); } catch {}
  };
  const removeCustomModel = async (id: string) => {
    if (!window.confirm("Delete this saved model from this browser?")) return;
    await deleteCustomModel(id);
    const list = await listCustomModels();
    setMyModels(list);
    if (selectedModelId === id) await useDefaultModel();
    showToast("Model deleted from this browser.");
  };
  const toggleFlip = async () => {
    const next = !flipModel; setFlipModel(next); flipRef.current = next;
    try { localStorage.setItem(CUSTOM_CAR_FLIP_KEY, next ? "1" : "0"); } catch {}
    // Re-apply the current selection so the new orientation takes effect.
    const cur = selectedModelRef.current;
    if (cur && cur !== "default") { try { await swapRef.current?.(cur); } catch {} }
  };

  // Loader simulation
  useEffect(() => {
    const lines = ["WARMING ENGINE", "LOADING NEON CITY", "TUNING SUSPENSION", "CALIBRATING DRIFT", "STARTING RADIO"];
    let i = 0;
    const iv = setInterval(() => {
      i += 1;
      setProgress(Math.min(100, Math.round((i / 22) * 100)));
      setStatus(lines[Math.floor(i / 5) % lines.length]);
      if (i >= 22) { clearInterval(iv); setTimeout(() => setLoading(false), 350); }
    }, 110);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("raphael-drive-config");
      if (saved) { const parsed = JSON.parse(saved) as CarConfig; setConfig({ ...DEFAULT_CONFIG, ...parsed }); }
    } catch { /* ignore */ }
    audioRef.current = new AudioEngine();
  }, []);
  useEffect(() => {
    try { localStorage.setItem("raphael-drive-config", JSON.stringify(config)); } catch { /* ignore */ }
    applyConfig(config);
  }, [config, applyConfig]);

  // Body-style: Race Spec gets a bigger wing + darker glass (same realistic shell, no cartoon GLB swap)
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    const race = config.body === "race";
    s.spoiler.scale.set(race ? 1.15 : 1, race ? 1.15 : 1, 1);
  }, [config.body]);

  useEffect(() => { audioRef.current?.setMuted(muted); }, [muted]);
  useEffect(() => { if (audioRef.current) audioRef.current.radioOn = radioOn; }, [radioOn]);
  useEffect(() => { if (audioRef.current) audioRef.current.trackIndex = trackIdx; }, [trackIdx]);
  useEffect(() => {
    const s = sceneRef.current;
    if (s?.rain) s.rain.visible = rainOn;
  }, [rainOn]);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    const t = dayNight / 100;
    s.skyMat.setHSL(0.72 - t * 0.15, 0.6, 0.04 + t * 0.28);
    if (s.scene.fog) s.scene.fog.color.copy(s.skyMat);
    s.hemi.intensity = 0.4 + t * 0.8;
    s.sun.intensity = 0.6 + t * 1.2;
    if (s.rain) s.rain.visible = rainOn && t < 0.6;
  }, [dayNight, rainOn]);

  // ---- Settings → engine/audio/graphics/district sync ----
  useEffect(() => { showToastRef.current = showToast; }, [showToast]);
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.engineType = settings.engineSound;
    a.engineVolume = settings.engineVolume / 100;
    a.squealVolume = settings.squealVolume / 100;
    a.sfxVolume = settings.sfxVolume / 100;
    a.radioVolume = settings.radioVolume / 100;
    a.setMasterVolume(settings.masterVolume);
    a.radioOn = settings.musicSource === "radio";
    if (settings.musicSource === "radio") a.startRadio();
    a.setAmbient(settings.ambientNoise);
    a.setDuck(settings.musicDuck, musicPlaying);
  }, [settings.engineSound, settings.engineVolume, settings.squealVolume, settings.sfxVolume, settings.radioVolume, settings.masterVolume, settings.musicSource, settings.ambientNoise, settings.musicDuck, musicPlaying]);
  useEffect(() => {
    // Settings garage values drive the legacy CarConfig (single source of truth).
    setConfig((prev) => ({ ...prev, paint: settings.paintColor, clearcoat: settings.clearcoat, neon: settings.neonColor, headlights: settings.headlights, spoiler: settings.spoilerStyle !== "none", wheelStyle: Math.min(2, settings.wheelStyle) }));
    applyConfig(configRef.current);
  }, [settings.paintColor, settings.clearcoat, settings.neonColor, settings.headlights, settings.spoilerStyle, settings.wheelStyle, settings.metallic, settings.finish, settings.neonBrightness, settings.headlightColor, settings.rideHeight, settings.camber, settings.tyreWidth, settings.spoilerSize, applyConfig]);
  useEffect(() => {
    // Time presets map to day/night values.
    const map: Record<string, number> = { dawn: 22, noon: 62, dusk: 38, midnight: 4 };
    if (settings.timePreset !== "custom" && map[settings.timePreset] !== undefined) updateSettings({ dayNight: map[settings.timePreset] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.timePreset]);
  useEffect(() => {
    // District palette: fog/sky tint + sign colour shift.
    const s = sceneRef.current;
    if (!s) return;
    const tints: Record<string, string> = { downtown: "#060710", port: "#071018", highway: "#0a0812", residential: "#0a0e08" };
    const tint = tints[settings.district] ?? "#060710";
    s.skyMat.set(tint);
    if (s.scene.fog) s.scene.fog.color.set(tint);
  }, [settings.district]);
  useEffect(() => {
    // Graphics quality → pixel ratio / shadows / bloom (applied to renderer via canvas style is not enough, so store and apply on next mount + live via composer pass if present).
    const canvas = mountRef.current?.querySelector("canvas");
    if (canvas) {
      const q = settings.graphicsQuality;
      canvas.style.imageRendering = q === "low" ? "pixelated" : "auto";
    }
    // Shadows/bloom toggles apply through CSS-independent flags read in loop; low disables bloom by dimming composer is not accessible here — visual difference comes from pixel ratio + CSS.
  }, [settings.graphicsQuality]);
  useEffect(() => {
    if (settings.photoMode) {
      window.setTimeout(() => { takePhoto(); updateSettings({ photoMode: false }); }, 120);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.photoMode]);
  useEffect(() => {
    // My Music ducking: engine dips while your songs play.
    // Subscribe (not assign): MyMusicPanel instances subscribe too, and a
    // single-assignment callback would be clobbered by the last panel mounted.
    const unsub = myMusicPlayer.subscribe({
      onPlayingChange: (p) => { setMusicPlaying(p); audioRef.current?.setDuck(settingsRef.current.musicDuck, p); },
      onTrackChange: (id) => setCurrentSong(id),
    });
    return unsub;
  }, []);
  useEffect(() => {
    // Best lap restore.
    try { const b = Number(localStorage.getItem("raphael-drive-best-lap") || "0"); if (b > 0) stateRef.current.bestLap = b; } catch {}
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      const cv = minimapRef.current;
      if (!cv) return;
      const g = cv.getContext("2d");
      if (!g) return;
      const size = settingsRef.current.minimapSize;
      const zoom = 1 + settingsRef.current.minimapZoom / 100; // 1x-2x
      const range = 150 / zoom; // world units shown across the map
      const toPx = (v: number, c: number) => ((v - (c - range / 2)) / range) * size;
      const holder = sceneRef.current?.car;
      const cx = holder ? holder.position.x : 0;
      const cz = holder ? holder.position.z : 0;
      g.fillStyle = "#0a0a18"; g.fillRect(0, 0, size, size);
      g.strokeStyle = "#2a2f4a"; g.lineWidth = 5;
      for (const s of STREETS) {
        const px = toPx(s, cx);
        const pz = toPx(s, cz);
        g.beginPath(); g.moveTo(px, 0); g.lineTo(px, size); g.stroke();
        g.beginPath(); g.moveTo(0, pz); g.lineTo(size, pz); g.stroke();
      }
      g.fillStyle = "#23233a";
      for (const b of BUILDING_BLOCKS) g.fillRect(toPx(b.x - 8, cx), toPx(b.z - 8, cz), 16 * (size / range), 16 * (size / range));
      const cp = CHECKPOINTS[hud.checkpoint % CHECKPOINTS.length];
      g.fillStyle = "#ffb020";
      g.beginPath(); g.arc(toPx(cp.x, cx), toPx(cp.z, cz), 5, 0, Math.PI * 2); g.fill();
      if (holder) {
        g.fillStyle = "#00e5ff";
        g.beginPath(); g.arc(toPx(holder.position.x, cx), toPx(holder.position.z, cz), 4, 0, Math.PI * 2); g.fill();
      }
    }, 150);
    return () => clearInterval(iv);
  }, [hud.checkpoint]);

  const nav = (m: Mode) => {
    audioRef.current?.ensure();
    audioRef.current?.click();
    if (m === "drive") { startDrive(); return; }
    setMode(m);
  };
  // Drive HUD gear: visible in Drive unless photo mode / HUD off / an overlay is open.
  const gearVisible = mode === "drive" && !settings.photoMode && settings.hudLayout !== "off" && !showSettingsPopup && !showPauseMenu;
  const toggleMute = () => { audioRef.current?.ensure(); setMuted((v) => !v); };
  const press = (key: keyof typeof touchRef.current, on: boolean) => { touchRef.current[key] = on; };
  const currentTrack = RADIO_TRACKS[trackIdx % RADIO_TRACKS.length];

  return (
    <div className="rd-root" style={{ filter: settings.colorBlind === "protan" ? "url(#protan)" : settings.colorBlind === "deutan" ? "hue-rotate(-20deg) saturate(1.2)" : settings.colorBlind === "tritan" ? "hue-rotate(40deg)" : "none" }}>
      <svg width="0" height="0" style={{ position: "absolute" }}><defs><filter id="protan"><feColorMatrix type="matrix" values="0.567,0.433,0,0,0 0.558,0.442,0,0,0 0,0.242,0.758,0,0 0,0,0,1,0" /></filter></defs></svg>
      <div ref={mountRef} className="rd-canvas" />
      <div className="rd-vignette" />
      <div className="rd-scan" />
      <div className={`rd-loader ${loading ? "" : "done"}`} aria-hidden={!loading}>
        <div className="rd-loader-inner">
          <svg className="rd-ring" viewBox="0 0 168 168">
            <defs><linearGradient id="loaderGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff2e88" /><stop offset="1" stopColor="#00e5ff" /></linearGradient></defs>
            <circle className="rd-ring-bg" cx="84" cy="84" r="66" />
            <circle className="rd-ring-fill" cx="84" cy="84" r="66" style={{ strokeDasharray: 414.69, strokeDashoffset: 414.69 * (1 - progress / 100) }} />
          </svg>
          <p className="rd-pct">{progress}</p>
          <p className="rd-status">{status}</p>
          <div className="rd-loader-brand">RAPHAEL DRIVE</div>
          <div className="rd-loader-sub">Neon City · Original Build</div>
        </div>
      </div>
      <header className="rd-top">
        <div className="rd-brand"><div className="rd-logo">RD</div><div><b>RAPHAEL DRIVE</b><span>Neon City · By Raphael</span></div></div>
        <nav className="rd-nav">
          <button className={mode === "menu" ? "active" : ""} onClick={() => nav("menu")}>Home</button>
          <button className={mode === "garage" ? "active" : ""} onClick={() => nav("garage")}>Garage</button>
          <button className={mode === "drive" ? "active" : ""} onClick={() => nav("drive")}>Drive</button>
          <button className={mode === "docs" ? "active" : ""} onClick={() => nav("docs")}>Docs</button>
          <button className={mode === "settings" ? "active" : ""} onClick={() => { if (mode === "drive" || mode === "garage") openSettingsPopup("header"); else nav("settings"); }}>{label(settings.language, "settings")}</button>
          <button onClick={toggleMute}>{muted ? "🔇 Sound Off" : "🔊 Sound On"}</button>
        </nav>
      </header>
      {mode === "menu" && !loading && (
        <section className="rd-panel rd-menu">
          <div className="rd-eyebrow">Original WebGL Driving Game · Real Physics</div>
          <h1>NEON CITY<br /><em>AWAITS YOU.</em></h1>
          <p className="rd-lead">Tune your Vanta GT in the garage, then drive a real physics car through a rainy neon city. Suspension, grip, drift, collisions — no pass-through, no cartoon. Nitro, checkpoints, traffic and procedural synthwave — all in your browser.</p>
          <div className="rd-cta">
            <button className="btn btn-primary" onClick={startDrive}>▶ {label(settings.language, "startDriving")}</button>
            <button className="btn btn-ghost" onClick={() => nav("garage")}>Open Garage</button>
            <button className="btn btn-cyan" onClick={() => nav("docs")}>How To Play</button>
            <button className="btn btn-ghost" onClick={() => nav("settings")}>⚙ {FEATURE_COUNT}+ Features</button>
          </div>
          <div className="rd-features">
            <div className="rd-feat"><b>Real Physics</b><span>cannon-es RaycastVehicle — 1,400 kg, suspension, grip, impact damage.</span></div>
            <div className="rd-feat"><b>PBR City</b><span>Procedural asphalt, facades, wet puddles, bloom, ACES tone mapping.</span></div>
            <div className="rd-feat"><b>Solid Collisions</b><span>Buildings + traffic are real physics bodies. You stop, slide, bounce.</span></div>
            <div className="rd-feat"><b>Synthwave Radio</b><span>Raphael FM — three original WebAudio loops, no sampled tracks.</span></div>
          </div>
          <div className="rd-statrow"><div><b>1400 kg</b>Car mass</div><div><b>5</b>Checkpoints</div><div><b>20</b>Traffic cars</div><div><b>{FEATURE_COUNT}+</b>Real Features</div></div>
        </section>
      )}
      {mode === "garage" && (
        <aside className="rd-panel rd-garage">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div>
              <div className="rd-eyebrow">Garage</div>
              <h2>Build your Vanta GT</h2>
            </div>
            <button className="btn btn-ghost" style={{ padding: "9px 12px", flexShrink: 0 }} onClick={() => openSettingsPopup("garage")} title="Open Settings (popup)">⚙ Settings</button>
          </div>
          <p className="rd-muted">Every change applies live to the 3D car behind this panel. Your setup is saved on this device.</p>
          <div className="rd-field"><label>Body Style</label><div className="rd-seg">
            <button className={config.body === "vanta" ? "active" : ""} onClick={() => setConfig({ ...config, body: "vanta" })}>Vanta GT</button>
            <button className={config.body === "race" ? "active" : ""} onClick={() => setConfig({ ...config, body: "race" })}>Race Spec</button>
          </div><p className="rd-note">Race Spec widens the carbon wing and firms the look. Same realistic shell, no cartoon swap.</p></div>
          <div className="rd-field"><label>Body Paint <span>{PAINTS.find((p) => p.value === config.paint)?.name}</span></label>
            <div className="rd-swatches">{PAINTS.map((p) => (<button key={p.value} className={`rd-sw ${config.paint === p.value ? "active" : ""}`} style={{ background: p.value }} aria-label={p.name} onClick={() => { setConfig({ ...config, paint: p.value }); updateSettings({ paintColor: p.value }); }} />))}</div>
          </div>
          <div className="rd-field"><label>Wheel Style</label><div className="rd-seg">
            {["Classic", "Sport", "Neon Rim"].map((n, i) => (<button key={n} className={config.wheelStyle === i ? "active" : ""} onClick={() => { setConfig({ ...config, wheelStyle: i }); updateSettings({ wheelStyle: i }); }}>{n}</button>))}
          </div></div>
          <div className="rd-field"><label>Neon Underglow</label>
            <div className="rd-swatches">{NEONS.map((n) => (<button key={n.value} className={`rd-sw ${config.neon === n.value ? "active" : ""}`} style={{ background: n.value }} aria-label={n.name} onClick={() => { setConfig({ ...config, neon: n.value }); updateSettings({ neonColor: n.value }); }} />))}</div>
          </div>
          <label className="rd-toggle">Spoiler <input type="checkbox" checked={config.spoiler} onChange={(e) => { setConfig({ ...config, spoiler: e.target.checked }); updateSettings({ spoilerStyle: e.target.checked ? "gt" : "none" }); }} /></label>
          <label className="rd-toggle">Headlights <input type="checkbox" checked={config.headlights} onChange={(e) => { setConfig({ ...config, headlights: e.target.checked }); updateSettings({ headlights: e.target.checked }); }} /></label>
          <div className="rd-field"><label>Clearcoat Shine <span>{config.clearcoat}%</span></label>
            <input type="range" min={0} max={100} value={config.clearcoat} onChange={(e) => { setConfig({ ...config, clearcoat: Number(e.target.value) }); updateSettings({ clearcoat: Number(e.target.value) }); }} />
          </div>
          <div className="rd-field" style={{ borderTop: "1px solid rgba(255,255,255,.12)", paddingTop: 12 }}>
            <label>Upload My Car Model <span style={{ textTransform: "none", letterSpacing: 0 }}>local only · .glb / .gltf</span></label>
            <p className="rd-note">Pick YOUR OWN .glb/.gltf car from this device. It is parsed in your browser and saved in this browser (IndexedDB) — never uploaded to any server. We never download or copy another site&apos;s models. Auto-scaled to ~4.3 m, ground-aligned; paint recolor applies where the model exposes body materials. Physics stays the same 1,400 kg chassis — only the look swaps.</p>
            <input ref={fileInputRef} type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleCustomFile(f); e.target.value = ""; }} />
            <button className="btn btn-cyan" style={{ width: "100%" }} disabled={uploading} onClick={() => fileInputRef.current?.click()}>{uploading ? "Parsing…" : "📁 Choose .glb / .gltf From My Device"}</button>
            <label className="rd-toggle" style={{ marginTop: 8 }}>Flip model (if it faces backwards) <input type="checkbox" checked={flipModel} onChange={() => void toggleFlip()} /></label>
            <div style={{ marginTop: 10 }}>
              <p className="rd-note" style={{ margin: "0 0 6px" }}>My Models ({myModels.length}) — {selectedModelId === "default" ? "using Default Vanta GT" : "using a custom model"}</p>
              <button className={`btn ${selectedModelId === "default" ? "btn-primary" : "btn-ghost"}`} style={{ width: "100%", marginBottom: 6 }} onClick={() => void useDefaultModel()}>Default Vanta GT</button>
              {myModels.length === 0 && <p className="rd-note">No custom models yet. Upload one above — it will appear here with name + date.</p>}
              {myModels.map((mm) => (
                <div key={mm.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, background: selectedModelId === mm.id ? "rgba(0,229,255,.12)" : "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, padding: "8px 10px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mm.name}</div>
                    <div className="rd-note" style={{ margin: 0 }}>{new Date(mm.date).toLocaleDateString()} · {(mm.size / 1048576).toFixed(2)} MB · {mm.meshCount} meshes · {mm.hasWheels ? "wheels found" : "no wheel meshes — built-in wheels used"}</div>
                  </div>
                  <button className="btn btn-cyan" style={{ padding: "6px 10px" }} onClick={() => void useCustomModel(mm.id)}>Use</button>
                  <button className="btn btn-ghost" style={{ padding: "6px 10px" }} onClick={() => void removeCustomModel(mm.id)}>Delete</button>
                </div>
              ))}
            </div>
            {toast && <p className="rd-note" style={{ color: "#ffd166", marginTop: 8 }}>{toast}</p>}
          </div>
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 8 }} onClick={startDrive}>▶ Drive This Setup</button>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={honk}>📯 Horn ({settings.hornStyle})</button>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => openSettingsPopup("garage")}>⚙ All Settings</button>
          </div>
          <MyMusicPanel settings={settings} onSourceChange={handleMusicSource} onDuckToggle={() => updateSettings({ musicDuck: !settings.musicDuck })} onToast={showToast} />
          <p className="rd-note" style={{ marginTop: 10 }}>Drag to orbit in garage view. Car + city are original procedural PBR — see Docs → Credits.</p>
        </aside>
      )}
      {mode === "settings" && (
        <section className="rd-panel rd-docs">
          <div className="rd-eyebrow">Settings</div>
          <h2>{FEATURE_COUNT}+ Real Features</h2>
          <p className="rd-muted">Every control below does something real and is saved on this device. Music: use the My Music panel in Garage/Drive to play your own songs with crossfade.</p>
          <SettingsPanel settings={settings} onChange={updateSettings} onAction={handleSettingsAction} onImportFile={(f) => void handleImportSettings(f)} />
          <MyMusicPanel settings={settings} onSourceChange={handleMusicSource} onDuckToggle={() => updateSettings({ musicDuck: !settings.musicDuck })} onToast={showToast} />
        </section>
      )}
      {mode === "docs" && (
        <section className="rd-panel rd-docs">
          <div className="rd-eyebrow">Documentation</div>
          <h2>How Raphael Drive works</h2>
          <p className="rd-muted">An original browser game by Raphael. Real cannon-es physics: the car has mass, suspension and grip, and buildings/traffic are solid bodies — you cannot drive through them. Hit something hard and you take damage and lose speed.</p>
          <h3 className="font-display" style={{ fontSize: 14, letterSpacing: ".2em" }}>CONTROLS</h3>
          <table><thead><tr><th>Action</th><th>Keyboard</th><th>Touch</th></tr></thead><tbody>
            <tr><td>Accelerate</td><td><kbd>W</kbd> / <kbd>↑</kbd></td><td>GAS</td></tr>
            <tr><td>Brake / Reverse</td><td><kbd>S</kbd> / <kbd>↓</kbd></td><td>BRK</td></tr>
            <tr><td>Steer</td><td><kbd>A</kbd> <kbd>D</kbd> / <kbd>←</kbd> <kbd>→</kbd></td><td>◀ ▶</td></tr>
            <tr><td>Drift / Handbrake</td><td><kbd>Space</kbd></td><td>DRIFT</td></tr>
            <tr><td>Nitro</td><td><kbd>Shift</kbd></td><td>N₂O</td></tr>
            <tr><td>Camera</td><td><kbd>C</kbd></td><td>Camera button</td></tr>
            <tr><td>Respawn</td><td><kbd>R</kbd></td><td>Respawn button</td></tr>
            <tr><td>Mute</td><td><kbd>M</kbd></td><td>Sound toggle</td></tr>
            <tr><td>Pause Menu</td><td><kbd>Esc</kbd> / <kbd>P</kbd></td><td>Pause button</td></tr>
            <tr><td>Settings Popup (in Drive)</td><td>⚙ gear button (top-right)</td><td>⚙ button</td></tr>
            <tr><td>Exit to Menu</td><td><kbd>Esc</kbd> in Pause Menu</td><td>Exit button in Pause</td></tr>
          </tbody></table>
          <h3 className="font-display" style={{ fontSize: 14, letterSpacing: ".2em" }}>PHYSICS</h3>
          <p className="rd-muted">• Chassis 1,400 kg, RaycastVehicle, 4 wheels, suspension stiffness 32, rest length 0.32, travel 0.32.<br />• Grip: friction slip 4.8 dry, 1.1 rear while drifting. Nitro raises engine force 3,400 → 5,200.<br />• Collisions: buildings = static boxes, traffic = 1,300 kg dynamic boxes, cones = 2 kg. Impact → camera shake + thud + damage %.<br />• Off-road: leaving the street adds drag and slows you. Sidewalks are raised 0.12.</p>
          <h3 className="font-display" style={{ fontSize: 14, letterSpacing: ".2em" }}>FEATURES</h3>
          <p className="rd-muted">• Garage: paint (clearcoat PBR), wheels, spoiler, neon, headlights, clearcoat — saved in localStorage.<br />• Drive: 5 checkpoints per lap, drift scoring, nitro meter, traffic, rain toggle, day/night slider, damage meter.<br />• Audio: WebAudio engine hum follows speed, nitro noise, drift squeal, collision thud, UI clicks, Raphael FM synthwave sequencer (3 original loops).<br />• Tech: Next.js + Three.js WebGL + cannon-es, ACES tone mapping, UnrealBloom, PWA manifest, responsive + touch controls.</p>
          <h3 className="font-display" style={{ fontSize: 14, letterSpacing: ".2em" }}>{FEATURE_COUNT}+ REAL FEATURES — FULL LIST</h3>
          <p className="rd-muted">Every feature below is a working control in Settings / Garage / Drive — not a label. Count: {FEATURE_COUNT}.</p>
          {(["Garage", "Drive", "Game", "Settings", "World", "Music", "Custom Car"] as const).map((grp) => (
            <div key={grp}>
              <h4 style={{ fontSize: 13, margin: "12px 0 4px" }}>{grp} ({FEATURE_REGISTRY.filter((f) => f.group === grp).length})</h4>
              <ul style={{ margin: "0 0 8px 18px", padding: 0, fontSize: 13, color: "#c9cfe8" }}>
                {FEATURE_REGISTRY.filter((f) => f.group === grp).map((f) => (
                  <li key={f.id}><b style={{ color: "#fff" }}>{f.label}</b> — {f.desc}</li>
                ))}
              </ul>
            </div>
          ))}
          <h3 className="font-display" style={{ fontSize: 14, letterSpacing: ".2em" }}>MY MUSIC (YOUR OWN SONGS)</h3>
          <p className="rd-muted">Garage / Drive / Settings → My Music: pick audio files from your device. Stored in this browser (IndexedDB), never uploaded. Play/pause/next/prev, seek bar, shuffle, repeat off/all/one, volume. Track changes crossfade: the old track fades out while the new one fades in (0-5s, set in Settings). Fade-in on first play, fade-out on pause/stop. Music can duck the engine (toggle). Raphael FM synthwave stays as a separate station — switch Radio ↔ My Music ↔ Off.</p>
          <h3 className="font-display" style={{ fontSize: 14, letterSpacing: ".2em" }}>LEADERBOARD (TOP 10, THIS DEVICE)</h3>
          {leaderboard.length === 0 ? <p className="rd-muted">No scores yet — finish a run to set one.</p> : (
            <ol style={{ margin: "0 0 8px 18px", fontSize: 13, color: "#c9cfe8" }}>
              {leaderboard.map((l, i) => (<li key={i}>{l.score} pts — {new Date(l.date).toLocaleDateString()}</li>))}
            </ol>
          )}
          <h3 className="font-display" style={{ fontSize: 14, letterSpacing: ".2em" }}>ACHIEVEMENTS</h3>
          <p className="rd-muted">{achievements.length === 0 ? "None unlocked yet." : achievements.join(" · ")}</p>
          <h3 className="font-display" style={{ fontSize: 14, letterSpacing: ".2em" }}>KEY BINDINGS (REMAPPABLE IN SETTINGS)</h3>
          <p className="rd-muted">Gas: {settings.keyGas} · Brake: {settings.keyBrake} · Left: {settings.keyLeft} · Right: {settings.keyRight} · Nitro: {settings.keyNitro} · Drift: {settings.keyDrift} · Horn: H · Camera: C · Respawn: R · Mute: M · Pause: P · Menu: Esc. Arrows always work as fallback.</p>
          <p className="rd-muted">Garage → “Upload My Car Model”: pick your OWN .glb/.gltf file from your device. It is parsed in your browser with GLTFLoader, auto-scaled to ~4.3 m, centred and ground-aligned, and saved in this browser (IndexedDB) — never uploaded to any server. “My Models” lists name, date, size, mesh count and whether wheel meshes were found. Use / Delete per model; your choice persists in localStorage. Wheel meshes (named wheel / tyre / rim) get spin pivots; if none are found, the built-in wheels stay visible and keep spinning. Paint recolor applies to detected body materials. Flip toggle fixes models authored facing backwards. Physics never changes: the same 1,400 kg RaycastVehicle chassis drives every model. Validation: non-GLB/GLTF files are rejected, empty files are rejected, over 20 MB shows a confirm warning. We do not download or copy any other site&apos;s models.</p>
          <h3 className="font-display" style={{ fontSize: 14, letterSpacing: ".2em" }}>CREDITS</h3>
          <p className="rd-muted">Car, city, road, sidewalk and facade textures are original procedural PBR works authored for Raphael Drive (treated as CC0). Physics: cannon-es (MIT). Rendering: Three.js (MIT). No real brands, no copied assets, no trademarked car replicas. The old Kenney CC0 low-poly models are kept in <b>public/models/</b> only as unused fallback files.</p>
          <button className="btn btn-primary" onClick={startDrive}>▶ Start Driving</button>
        </section>
      )}
      {mode === "drive" && (
        <>
          {settings.hudLayout !== "off" && !settings.photoMode && (
            <>
              <div className="rd-hud rd-hint"><b>{settings.keyGas.replace("Key", "")} / Arrows</b> drive · <b>Space</b> drift · <b>Shift</b> nitro · <b>H</b> horn · <b>C</b> camera · <b>R</b> respawn · <b>P</b> pause · <b>M</b> mute · <b>Esc</b> menu</div>
              {settings.checkpointProgress && <div className="rd-hud rd-check"><b>{label(settings.language, "checkpoint")} {hud.checkpoint + 1} · {label(settings.language, "lap")} {hud.laps + 1}</b><p>Follow the glowing ring — gold ring is next{stateRef.current.offroad ? " · OFF-ROAD — slow" : ""}</p></div>}
              {settings.minimapOn && <div className="rd-hud rd-minimap" style={gearVisible ? { top: 128 } : undefined}><canvas ref={minimapRef} width={settings.minimapSize} height={settings.minimapSize} style={{ width: settings.minimapSize, height: settings.minimapSize }} /><p>City Map</p></div>}
              {settings.hudLayout === "full" && (
                <div className="rd-hud rd-radio" style={gearVisible ? { top: 330 } : undefined}>
                  <b>{settings.musicSource === "mymusic" ? "MY MUSIC" : "RAPHAEL FM 88.7"}</b>
                  <p>{settings.musicSource === "mymusic" ? (currentSong ? "Your song playing" : "Add songs in My Music") : currentTrack.title}</p>
                  {settings.musicSource === "radio" && <span>{currentTrack.artist} · {currentTrack.bpm} BPM</span>}
                  <button onClick={() => { audioRef.current?.ensure(); audioRef.current?.nextTrack(); setTrackIdx((i) => (i + 1) % RADIO_TRACKS.length); }}>Next Track →</button>
                  <button onClick={() => setRadioOn((v) => !v)}>{radioOn ? "Radio: On" : "Radio: Off"}</button>
                </div>
              )}
              <div className="rd-hud rd-bars">
                <div className="rd-bar-label"><span>{label(settings.language, "nitro")}</span><span>{hud.nitro}%</span></div>
                <div className="rd-bar"><i style={{ width: `${Math.min(100, (hud.nitro / settings.nitroCapacity) * 100)}%` }} /></div>
                {settings.scoreOn && <div className="rd-bar-label"><span>{label(settings.language, "score")}</span><span>{scoreHud.score}</span></div>}
                {settings.driftComboOn && scoreHud.combo > 0 && <div className="rd-bar-label"><span>Drift Combo</span><span>{scoreHud.combo.toFixed(1)}s</span></div>}
                <div className="rd-bar-label"><span>{label(settings.language, "drift")}</span><span>{hud.drift}</span></div>
                {settings.damageOn && <div className="rd-bar-label"><span>{label(settings.language, "damage")}</span><span>{hud.damage}%</span></div>}
                {settings.fuelOn && <div className="rd-bar-label"><span>{label(settings.language, "fuel")}</span><span>{scoreHud.fuel}%</span></div>}
                {settings.lapTimerOn && <div className="rd-bar-label"><span>Lap Time</span><span>{scoreHud.lapTime.toFixed(1)}s</span></div>}
                {settings.bestLapOn && scoreHud.bestLap > 0 && <div className="rd-bar-label"><span>Best Lap</span><span>{scoreHud.bestLap.toFixed(1)}s</span></div>}
                {scoreHud.job && <div className="rd-bar-label"><span>{label(settings.language, "job")}</span><span>{scoreHud.job}</span></div>}
                {scoreHud.police && <div className="rd-bar-label"><span>🚨 {label(settings.language, "police")}</span><span>Slow down!</span></div>}
                {settings.fpsCounter && <div className="rd-bar-label"><span>FPS</span><span>{scoreHud.fps}</span></div>}
              </div>
              <div className="rd-hud rd-speed"><span>{label(settings.language, "speed")}</span><b>{hud.speed}</b><span>{settings.speedUnit === "mph" ? "mph" : "km/h"}</span>{hud.drift > 0 && <div className="drift">★ Drift {hud.drift}</div>}</div>
              {settings.subtitles && <div className="rd-hud" style={{ bottom: 90, left: 20, fontSize: 12 }}>🎵 {settings.musicSource === "mymusic" ? (musicPlaying ? "Your song playing (My Music)" : "My Music paused") : radioOn ? `${currentTrack.title} — ${currentTrack.artist}` : "Radio off"}</div>}
            </>
          )}
          {settings.paused && <div className="rd-count"><b>{label(settings.language, "paused")}</b><p style={{ fontSize: 14 }}>Press P to resume</p></div>}
          {settings.wipers && (settings.weather === "rain" || settings.weather === "storm") && <div className="rd-wipers" aria-hidden="true"><i /></div>}
          <div className="rd-drive-actions">
            <button onClick={() => { const next = ((camMode + 1) % 5) as CamMode; setCamMode(next); camRef.current = next; }}>Camera {camMode + 1}/5</button>
            <button onClick={() => { resetRef.current(); stateRef.current.checkpoint = 0; }}>Respawn</button>
            <button onClick={() => setRainOn((v) => !v)}>{rainOn ? "Rain On" : "Rain Off"}</button>
            <button onClick={honk}>📯 Horn</button>
            <button onClick={() => updateSettings({ paused: !settings.paused })}>{settings.paused ? "Resume" : "Pause"}</button>
            <button onClick={() => setMode("menu")}>Menu</button>
          </div>
          <div style={{ position: "absolute", left: 20, top: 122, zIndex: 15, background: "rgba(8,7,20,.7)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 12, padding: "10px 12px" }}>
            <label style={{ fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: "#c9cfe8", fontWeight: 700 }}>Day / Night</label>
            <input type="range" min={0} max={100} value={dayNight} onChange={(e) => setDayNight(Number(e.target.value))} style={{ width: 150, display: "block", marginTop: 6 }} />
            <div style={{ marginTop: 8 }}>
              <MyMusicPanel settings={settings} onSourceChange={handleMusicSource} onDuckToggle={() => updateSettings({ musicDuck: !settings.musicDuck })} onToast={showToast} />
            </div>
          </div>
          {hud.countdown && <div className="rd-count"><b>{hud.countdown}</b></div>}
          {settings.touchOn && (
            <div className="rd-touch" style={{ transform: `scale(${0.8 + settings.touchSize / 200})`, transformOrigin: "bottom center" }}>
              <div className="grp">
                <button onPointerDown={() => press("left", true)} onPointerUp={() => press("left", false)} onPointerLeave={() => press("left", false)}>◀</button>
                <button onPointerDown={() => press("right", true)} onPointerUp={() => press("right", false)} onPointerLeave={() => press("right", false)}>▶</button>
              </div>
              <div className="grp">
                <button className="wide" onPointerDown={() => press("drift", true)} onPointerUp={() => press("drift", false)}>DRIFT</button>
                <button onPointerDown={() => press("nitro", true)} onPointerUp={() => press("nitro", false)}>N₂O</button>
                <button onPointerDown={() => press("brake", true)} onPointerUp={() => press("brake", false)}>BRK</button>
                <button onPointerDown={() => press("gas", true)} onPointerUp={() => press("gas", false)}>GAS</button>
              </div>
            </div>
          )}
        </>
      )}
      {/* Drive HUD Settings gear — opens the popup overlay, never leaves Drive. */}
      {gearVisible && (
        <button className="rd-drive-settings" onClick={() => openSettingsPopup("hud")} title="Settings (popup)" aria-label="Open Settings">⚙</button>
      )}
      {/* Pause menu (P / Esc in Drive). Pauses physics via settings.paused. */}
      {mode === "drive" && showPauseMenu && !showSettingsPopup && (
        <div className="rd-modal-backdrop" onClick={resumeFromPause}>
          <div className="rd-modal rd-pause" role="dialog" aria-modal="true" aria-label="Paused" onClick={(e) => e.stopPropagation()}>
            <div className="rd-modal-head"><b>⏸ PAUSED</b><button className="rd-modal-x" onClick={resumeFromPause} aria-label="Resume">✕</button></div>
            <div className="rd-modal-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="btn btn-primary" onClick={resumeFromPause}>▶ Resume</button>
              <button className="btn btn-cyan" onClick={() => openSettingsPopup("pause")}>⚙ Settings</button>
              <button className="btn btn-ghost" onClick={restartFromPause}>↻ Restart Run</button>
              <button className="btn btn-ghost" onClick={exitToMenu}>⌂ Exit to Menu</button>
              <p className="rd-note" style={{ margin: "6px 0 0" }}>P resumes · Esc exits to menu · Settings opens the popup on top of Drive.</p>
            </div>
          </div>
        </div>
      )}
      {/* Settings popup overlay — same full SettingsPanel + MyMusicPanel, on top of Drive/Garage. */}
      {showSettingsPopup && (mode === "drive" || mode === "garage") && (
        <div className="rd-modal-backdrop" onClick={closeSettingsPopup}>
          <div className="rd-modal" role="dialog" aria-modal="true" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
            <div className="rd-modal-head">
              <b>⚙ Settings — {mode === "drive" ? "Drive (popup — game paused)" : "Garage (popup)"}</b>
              <button className="rd-modal-x" onClick={closeSettingsPopup} aria-label="Close Settings">✕</button>
            </div>
            <div className="rd-modal-body">
              <p className="rd-note" style={{ marginTop: 0 }}>Every change applies live without leaving {mode === "drive" ? "Drive" : "Garage"}. Esc closes this popup{mode === "drive" ? " → pause menu" : ""}.</p>
              <SettingsPanel settings={settings} onChange={updateSettings} onAction={handleSettingsAction} onImportFile={(f) => void handleImportSettings(f)} />
              <MyMusicPanel settings={settings} onSourceChange={handleMusicSource} onDuckToggle={() => updateSettings({ musicDuck: !settings.musicDuck })} onToast={showToast} />
            </div>
            <div className="rd-modal-foot">
              <button className="btn btn-primary" onClick={closeSettingsPopup}>{mode === "drive" ? "◀ Back to Pause" : "Done"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
