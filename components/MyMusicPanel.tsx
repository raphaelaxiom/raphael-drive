"use client";
import { useEffect, useRef, useState } from "react";
import { listMusicTracks, addMusicFiles, deleteMusicTrack, myMusicPlayer, type MusicTrack, type RepeatMode } from "@/lib/mymusic";
import type { Settings } from "@/lib/settings";

type Props = {
  settings: Settings;
  onSourceChange: (src: "radio" | "mymusic" | "off") => void;
  onDuckToggle: () => void;
  onToast: (msg: string) => void;
};

function fmt(sec: number) {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function MyMusicPanel({ settings, onSourceChange, onDuckToggle, onToast }: Props) {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState({ cur: 0, dur: 0 });
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [lastError, setLastError] = useState("");
  const [testToneState, setTestToneState] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Restore queue on mount: Garage -> Drive remounts the panel, and the
    // queue is in-memory — without this, Play after navigation did nothing.
    let alive = true;
    listMusicTracks().then((list) => {
      if (!alive) return;
      setTracks(list);
      myMusicPlayer.setQueue(list.map((t) => t.id));
      setCurrentId(myMusicPlayer.currentId);
      setPlaying(myMusicPlayer.playing);
    }).catch(() => {});
    const unsub = myMusicPlayer.subscribe({
      onTrackChange: (id) => { if (alive) { setCurrentId(id); if (id) setLastError(""); } },
      onPlayingChange: (p) => { if (alive) setPlaying(p); },
      onProgress: (cur, dur) => { if (alive) setProgress({ cur, dur }); },
      onError: (msg) => { if (alive) setLastError(msg); },
    });
    myMusicPlayer.startProgress();
    return () => { alive = false; unsub(); myMusicPlayer.stopProgress(); };
  }, []);

  useEffect(() => { myMusicPlayer.setVolume(settings.musicVolume / 100); }, [settings.musicVolume]);
  useEffect(() => { myMusicPlayer.setCrossfade(settings.crossfadeDuration); }, [settings.crossfadeDuration]);
  useEffect(() => { myMusicPlayer.shuffle = shuffle; }, [shuffle]);
  useEffect(() => { myMusicPlayer.repeat = repeat; }, [repeat]);

  const refresh = async () => {
    const list = await listMusicTracks();
    setTracks(list);
    myMusicPlayer.setQueue(list.map((t) => t.id));
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    let added: MusicTrack[] = [];
    try {
      added = await addMusicFiles(files);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save those files.";
      setLastError(msg);
      onToast(msg);
      return;
    }
    if (added.length === 0) { onToast("No playable audio files in that selection."); return; }
    await refresh();
    onToast(`Added ${added.length} song(s). They stay in this browser only — never uploaded.`);
    // Switch source FIRST so Raphael FM fully stops before My Music starts.
    onSourceChange("mymusic");
    const list = await listMusicTracks();
    if (list.length > 0 && !myMusicPlayer.currentId) {
      myMusicPlayer.setQueue(list.map((t) => t.id));
      try {
        await myMusicPlayer.playId(list[0].id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not play that file.";
        setLastError(msg);
        onToast(msg);
      }
    }
  };

  const playTrack = async (id: string) => {
    // Switch source FIRST (stops radio), then play — the old order played
    // first and let the source switch re-trigger play() on a stale queue.
    onSourceChange("mymusic");
    myMusicPlayer.setQueue(tracks.map((t) => t.id));
    try {
      await myMusicPlayer.playId(id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not play that file.";
      setLastError(msg);
      onToast(msg);
    }
  };

  const togglePlay = async () => {
    try {
      if (playing) await myMusicPlayer.pause();
      else {
        onSourceChange("mymusic");
        await myMusicPlayer.play();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not play.";
      setLastError(msg);
      onToast(msg);
    }
  };

  // Test Tone: proves the browser-audio path works independent of any file.
  // If you hear the beep but not your song, the file itself is the problem.
  const playTestTone = () => {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      void ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.55);
      setTestToneState("Test tone played — if you heard the beep, your speakers + browser audio work.");
      window.setTimeout(() => void ctx.close(), 700);
    } catch {
      setTestToneState("Test tone could not play — check browser audio permission.");
    }
  };

  const current = tracks.find((t) => t.id === currentId);

  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,.12)", paddingTop: 12, marginTop: 12 }}>
      <label>My Music — Your Own Songs <span style={{ textTransform: "none", letterSpacing: 0 }}>local only</span></label>
      <p className="rd-note">Pick audio files from your device. They are stored in this browser (IndexedDB) and never uploaded. Track changes crossfade: old fades out, new fades in.</p>
      <div className="rd-seg" style={{ marginBottom: 8 }}>
        {(["radio", "mymusic", "off"] as const).map((src) => (
          <button key={src} className={settings.musicSource === src ? "active" : ""} onClick={() => onSourceChange(src)}>
            {src === "radio" ? "Raphael FM" : src === "mymusic" ? "My Music" : "Off"}
          </button>
        ))}
      </div>
      <input ref={fileRef} type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.webm" multiple style={{ display: "none" }} onChange={(e) => { void handleFiles(e.target.files); e.target.value = ""; }} />
      <button className="btn btn-cyan" style={{ width: "100%" }} onClick={() => fileRef.current?.click()}>📁 Add My Songs From Device</button>
      <div style={{ marginTop: 10 }}>
        <b style={{ fontSize: 13 }}>Now Playing: {current ? current.name : "—"}</b>
        <p className="rd-note" style={{ margin: "2px 0 0" }}>
          {playing ? `▶ Playing — ${fmt(progress.cur)} / ${fmt(progress.dur)}` : current ? `⏸ Paused — ${fmt(progress.cur)} / ${fmt(progress.dur)}` : "No song playing — add a song, then press Play."}
        </p>
        {lastError && <p style={{ fontSize: 12.5, color: "#ff6b6b", lineHeight: 1.5, margin: "6px 0 0" }}>⚠ {lastError}</p>}
        {settings.musicVolume === 0 && <p style={{ fontSize: 12.5, color: "#ffd166", lineHeight: 1.5, margin: "6px 0 0" }}>⚠ Music Volume is 0 in Settings — turn it up to hear your songs.</p>}
        {testToneState && <p style={{ fontSize: 12.5, color: "#9fe8ff", lineHeight: 1.5, margin: "6px 0 0" }}>{testToneState}</p>}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 11 }}>{fmt(progress.cur)}</span>
          <input type="range" min={0} max={Math.max(1, progress.dur)} value={Math.min(progress.cur, progress.dur || 0)} onChange={(e) => myMusicPlayer.seek(Number(e.target.value))} style={{ flex: 1 }} />
          <span style={{ fontSize: 11 }}>{fmt(progress.dur)}</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          <button className="btn btn-ghost" onClick={() => void myMusicPlayer.prev().catch((e) => { const m = e instanceof Error ? e.message : "Could not play previous track."; setLastError(m); onToast(m); })}>⏮ Prev</button>
          <button className="btn btn-primary" onClick={() => void togglePlay()}>{playing ? "⏸ Pause" : "▶ Play"}</button>
          <button className="btn btn-ghost" onClick={() => void myMusicPlayer.next().catch((e) => { const m = e instanceof Error ? e.message : "Could not play next track."; setLastError(m); onToast(m); })}>Next ⏭</button>
          <button className={`btn ${shuffle ? "btn-primary" : "btn-ghost"}`} onClick={() => setShuffle((v) => !v)}>Shuffle {shuffle ? "On" : "Off"}</button>
          <button className="btn btn-ghost" onClick={() => setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"))}>Repeat: {repeat}</button>
          <button className="btn btn-ghost" onClick={() => void myMusicPlayer.stop()}>Stop</button>
          <button className="btn btn-ghost" onClick={playTestTone}>🔔 Test Tone</button>
        </div>
        <p className="rd-note" style={{ marginTop: 6 }}>Crossfade: {settings.crossfadeDuration}s — set it in Settings. {settings.musicDuck ? "Engine ducks while music plays." : "Engine does not duck."}</p>
        <label className="rd-toggle" style={{ marginTop: 4 }}>Music ducks engine <input type="checkbox" checked={settings.musicDuck} onChange={() => onDuckToggle()} /></label>
      </div>
      <div style={{ marginTop: 10 }}>
        <p className="rd-note" style={{ margin: "0 0 6px" }}>My Playlist ({tracks.length})</p>
        {tracks.length === 0 && <p className="rd-note">No songs yet. Add some above — they persist in this browser.</p>}
        {tracks.map((t) => (
          <div key={t.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, background: currentId === t.id ? "rgba(0,229,255,.12)" : "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, padding: "8px 10px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
              <div className="rd-note" style={{ margin: 0 }}>{(t.size / 1048576).toFixed(2)} MB · {new Date(t.date).toLocaleDateString()}</div>
            </div>
            <button className="btn btn-cyan" style={{ padding: "6px 10px" }} onClick={() => void playTrack(t.id)}>Play</button>
            <button className="btn btn-ghost" style={{ padding: "6px 10px" }} onClick={() => void (async () => { if (window.confirm("Delete this song from this browser?")) { await deleteMusicTrack(t.id); await refresh(); } })()}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
