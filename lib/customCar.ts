// Custom car model upload — local-only. The user picks their OWN .glb/.gltf file
// from their device. It is NEVER uploaded to any server: it is parsed in the
// browser with GLTFLoader and stored in IndexedDB on this device only.
// We do NOT download or copy any other site's models (copyrighted).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type CustomModelMeta = {
  id: string;
  name: string;
  fileName: string;
  size: number;
  date: string;
  hasWheels: boolean;
  meshCount: number;
};

export const CUSTOM_CAR_DB = "raphael-drive-custom-cars";
export const CUSTOM_CAR_STORE = "customCars";
export const CUSTOM_CAR_CHOICE_KEY = "raphael-drive-custom-car";
export const CUSTOM_CAR_FLIP_KEY = "raphael-drive-custom-car-flip";
export const MAX_WARN_BYTES = 20 * 1024 * 1024; // >20MB -> warn, still allowed on confirm

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB is not available in this browser."));
    const req = indexedDB.open(CUSTOM_CAR_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CUSTOM_CAR_STORE)) db.createObjectStore(CUSTOM_CAR_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open IndexedDB."));
  });
}

export async function saveCustomModel(file: File): Promise<CustomModelMeta> {
  const buf = await file.arrayBuffer();
  // Validate by parsing BEFORE saving, so a broken file never lands in the list.
  const probe = await parseGlb(buf);
  const hasWheels = detectWheelMeshes(probe.group).length > 0;
  let meshCount = 0;
  probe.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshCount++; });
  probe.group.traverse((o) => {
    // Dispose probe copy — we store bytes, not the parsed scene.
    const m = o as THREE.Mesh;
    if (m.isMesh) { /* geometry/materials are GC'd with the group */ }
  });
  const meta: CustomModelMeta = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name.replace(/\.(glb|gltf)$/i, ""),
    fileName: file.name,
    size: file.size,
    date: new Date().toISOString(),
    hasWheels,
    meshCount,
  };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CUSTOM_CAR_STORE, "readwrite");
    tx.objectStore(CUSTOM_CAR_STORE).put({ ...meta, data: buf });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save model."));
  });
  db.close();
  return meta;
}

export async function listCustomModels(): Promise<CustomModelMeta[]> {
  const db = await openDb();
  const rows = await new Promise<Array<CustomModelMeta & { data: ArrayBuffer }>>((resolve, reject) => {
    const tx = db.transaction(CUSTOM_CAR_STORE, "readonly");
    const req = tx.objectStore(CUSTOM_CAR_STORE).getAll();
    req.onsuccess = () => resolve((req.result ?? []) as Array<CustomModelMeta & { data: ArrayBuffer }>);
    req.onerror = () => reject(req.error ?? new Error("Could not list models."));
  });
  db.close();
  return rows.map(({ data: _d, ...meta }) => meta).sort((a, b) => (b.date < a.date ? -1 : 1));
}

export async function loadCustomModelData(id: string): Promise<ArrayBuffer | null> {
  const db = await openDb();
  const row = await new Promise<{ data?: ArrayBuffer } | undefined>((resolve, reject) => {
    const tx = db.transaction(CUSTOM_CAR_STORE, "readonly");
    const req = tx.objectStore(CUSTOM_CAR_STORE).get(id);
    req.onsuccess = () => resolve(req.result as { data?: ArrayBuffer } | undefined);
    req.onerror = () => reject(req.error ?? new Error("Could not load model."));
  });
  db.close();
  return row?.data ?? null;
}

export async function deleteCustomModel(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CUSTOM_CAR_STORE, "readwrite");
    tx.objectStore(CUSTOM_CAR_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not delete model."));
  });
  db.close();
}

export function validateCustomFile(file: File): { ok: boolean; error?: string; warnOver20Mb?: boolean } {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".glb") && !lower.endsWith(".gltf")) {
    return { ok: false, error: "Only .glb / .gltf files are accepted. That file is not a GLB/GLTF model." };
  }
  if (file.size === 0) return { ok: false, error: "That file is empty (0 bytes)." };
  return { ok: true, warnOver20Mb: file.size > MAX_WARN_BYTES };
}

export async function parseGlb(data: ArrayBuffer): Promise<{ group: THREE.Group }> {
  const loader = new GLTFLoader();
  // GLTFLoader.parse with a copy: it does not retain the buffer after parsing.
  const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
    try {
      loader.parse(data.slice(0), "", (g) => resolve(g), (e) => reject(e instanceof Error ? e : new Error("Could not parse this GLB/GLTF file.")));
    } catch (e) {
      reject(e instanceof Error ? e : new Error("Could not parse this GLB/GLTF file."));
    }
  });
  return { group: gltf.scene };
}

export function detectWheelMeshes(group: THREE.Group): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const n = (m.name || "").toLowerCase();
    if (/(wheel|tire|tyre|rim|tire_|wheel_)/.test(n)) out.push(m);
  });
  return out;
}

export type NormalizedCustom = {
  group: THREE.Group;
  bodyMats: THREE.Material[];
  wheelPivots: THREE.Group[];
  spoiler: THREE.Object3D | null;
  hasWheels: boolean;
  meshCount: number;
};

/**
 * Auto-normalize a user model so it fits the game's physics chassis:
 * - longest horizontal axis -> ~4.3 m (the chassis box length)
 * - height clamped so the car is not a monster truck
 * - centered on X/Z, bottom (min Y) at ground y=0
 * - shadows on, materials kept (PBR preserved)
 * - wheel meshes (name contains wheel/tyre/rim) wrapped in spin pivots
 * - body materials collected for paint recolor: largest meshes + names
 *   containing body/paint/shell/car (excluding wheel/glass names)
 */
export function normalizeCustomModel(input: THREE.Group): NormalizedCustom {
  const group = input;
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  // If the model is long along X instead of Z, rotate so length lies along Z
  // (the game lays the car out along Z, nose +Z before the holder's PI turn).
  if (size.x > size.z) {
    group.rotation.y = Math.PI / 2;
    group.updateMatrixWorld(true);
    box.setFromObject(group);
    box.getSize(size);
    box.getCenter(center);
  }
  const longest = Math.max(size.x, size.z, 0.001);
  let scale = 4.3 / longest;
  const scaledHeight = size.y * scale;
  if (scaledHeight > 2.1) scale = (2.1 / Math.max(size.y, 0.001)) * (size.y > 0 ? 1 : 1);
  // Recompute after clamping height: apply combined scale.
  group.scale.setScalar(scale);
  group.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(group);
  const size2 = new THREE.Vector3();
  box2.getSize(size2);
  const center2 = new THREE.Vector3();
  box2.getCenter(center2);
  group.position.x -= center2.x;
  group.position.z -= center2.z;
  group.position.y -= box2.min.y; // ground-align: lowest point at y=0
  group.updateMatrixWorld(true);

  let meshCount = 0;
  const bodyMats: THREE.Material[] = [];
  const wheelPivots: THREE.Group[] = [];
  let spoiler: THREE.Object3D | null = null;
  const meshes: THREE.Mesh[] = [];
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    meshCount++;
    m.castShadow = true;
    m.receiveShadow = true;
    meshes.push(m);
    const n = (m.name || "").toLowerCase();
    if (n.includes("spoiler") || n.includes("wing")) spoiler = m;
  });
  // Wheel pivots: wrap each detected wheel mesh in a pivot at its centre so
  // the game loop can spin it around the axle (X) like the built-in wheels.
  const wheelMeshes = detectWheelMeshes(group);
  for (const wm of wheelMeshes) {
    const wBox = new THREE.Box3().setFromObject(wm);
    const wCenter = new THREE.Vector3();
    wBox.getCenter(wCenter);
    const pivot = new THREE.Group();
    pivot.position.copy(wCenter);
    const parent = wm.parent;
    if (!parent) continue;
    // Move mesh into pivot space: pivot sits at wheel centre in group space.
    // Convert world-ish position: pivot is a child of group, so use local coords.
    const local = group.worldToLocal(wCenter.clone());
    pivot.position.copy(local);
    parent.add(pivot);
    // Re-parent mesh preserving its world transform: store matrix, attach.
    const worldMatrix = wm.matrixWorld.clone();
    pivot.attach(wm);
    // After attach, wm keeps its world transform; now recenter pivot logic:
    // pivot.attach already preserved transform, so spinning pivot spins the wheel.
    void worldMatrix;
    wheelPivots.push(pivot);
  }
  // Body materials: largest meshes first (by bounding-box volume), skipping
  // wheels / glass / tyre / light materials so paint does not tint them.
  const scored = meshes
    .map((m) => {
      const b = new THREE.Box3().setFromObject(m);
      const s = new THREE.Vector3();
      b.getSize(s);
      return { m, vol: s.x * s.y * s.z, name: (m.name || "").toLowerCase() };
    })
    .sort((a, b) => b.vol - a.vol);
  const skip = /(wheel|tire|tyre|rim|glass|window|windshield|light|headlight|taillight|tail|tyre|tire|interior|seat|steer|dash)/;
  const bodyCandidates = scored.filter((s) => !skip.test(s.name));
  const namedBody = scored.filter((s) => /(body|paint|shell|chassis|car|hood|door|fender|bumper)/.test(s.name));
  const picked = (namedBody.length > 0 ? namedBody : bodyCandidates).slice(0, 4);
  const seen = new Set<THREE.Material>();
  for (const p of picked) {
    const matAny = p.m.material as unknown as THREE.Material | THREE.Material[];
    const mats = Array.isArray(matAny) ? matAny : [matAny];
    for (const mt of mats) {
      if (mt && !seen.has(mt as THREE.Material)) {
        seen.add(mt as THREE.Material);
        bodyMats.push(mt as THREE.Material);
      }
    }
  }
  // Fallback: if nothing was classified, use the single largest mesh's material.
  if (bodyMats.length === 0 && scored.length > 0) {
    const matAny0 = scored[0].m.material as unknown as THREE.Material | THREE.Material[];
    const mats = Array.isArray(matAny0) ? matAny0 : [matAny0];
    for (const mt of mats) if (mt) bodyMats.push(mt as THREE.Material);
  }
  return { group, bodyMats, wheelPivots, spoiler, hasWheels: wheelMeshes.length > 0, meshCount };
}

export function applyPaintToCustomMats(mats: THREE.Material[], color: string) {
  for (const mt of mats) {
    const m = mt as THREE.MeshStandardMaterial & { color?: THREE.Color; emissive?: THREE.Color };
    if (m && m.color && typeof (m.color as THREE.Color).set === "function") {
      (m.color as THREE.Color).set(color);
    }
  }
}
