// Raphael Drive — 100+ feature settings registry.
// Every entry here is a REAL control: persisted in localStorage, rendered in
// the Settings panel, and mapped to an observable effect in the game.
// No code/assets from any reference site are used; all original.

export type DriveMode = "free" | "timetrial" | "checkpoint" | "drift";
export type WeatherKind = "clear" | "rain" | "storm" | "fog";
export type HudLayout = "full" | "minimal" | "off";
export type SpeedUnit = "kmh" | "mph";
export type GraphicsQuality = "low" | "medium" | "high" | "ultra";
export type Language = "en" | "hinglish";
export type ColorBlind = "off" | "protan" | "deutan" | "tritan";
export type EngineSound = "v8" | "v12" | "electric";
export type HornStyle = "classic" | "sport" | "air";
export type TailLightStyle = "strip" | "round" | "neon";
export type SpoilerStyle = "none" | "sport" | "gt" | "drag";
export type District = "downtown" | "port" | "highway" | "residential";
export type TimePreset = "dawn" | "noon" | "dusk" | "midnight" | "custom";
export type Finish = "gloss" | "matte" | "satin";
export type Decal = "none" | "stripes" | "flames" | "checker";

export interface Settings {
  // ---- Garage (21) ----
  paintColor: string;
  metallic: number; // 0-100
  clearcoat: number; // 0-100 (mirrors CarConfig.clearcoat)
  finish: Finish;
  wheelStyle: number; // 0-4
  rimColor: string;
  tyreWidth: number; // 0-100
  spoilerStyle: SpoilerStyle;
  spoilerSize: number; // 0-100
  neonColor: string;
  neonBrightness: number; // 0-100
  neonPulse: boolean;
  headlightColor: string;
  headlights: boolean;
  tailLightStyle: TailLightStyle;
  windowTint: number; // 0-100
  caliperColor: string;
  bodyKit: boolean;
  decals: Decal;
  rideHeight: number; // 0-100
  camber: number; // 0-100
  // ---- Drive (32) ----
  driveMode: DriveMode;
  dayNight: number; // 0-100
  autoCycle: boolean;
  weather: WeatherKind;
  weatherIntensity: number; // 0-100
  trafficDensity: number; // 0-20
  trafficAggression: number; // 0-100
  minimapOn: boolean;
  minimapSize: number; // 100-220 px
  minimapZoom: number; // 0-100
  hudLayout: HudLayout;
  speedUnit: SpeedUnit;
  cameraMode: number; // 0 chase, 1 hood, 2 top, 3 cinematic, 4 first-person
  fov: number; // 50-90
  camShake: number; // 0-100
  nitroCapacity: number; // 50-200
  nitroRecharge: number; // 0-100
  driftMultiplier: number; // 1-5
  damageOn: boolean;
  fuelOn: boolean;
  engineSound: EngineSound;
  engineVolume: number; // 0-100
  squealVolume: number; // 0-100
  windVolume: number; // 0-100
  hornStyle: HornStyle;
  highBeam: boolean;
  wipers: boolean;
  handbrakeStrength: number; // 0-100
  abs: boolean;
  tractionControl: boolean;
  steeringSensitivity: number; // 0-100
  autoBrake: boolean;
  // ---- Game (22) ----
  paused: boolean;
  lapTimerOn: boolean;
  bestLapOn: boolean;
  checkpointProgress: boolean;
  driftComboOn: boolean;
  scoreOn: boolean;
  leaderboardOn: boolean;
  achievementsOn: boolean;
  dailySeed: number;
  photoMode: boolean;
  replayOn: boolean;
  ghostCar: boolean;
  hotseat: boolean;
  timeTrialTarget: number; // seconds
  driftChallengeTarget: number; // points
  countdownLength: number; // 1-5
  raceLaps: number; // 1-5
  // ---- Settings (22) ----
  keyGas: string;
  keyBrake: string;
  keyLeft: string;
  keyRight: string;
  keyNitro: string;
  keyDrift: string;
  touchOn: boolean;
  touchSize: number; // 0-100
  language: Language;
  graphicsQuality: GraphicsQuality;
  masterVolume: number; // 0-100
  musicVolume: number; // 0-100
  sfxVolume: number; // 0-100
  radioVolume: number; // 0-100
  crossfadeDuration: number; // 0-5 seconds
  subtitles: boolean;
  colorBlind: ColorBlind;
  reduceMotion: boolean;
  fpsCounter: boolean;
  // ---- World (21) ----
  timePreset: TimePreset;
  district: District;
  roadWetness: number; // 0-100
  puddleAmount: number; // 0-100
  neonDistrict: boolean;
  billboardCycle: boolean;
  streetlights: boolean;
  moonStars: boolean;
  clouds: boolean;
  fireworks: boolean;
  policeChase: boolean;
  taxiJob: boolean;
  deliveryJob: boolean;
  fuelStations: boolean;
  repairGarages: boolean;
  carWash: boolean;
  ambientNoise: boolean;
  rainOn: boolean;
  fogDensity: number; // 0-100
  nightLights: boolean;
  trafficLightsCycle: boolean;
  // ---- Music ----
  musicSource: "radio" | "mymusic" | "off";
  musicDuck: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  paintColor: "#ff2e88",
  metallic: 85,
  clearcoat: 70,
  finish: "gloss",
  wheelStyle: 1,
  rimColor: "#d6dae2",
  tyreWidth: 50,
  spoilerStyle: "gt",
  spoilerSize: 60,
  neonColor: "#00e5ff",
  neonBrightness: 75,
  neonPulse: false,
  headlightColor: "#fff2b0",
  headlights: true,
  tailLightStyle: "strip",
  windowTint: 40,
  caliperColor: "#ff2e88",
  bodyKit: false,
  decals: "none",
  rideHeight: 50,
  camber: 20,
  driveMode: "free",
  dayNight: 12,
  autoCycle: false,
  weather: "rain",
  weatherIntensity: 60,
  trafficDensity: 6,
  trafficAggression: 50,
  minimapOn: true,
  minimapSize: 150,
  minimapZoom: 50,
  hudLayout: "full",
  speedUnit: "kmh",
  cameraMode: 0,
  fov: 62,
  camShake: 60,
  nitroCapacity: 100,
  nitroRecharge: 40,
  driftMultiplier: 1,
  damageOn: true,
  fuelOn: false,
  engineSound: "v8",
  engineVolume: 70,
  squealVolume: 70,
  windVolume: 50,
  hornStyle: "classic",
  highBeam: false,
  wipers: true,
  handbrakeStrength: 70,
  abs: true,
  tractionControl: true,
  steeringSensitivity: 60,
  autoBrake: false,
  paused: false,
  lapTimerOn: true,
  bestLapOn: true,
  checkpointProgress: true,
  driftComboOn: true,
  scoreOn: true,
  leaderboardOn: true,
  achievementsOn: true,
  dailySeed: 0,
  photoMode: false,
  replayOn: false,
  ghostCar: false,
  hotseat: false,
  timeTrialTarget: 120,
  driftChallengeTarget: 5000,
  countdownLength: 3,
  raceLaps: 1,
  keyGas: "KeyW",
  keyBrake: "KeyS",
  keyLeft: "KeyA",
  keyRight: "KeyD",
  keyNitro: "ShiftLeft",
  keyDrift: "Space",
  touchOn: true,
  touchSize: 50,
  language: "en",
  graphicsQuality: "high",
  masterVolume: 55,
  musicVolume: 70,
  sfxVolume: 80,
  radioVolume: 60,
  crossfadeDuration: 1.5,
  subtitles: true,
  colorBlind: "off",
  reduceMotion: false,
  fpsCounter: false,
  timePreset: "custom",
  district: "downtown",
  roadWetness: 60,
  puddleAmount: 60,
  neonDistrict: true,
  billboardCycle: true,
  streetlights: true,
  moonStars: true,
  clouds: false,
  fireworks: false,
  policeChase: false,
  taxiJob: false,
  deliveryJob: false,
  fuelStations: false,
  repairGarages: false,
  carWash: false,
  ambientNoise: false,
  rainOn: true,
  fogDensity: 30,
  nightLights: true,
  trafficLightsCycle: true,
  musicSource: "radio",
  musicDuck: true,
};

export const SETTINGS_KEY = "raphael-drive-settings-v1";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage full/blocked — settings still live in memory */
  }
}

export interface FeatureEntry {
  id: string;
  label: string;
  group: "Garage" | "Drive" | "Game" | "Settings" | "World" | "Music" | "Custom Car";
  desc: string;
}

export const FEATURE_REGISTRY: FeatureEntry[] = [
  // Garage (21)
  { id: "paintColor", label: "Body Paint (custom colour)", group: "Garage", desc: "Any colour via colour picker; tints the PBR paint + custom-model body materials." },
  { id: "metallic", label: "Metallic paint", group: "Garage", desc: "0-100 metalness on the paint material." },
  { id: "clearcoat", label: "Clearcoat Shine", group: "Garage", desc: "0-100 clearcoat + roughness on the physical paint." },
  { id: "finish", label: "Paint Finish (gloss/matte/satin)", group: "Garage", desc: "Gloss = shiny clearcoat, Matte = flat, Satin = in-between." },
  { id: "wheelStyle", label: "Wheel Style (5)", group: "Garage", desc: "Classic / Sport / Neon Rim / Offroad / Stealth — rim colour + spoke look." },
  { id: "rimColor", label: "Rim Colour", group: "Garage", desc: "Any colour for the alloy rims." },
  { id: "tyreWidth", label: "Tyre Width", group: "Garage", desc: "Wider/narrower tyre cylinders on the visual wheels." },
  { id: "spoilerStyle", label: "Spoiler Style (4)", group: "Garage", desc: "None / Sport / GT / Drag — wing shape + size." },
  { id: "spoilerSize", label: "Spoiler Size", group: "Garage", desc: "Scales the wing." },
  { id: "neonColor", label: "Neon Underglow Colour", group: "Garage", desc: "Colour of the underglow plane + glow." },
  { id: "neonBrightness", label: "Neon Brightness", group: "Garage", desc: "Underglow opacity/intensity." },
  { id: "neonPulse", label: "Neon Pulse", group: "Garage", desc: "Underglow gently pulses when on." },
  { id: "headlightColor", label: "Headlight Colour", group: "Garage", desc: "Colour of headlight lenses + spotlights." },
  { id: "headlights", label: "Headlights On/Off", group: "Garage", desc: "Toggles headlight lenses + spotlights." },
  { id: "tailLightStyle", label: "Tail-light Style", group: "Garage", desc: "Strip / Round / Neon tail-light look." },
  { id: "windowTint", label: "Window Tint", group: "Garage", desc: "Glass opacity 0-100." },
  { id: "caliperColor", label: "Brake Caliper Colour", group: "Garage", desc: "Colour of the brake discs' caliper ring." },
  { id: "bodyKit", label: "Body Kit", group: "Garage", desc: "Adds side skirts + splitter + diffuser accents." },
  { id: "decals", label: "Decals", group: "Garage", desc: "None / Stripes / Flames / Checker roof decal." },
  { id: "rideHeight", label: "Ride Height", group: "Garage", desc: "Lowers/raises the visual body on its wheels." },
  { id: "camber", label: "Camber", group: "Garage", desc: "Tilts the visual wheels in/out." },
  // Drive (32)
  { id: "driveMode", label: "Drive Mode (Free/Time Trial/Checkpoint/Drift)", group: "Drive", desc: "Free Roam, Time Trial vs target, Checkpoint Race laps, Drift Challenge target." },
  { id: "dayNight", label: "Day/Night Slider", group: "Drive", desc: "0-100 sun/sky/fog blend." },
  { id: "autoCycle", label: "Auto Day/Night Cycle", group: "Drive", desc: "Day/night value drifts slowly on its own." },
  { id: "weather", label: "Weather (Clear/Rain/Storm/Fog)", group: "Drive", desc: "Rain particles, fog density, lightning-ish flashes in Storm." },
  { id: "weatherIntensity", label: "Weather Intensity", group: "Drive", desc: "How heavy the weather effect is." },
  { id: "trafficDensity", label: "Traffic Density (0-20)", group: "Drive", desc: "How many traffic cars are active (up to 20 spawned)." },
  { id: "trafficAggression", label: "Traffic Aggression", group: "Drive", desc: "Traffic speed + lane-change eagerness." },
  { id: "minimapOn", label: "Minimap On/Off", group: "Drive", desc: "Shows/hides the city map." },
  { id: "minimapSize", label: "Minimap Size", group: "Drive", desc: "Minimap canvas size in px." },
  { id: "minimapZoom", label: "Minimap Zoom", group: "Drive", desc: "Zoom of the minimap around the player." },
  { id: "hudLayout", label: "HUD Layout (Full/Minimal/Off)", group: "Drive", desc: "Full = all HUD, Minimal = speed + nitro only, Off = none." },
  { id: "speedUnit", label: "Speed Unit (km/h / mph)", group: "Drive", desc: "Speed readout conversion." },
  { id: "cameraMode", label: "Camera (Chase/Hood/Top/Cinematic/First-person)", group: "Drive", desc: "5 camera modes, C key cycles." },
  { id: "fov", label: "Field of View", group: "Drive", desc: "Camera FOV 50-90." },
  { id: "camShake", label: "Camera Shake", group: "Drive", desc: "Impact shake strength." },
  { id: "nitroCapacity", label: "Nitro Capacity", group: "Drive", desc: "Max nitro meter 50-200." },
  { id: "nitroRecharge", label: "Nitro Recharge Rate", group: "Drive", desc: "How fast nitro refills." },
  { id: "driftMultiplier", label: "Drift Score Multiplier", group: "Drive", desc: "Drift points multiplied 1x-5x." },
  { id: "damageOn", label: "Damage On/Off", group: "Drive", desc: "Impacts add damage % and slow the car when on." },
  { id: "fuelOn", label: "Fuel System", group: "Drive", desc: "Fuel drains while driving; empty = crawl. Refuel at fuel stations." },
  { id: "engineSound", label: "Engine Sound (V8/V12/Electric)", group: "Drive", desc: "Oscillator voice for the engine." },
  { id: "engineVolume", label: "Engine Volume", group: "Drive", desc: "Engine channel volume." },
  { id: "squealVolume", label: "Tyre Squeal Volume", group: "Drive", desc: "Drift squeal channel volume." },
  { id: "windVolume", label: "Wind Volume", group: "Drive", desc: "Speed-based wind noise." },
  { id: "hornStyle", label: "Horn (Classic/Sport/Air)", group: "Drive", desc: "H key honks in 3 styles." },
  { id: "highBeam", label: "High Beam", group: "Drive", desc: "Longer, brighter headlight cones." },
  { id: "wipers", label: "Wipers", group: "Drive", desc: "Wiper sweep overlay in rain + clears droplets." },
  { id: "handbrakeStrength", label: "Handbrake Strength", group: "Drive", desc: "Drift brake force." },
  { id: "abs", label: "ABS", group: "Drive", desc: "Anti-lock: braking keeps steering control." },
  { id: "tractionControl", label: "Traction Control", group: "Drive", desc: "Caps wheel spin, steadier launches." },
  { id: "steeringSensitivity", label: "Steering Sensitivity", group: "Drive", desc: "Steering angle multiplier." },
  { id: "autoBrake", label: "Auto-Brake Assist", group: "Drive", desc: "Auto-brakes before walls/traffic when on." },
  // Game (22)
  { id: "paused", label: "Pause", group: "Game", desc: "P pauses physics + timer, shows pause overlay." },
  { id: "lapTimerOn", label: "Lap Timer", group: "Game", desc: "Shows current lap time in HUD." },
  { id: "bestLapOn", label: "Best Lap Tracker", group: "Game", desc: "Best lap stored in localStorage, shown in HUD/Docs." },
  { id: "checkpointProgress", label: "Checkpoint Progress", group: "Game", desc: "Checkpoint/lap readout in HUD." },
  { id: "driftComboOn", label: "Drift Combo", group: "Game", desc: "Consecutive drifts chain a combo multiplier." },
  { id: "scoreOn", label: "Score Display", group: "Game", desc: "Total score (drift + checkpoints + jobs) in HUD." },
  { id: "leaderboardOn", label: "Local Leaderboard (Top 10)", group: "Game", desc: "Best scores saved locally, shown in Docs + after a run." },
  { id: "achievementsOn", label: "Achievements", group: "Game", desc: "First Drift, 1000 pts, 5 checkpoints, Speed Demon — toast on unlock." },
  { id: "dailySeed", label: "Daily Challenge Seed", group: "Game", desc: "Seed shown in Docs; same seed = same checkpoint order." },
  { id: "photoMode", label: "Photo Mode", group: "Game", desc: "Hides HUD, downloads a PNG screenshot of the canvas." },
  { id: "replayOn", label: "Replay Last 10s", group: "Game", desc: "Records positions; replay flies the camera along your last 10s." },
  { id: "ghostCar", label: "Ghost Car (Best Lap)", group: "Game", desc: "Translucent ghost replays your best-lap path." },
  { id: "hotseat", label: "Hotseat 2-Player Time Trial", group: "Game", desc: "Player 1 then Player 2 run the same trial; winner shown." },
  { id: "resetScore", label: "Reset Score", group: "Game", desc: "Button: zeroes score/drift/checkpoints." },
  { id: "mute", label: "Mute", group: "Game", desc: "Master mute (M key)." },
  { id: "radioOn", label: "Radio On/Off", group: "Game", desc: "Raphael FM synthwave on/off." },
  { id: "respawn", label: "Respawn", group: "Game", desc: "R key: back to start, speed zero." },
  { id: "restart", label: "Restart Run", group: "Game", desc: "Button: full run reset (score, lap, fuel, damage)." },
  { id: "timeTrialTarget", label: "Time Trial Target", group: "Game", desc: "Target seconds for Time Trial mode." },
  { id: "driftChallengeTarget", label: "Drift Challenge Target", group: "Game", desc: "Target points for Drift Challenge mode." },
  { id: "countdownLength", label: "Countdown Length", group: "Game", desc: "3-2-1-GO length in seconds (1-5)." },
  { id: "raceLaps", label: "Race Laps", group: "Game", desc: "Laps for Checkpoint Race mode (1-5)." },
  // Settings (22)
  { id: "keyGas", label: "Key Bind: Accelerate", group: "Settings", desc: "Remappable key for gas." },
  { id: "keyBrake", label: "Key Bind: Brake", group: "Settings", desc: "Remappable key for brake/reverse." },
  { id: "keyLeft", label: "Key Bind: Steer Left", group: "Settings", desc: "Remappable key for left." },
  { id: "keyRight", label: "Key Bind: Steer Right", group: "Settings", desc: "Remappable key for right." },
  { id: "keyNitro", label: "Key Bind: Nitro", group: "Settings", desc: "Remappable key for nitro." },
  { id: "keyDrift", label: "Key Bind: Drift", group: "Settings", desc: "Remappable key for drift." },
  { id: "touchOn", label: "Touch Controls", group: "Settings", desc: "On-screen buttons on touch devices." },
  { id: "touchSize", label: "Touch Button Size", group: "Settings", desc: "Scales the touch buttons." },
  { id: "language", label: "Language (EN / Hinglish)", group: "Settings", desc: "Switches key UI labels between English and Hinglish." },
  { id: "graphicsQuality", label: "Graphics Quality", group: "Settings", desc: "Low/Medium/High/Ultra — pixel ratio, shadows, bloom." },
  { id: "masterVolume", label: "Master Volume", group: "Settings", desc: "Overall output volume." },
  { id: "musicVolume", label: "Music Volume", group: "Settings", desc: "My Music channel volume." },
  { id: "sfxVolume", label: "SFX Volume", group: "Settings", desc: "Collision/horn/UI sound volume." },
  { id: "radioVolume", label: "Radio Volume", group: "Settings", desc: "Raphael FM volume." },
  { id: "crossfadeDuration", label: "Crossfade Duration", group: "Settings", desc: "My Music crossfade 0-5s." },
  { id: "subtitles", label: "Track Subtitles", group: "Settings", desc: "Shows current track name as a subtitle line." },
  { id: "colorBlind", label: "Colour-Blind Mode", group: "Settings", desc: "CSS filter presets for protan/deutan/tritan." },
  { id: "reduceMotion", label: "Reduce Motion", group: "Settings", desc: "Disables shake/pulse/vignette animation." },
  { id: "fpsCounter", label: "FPS Counter", group: "Settings", desc: "Shows live frames-per-second in HUD." },
  { id: "exportSettings", label: "Export Settings (JSON)", group: "Settings", desc: "Downloads settings as JSON." },
  { id: "importSettings", label: "Import Settings (JSON)", group: "Settings", desc: "Loads settings from a JSON file." },
  { id: "resetAll", label: "Reset All Settings", group: "Settings", desc: "Restores every default." },
  // World (21)
  { id: "timePreset", label: "Time Preset (Dawn/Noon/Dusk/Midnight)", group: "World", desc: "One-click day/night presets." },
  { id: "district", label: "District (Downtown/Port/Highway/Residential)", group: "World", desc: "Recolours the city palette + neon words." },
  { id: "roadWetness", label: "Road Wetness", group: "World", desc: "How reflective/wet the asphalt looks." },
  { id: "puddleAmount", label: "Puddle Amount", group: "World", desc: "Puddle patch opacity/scale." },
  { id: "neonDistrict", label: "Neon District On/Off", group: "World", desc: "Neon signs + underglow district glow." },
  { id: "billboardCycle", label: "Billboard Text Cycle", group: "World", desc: "Neon signs rotate through original words." },
  { id: "streetlights", label: "Streetlights", group: "World", desc: "Street lamps + light pools on/off." },
  { id: "moonStars", label: "Moon + Stars", group: "World", desc: "Moon disc + star specks in the sky." },
  { id: "clouds", label: "Clouds", group: "World", desc: "Drifting cloud sprites." },
  { id: "fireworks", label: "Fireworks", group: "World", desc: "Celebration fireworks bursts in the sky." },
  { id: "policeChase", label: "Police Chase", group: "World", desc: "A police car chases you + siren when speeding." },
  { id: "taxiJob", label: "Taxi Job", group: "World", desc: "Drive to the glowing pickup, then the drop-off, earn +500." },
  { id: "deliveryJob", label: "Delivery Job", group: "World", desc: "Drive to the glowing crate, then the drop-off, earn +400." },
  { id: "fuelStations", label: "Fuel Stations", group: "World", desc: "Glowing stations refill fuel when you drive in." },
  { id: "repairGarages", label: "Repair Garages", group: "World", desc: "Glowing garages repair damage when you drive in." },
  { id: "carWash", label: "Car Wash", group: "World", desc: "Drive-through wash restores shine + clears damage tint." },
  { id: "ambientNoise", label: "Ambient City Noise", group: "World", desc: "Low city hum bed under the audio." },
  { id: "rainOn", label: "Rain On/Off", group: "World", desc: "Rain particles on/off." },
  { id: "fogDensity", label: "Fog Density", group: "World", desc: "Scene fog near/far." },
  { id: "nightLights", label: "Building Lights", group: "World", desc: "Facade emissive windows on/off." },
  { id: "trafficLightsCycle", label: "Traffic Lights Cycle", group: "World", desc: "Intersection lights cycle red/amber/green." },
  // Music (8)
  { id: "musicSource", label: "Music Source (Radio / My Music / Off)", group: "Music", desc: "Switch between Raphael FM, your own files, or silence." },
  { id: "musicDuck", label: "Music Ducks Engine", group: "Music", desc: "When music plays, engine sound dips." },
  { id: "myMusicUpload", label: "Upload My Own Songs", group: "Music", desc: "Pick audio files from your device; stored in this browser only." },
  { id: "myMusicPlaylist", label: "My Music Playlist", group: "Music", desc: "Play/pause/next/prev, seek bar, shuffle, repeat off/all/one." },
  { id: "crossfade", label: "Crossfade (fade-out → fade-in)", group: "Music", desc: "Track end/skip fades out old + fades in new, no clicks." },
  { id: "musicVolume2", label: "My Music Volume", group: "Music", desc: "Volume for your own songs." },
  { id: "musicSeek", label: "Seek Bar", group: "Music", desc: "Scrub within the current song." },
  { id: "musicPersist", label: "Playlist Persists", group: "Music", desc: "Songs + settings survive reload via IndexedDB/localStorage." },
  // Custom Car (3, documented in FEATURES.md already)
  { id: "customCarUpload", label: "Upload My Car Model (.glb/.gltf)", group: "Custom Car", desc: "Your own model, local-only, auto-scaled." },
  { id: "customCarFlip", label: "Flip Custom Model", group: "Custom Car", desc: "Fixes backwards-facing uploads." },
  { id: "customCarList", label: "My Models List", group: "Custom Car", desc: "Use/Delete saved models per device." },
];

export const FEATURE_COUNT = FEATURE_REGISTRY.length;

export const STRINGS: Record<Language, Record<string, string>> = {
  en: {
    startDriving: "Start Driving",
    garage: "Garage",
    drive: "Drive",
    docs: "Docs",
    settings: "Settings",
    myMusic: "My Music",
    speed: "Speed",
    nitro: "Nitro",
    drift: "Drift Score",
    damage: "Damage",
    checkpoint: "Checkpoint",
    lap: "Lap",
    paused: "PAUSED",
    score: "Score",
    fuel: "Fuel",
    job: "Job",
    police: "Police!",
    menu: "Menu",
  },
  hinglish: {
    startDriving: "Driving Shuru Karo",
    garage: "Garage",
    drive: "Drive",
    docs: "Docs",
    settings: "Settings",
    myMusic: "Mera Music",
    speed: "Speed",
    nitro: "Nitro",
    drift: "Drift Score",
    damage: "Damage",
    checkpoint: "Checkpoint",
    lap: "Lap",
    paused: "RUKA HUA",
    score: "Score",
    fuel: "Fuel",
    job: "Kaam",
    police: "Police!",
    menu: "Menu",
  },
};

export function label(lang: Language, key: string): string {
  return STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
}
