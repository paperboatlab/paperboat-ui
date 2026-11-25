// The media player (brand.html tokens; no browser controls): a video or a sound with one bar of keys:
// play, the scrub line (what has loaded, where it is), the time, sound on/off and its level, speed and full
// screen. A video's bar fades while it plays and the pointer rests; keys work when the player has focus:
// Space or K play/pause, ←/→ 5 s, M sound, F full screen.
import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon.tsx";
import { Key } from "../Key.tsx";

const SPEEDS = [0.5, 1, 1.5, 2];
const clock = (s: number) => {
  if (!Number.isFinite(s)) return "–:––";
  const t = Math.max(0, Math.floor(s)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), r = t % 60;
  return `${h ? `${h}:${String(m).padStart(2, "0")}` : m}:${String(r).padStart(2, "0")}`;
};

export function MediaPlayer({ src, kind = "video", title }: { src: string; kind?: "video" | "audio"; title: string }) {
  const box = useRef<HTMLDivElement>(null), el = useRef<HTMLVideoElement & HTMLAudioElement>(null), line = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false), [t, setT] = useState(0), [dur, setDur] = useState(NaN), [loaded, setLoaded] = useState(0);
  const [muted, setMuted] = useState(false), [vol, setVol] = useState(1), [speed, setSpeed] = useState(1), [full, setFull] = useState(false);
  const [idle, setIdle] = useState(false), [error, setError] = useState<string | null>(null), [started, setStarted] = useState(false);

  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  // the bar fades after 2 s without the pointer while a video plays
  const rest = useRef(0);
  const wake = () => { setIdle(false); clearTimeout(rest.current); rest.current = window.setTimeout(() => setIdle(true), 2000); };
  useEffect(() => () => clearTimeout(rest.current), []);

  const m = () => el.current!;
  const toggle = () => { const v = m(); if (v.paused || v.ended) { setStarted(true); v.play().catch((e) => setError(String(e?.message ?? e))); } else v.pause(); };
  const seek = (s: number) => { const v = m(); v.currentTime = Math.min(Math.max(0, s), Number.isFinite(v.duration) ? v.duration : s); setT(v.currentTime); };
  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen())?.catch(() => {});
  const scrubAt = (x: number) => { const r = line.current!.getBoundingClientRect(); seek(((x - r.left) / r.width) * (m().duration || 0)); };

  const keys = (e: React.KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === " " || k === "k") toggle();
    else if (k === "arrowleft") seek(m().currentTime - 5);
    else if (k === "arrowright") seek(m().currentTime + 5);
    else if (k === "m") { m().muted = !m().muted; }
    else if (k === "f" && kind === "video") fullscreen();
    else return;
    e.preventDefault();
  };

  const Media = kind === "video" ? "video" : "audio";
  const pct = dur > 0 ? (t / dur) * 100 : 0;
  return (
    <div ref={box} className={`pb-player ${kind}${playing ? " playing" : ""}${idle && playing && kind === "video" ? " idle" : ""}${full ? " full" : ""}`}
      tabIndex={0} role="group" aria-label={title} onKeyDown={keys} onPointerMove={wake}>
      <Media ref={el} src={src} preload="metadata" playsInline
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} onLoadedMetadata={(e) => { setDur(e.currentTarget.duration); setError(null); }}
        onDurationChange={(e) => setDur(e.currentTarget.duration)}
        onProgress={(e) => { const b = e.currentTarget.buffered, d = e.currentTarget.duration; if (b.length && d) setLoaded((b.end(b.length - 1) / d) * 100); }}
        onVolumeChange={(e) => { setMuted(e.currentTarget.muted); setVol(e.currentTarget.volume); }}
        onError={() => setError("This file can't be played here: its format may not be one the browser plays (MP4 with H.264, WebM, MP3, OGG, WAV are).")}
        onClick={kind === "video" ? toggle : undefined} />
      {kind === "video" && !started && !error && <button type="button" className="pb-player-start" aria-label="Play" onClick={toggle}><Icon name="play" size={22} /></button>}
      {error && <div className="pb-player-error">{error}</div>}
      <div className="pb-player-bar">
        <Key size="sm" kind="quiet" round icon={playing ? "debug-pause" : "play"} label={playing ? "Pause (Space)" : "Play (Space)"} onClick={toggle} />
        <span className="pb-player-time">{clock(t)} <i>/</i> {clock(dur)}</span>
        <div ref={line} className="pb-player-line" role="slider" aria-label="Position" aria-valuemin={0} aria-valuemax={Math.round(dur || 0)} aria-valuenow={Math.round(t)} aria-valuetext={`${clock(t)} of ${clock(dur)}`} tabIndex={-1}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); scrubAt(e.clientX); }}
          onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) scrubAt(e.clientX); }}>
          <i className="loaded" style={{ width: `${loaded}%` }} /><i className="done" style={{ width: `${pct}%` }} /><i className="thumb" style={{ left: `${pct}%` }} />
        </div>
        <Key size="sm" kind="quiet" round icon={muted || vol === 0 ? "volume-off" : "volume"} label={muted ? "Sound on (M)" : "Sound off (M)"} onClick={() => { m().muted = !m().muted; }} />
        <input className="pb-player-vol" type="range" min={0} max={1} step={0.05} value={muted ? 0 : vol} aria-label="Volume"
          onChange={(e) => { const v = m(); v.volume = Number(e.target.value); v.muted = v.volume === 0; }} />
        <button type="button" className="pb-player-speed" title="Speed" onClick={() => { const s = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; m().playbackRate = s; setSpeed(s); }}>{speed}×</button>
        {kind === "video" && <Key size="sm" kind="quiet" round icon={full ? "media-exit-fullscreen" : "media-fullscreen"} label={full ? "Leave full screen (F)" : "Full screen (F)"} onClick={fullscreen} />}
      </div>
    </div>
  );
}
