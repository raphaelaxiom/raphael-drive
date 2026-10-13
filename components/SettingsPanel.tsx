"use client";
import type { Settings } from "@/lib/settings";

type Props = {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onAction: (action: "resetScore" | "restart" | "respawn" | "export" | "resetAll" | "photo" | "replay") => void;
  onImportFile: (file: File) => void;
};

function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="rd-field">
      <label>{label}</label>
      {children}
      {hint && <p className="rd-note">{hint}</p>}
    </div>
  );
}

function Num({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ flex: 1 }} />
      <span style={{ fontSize: 12, minWidth: 34, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function Sel<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div className="rd-seg">
      {options.map((o) => (
        <button key={o} className={value === o ? "active" : ""} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

function Tog({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="rd-toggle">{label} <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} /></label>
  );
}

const KEY_OPTS = ["KeyW", "KeyS", "KeyA", "KeyD", "KeyQ", "KeyE", "KeyR", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "KeyI", "KeyO", "KeyP", "KeyU", "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "ShiftLeft", "ShiftRight", "ControlLeft", "Tab"];

export default function SettingsPanel({ settings: s, onChange, onAction, onImportFile }: Props) {
  return (
    <div>
      <h3 className="font-display" style={{ fontSize: 14, letterSpacing: ".2em" }}>GARAGE</h3>
      <Row label="Body Paint"><input type="color" value={s.paintColor} onChange={(e) => onChange({ paintColor: e.target.value })} /></Row>
      <Row label={`Metallic ${s.metallic}`}><Num value={s.metallic} min={0} max={100} onChange={(v) => onChange({ metallic: v })} /></Row>
      <Row label={`Clearcoat ${s.clearcoat}`}><Num value={s.clearcoat} min={0} max={100} onChange={(v) => onChange({ clearcoat: v })} /></Row>
      <Row label="Finish"><Sel value={s.finish} options={["gloss", "matte", "satin"] as const} onChange={(v) => onChange({ finish: v })} /></Row>
      <Row label={`Wheel Style ${s.wheelStyle + 1} / 5`}><Num value={s.wheelStyle} min={0} max={4} onChange={(v) => onChange({ wheelStyle: v })} /></Row>
      <Row label="Rim Colour"><input type="color" value={s.rimColor} onChange={(e) => onChange({ rimColor: e.target.value })} /></Row>
      <Row label={`Tyre Width ${s.tyreWidth}`}><Num value={s.tyreWidth} min={0} max={100} onChange={(v) => onChange({ tyreWidth: v })} /></Row>
      <Row label="Spoiler Style"><Sel value={s.spoilerStyle} options={["none", "sport", "gt", "drag"] as const} onChange={(v) => onChange({ spoilerStyle: v })} /></Row>
      <Row label={`Spoiler Size ${s.spoilerSize}`}><Num value={s.spoilerSize} min={0} max={100} onChange={(v) => onChange({ spoilerSize: v })} /></Row>
      <Row label="Neon Colour"><input type="color" value={s.neonColor} onChange={(e) => onChange({ neonColor: e.target.value })} /></Row>
      <Row label={`Neon Brightness ${s.neonBrightness}`}><Num value={s.neonBrightness} min={0} max={100} onChange={(v) => onChange({ neonBrightness: v })} /></Row>
      <Tog label="Neon Pulse" value={s.neonPulse} onChange={(v) => onChange({ neonPulse: v })} />
      <Row label="Headlight Colour"><input type="color" value={s.headlightColor} onChange={(e) => onChange({ headlightColor: e.target.value })} /></Row>
      <Tog label="Headlights" value={s.headlights} onChange={(v) => onChange({ headlights: v })} />
      <Row label="Tail-light Style"><Sel value={s.tailLightStyle} options={["strip", "round", "neon"] as const} onChange={(v) => onChange({ tailLightStyle: v })} /></Row>
      <Row label={`Window Tint ${s.windowTint}`}><Num value={s.windowTint} min={0} max={100} onChange={(v) => onChange({ windowTint: v })} /></Row>
      <Row label="Brake Caliper Colour"><input type="color" value={s.caliperColor} onChange={(e) => onChange({ caliperColor: e.target.value })} /></Row>
      <Tog label="Body Kit" value={s.bodyKit} onChange={(v) => onChange({ bodyKit: v })} />
      <Row label="Decals"><Sel value={s.decals} options={["none", "stripes", "flames", "checker"] as const} onChange={(v) => onChange({ decals: v })} /></Row>
      <Row label={`Ride Height ${s.rideHeight}`}><Num value={s.rideHeight} min={0} max={100} onChange={(v) => onChange({ rideHeight: v })} /></Row>
      <Row label={`Camber ${s.camber}`}><Num value={s.camber} min={0} max={100} onChange={(v) => onChange({ camber: v })} /></Row>

      <h3 className="font-display" style={{ fontSize: 14, letterSpacing: ".2em", marginTop: 18 }}>DRIVE</h3>
      <Row label="Drive Mode"><Sel value={s.driveMode} options={["free", "timetrial", "checkpoint", "drift"] as const} onChange={(v) => onChange({ driveMode: v })} /></Row>
      <Row label={`Day / Night ${s.dayNight}`}><Num value={s.dayNight} min={0} max={100} onChange={(v) => onChange({ dayNight: v, timePreset: "custom" })} /></Row>
      <Tog label="Auto Day/Night Cycle" value={s.autoCycle} onChange={(v) => onChange({ autoCycle: v })} />
      <Row label="Weather"><Sel value={s.weather} options={["clear", "rain", "storm", "fog"] as const} onChange={(v) => onChange({ weather: v })} /></Row>
      <Row label={`Weather Intensity ${s.weatherIntensity}`}><Num value={s.weatherIntensity} min={0} max={100} onChange={(v) => onChange({ weatherIntensity: v })} /></Row>
      <Row label={`Traffic Density ${s.trafficDensity}`}><Num value={s.trafficDensity} min={0} max={20} onChange={(v) => onChange({ trafficDensity: v })} /></Row>
      <Row label={`Traffic Aggression ${s.trafficAggression}`}><Num value={s.trafficAggression} min={0} max={100} onChange={(v) => onChange({ trafficAggression: v })} /></Row>
      <Tog label="Minimap" value={s.minimapOn} onChange={(v) => onChange({ minimapOn: v })} />
      <Row label={`Minimap Size ${s.minimapSize}px`}><Num value={s.minimapSize} min={100} max={220} onChange={(v) => onChange({ minimapSize: v })} /></Row>
      <Row label={`Minimap Zoom ${s.minimapZoom}`}><Num value={s.minimapZoom} min={0} max={100} onChange={(v) => onChange({ minimapZoom: v })} /></Row>
      <Row label="HUD Layout"><Sel value={s.hudLayout} options={["full", "minimal", "off"] as const} onChange={(v) => onChange({ hudLayout: v })} /></Row>
      <Row label="Speed Unit"><Sel value={s.speedUnit} options={["kmh", "mph"] as const} onChange={(v) => onChange({ speedUnit: v })} /></Row>
      <Row label={`Camera ${s.cameraMode + 1} / 5 (0=Chase 1=Hood 2=Top 3=Cinematic 4=First)`}><Num value={s.cameraMode} min={0} max={4} onChange={(v) => onChange({ cameraMode: v })} /></Row>
      <Row label={`Field of View ${s.fov}`}><Num value={s.fov} min={50} max={90} onChange={(v) => onChange({ fov: v })} /></Row>
      <Row label={`Camera Shake ${s.camShake}`}><Num value={s.camShake} min={0} max={100} onChange={(v) => onChange({ camShake: v })} /></Row>
      <Row label={`Nitro Capacity ${s.nitroCapacity}`}><Num value={s.nitroCapacity} min={50} max={200} onChange={(v) => onChange({ nitroCapacity: v })} /></Row>
      <Row label={`Nitro Recharge ${s.nitroRecharge}`}><Num value={s.nitroRecharge} min={0} max={100} onChange={(v) => onChange({ nitroRecharge: v })} /></Row>
      <Row label={`Drift Multiplier ${s.driftMultiplier}x`}><Num value={s.driftMultiplier} min={1} max={5} onChange={(v) => onChange({ driftMultiplier: v })} /></Row>
      <Tog label="Damage" value={s.damageOn} onChange={(v) => onChange({ damageOn: v })} />
      <Tog label="Fuel System" value={s.fuelOn} onChange={(v) => onChange({ fuelOn: v })} />
      <Row label="Engine Sound"><Sel value={s.engineSound} options={["v8", "v12", "electric"] as const} onChange={(v) => onChange({ engineSound: v })} /></Row>
      <Row label={`Engine Volume ${s.engineVolume}`}><Num value={s.engineVolume} min={0} max={100} onChange={(v) => onChange({ engineVolume: v })} /></Row>
      <Row label={`Tyre Squeal ${s.squealVolume}`}><Num value={s.squealVolume} min={0} max={100} onChange={(v) => onChange({ squealVolume: v })} /></Row>
      <Row label={`Wind Volume ${s.windVolume}`}><Num value={s.windVolume} min={0} max={100} onChange={(v) => onChange({ windVolume: v })} /></Row>
      <Row label="Horn Style"><Sel value={s.hornStyle} options={["classic", "sport", "air"] as const} onChange={(v) => onChange({ hornStyle: v })} /></Row>
      <Tog label="High Beam" value={s.highBeam} onChange={(v) => onChange({ highBeam: v })} />
      <Tog label="Wipers" value={s.wipers} onChange={(v) => onChange({ wipers: v })} />
      <Row label={`Handbrake Strength ${s.handbrakeStrength}`}><Num value={s.handbrakeStrength} min={0} max={100} onChange={(v) => onChange({ handbrakeStrength: v })} /></Row>
      <Tog label="ABS" value={s.abs} onChange={(v) => onChange({ abs: v })} />
      <Tog label="Traction Control" value={s.tractionControl} onChange={(v) => onChange({ tractionControl: v })} />
      <Row label={`Steering Sensitivity ${s.steeringSensitivity}`}><Num value={s.steeringSensitivity} min={0} max={100} onChange={(v) => onChange({ steeringSensitivity: v })} /></Row>
      <Tog label="Auto-Brake Assist" value={s.autoBrake} onChange={(v) => onChange({ autoBrake: v })} />

      <h3 className="font-display" style={{ fontSize: 14, letterSpacing: ".2em", marginTop: 18 }}>GAME</h3>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <button className="btn btn-ghost" onClick={() => onAction("respawn")}>Respawn</button>
        <button className="btn btn-ghost" onClick={() => onAction("restart")}>Restart Run</button>
        <button className="btn btn-ghost" onClick={() => onAction("resetScore")}>Reset Score</button>
        <button className="btn btn-cyan" onClick={() => onAction("photo")}>Photo Mode (PNG)</button>
        <button className="btn btn-cyan" onClick={() => onAction("replay")}>Replay Last 10s</button>
      </div>
      <Tog label="Pause (P)" value={s.paused} onChange={(v) => onChange({ paused: v })} />
      <Tog label="Lap Timer" value={s.lapTimerOn} onChange={(v) => onChange({ lapTimerOn: v })} />
      <Tog label="Best Lap Tracker" value={s.bestLapOn} onChange={(v) => onChange({ bestLapOn: v })} />
      <Tog label="Checkpoint Progress" value={s.checkpointProgress} onChange={(v) => onChange({ checkpointProgress: v })} />
      <Tog label="Drift Combo" value={s.driftComboOn} onChange={(v) => onChange({ driftComboOn: v })} />
      <Tog label="Score Display" value={s.scoreOn} onChange={(v) => onChange({ scoreOn: v })} />
      <Tog label="Leaderboard" value={s.leaderboardOn} onChange={(v) => onChange({ leaderboardOn: v })} />
      <Tog label="Achievements" value={s.achievementsOn} onChange={(v) => onChange({ achievementsOn: v })} />
      <Row label={`Time Trial Target ${s.timeTrialTarget}s`}><Num value={s.timeTrialTarget} min={30} max={300} onChange={(v) => onChange({ timeTrialTarget: v })} /></Row>
      <Row label={`Drift Target ${s.driftChallengeTarget}`}><Num value={s.driftChallengeTarget} min={1000} max={50000} onChange={(v) => onChange({ driftChallengeTarget: v })} /></Row>
      <Row label={`Countdown ${s.countdownLength}s`}><Num value={s.countdownLength} min={1} max={5} onChange={(v) => onChange({ countdownLength: v })} /></Row>
      <Row label={`Race Laps ${s.raceLaps}`}><Num value={s.raceLaps} min={1} max={5} onChange={(v) => onChange({ raceLaps: v })} /></Row>
      <Tog label="Ghost Car (Best Lap)" value={s.ghostCar} onChange={(v) => onChange({ ghostCar: v })} />
      <Tog label="Hotseat 2-Player" value={s.hotseat} onChange={(v) => onChange({ hotseat: v })} />

      <h3 className="font-display" style={{ fontSize: 14, letterSpacing: ".2em", marginTop: 18 }}>SETTINGS</h3>
      <Row label="Key: Accelerate"><select value={s.keyGas} onChange={(e) => onChange({ keyGas: e.target.value })}>{KEY_OPTS.map((k) => <option key={k} value={k}>{k}</option>)}</select></Row>
      <Row label="Key: Brake"><select value={s.keyBrake} onChange={(e) => onChange({ keyBrake: e.target.value })}>{KEY_OPTS.map((k) => <option key={k} value={k}>{k}</option>)}</select></Row>
      <Row label="Key: Steer Left"><select value={s.keyLeft} onChange={(e) => onChange({ keyLeft: e.target.value })}>{KEY_OPTS.map((k) => <option key={k} value={k}>{k}</option>)}</select></Row>
      <Row label="Key: Steer Right"><select value={s.keyRight} onChange={(e) => onChange({ keyRight: e.target.value })}>{KEY_OPTS.map((k) => <option key={k} value={k}>{k}</option>)}</select></Row>
      <Row label="Key: Nitro"><select value={s.keyNitro} onChange={(e) => onChange({ keyNitro: e.target.value })}>{KEY_OPTS.map((k) => <option key={k} value={k}>{k}</option>)}</select></Row>
      <Row label="Key: Drift"><select value={s.keyDrift} onChange={(e) => onChange({ keyDrift: e.target.value })}>{KEY_OPTS.map((k) => <option key={k} value={k}>{k}</option>)}</select></Row>
      <Tog label="Touch Controls" value={s.touchOn} onChange={(v) => onChange({ touchOn: v })} />
      <Row label={`Touch Button Size ${s.touchSize}`}><Num value={s.touchSize} min={0} max={100} onChange={(v) => onChange({ touchSize: v })} /></Row>
      <Row label="Language"><Sel value={s.language} options={["en", "hinglish"] as const} onChange={(v) => onChange({ language: v })} /></Row>
      <Row label="Graphics Quality"><Sel value={s.graphicsQuality} options={["low", "medium", "high", "ultra"] as const} onChange={(v) => onChange({ graphicsQuality: v })} /></Row>
      <Row label={`Master Volume ${s.masterVolume}`}><Num value={s.masterVolume} min={0} max={100} onChange={(v) => onChange({ masterVolume: v })} /></Row>
      <Row label={`Music Volume ${s.musicVolume}`}><Num value={s.musicVolume} min={0} max={100} onChange={(v) => onChange({ musicVolume: v })} /></Row>
      <Row label={`SFX Volume ${s.sfxVolume}`}><Num value={s.sfxVolume} min={0} max={100} onChange={(v) => onChange({ sfxVolume: v })} /></Row>
      <Row label={`Radio Volume ${s.radioVolume}`}><Num value={s.radioVolume} min={0} max={100} onChange={(v) => onChange({ radioVolume: v })} /></Row>
      <Row label={`Crossfade ${s.crossfadeDuration}s`}><Num value={s.crossfadeDuration} min={0} max={5} onChange={(v) => onChange({ crossfadeDuration: v })} /></Row>
      <Tog label="Track Subtitles" value={s.subtitles} onChange={(v) => onChange({ subtitles: v })} />
      <Row label="Colour-Blind Mode"><Sel value={s.colorBlind} options={["off", "protan", "deutan", "tritan"] as const} onChange={(v) => onChange({ colorBlind: v })} /></Row>
      <Tog label="Reduce Motion" value={s.reduceMotion} onChange={(v) => onChange({ reduceMotion: v })} />
      <Tog label="FPS Counter" value={s.fpsCounter} onChange={(v) => onChange({ fpsCounter: v })} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button className="btn btn-ghost" onClick={() => onAction("export")}>Export Settings JSON</button>
        <label className="btn btn-ghost" style={{ cursor: "pointer" }}>Import Settings JSON<input type="file" accept=".json,application/json" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = ""; }} /></label>
        <button className="btn btn-ghost" onClick={() => onAction("resetAll")}>Reset All Settings</button>
      </div>

      <h3 className="font-display" style={{ fontSize: 14, letterSpacing: ".2em", marginTop: 18 }}>WORLD</h3>
      <Row label="Time Preset"><Sel value={s.timePreset} options={["dawn", "noon", "dusk", "midnight", "custom"] as const} onChange={(v) => onChange({ timePreset: v })} /></Row>
      <Row label="District"><Sel value={s.district} options={["downtown", "port", "highway", "residential"] as const} onChange={(v) => onChange({ district: v })} /></Row>
      <Row label={`Road Wetness ${s.roadWetness}`}><Num value={s.roadWetness} min={0} max={100} onChange={(v) => onChange({ roadWetness: v })} /></Row>
      <Row label={`Puddle Amount ${s.puddleAmount}`}><Num value={s.puddleAmount} min={0} max={100} onChange={(v) => onChange({ puddleAmount: v })} /></Row>
      <Tog label="Neon District" value={s.neonDistrict} onChange={(v) => onChange({ neonDistrict: v })} />
      <Tog label="Billboard Text Cycle" value={s.billboardCycle} onChange={(v) => onChange({ billboardCycle: v })} />
      <Tog label="Streetlights" value={s.streetlights} onChange={(v) => onChange({ streetlights: v })} />
      <Tog label="Moon + Stars" value={s.moonStars} onChange={(v) => onChange({ moonStars: v })} />
      <Tog label="Clouds" value={s.clouds} onChange={(v) => onChange({ clouds: v })} />
      <Tog label="Fireworks" value={s.fireworks} onChange={(v) => onChange({ fireworks: v })} />
      <Tog label="Police Chase" value={s.policeChase} onChange={(v) => onChange({ policeChase: v })} />
      <Tog label="Taxi Job" value={s.taxiJob} onChange={(v) => onChange({ taxiJob: v })} />
      <Tog label="Delivery Job" value={s.deliveryJob} onChange={(v) => onChange({ deliveryJob: v })} />
      <Tog label="Fuel Stations" value={s.fuelStations} onChange={(v) => onChange({ fuelStations: v })} />
      <Tog label="Repair Garages" value={s.repairGarages} onChange={(v) => onChange({ repairGarages: v })} />
      <Tog label="Car Wash" value={s.carWash} onChange={(v) => onChange({ carWash: v })} />
      <Tog label="Ambient City Noise" value={s.ambientNoise} onChange={(v) => onChange({ ambientNoise: v })} />
      <Tog label="Rain" value={s.rainOn} onChange={(v) => onChange({ rainOn: v })} />
      <Row label={`Fog Density ${s.fogDensity}`}><Num value={s.fogDensity} min={0} max={100} onChange={(v) => onChange({ fogDensity: v })} /></Row>
      <Tog label="Building Lights" value={s.nightLights} onChange={(v) => onChange({ nightLights: v })} />
      <Tog label="Traffic Lights Cycle" value={s.trafficLightsCycle} onChange={(v) => onChange({ trafficLightsCycle: v })} />
    </div>
  );
}
