/**
 * The Scope (#37): the study instrument. Several channels over time on a canvas (uPlot), one
 * y axis per unit, zoom and pan, live or frozen, two cursors with deltas, an edge trigger,
 * xy and fft modes, four draw styles, CSV and PNG export.
 *
 * The screen is output only; every control sits in the grey caption under it. Settings
 * (mode, window, trigger, draw, hidden, ylog) are the caller's to keep (the Board layout);
 * zoom, cursors and freeze are this view's own and are not saved.
 *
 * Imports only React, uPlot and its siblings, and types from the host (tested), so it can move
 * into a shared kit for a studio app (#160) and render a finished result with live={false}.
 */
import { useDismiss } from "../dismiss.tsx";
import { Icon } from "../Icon.tsx";
import { seriesColor, token } from "../plot/tokens.ts";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import uPlot from "uplot";
import { applyBoxZoom, cursorBind, drawXCursors, formatCoord, laneRange, laneTicks, nearXCursor, panXRange, panYRange, yScaleRange, zoomRangeAround } from "./interact.ts";
import { findTrigger, spectrum, toCsv, valueAt } from "./math.ts";
import type { ScopeChannel as Channel, TapPort } from "./types.ts";
import { scopeWidget } from "./widget.ts";

export type ScopeMode = "time" | "xy" | "fft";
export type TimeSpanMode = "tracking" | "squishing";
export type ScopeTool = "pan" | "zoom";
export type DrawStyle = "line" | "line+points" | "points" | "smooth";
export type Trigger = { edge?: "rising" | "falling"; source: string; level: number; position?: number; single?: boolean };
export type ScopeSettings = {
  mode?: ScopeMode;
  timeSpanMode?: TimeSpanMode;
  window?: number;
  grid?: boolean;
  tool?: ScopeTool;
  ylog?: boolean;
  hidden?: string[];
  draw?: DrawStyle;
  trigger?: Trigger;
};

type Props = {
  name: string;
  channels: readonly Channel[];
  /** Ticks when the channels' samples change (the trace store's version). */
  version: number;
  /** A running source: follow it. False shows a finished result (a check in Articula, a stopped run). */
  live: boolean;
  settings: ScopeSettings;
  onSettings?: (next: ScopeSettings) => void;
  /** Normal size: corner ranges, a one-line legend, only ⋯ in the caption. A caption too narrow
      for its keys folds them into ⋯ at any size. */
  small?: boolean;
  /** What waits to be plotted before the first sample: its inputs' names. */
  placeholder?: string;
  taps?: readonly TapPort[];
  onTap?: (id: string) => void;
};

const MODES: ScopeMode[] = ["time", "xy", "fft"];
const DRAWS: DrawStyle[] = ["line", "line+points", "points", "smooth"];
/** Channel k: trace colour k mod 8 (the screen's own: trace 1 is the accent, live data), the same as its
    legend line; solid for 1–6, dashed 7–12, dotted from 13. */
const dashOf = (k: number) => (k < 6 ? [] : k < 12 ? [6, 4] : [1.5, 3]);
const colourOf = (k: number, _css: CSSStyleDeclaration, from?: Element | null) => token(`--trace-${(k % 8) + 1}`, seriesColor(k, from), from);
/** A lane's tick label: short, with a true minus. */
const tick = (v: number) => String(+v.toPrecision(4)).replace("-", "−");
const fmt = formatCoord;
const download = (name: string, href: string) => {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
};

type View = { x: [number, number] | null; y: [number, number] | null };
const lastOf = (buf: { values: ArrayLike<number> }) => buf.values[buf.values.length - 1];

export function Scope({ name, channels, version, live, settings, onSettings, small = false, placeholder, taps, onTap }: Props) {
  const mode = settings.mode ?? "time";
  const draw = settings.draw ?? "line";
  const hidden = useMemo(() => new Set(settings.hidden ?? []), [settings.hidden]);
  const set = (patch: Partial<ScopeSettings>) => onSettings?.({ ...settings, ...patch });
  // Every channel keeps its slot (colour, line) when others hide: k is its place in `channels`.
  const shown = channels.map((c, k) => ({ c, k })).filter(({ c }) => !hidden.has(c.id));
  const units = [...new Set(shown.map(({ c }) => c.unit ?? ""))];
  /** In time, one lane per unit, top first (REBRAND: the Scope in lanes); lane k > 0 plots on scale y{k+1}. */
  const lanes = mode === "time" ? Math.max(1, units.length) : 1;
  const scaleOf = (unit: string | undefined) => {
    const k = units.indexOf(unit ?? "");
    return k > 0 && mode === "time" ? `y${k + 1}` : "y";
  };
  /** Each lane's data range, as its scale last had it: the lane's ticks are drawn from it. */
  const bands = useRef<[number, number][]>([]);

  const [frozen, setFrozen] = useState(false);
  const [cursors, setCursors] = useState<[number, number] | null>(null);
  const [tool, setTool] = useState<ScopeTool>(settings.tool ?? "pan");
  const [menu, setMenu] = useState<"" | "more" | "trigger" | "tap">("");
  const [menuBelow, setMenuBelow] = useState(false);
  const [tapQuery, setTapQuery] = useState("");
  const [triggered, setTriggered] = useState<number | null>(null);
  const [theme, setTheme] = useState(0);
  const [folded, setFolded] = useState(small);
  /** The caption's full key row width when it last unfolded; 0 until measured. */
  const keyRowWidth = useRef(0);
  const frame = useRef<HTMLElement>(null);
  const caption = useRef<HTMLElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const keys = useRef<HTMLSpanElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);
  const view = useRef<View>({ x: null, y: null });
  const liveWindow = useRef<number | undefined>(settings.window);
  const timeSpanMode = settings.timeSpanMode ?? (settings.window ? "tracking" : "squishing");
  /** Each channel's highest FFT peak (Hz), as the last fft data had it: the legend reads it. */
  const peaksNow = useRef(new Map<string, number>());
  const draws = useRef<{ cursors: [number, number] | null; triggered: number | null; trigger?: Trigger; mode: ScopeMode }>({ cursors, triggered, trigger: settings.trigger, mode });
  draws.current = { cursors, triggered, trigger: settings.trigger, mode };
  const isFrozen = frozen || !live;
  const status = !live ? (channels.length ? "result" : "idle") : frozen ? "frozen" : settings.trigger && mode === "time" ? (triggered === null ? "armed" : "triggered") : "live";
  const compact = small || folded;

  /** Open a caption menu on the side with room: below near the top, above near the bottom. */
  const openMenu = (name: "more" | "trigger" | "tap", element?: HTMLElement | null) => {
    if (menu === name) { setMenu(""); return; }
    const rect = (element ?? caption.current)?.getBoundingClientRect();
    setMenuBelow(Boolean(rect && rect.top < window.innerHeight / 2));
    setMenu(name);
  };

  // A press outside the open menu, or Escape, closes it; a press on a caption key is left to that key.
  useDismiss(pop, () => setMenu(""), { enabled: menu !== "", triggerRef: keys });

  // The caption's keys fold into ⋯ when the tile is too narrow for them (#273): a full row needs
  // about 770px with every choice on. Measure after layout, before paint, so it never spills.
  useLayoutEffect(() => {
    const figure = frame.current;
    const row = caption.current;
    if (!figure || !row) return;
    const measure = () => {
      if (small) {
        keyRowWidth.current = 0;
        setFolded(true);
        return;
      }
      if (!folded) {
        // Expanded: it spills only when the row cannot fit. Keep what it needs to unfold again.
        if (row.scrollWidth > row.clientWidth + 1) {
          keyRowWidth.current = row.scrollWidth;
          setFolded(true);
        }
      } else if (keyRowWidth.current === 0 || row.clientWidth >= keyRowWidth.current + 8) {
        // Unfold to measure when starting wide after a small tile, or when there is room again.
        setFolded(false);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(figure);
    ro.observe(row);
    return () => ro.disconnect();
  }, [small, folded, name, mode, timeSpanMode, tool, frozen, cursors, settings.trigger, onTap, channels.length, status]);

  useEffect(() => {
    liveWindow.current = settings.window;
  }, [settings.window]);

  // The theme can change under a mounted Scope: the colours are read again.
  useEffect(() => {
    const mo = new MutationObserver(() => setTheme((n) => n + 1));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const on = () => setTheme((n) => n + 1);
    mq?.addEventListener("change", on);
    return () => {
      mo.disconnect();
      mq?.removeEventListener("change", on);
    };
  }, []);

  // ---- Data for the current mode ----
  const bounds = () => {
    let t0 = Infinity, t1 = -Infinity;
    for (const { c } of shown) {
      if (!c.buf.times.length) continue;
      t0 = Math.min(t0, c.buf.times[0]);
      t1 = Math.max(t1, c.buf.times[c.buf.times.length - 1]);
    }
    return Number.isFinite(t0) ? ([t0, t1] as [number, number]) : null;
  };
  const xRange = (): [number, number] | null => {
    const b = bounds();
    if (!b) return null;
    if (isFrozen && view.current.x) return view.current.x;
    const W = liveWindow.current ?? (timeSpanMode === "tracking" ? 10 : undefined);
    const trig = settings.trigger;
    if (trig && mode === "time") {
      const src = channels.find((c) => c.id === trig.source);
      const width = W ?? Math.max((b[1] - b[0]) / 4, 1e-6);
      const pos = (trig.position ?? 10) / 100;
      if (src) {
        const T = findTrigger(src.buf.times, src.buf.values, trig.level, trig.edge ?? "rising", b[1] - (1 - pos) * width);
        if (T !== null) {
          if (T !== draws.current.triggered) queueMicrotask(() => setTriggered(T));
          if (trig.single && live) queueMicrotask(() => setFrozen(true));
          return [T - pos * width, T + (1 - pos) * width];
        }
      }
      return view.current.x ?? [b[1] - width, b[1]];
    }
    if (timeSpanMode === "tracking" && W) {
      return [b[1] - W, b[1]];
    }
    return b;
  };
  const data = (): uPlot.AlignedData => {
    if (mode === "xy") {
      const [first, ...rest] = shown;
      const x = first ? Array.from(first.c.buf.values) : [];
      return [null, ...rest.map(({ c }) => [x.slice(0, c.buf.values.length), Array.from(c.buf.values).slice(0, x.length)])] as unknown as uPlot.AlignedData;
    }
    if (mode === "fft") {
      const [a, b] = xRange() ?? [-Infinity, Infinity];
      const tables = shown.map(({ c }) => {
        const t = c.buf.times, v = c.buf.values;
        let i0 = 0, i1 = c.buf.times.length;
        while (i0 < i1 && t[i0] < a) i0++;
        while (i1 > i0 && t[i1 - 1] > b) i1--;
        const dt = i1 - i0 > 1 ? (t[i1 - 1] - t[i0]) / (i1 - i0 - 1) : 0;
        const s = spectrum(Array.from(v).slice(i0, i1), dt);
        let best = -1;
        s.db.forEach((y, j) => (best < 0 || y > s.db[best]) && (best = j));
        if (best >= 0) peaksNow.current.set(c.id, s.f[best]);
        return [s.f, s.db] as uPlot.AlignedData;
      });
      return tables.length ? uPlot.join(tables) : [[]];
    }
    const tables = shown.map(({ c }) => [c.buf.times, c.buf.values] as unknown as uPlot.AlignedData);
    if (tables.length === 1) return [Array.from(shown[0].c.buf.times), Array.from(shown[0].c.buf.values)];
    return tables.length ? uPlot.join(tables) : [[]];
  };

  // ---- The plot: made again when what it draws changes shape, fed on every version ----
  const showGrid = settings.grid !== false;
  const useLogY = mode === "time" && !!settings.ylog;
  const shape = JSON.stringify([mode, draw, useLogY, showGrid, tool, units, shown.map(({ c, k }) => [c.id, k, c.label]), theme, small]);
  const laned = lanes > 1;
  useLayoutEffect(() => {
    const el = host.current;
    if (!el || !shown.length) return;
    const css = getComputedStyle(el);
    const ink = css.getPropertyValue("--text-on-screen").trim() || "#f2f2ee";
    const dim = css.getPropertyValue("--text-on-screen-muted").trim() || "#5d5d58";
    const font = `11px ${css.getPropertyValue("--font-mono").trim() || "monospace"}`;
    const screen = css.getPropertyValue("--surface-screen").trim() || "#050505";
    const grid = showGrid
      ? { stroke: css.getPropertyValue("--grid-line").trim() || "#333", width: 1, dash: [2, 4] }
      : { show: false };
    // Units are written in the screen's corners (see the JSX), not as axis titles.
    const axis = (scale: string, side: 1 | 2 | 3): uPlot.Axis => ({
      scale, side, stroke: dim, font, grid: side === 1 ? { show: false } : grid, ticks: { show: false }, size: side === 2 ? 22 : small ? 36 : 44, gap: 4,
    });
    const pathOf = (): uPlot.Series["paths"] =>
      draw === "points" ? () => null : draw === "smooth" ? uPlot.paths.spline!() : uPlot.paths.linear!();
    // xy: the trail, in order, as a path through the facet's points.
    const trail: uPlot.Series.PathBuilder = (u, sidx) => {
      const [xs, ys] = u.data[sidx] as unknown as [number[], number[]];
      const p = new Path2D();
      const scale = u.series[sidx].scale ?? "y";
      xs.forEach((x, i) => {
        const px = u.valToPos(x, "x", true), py = u.valToPos(ys[i], scale, true);
        if (i) p.lineTo(px, py);
        else p.moveTo(px, py);
      });
      return { stroke: p, fill: null, clip: null, band: null, gaps: null, flags: 0 } as unknown as uPlot.Series.Paths;
    };
    const series: uPlot.Series[] = [{}];
    const list = mode === "xy" ? shown.slice(1) : shown;
    for (const { c, k } of list) {
      const stroke = colourOf(k, css);
      series.push({
        label: c.label,
        stroke,
        width: 1.5,
        dash: dashOf(k),
        scale: mode === "fft" ? "y" : scaleOf(c.unit),
        spanGaps: true,
        paths: mode === "xy" ? trail : pathOf(),
        points: { show: draw === "points" || draw === "line+points", size: draw === "points" ? 4 : 5, width: 1, stroke, fill: draw === "points" ? stroke : screen },
      });
    }
    if (useLogY && view.current.y && view.current.y[0] <= 0) view.current.y = null;
    // Lanes: each unit's scale keeps its data in its own band; the lanes' ticks are drawn by hand (drawAxes).
    if (laned) view.current.y = null;
    const laneScale = (k: number): uPlot.Scale.Range => (_u, min, max) => {
      const [lo, hi] = yScaleRange(min, max, { log: useLogY && !laned, view: laned ? null : view.current.y });
      bands.current[k] = [lo, hi];
      return laneRange(lo, hi, k, lanes);
    };
    const yScales: Record<string, uPlot.Scale> = {};
    for (let k = 1; k < lanes; k++) yScales[`y${k + 1}`] = { range: laneScale(k) };
    const axes: uPlot.Axis[] = [
      { ...axis("x", 2), grid },
      laned ? { ...axis("y", 3), splits: () => [] } : axis("y", 3),
    ];
    const opts: uPlot.Options = {
      width: el.clientWidth || 300,
      height: el.clientHeight || 120,
      mode: mode === "xy" ? 2 : 1,
      pxAlign: 0,
      legend: { show: false },
      padding: [small ? 6 : 14, 18, 0, 0],
      scales: {
        x: mode === "fft" ? { time: false, distr: 3 } : { time: false, ...(mode === "time" ? { range: (_u: uPlot, min: number, max: number) => view.current.x ?? [min, max] } : {}) },
        y: useLogY && !laned ? { range: laneScale(0), distr: 3 } : { range: laneScale(0) },
        ...yScales,
      },
      axes,
      series,
      select: { show: true, left: 0, top: 0, width: 0, height: 0 },
      cursor: cursorBind(() => tool === "zoom", () => autoscaleNow.current()),
      hooks: {
        setSelect: [
          (u) => {
            const box = applyBoxZoom(u, laned ? [] : ["y"]);
            if (box && (laned || box.y.y)) {
              view.current.x = box.x;
              view.current.y = laned ? null : box.y.y;
              setFrozen(true);
              u.redraw(true);
            }
          },
        ],
        drawAxes: [(u) => laned && drawLanes(u, dim, showGrid ? grid as { stroke: string } : null, font)],
        draw: [(u) => decorateNow.current(u, ink)],
      },
    };
    const u = new uPlot(opts, data(), el);
    plot.current = u;
    const ro = new ResizeObserver(() => u.setSize({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      u.destroy();
      plot.current = null;
    };
  }, [shape]); // eslint-disable-line react-hooks/exhaustive-deps -- `shape` says when the plot must be made again

  // New samples: the same plot, new data, the window following the run (unless frozen).
  useEffect(() => {
    const u = plot.current;
    if (!u) return;
    if (!isFrozen) view.current.x = mode === "time" ? xRange() : null;
    u.setData(data(), true);
  }); // every render: version, settings, freeze and cursors all re-render

  /** Each lane's grid lines and tick labels, and its unit at its top left (lanes have no axis of their own). */
  const drawLanes = (u: uPlot, dim: string, grid: { stroke: string } | null, font: string) => {
    const { ctx } = u;
    const { left, width } = u.bbox;
    const r = devicePixelRatio || 1;
    ctx.save();
    ctx.font = font.replace(/^(\d+)px/, (_, n) => `${Number(n) * r}px`);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    units.forEach((unit, k) => {
      const band = bands.current[k];
      if (!band) return;
      const scale = k ? `y${k + 1}` : "y";
      for (const v of laneTicks(band[0], band[1])) {
        const y = Math.round(u.valToPos(v, scale, true)) + 0.5;
        if (grid) {
          ctx.strokeStyle = grid.stroke;
          ctx.lineWidth = r;
          ctx.setLineDash([2 * r, 4 * r]);
          ctx.beginPath();
          ctx.moveTo(left, y);
          ctx.lineTo(left + width, y);
          ctx.stroke();
        }
        ctx.fillStyle = dim;
        ctx.fillText(tick(v), left - 6 * r, y);
      }
      if (unit) {
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(unit, left + 4 * r, u.valToPos(band[1], scale, true) + 2 * r);
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
      }
    });
    ctx.restore();
  };

  // Cursors, the trigger level and its point: drawn over the traces.
  const decorate = (u: uPlot, ink: string) => {
    const { ctx } = u;
    const { left, top, width, height } = u.bbox;
    const d = draws.current;
    const r = devicePixelRatio || 1;
    const screen = getComputedStyle(u.root).getPropertyValue("--surface-screen").trim() || "#050505";
    ctx.save();
    ctx.font = `${10 * r}px monospace`;
    if (d.mode === "time" && d.cursors) {
      drawXCursors(ctx, u, d.cursors, { labels: ["1", "2"], ink, screenBg: screen, r });
    }
    if (d.mode === "time" && d.trigger) {
      const signal = getComputedStyle(u.root).getPropertyValue("--trace-1").trim() || "#ff6a30";
      const src = channels.find((c) => c.id === d.trigger!.source);
      const y = u.valToPos(d.trigger.level, scaleOf(src?.unit), true);
      if (y >= top && y <= top + height) {
        ctx.strokeStyle = signal;
        ctx.setLineDash([4 * r, 4 * r]);
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(left + width, y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
        ctx.fillStyle = signal;
        ctx.beginPath();
        ctx.moveTo(left + width - 14 * r, y);
        ctx.lineTo(left + width - 8 * r, y - 6 * r);
        ctx.lineTo(left + width, y - 6 * r);
        ctx.lineTo(left + width, y + 6 * r);
        ctx.lineTo(left + width - 8 * r, y + 6 * r);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = screen;
        ctx.fillText("T", left + width - 8 * r, y + 4 * r);
      }
      if (d.triggered !== null) {
        const x = u.valToPos(d.triggered, "x", true);
        ctx.fillStyle = signal;
        ctx.beginPath();
        ctx.moveTo(x - 5 * r, top);
        ctx.lineTo(x + 5 * r, top);
        ctx.lineTo(x, top + 7 * r);
        ctx.closePath();
        ctx.fill();
      }
    }
    if (d.mode === "xy") {
      // The newest point of each trail is a dot.
      u.series.forEach((s, i) => {
        if (!i) return;
        const [xs, ys] = u.data[i] as unknown as [number[], number[]];
        if (!xs?.length) return;
        ctx.fillStyle = String(s.stroke instanceof Function ? s.stroke(u, i) : s.stroke);
        ctx.beginPath();
        ctx.arc(u.valToPos(xs[xs.length - 1], "x", true), u.valToPos(ys[ys.length - 1], s.scale ?? "y", true), 3.5 * r, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
    ctx.restore();
  };

  const decorateNow = useRef(decorate);
  decorateNow.current = decorate;

  // ---- Gestures: drag pans (or moves a cursor or the trigger level), Ctrl+wheel zooms ----
  const autoscale = () => {
    view.current = { x: null, y: null };
    liveWindow.current = settings.window;
    setFrozen(false);
    setTriggered(null);
    plot.current?.redraw(true);
  };
  const autoscaleNow = useRef(autoscale);
  autoscaleNow.current = autoscale;
  const drag = useRef<null | { kind: "pan" | "cursor" | "level"; i?: number; x0: number; y0?: number; min: number; max: number; ymin?: number; ymax?: number }>(null);
  const local = (e: { clientX: number; clientY: number }) => {
    const u = plot.current!;
    const r = u.over.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  };
  const onPointerDown = (e: ReactPointerEvent) => {
    const u = plot.current;
    if (!u || e.button !== 0 || e.ctrlKey || e.metaKey || mode !== "time" || !(e.target as Element).closest(".u-over")) return;
    const p = local(e);
    const min = u.scales.x.min ?? 0, max = u.scales.x.max ?? 1;
    const ymin = u.scales.y.min ?? 0, ymax = u.scales.y.max ?? 1;
    const near = nearXCursor(u, cursors, p.x);
    const trig = settings.trigger;
    if (near >= 0) drag.current = { kind: "cursor", i: near, x0: p.x, min, max };
    else if (trig && p.x > p.w - 18 && Math.abs(u.valToPos(trig.level, scaleOf(channels.find((c) => c.id === trig.source)?.unit)) - p.y) < 9)
      drag.current = { kind: "level", x0: p.y, min, max };
    else if (tool === "zoom") return; // Square cursor drag zoom: uPlot handler draws the zoom box
    else drag.current = { kind: "pan", x0: p.x, y0: p.y, min, max, ymin, ymax };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    e.stopPropagation(); // outside Arrange the Board must not start a drag of the cell
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const u = plot.current, d = drag.current;
    if (!u || !d) return;
    const p = local(e);
    if (d.kind === "pan") {
      // Both axes move with the pointer: a zoomed y view pans up and down too.
      view.current.x = panXRange(d.min, d.max, p.x - d.x0, p.w);
      if (lanes < 2) view.current.y = panYRange(d.ymin ?? 0, d.ymax ?? 0, p.y - (d.y0 ?? p.y), p.h, { log: useLogY });
      if (!frozen) setFrozen(true); // panning back in time freezes the Scope
      u.redraw(true);
    } else if (d.kind === "cursor" && cursors) {
      const next: [number, number] = [...cursors];
      next[d.i!] = u.posToVal(p.x, "x");
      setCursors(next);
    } else if (d.kind === "level" && settings.trigger) {
      const scale = scaleOf(channels.find((c) => c.id === settings.trigger!.source)?.unit);
      draws.current.trigger = { ...settings.trigger, level: u.posToVal(p.y, scale) };
      u.redraw(false);
    }
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.kind === "level" && draws.current.trigger) set({ trigger: { ...draws.current.trigger, level: +draws.current.trigger.level.toPrecision(4) } });
  };
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      const u = plot.current;
      if (!u || !(e.ctrlKey || e.metaKey) || mode === "xy") return; // a plain wheel scrolls the Board
      e.preventDefault();
      const p = local(e);
      const f = e.deltaY > 0 ? 1.25 : 0.8;
      if (e.shiftKey && lanes < 2) {
        const at = u.posToVal(p.y, "y"), [a, b] = [u.scales.y.min ?? 0, u.scales.y.max ?? 1];
        view.current.y = zoomRangeAround(a, b, at, f, useLogY);
      } else {
        const at = u.posToVal(p.x, "x"), [a, b] = [u.scales.x.min ?? 0, u.scales.x.max ?? 1];
        view.current.x = zoomRangeAround(a, b, at, f);
        if (!isFrozen) liveWindow.current = view.current.x[1] - view.current.x[0]; // zooming while live keeps following, with the new window
      }
      u.redraw(true);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  });

  const toggleCursors = () => {
    const u = plot.current;
    if (cursors || !u) return setCursors(null);
    const a = u.scales.x.min ?? 0, b = u.scales.x.max ?? 1;
    setCursors([a + (b - a) / 3, a + (2 * (b - a)) / 3]);
  };
  const toggleFreeze = () => {
    if (frozen) autoscale();
    else {
      const u = plot.current;
      if (u && mode === "time") view.current.x = [u.scales.x.min ?? 0, u.scales.x.max ?? 1];
      setFrozen(true);
    }
  };
  const onKey = (e: ReactKeyboardEvent) => {
    if ((e.target as Element).closest("input, select, button")) return;
    const k = e.key.toLowerCase();
    if (k === "f") toggleFreeze();
    else if (k === "c") toggleCursors();
    else if (k === "t") {
      const rect = caption.current?.getBoundingClientRect();
      setMenuBelow(Boolean(rect && rect.top < window.innerHeight / 2));
      setMenu((m) => (m === "trigger" ? "" : "trigger"));
    }
    else if (k === "a") autoscale();
    else if (k === "g") set({ grid: settings.grid === false ? true : false });
    else if (k === "z") setTool((t) => (t === "zoom" ? "pan" : "zoom"));
    else if (k === "escape") {
      if (tool === "zoom") setTool("pan");
      setMenu("");
    }
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  // ---- Readouts ----
  const at = (c: Channel, t: number) => valueAt(c.buf.times, c.buf.values, t);
  const peaks = peaksNow.current;
  const legendValue = (c: Channel) =>
    mode === "fft" ? (peaks.has(c.id) ? `${fmt(peaks.get(c.id), 2)}` : "–") : cursors && mode === "time" ? fmt(at(c, cursors[1])) : fmt(lastOf(c.buf));
  const legendUnit = (c: Channel) => (mode === "fft" ? "Hz" : c.unit);

  const exportCsv = (all: boolean) => {
    const u = plot.current;
    const [a, b] = all || !u || mode !== "time" ? [-Infinity, Infinity] : [u.scales.x.min ?? -Infinity, u.scales.x.max ?? Infinity];
    const text = toCsv(shown.map(({ c }) => ({ label: c.label, unit: c.unit, t: c.buf.times, v: c.buf.values })), a, b);
    download(`${name}.csv`, URL.createObjectURL(new Blob([text], { type: "text/csv" })));
    setMenu("");
  };
  const exportPng = () => {
    const u = plot.current;
    if (!u) return;
    // The screen, with the legend written along its top.
    const canvas = document.createElement("canvas");
    canvas.width = u.ctx.canvas.width;
    canvas.height = u.ctx.canvas.height;
    const g = canvas.getContext("2d")!;
    const css = getComputedStyle(u.root);
    g.fillStyle = css.getPropertyValue("--surface-screen").trim() || "#050505";
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(u.ctx.canvas, 0, 0);
    g.font = `${11 * (devicePixelRatio || 1)}px monospace`;
    let x = 8;
    shown.forEach(({ c, k }) => {
      g.fillStyle = colourOf(k, css);
      const text = `${c.label} ${legendValue(c)}${legendUnit(c) ? ` ${legendUnit(c)}` : ""}`;
      g.fillText(text, x, 14 * (devicePixelRatio || 1));
      x += g.measureText(text).width + 16;
    });
    download(`${name}.png`, canvas.toDataURL("image/png"));
    setMenu("");
  };
  const copyCursors = () => {
    if (!cursors) return;
    const [t1, t2] = cursors;
    const lines = [`t1 ${fmt(t1)} s`, `t2 ${fmt(t2)} s`, `Δt ${fmt(t2 - t1)} s`, `1/Δt ${fmt(1 / (t2 - t1))} Hz`];
    for (const { c } of shown) {
      const a = at(c, t1), b = at(c, t2);
      lines.push(`Δ${c.label} ${a === null || b === null ? "–" : fmt(b - a)}${c.unit ? ` ${c.unit}` : ""}`);
    }
    void navigator.clipboard?.writeText(lines.join("\n"));
    setMenu("");
  };

  const trig = settings.trigger;
  const tapList = (taps ?? []).filter((t) => t.label.toLowerCase().includes(tapQuery.toLowerCase()));

  return (
    <figure
      ref={frame}
      className={`instrument scope${channels.length ? "" : " idle"}${small ? " small" : ""}`}
      data-widget={scopeWidget.id}
      data-widget-version={scopeWidget.version}
      data-version={version}
      tabIndex={0}
      onKeyDown={onKey}
      aria-label={`Scope ${name}`}
    >
      <div className={`screen${cursors && mode === "time" && channels.length ? " with-readout" : ""}`}>
        {channels.length > 0 && (
          <div className="scope-legend" role="list">
            {(mode === "xy" ? shown.slice(0, 1) : []).map(({ c }) => (
              <span key={`x-${c.id}`} className="scope-entry" role="listitem">
                x {c.label} <b>{fmt(lastOf(c.buf))}</b>
                {c.unit && <i>{c.unit}</i>}
              </span>
            ))}
            {channels.map((c, k) => (mode === "xy" && shown[0]?.c === c ? null : (
              <button
                key={c.id}
                className={`scope-entry${hidden.has(c.id) ? " off" : ""}`}
                role="listitem"
                title={hidden.has(c.id) ? `Show ${c.label}` : `Hide ${c.label}`}
                onClick={() => set({ hidden: hidden.has(c.id) ? [...hidden].filter((h) => h !== c.id) : [...hidden, c.id] })}
              >
                <svg width="16" height="6" aria-hidden>
                  <line x1="0" y1="3" x2="16" y2="3" style={{ stroke: `var(--trace-${(k % 8) + 1})` }} strokeWidth="1.6" strokeDasharray={dashOf(k).join(" ") || undefined} />
                </svg>
                {mode === "xy" && "y "}
                {c.label} <b>{legendValue(c)}</b>
                {legendUnit(c) && <i>{legendUnit(c)}</i>}
              </button>
            )))}
          </div>
        )}
        <div
          ref={host}
          className={`scope-plot${tool === "zoom" ? " tool-zoom" : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {channels.length > 0 && (
          <>
            {lanes < 2 && <span className="scope-unit y">{mode === "fft" ? "dB" : mode === "xy" ? shown[1]?.c.unit : units[0]}</span>}
            <span className="scope-unit x">{mode === "fft" ? "Hz" : mode === "xy" ? shown[0]?.c.unit : "s"}</span>
          </>
        )}
                {!channels.length && <output className="scope-placeholder">{placeholder ?? "scope"}</output>}
        {cursors && mode === "time" && channels.length > 0 && (
          <div className="scope-readout">
            <span>1 {fmt(cursors[0])} s</span>
            <span>2 {fmt(cursors[1])} s</span>
            <span>Δt {fmt(cursors[1] - cursors[0])} s</span>
            <span>1/Δt {fmt(1 / (cursors[1] - cursors[0]))} Hz</span>
            {shown.map(({ c, k }) => {
              const a = at(c, cursors[0]), b = at(c, cursors[1]);
              return (
                <span key={c.id}>
                  <svg width="12" height="6" aria-hidden>
                    <line x1="0" y1="3" x2="12" y2="3" style={{ stroke: `var(--trace-${(k % 8) + 1})` }} strokeWidth="1.6" strokeDasharray={dashOf(k).join(" ") || undefined} />
                  </svg>{" "}
                  Δ{c.label} {a === null || b === null ? "–" : `${b - a >= 0 ? "+" : ""}${fmt(b - a)}`}
                  {c.unit ? ` ${c.unit}` : ""}
                </span>
              );
            })}
          </div>
        )}
      </div>
      <figcaption ref={caption}>
        <b>{name}</b>
        <span className={`scope-status ${status}`}>{status}</span>
        <span className="scope-keys" ref={keys}>
          {!compact && (
            <>
              <span className="scope-modes" role="radiogroup" aria-label="Mode">
                {MODES.map((m) => (
                  <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? "on" : ""} onClick={() => set({ mode: m === "time" ? undefined : m })}>
                    {m}
                  </button>
                ))}
              </span>
              <i className="scope-sep" />
              {onTap && (
                <button title="Wire an output into this Scope" onClick={(e) => openMenu("tap", e.currentTarget)}>
                  + tap
                </button>
              )}
              <button className={isFrozen && live ? "on" : ""} aria-pressed={frozen && live} disabled={!live} title="Freeze or follow (F)" onClick={toggleFreeze}>
                freeze
              </button>
              <button className={trig ? "on" : ""} aria-pressed={!!trig} disabled={mode !== "time"} title="Trigger (T)" onClick={(e) => openMenu("trigger", e.currentTarget)}>
                trigger
              </button>
              <i className="scope-sep" />
            </>
          )}
          {/* The plot's tools, as Plot2D has them (Articula, Julix): always in view, never folded. */}
          <span className="scope-tools" role="group" aria-label="Tools">
            <button className={`pb-plot2d-btn${tool === "pan" ? " on" : ""}`} aria-pressed={tool === "pan"} title="Pan: drag to move along time and value" aria-label="Pan" onClick={() => setTool("pan")}>
              <Icon name="move" size={13} />
            </button>
            <button className={`pb-plot2d-btn${tool === "zoom" ? " on" : ""}`} aria-pressed={tool === "zoom"} title="Box zoom: drag a rectangle (Z)" aria-label="Box zoom" onClick={() => setTool((t) => (t === "zoom" ? "pan" : "zoom"))}>
              <Icon name="zoom-in" size={13} />
            </button>
            <button className={`pb-plot2d-btn${cursors ? " on" : ""}`} aria-pressed={!!cursors} disabled={mode !== "time" || !channels.length} title="Two cursors and their deltas (C)" onClick={toggleCursors}>
              A/B
            </button>
            <button className={`pb-plot2d-btn${settings.grid !== false ? " on" : ""}`} aria-pressed={settings.grid !== false} title="Grid (G)" onClick={() => set({ grid: settings.grid === false ? true : false })}>
              grid
            </button>
            <button className="pb-plot2d-btn" disabled={!channels.length} title="Fit the graph (A, double-click)" aria-label="Fit the graph" onClick={autoscale}>
              <Icon name="screen-full" size={13} />
            </button>
          </span>
          <button title="More" aria-label="More" aria-haspopup="menu" aria-expanded={menu === "more"} onClick={(e) => openMenu("more", e.currentTarget)}>
            ⋯
          </button>
        </span>
        {menu === "more" && (
          <div ref={pop} className={`scope-pop${menuBelow ? " below" : ""}`} role="menu">
            <button className="opt" disabled={!channels.length} onClick={() => { autoscale(); setMenu(""); }}>
              Fit graph <i>A, double-click</i>
            </button>
            {compact && (
              <div className="scope-row">
                {MODES.map((m) => (
                  <button key={m} className={`opt${mode === m ? " on" : ""}`} onClick={() => set({ mode: m === "time" ? undefined : m })}>
                    {m}
                  </button>
                ))}
              </div>
            )}
            {mode === "time" && (
              <div className="scope-row" role="radiogroup" aria-label="Span">
                {(["track", "squish"] as const).map((m) => {
                  const active = (m === "track") === (timeSpanMode === "tracking");
                  return (
                    <button
                      key={m}
                      role="radio"
                      aria-checked={active}
                      className={`opt${active ? " on" : ""}`}
                      title={m === "track" ? "Tracking: a window of constant length follows the run" : "Squishing: the whole run, so far"}
                      onClick={() => {
                        if (m === "track") {
                          const nextW = settings.window ?? liveWindow.current ?? 10;
                          liveWindow.current = nextW;
                          set({ timeSpanMode: "tracking", window: nextW });
                        } else {
                          liveWindow.current = undefined;
                          set({ timeSpanMode: "squishing", window: undefined });
                        }
                      }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="scope-row" role="radiogroup" aria-label="Tool">
              {(["pan", "zoom"] as const).map((t) => (
                <button key={t} role="radio" aria-checked={tool === t} className={`opt${tool === t ? " on" : ""}`}
                  title={t === "pan" ? "Pan: drag to move along time and value" : "Zoom: drag a rectangle to zoom in (Z)"} onClick={() => setTool(t)}>
                  {t}
                </button>
              ))}
            </div>
            <div className="scope-row" aria-label="Draw">
              {DRAWS.map((d) => (
                <button key={d} className={`opt${draw === d ? " on" : ""}`} onClick={() => set({ draw: d === "line" ? undefined : d })}>
                  {d}
                </button>
              ))}
            </div>
            <label className="scope-row">
              window
              <input
                className="well"
                type="number"
                min={0}
                step="any"
                placeholder="whole run"
                defaultValue={settings.window ?? ""}
                onBlur={(e) => set({ window: Number(e.target.value) > 0 ? Number(e.target.value) : undefined })}
              />
              s
            </label>
            <label className="scope-row">
              <input type="checkbox" checked={settings.grid !== false} onChange={(e) => set({ grid: e.target.checked })} /> grid
            </label>
            <label className="scope-row">
              <input type="checkbox" checked={!!settings.ylog} disabled={mode !== "time"} onChange={(e) => set({ ylog: e.target.checked || undefined })} /> log y
            </label>
            {compact && (
              <>
                {onTap && (
                  <button className="opt" onClick={() => openMenu("tap")}>+ tap</button>
                )}
                <button className={`opt${frozen && live ? " on" : ""}`} disabled={!live} onClick={toggleFreeze}>freeze</button>
                <button className={`opt${cursors ? " on" : ""}`} disabled={mode !== "time"} onClick={toggleCursors}>cursors</button>
                <button className={`opt${trig ? " on" : ""}`} disabled={mode !== "time"} onClick={() => openMenu("trigger")}>trigger</button>
              </>
            )}
            <hr />
            <button className="opt" onClick={() => exportCsv(false)} disabled={!channels.length}>CSV, visible range</button>
            <button className="opt" onClick={() => exportCsv(true)} disabled={!channels.length}>CSV, all</button>
            <button className="opt" onClick={exportPng} disabled={!channels.length}>PNG</button>
            <button className="opt" onClick={copyCursors} disabled={!cursors}>Copy cursor values</button>
          </div>
        )}
        {menu === "trigger" && (
          <div ref={pop} className={`scope-pop${menuBelow ? " below" : ""}`} role="dialog" aria-label="Trigger">
            <div className="scope-row">
              {(["rising", "falling"] as const).map((edge) => (
                <button key={edge} className={`opt${(trig?.edge ?? "rising") === edge ? " on" : ""}`} onClick={() => set({ trigger: { source: trig?.source ?? shown[0]?.c.id ?? "", level: trig?.level ?? 0, ...trig, edge } })}>
                  {edge}
                </button>
              ))}
            </div>
            <label className="scope-row">
              source
              <select className="well" value={trig?.source ?? ""} onChange={(e) => set({ trigger: { level: 0, ...trig, source: e.target.value } })}>
                {!trig && <option value="">pick a channel</option>}
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className="scope-row">
              level
              <input className="well" type="number" step="any" defaultValue={trig?.level ?? 0} key={trig?.level} onBlur={(e) => trig && set({ trigger: { ...trig, level: Number(e.target.value) || 0 } })} />
            </label>
            <label className="scope-row">
              position
              <input className="well" type="number" min={0} max={100} defaultValue={trig?.position ?? 10} onBlur={(e) => trig && set({ trigger: { ...trig, position: Math.min(100, Math.max(0, Number(e.target.value) || 0)) } })} />%
            </label>
            <div className="scope-row">
              {(["auto", "single"] as const).map((m) => (
                <button key={m} className={`opt${(trig?.single ? "single" : "auto") === m ? " on" : ""}`} disabled={!trig} onClick={() => { if (trig) { set({ trigger: { ...trig, single: m === "single" || undefined } }); autoscale(); } }}>
                  {m}
                </button>
              ))}
            </div>
            <button className="opt" disabled={!trig} onClick={() => { set({ trigger: undefined }); setMenu(""); setTriggered(null); }}>
              No trigger
            </button>
          </div>
        )}
        {menu === "tap" && (
          <div ref={pop} className={`scope-pop${menuBelow ? " below" : ""}`} role="dialog" aria-label="Tap an output">
            <input className="well" autoFocus placeholder="/ search outputs" value={tapQuery} onChange={(e) => setTapQuery(e.target.value)} />
            <div className="scope-taps">
              {tapList.length === 0 && <span className="muted">no outputs</span>}
              {tapList.slice(0, 40).map((t) => (
                <button key={t.id} className="opt" onClick={() => { onTap?.(t.id); setMenu(""); setTapQuery(""); }}>
                  {t.label}
                  {t.unit && <i> {t.unit}</i>}
                </button>
              ))}
            </div>
          </div>
        )}
      </figcaption>
    </figure>
  );
}
