// The Board's instruments as faces in the kit's Instrument frame (ui-example §14): graph, display, lamp, switch,
// choice, speaker. Each takes plain values; the host (Simplicial's toolkits) reads its block's params and the run
// and hands them in, so any app's dashboard draws the same instruments. The Scope is the one to study (scope/).
// Sizes follow the host's cell: an ancestor with `size-large` / `size-xlarge` grows the readouts. Styles: instruments.css.
import { useEffect, useRef, useState } from "react";
import { Switch } from "../controls.tsx";
import { Instrument } from "./Instrument.tsx";
import { GRID_BY_SIZE, graphValue, readout } from "./readout.ts";
import type { ScopeChannel } from "../scope/types.ts";

const W = 300, H = 100;
const minus = (s: string) => s.replace("-", "−");

export type GraphInstrumentProps = {
  name: string;
  /** What is wired in ("plant.θ"). */
  detail?: string;
  /** One trace per channel; x is the sample's time (or index, or a point's x). */
  channels: readonly ScopeChannel[];
  /** The unit of a single channel without its own. */
  unit?: string;
  idle?: boolean;
};

/** A Graph: the glance. Traces to the screen's edges with no axes, the latest value at the caption's end. */
export function GraphInstrument({ name, detail, channels, unit, idle }: GraphInstrumentProps) {
  let tMin = Infinity, tMax = -Infinity, vMin = Infinity, vMax = -Infinity;
  for (const c of channels)
    for (let i = 0; i < c.buf.times.length; i++) {
      tMin = Math.min(tMin, c.buf.times[i]);
      tMax = Math.max(tMax, c.buf.times[i]);
      vMin = Math.min(vMin, c.buf.values[i]);
      vMax = Math.max(vMax, c.buf.values[i]);
    }
  const span = vMax - vMin || 1, width = tMax - tMin || 1;
  const points = ({ buf }: ScopeChannel) => {
    let out = "";
    for (let i = 0; i < buf.times.length; i++)
      out += `${(((buf.times[i] - tMin) / width) * W).toFixed(1)},${(H - 6 - ((buf.values[i] - vMin) / span) * (H - 12)).toFixed(1)} `;
    return out;
  };
  return (
    <Instrument name={name} detail={detail} value={graphValue(channels, idle, unit)} idle={idle} className="graph">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        {channels.map((c, i) => (
          <polyline key={c.id} className={`trace trace-${i % 8}`} points={points(c)} fill="none" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
    </Instrument>
  );
}

export type DisplayInstrumentProps = {
  name: string;
  detail?: string;
  /** The latest value: a number, a vector, or the host's matrix / point-list text. */
  latest: unknown;
  /** A vector's components with their labels ("x: 1.0000 m, v: 2.0000 m/s"), when it has them. */
  vector?: string;
  unit?: string;
  idle?: boolean;
  /** The host's cell size: a bigger card lists more of a vector and shows a matrix's corner as a grid. */
  size?: string;
};

/** A Display: the latest value, large, with its unit; a vector or matrix reads out more as its card grows. */
export function DisplayInstrument({ name, detail, latest, vector, unit, idle, size }: DisplayInstrumentProps) {
  const { dims, type, values, grid } = readout(latest, vector, size);
  const n = GRID_BY_SIZE[size ?? ""];
  const rows = grid && n ? grid.rows.slice(0, n) : undefined;
  const cutColumns = !!grid && (grid.moreColumns || grid.rows.some((r) => r.length > n));
  const cutRows = !!grid && (grid.moreRows || grid.rows.length > n);
  return (
    <Instrument name={name} detail={detail ?? "display"} value={dims ? `${dims} ${type}` : undefined} idle={idle} className="display">
      {type === "scalar" || idle ? (
        <span className="rd"><output>{minus(values)}</output>{unit && <small>{unit}</small>}</span>
      ) : rows ? (
        <table className="matrix-grid" aria-label={`${name}: ${dims} matrix, top-left corner`}>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.slice(0, n).map((v, j) => <td key={j}>{v}</td>)}
                {cutColumns && <td className="more">⋯</td>}
              </tr>
            ))}
            {cutRows && (
              <tr>
                {rows[0].slice(0, n).map((_, j) => <td key={j} className="more">⋮</td>)}
                {cutColumns && <td className="more">⋱</td>}
              </tr>
            )}
          </tbody>
        </table>
      ) : (
        <output className="list">{values}</output>
      )}
    </Instrument>
  );
}

export type LampInstrumentProps = {
  name: string;
  /** Its condition ("> 10 · latch"). */
  detail?: string;
  on: boolean;
  /** The state in words, never colour alone: on/off, armed/tripped; "–" idle. */
  word: string;
  idle?: boolean;
  /** Lit in the accent, or red for a trip that means danger. */
  tone?: "accent" | "danger";
  title?: string;
};

/** A Lamp: a disc lit in the accent (or red) with its state in words beside it. */
export function LampInstrument({ name, detail, on, word, idle, tone = "accent", title }: LampInstrumentProps) {
  return (
    <Instrument name={name} detail={detail} idle={idle} className={`lamp-instrument${on ? " on" : ""} tone-${tone}`}>
      <span className="lamp">
        <i aria-hidden="true" />
        <output aria-label={`${name}: ${idle ? "no reading yet" : word}`} title={title}>{word}</output>
      </span>
    </Instrument>
  );
}

export type SwitchInstrumentProps = {
  name: string;
  /** What the host last latched. */
  on: boolean;
  /** Inert (and idle) while false: it flips only during a run. */
  live: boolean;
  /** A hold key instead of the switch: on while held. */
  momentary?: boolean;
  /** A press (true) or release (false); a flip is a press then a release. */
  onInput: (down: boolean) => void;
};

/** A Switch: the kit's switch (or a hold key) the user flips during a run; it shows only what the host latched. */
export function SwitchInstrument({ name, on, live, momentary, onInput }: SwitchInstrumentProps) {
  const held = useRef(false);
  const flip = () => { if (live) { onInput(true); onInput(false); } };
  const release = () => { if (held.current) { held.current = false; onInput(false); } };
  return (
    <Instrument name={name} detail={momentary ? "hold" : "switch"} value={on ? "on (1)" : "off (0)"} idle={!live} className="switch-instrument">
      <span className="switch-face" inert={!live} title={live ? undefined : "Flips during a run"}>
        {momentary ? (
          <button type="button" className={`hold${on ? " on" : ""}`} title="Hold to switch on"
            onPointerDown={(e) => { e.stopPropagation(); if (!live) return; e.currentTarget.setPointerCapture(e.pointerId); held.current = true; onInput(true); }}
            onPointerUp={release} onPointerCancel={release}>
            hold
          </button>
        ) : (
          <>
            <Switch label={`${name}: ${on ? "on" : "off"}`} checked={on} onChange={flip} />
            <b>{on ? "on" : "off"}</b>
          </>
        )}
      </span>
    </Instrument>
  );
}

export type ChoiceInstrumentProps = {
  name: string;
  options: readonly string[];
  /** The option the host last latched. */
  index: number;
  live: boolean;
  onChoose: (index: number) => void;
};

/** A pick-one control: one key per option, the chosen one tinted; inert while not live. */
export function ChoiceInstrument({ name, options, index, live, onChoose }: ChoiceInstrumentProps) {
  return (
    <Instrument name={name} detail="choice" value={options[Math.max(0, Math.min(index, options.length - 1))] ?? "–"} idle={!live} className="choice-instrument">
      <span className="choice-options" role="radiogroup" aria-label={name} inert={!live}>
        {options.map((o, i) => (
          <button key={o} type="button" role="radio" aria-checked={i === index} onClick={(e) => { e.stopPropagation(); if (live) onChoose(i); }}>{o}</button>
        ))}
      </span>
    </Instrument>
  );
}

export type SpeakerInstrumentProps = {
  name: string;
  /** One step's PCM samples, −1…1 before the volume; each new array is queued after the last. */
  samples: unknown;
  live: boolean;
  /** Samples per second; default 44100. */
  rate?: number;
  /** 0…1; default 0.8. */
  volume?: number;
};

/**
 * Plays PCM through Web Audio, queuing each array back to back. Browsers start an AudioContext suspended, so
 * the screen shows a Sound on key until it is pressed.
 */
export function SpeakerInstrument({ name, samples, live, rate = 44100, volume = 0.8 }: SpeakerInstrumentProps) {
  const context = useRef<AudioContext | null>(null);
  const nextTime = useRef(0);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => () => { void context.current?.close(); context.current = null; }, []);
  const enable = async () => {
    context.current ??= new AudioContext({ sampleRate: rate });
    await context.current.resume();
    setEnabled(context.current.state === "running");
  };
  useEffect(() => {
    const ctx = context.current;
    if (!ctx || ctx.state !== "running" || !live || !Array.isArray(samples) || samples.length === 0) return;
    const buffer = ctx.createBuffer(1, samples.length, rate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      const value = Number(samples[i]);
      channel[i] = Number.isFinite(value) ? Math.max(-1, Math.min(1, value * volume)) : 0;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const now = ctx.currentTime;
    if (nextTime.current < now || nextTime.current > now + 0.5) nextTime.current = now + 0.03;
    source.start(nextTime.current);
    nextTime.current += buffer.duration;
  }, [samples, live, rate, volume]);
  return (
    <Instrument name={name} detail="speaker" value={Array.isArray(samples) ? `${samples.length} samples` : "waiting"} idle={!live} className="speaker-instrument">
      <span className="speaker-face">
        <button type="button" aria-pressed={enabled} onClick={enable}>{enabled ? "Sound on" : "Sound off: press for sound"}</button>
        <span className={`speaker-bars${enabled && live ? " on" : ""}`} aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => <i key={i} style={{ height: `${30 + ((i * 7) % 10) * 7}%` }} />)}
        </span>
      </span>
    </Instrument>
  );
}
