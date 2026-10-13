// Original procedural audio for Raphael Drive — no sampled music, no copied files.
// Engine hum, nitro, drift squeal, UI clicks + a small WebAudio synthwave sequencer.
export type RadioTrack = { id: string; title: string; artist: string; bpm: number; root: number };

export const RADIO_TRACKS: RadioTrack[] = [
  { id: "midnight-overdrive", title: "Midnight Overdrive", artist: "Raphael FM Session", bpm: 104, root: 110 },
  { id: "neon-horizon", title: "Neon Horizon", artist: "Raphael FM Session", bpm: 92, root: 98 },
  { id: "chrome-rain", title: "Chrome Rain", artist: "Raphael FM Session", bpm: 116, root: 123.5 },
];

const MINOR = [0, 3, 7, 10, 12, 15, 19, 24];

export class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  engineOsc: OscillatorNode | null = null;
  engineOsc2: OscillatorNode | null = null;
  engineGain: GainNode | null = null;
  engineFilter: BiquadFilterNode | null = null;
  noiseGain: GainNode | null = null;
  squealOsc: OscillatorNode | null = null;
  squealGain: GainNode | null = null;
  muted = false;
  radioOn = true;
  trackIndex = 0;
  duckFactor = 1; // 1 = full engine, <1 when My Music ducks the engine
  engineType: "v8" | "v12" | "electric" = "v8";
  engineVolume = 0.7;
  squealVolume = 0.7;
  sfxVolume = 0.8;
  radioVolume = 0.6;
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private ambientSrc: AudioBufferSourceNode | null = null;
  private ambientGain: GainNode | null = null;
  private radioTimer: number | null = null;
  private step = 0;

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);

    // Engine: two detuned saws through a lowpass.
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = "sawtooth";
    this.engineOsc.frequency.value = 55;
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = "square";
    this.engineOsc2.frequency.value = 27.5;
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.4;
    this.engineOsc.connect(this.engineFilter);
    this.engineOsc2.connect(g2);
    g2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    this.engineOsc2.start();

    // Drift squeal.
    this.squealOsc = this.ctx.createOscillator();
    this.squealOsc.type = "sine";
    this.squealOsc.frequency.value = 1180;
    this.squealGain = this.ctx.createGain();
    this.squealGain.gain.value = 0;
    this.squealOsc.connect(this.squealGain);
    this.squealGain.connect(this.master);
    this.squealOsc.start();

    // Nitro / rain noise.
    const len = this.ctx.sampleRate * 1;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0;
    src.connect(bp);
    bp.connect(this.noiseGain);
    this.noiseGain.connect(this.master);
    src.start();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.55 * (this.masterVolume / 55), this.ctx.currentTime, 0.05);
  }

  masterVolume = 55;
  setMasterVolume(v: number) {
    this.masterVolume = Math.max(0, Math.min(100, v));
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55 * (this.masterVolume / 55), this.ctx.currentTime, 0.05);
  }

  setEngine(speedNorm: number, nitro: boolean, drifting: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const base = this.engineType === "electric" ? 120 : this.engineType === "v12" ? 62 : 48;
    const span = this.engineType === "electric" ? 220 : 165;
    const freq = base + speedNorm * span + (nitro ? 28 : 0);
    this.engineOsc?.frequency.setTargetAtTime(freq, t, 0.06);
    this.engineOsc2?.frequency.setTargetAtTime(freq / 2, t, 0.06);
    if (this.engineOsc) this.engineOsc.type = this.engineType === "electric" ? "sine" : "sawtooth";
    this.engineFilter?.frequency.setTargetAtTime(320 + speedNorm * 1400, t, 0.08);
    this.engineGain?.gain.setTargetAtTime((0.045 + speedNorm * 0.075) * this.engineVolume * this.duckFactor, t, 0.08);
    this.noiseGain?.gain.setTargetAtTime(nitro ? 0.07 : drifting ? 0.03 : 0.008, t, 0.1);
    this.squealGain?.gain.setTargetAtTime(drifting && speedNorm > 0.25 ? 0.035 * this.squealVolume : 0, t, 0.06);
    if (drifting) this.squealOsc?.frequency.setTargetAtTime(1050 + Math.random() * 320, t, 0.05);
  }

  setDuck(on: boolean, musicPlaying: boolean) {
    this.duckFactor = on && musicPlaying ? 0.35 : 1;
  }

  horn(style: "classic" | "sport" | "air" = "classic") {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const freqs = style === "air" ? [370, 440, 550] : style === "sport" ? [440, 554] : [392, 494];
    for (const f of freqs) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = style === "air" ? "sawtooth" : "square";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06 * this.sfxVolume, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.6);
    }
  }

  setSiren(on: boolean) {
    if (!this.ctx || !this.master) return;
    if (on && !this.sirenOsc) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "triangle";
      g.gain.value = 0.0;
      o.connect(g); g.connect(this.master);
      o.start();
      this.sirenOsc = o; this.sirenGain = g;
      const t = this.ctx.currentTime;
      g.gain.setTargetAtTime(0.035 * this.sfxVolume, t, 0.2);
      // Two-tone wail via periodic frequency LFO on the oscillator.
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.8;
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain); lfoGain.connect(o.frequency);
      o.frequency.value = 880;
      lfo.start();
      (this as unknown as { sirenLfo?: OscillatorNode }).sirenLfo = lfo;
    } else if (!on && this.sirenOsc) {
      const t = this.ctx.currentTime;
      this.sirenGain?.gain.setTargetAtTime(0, t, 0.15);
      const osc = this.sirenOsc;
      const lfo = (this as unknown as { sirenLfo?: OscillatorNode }).sirenLfo;
      window.setTimeout(() => { try { osc.stop(); lfo?.stop(); } catch {} }, 400);
      this.sirenOsc = null; this.sirenGain = null;
    }
  }

  setAmbient(on: boolean) {
    if (!this.ctx || !this.master) return;
    if (on && !this.ambientSrc) {
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
      const src = this.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 220;
      const g = this.ctx.createGain();
      g.gain.value = 0.02;
      src.connect(lp); lp.connect(g); g.connect(this.master);
      src.start();
      this.ambientSrc = src; this.ambientGain = g;
    } else if (!on && this.ambientSrc) {
      try { this.ambientSrc.stop(); } catch {}
      this.ambientSrc = null; this.ambientGain = null;
    }
  }

  click() {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.08 * this.sfxVolume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.1);
  }

  collision(strength: number) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
    g.gain.setValueAtTime(Math.min(0.35, 0.08 + strength * 0.3) * this.sfxVolume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.26);
  }

  stopRadio() {
    // Fully stop the Raphael FM sequencer (not just silence it): clear the
    // tick timer so a later startRadio() restarts cleanly, and silence any
    // in-flight step. Used when switching to My Music / Off.
    this.radioOn = false;
    if (this.radioTimer !== null) { window.clearTimeout(this.radioTimer); this.radioTimer = null; }
  }

  startRadio() {
    if (this.radioTimer !== null) return;
    this.step = 0;
    const tick = () => {
      if (!this.ctx || !this.master || !this.radioOn || this.muted) {
        // Keep stepping silently so tracks stay in time when unmuted.
      }
      if (this.ctx && this.master && this.radioOn && !this.muted) {
        const track = RADIO_TRACKS[this.trackIndex % RADIO_TRACKS.length];
        const t = this.ctx.currentTime;
        const s = this.step;
        // Bass on every beat, arpeggio on 8ths, pad every 2 bars — all original patterns.
        if (s % 4 === 0) this.note(track.root / 2, t, 0.42, "triangle", 0.055);
        if (s % 8 === 4) this.note(track.root * 1.5, t, 0.3, "triangle", 0.04);
        const arpNote = track.root * Math.pow(2, MINOR[(s + Math.floor(s / 16)) % MINOR.length] / 12);
        if (s % 2 === 0) this.note(arpNote * 2, t, 0.16, "square", 0.02);
        if (s % 32 === 0) {
          this.note(track.root * 2, t, 1.6, "sine", 0.035);
          this.note(track.root * 2 * 1.5, t, 1.6, "sine", 0.03);
        }
        // Hat: short noise burst.
        if (s % 2 === 1) this.hat(t);
      }
      this.step = (this.step + 1) % 64;
      const track = RADIO_TRACKS[this.trackIndex % RADIO_TRACKS.length];
      const stepDur = 60 / track.bpm / 2;
      this.radioTimer = window.setTimeout(tick, stepDur * 1000) as unknown as number;
    };
    tick();
  }

  private note(freq: number, t: number, dur: number, type: OscillatorType, vol: number) {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol * this.radioVolume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private hat(t: number) {
    if (!this.ctx || !this.master) return;
    const len = this.ctx.sampleRate * 0.04;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 6000;
    const g = this.ctx.createGain();
    g.gain.value = 0.02;
    src.connect(hp);
    hp.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  nextTrack() {
    this.trackIndex = (this.trackIndex + 1) % RADIO_TRACKS.length;
    this.step = 0;
  }
}
