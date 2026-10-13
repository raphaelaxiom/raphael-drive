// My Music — the user's OWN songs, local-only.
// Files are picked from the device (File API) and stored in IndexedDB in THIS
// browser. Nothing is uploaded to any server; there is no upload endpoint.
// Playback uses two HTMLAudioElements so track changes can CROSSFADE:
// old track fades out while the new one fades in (GainNode-style volume ramps
// via element.volume + rAF), no clicks, no gaps. All original code.

export interface MusicTrack {
  id: string;
  name: string;
  size: number;
  date: string;
  type: string;
}

const DB = "raphael-drive-music";
const STORE = "tracks";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB is not available in this browser."));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open music storage."));
  });
}

export async function listMusicTracks(): Promise<MusicTrack[]> {
  const db = await openDb();
  const rows = await new Promise<Array<MusicTrack & { blob: Blob }>>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result ?? []) as Array<MusicTrack & { blob: Blob }>);
    req.onerror = () => reject(req.error ?? new Error("Could not list songs."));
  });
  db.close();
  return rows.map(({ blob: _b, ...meta }) => meta).sort((a, b) => (a.date < b.date ? -1 : 1));
}

export async function addMusicFiles(files: FileList | File[]): Promise<MusicTrack[]> {
  const added: MusicTrack[] = [];
  const db = await openDb();
  const arr = Array.from(files);
  for (const f of arr) {
    if (!f.type.startsWith("audio/") && !/\.(mp3|wav|ogg|m4a|flac|webm)$/i.test(f.name)) continue;
    if (f.size === 0) continue;
    const meta: MusicTrack = {
      id: `song-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name.replace(/\.[a-z0-9]+$/i, ""),
      size: f.size,
      date: new Date().toISOString(),
      type: f.type || "audio/*",
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ ...meta, blob: f });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Could not save song."));
    });
    added.push(meta);
  }
  db.close();
  return added;
}

export async function deleteMusicTrack(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not delete song."));
  });
  db.close();
}

async function loadTrackBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  const row = await new Promise<{ blob?: Blob } | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as { blob?: Blob } | undefined);
    req.onerror = () => reject(req.error ?? new Error("Could not load song."));
  });
  db.close();
  return row?.blob ?? null;
}

export type RepeatMode = "off" | "all" | "one";

export class MyMusicPlayer {
  private a: HTMLAudioElement | null = null;
  private b: HTMLAudioElement | null = null;
  private active: HTMLAudioElement | null = null;
  private urls = new Map<HTMLAudioElement, string>();
  currentId: string | null = null;
  playing = false;
  volume = 0.7;
  crossfade = 1.5;
  shuffle = false;
  repeat: RepeatMode = "off";
  onTrackChange: ((id: string | null) => void) | null = null;
  onPlayingChange: ((playing: boolean) => void) | null = null;
  onProgress: ((current: number, duration: number) => void) | null = null;
  private fadeRaf = 0;
  private progressTimer: number | null = null;
  private queue: string[] = [];
  private queuePos = 0;

  private ensureElements() {
    if (!this.a) {
      this.a = new Audio();
      this.b = new Audio();
      for (const el of [this.a, this.b]) {
        el.preload = "auto";
        el.addEventListener("ended", () => {
          if (el === this.active) void this.handleEnded();
        });
        el.addEventListener("timeupdate", () => {
          if (el === this.active && this.onProgress) this.onProgress(el.currentTime, el.duration || 0);
        });
      }
      this.active = this.a;
    }
  }

  private async handleEnded() {
    if (this.repeat === "one" && this.currentId) {
      await this.playId(this.currentId, { fadeIn: true });
      return;
    }
    await this.next(true);
  }

  setQueue(ids: string[]) {
    this.queue = [...ids];
    const i = this.currentId ? this.queue.indexOf(this.currentId) : -1;
    this.queuePos = i >= 0 ? i : 0;
  }

  private ramp(el: HTMLAudioElement, from: number, to: number, durMs: number): Promise<void> {
    return new Promise((resolve) => {
      if (durMs <= 0) { el.volume = to; resolve(); return; }
      const start = performance.now();
      cancelAnimationFrame(this.fadeRaf);
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / durMs);
        // Equal-power-ish curve so the crossfade never dips to silence.
        const eased = t * t * (3 - 2 * t);
        el.volume = from + (to - from) * eased;
        if (t < 1) this.fadeRaf = requestAnimationFrame(step);
        else resolve();
      };
      this.fadeRaf = requestAnimationFrame(step);
    });
  }

  private async setUrl(el: HTMLAudioElement, id: string) {
    const blob = await loadTrackBlob(id);
    if (!blob) throw new Error("That song could not be loaded from this browser.");
    const old = this.urls.get(el);
    if (old) URL.revokeObjectURL(old);
    const url = URL.createObjectURL(blob);
    this.urls.set(el, url);
    el.src = url;
    el.load();
  }

  /** Play a track by id. If another track is playing, crossfade out→in. */
  async playId(id: string, opts: { fadeIn?: boolean } = {}) {
    this.ensureElements();
    const wasPlaying = this.playing && this.active && !this.active.paused;
    const next = this.active === this.a ? this.b! : this.a!;
    await this.setUrl(next, id);
    next.volume = 0;
    next.currentTime = 0;
    await next.play().catch(() => { /* autoplay blocked until user gesture */ });
    const fadeMs = (opts.fadeIn === false ? 0 : this.crossfade) * 1000;
    const old = this.active!;
    this.active = next;
    this.currentId = id;
    this.playing = true;
    this.onTrackChange?.(id);
    this.onPlayingChange?.(true);
    // Crossfade: new fades in, old fades out in parallel.
    await Promise.all([
      this.ramp(next, 0, this.volume, fadeMs),
      wasPlaying ? this.ramp(old, old.volume, 0, fadeMs).then(() => { old.pause(); }) : Promise.resolve(),
    ]);
  }

  async play() {
    if (this.currentId && this.active) {
      await this.active.play().catch(() => {});
      await this.ramp(this.active, this.active.volume, this.volume, this.crossfade * 1000);
      this.playing = true;
      this.onPlayingChange?.(true);
      return;
    }
    if (this.queue.length > 0) await this.playId(this.queue[this.queuePos]);
  }

  async pause() {
    if (!this.active) return;
    await this.ramp(this.active, this.active.volume, 0, Math.min(800, this.crossfade * 1000));
    this.active.pause();
    this.playing = false;
    this.onPlayingChange?.(false);
  }

  async stop() {
    if (!this.active) return;
    await this.ramp(this.active, this.active.volume, 0, Math.min(800, this.crossfade * 1000));
    this.active.pause();
    this.active.currentTime = 0;
    this.playing = false;
    this.currentId = null;
    this.onTrackChange?.(null);
    this.onPlayingChange?.(false);
  }

  async next(auto = false) {
    if (this.queue.length === 0) return;
    let nextPos: number;
    if (this.shuffle) {
      nextPos = Math.floor(Math.random() * this.queue.length);
      if (this.queue.length > 1 && nextPos === this.queuePos) nextPos = (nextPos + 1) % this.queue.length;
    } else {
      nextPos = this.queuePos + 1;
      if (nextPos >= this.queue.length) {
        if (this.repeat === "all" || auto) nextPos = 0;
        else { await this.stop(); return; }
      }
    }
    this.queuePos = nextPos;
    await this.playId(this.queue[this.queuePos]);
  }

  async prev() {
    if (this.queue.length === 0) return;
    this.queuePos = (this.queuePos - 1 + this.queue.length) % this.queue.length;
    await this.playId(this.queue[this.queuePos]);
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.active && this.playing) this.active.volume = this.volume;
  }

  setCrossfade(sec: number) { this.crossfade = Math.max(0, Math.min(5, sec)); }

  seek(sec: number) {
    if (this.active && isFinite(this.active.duration)) {
      this.active.currentTime = Math.max(0, Math.min(this.active.duration, sec));
    }
  }

  startProgress() {
    if (this.progressTimer !== null) return;
    this.progressTimer = window.setInterval(() => {
      if (this.active && this.onProgress) this.onProgress(this.active.currentTime, this.active.duration || 0);
    }, 500) as unknown as number;
  }

  stopProgress() {
    if (this.progressTimer !== null) { window.clearInterval(this.progressTimer); this.progressTimer = null; }
  }
}

export const myMusicPlayer = new MyMusicPlayer();
