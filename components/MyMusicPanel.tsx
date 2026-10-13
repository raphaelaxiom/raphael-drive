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
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listMusicTracks().then(setTracks).catch(() => {});
    myMusicPlayer.onTrackChange = (id) => setCurrentId(id);
    myMusicPlayer.onPlayingChange = (p) => setPlaying(p);
    myMusicPlayer.onProgress = (cur, dur) => setProgress({ cur, dur });
    myMusicPlayer.startProgress();
    return () => { myMusicPlayer.stopProgress(); };
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
    const added = await addMusicFiles(files);
    if (added.length === 0) { onToast("No playable audio files in that selection."); return; }
    await refresh();
    onToast(`Added ${added.length} song(s). They stay in this browser only — never uploaded.`);
    onSourceChange("mymusic");
    const list = await listMusicTracks();
    if (list.length > 0 && !currentId) {
      myMusicPlayer.setQueue(list.map((t) => t.id));
      await myMusicPlayer.playId(list[0].id);
    }
  };

  const playTrack = async (id: string) => {
    myMusicPlayer.setQueue(tracks.map((t) => t.id));
    await myMusicPlayer.playId(id);
    onSourceChange("mymusic");
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
        <b style={{ fontSize: 13 }}>{current ? current.name : "No song playing"}</b>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 11 }}>{fmt(progress.cur)}</span>
          <input type="range" min={0} max={Math.max(1, progress.dur)} value={Math.min(progress.cur, progress.dur || 0)} onChange={(e) => myMusicPlayer.seek(Number(e.target.value))} style={{ flex: 1 }} />
          <span style={{ fontSize: 11 }}>{fmt(progress.dur)}</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          <button className="btn btn-ghost" onClick={() => void myMusicPlayer.prev()}>⏮ Prev</button>
          <button className="btn btn-primary" onClick={() => void (playing ? myMusicPlayer.pause() : myMusicPlayer.play())}>{playing ? "⏸ Pause" : "▶ Play"}</button>
          <button className="btn btn-ghost" onClick={() => void myMusicPlayer.next()}>Next ⏭</button>
          <button className={`btn ${shuffle ? "btn-primary" : "btn-ghost"}`} onClick={() => setShuffle((v) => !v)}>Shuffle {shuffle ? "On" : "Off"}</button>
          <button className="btn btn-ghost" onClick={() => setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"))}>Repeat: {repeat}</button>
          <button className="btn btn-ghost" onClick={() => void myMusicPlayer.stop()}>Stop</button>
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
