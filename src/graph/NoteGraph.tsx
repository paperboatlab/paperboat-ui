// The note graph (Obsidian's graph): every note a dot sized by its links, every link a line, laid out by a
// force that settles. It is drawn on one canvas, so a hub of thousands pans, zooms and drags smoothly, and it is
// laid out before it is shown: it opens fitted once, with nothing jumping, and takes one short breath to rest
// (none with reduced motion), so it reads as live. Labels keep clear of other notes; where they still meet (a
// dense hub zoomed out a little) the better-linked note's label wins. Hover a note and the rest
// dims to its neighbours; drag one and the others follow; the focus (the note open) carries the accent ring.
// Compact, it is the local graph beside a note: labels only for the focus and what the pointer is on, no wheel
// zoom, no keys. One quiet key fits it to view.
import { useEffect, useMemo, useRef, useState } from "react";
import { ICONS, type IconName } from "../icons.ts";
import { Key } from "../Key.tsx";
import { Force, type SimNode } from "./force.ts";

/** A note or file: its label, and its type as the file tree shows it (`fileIconFor`: the icon and its tone,
 *  the --file-* colours, brand.html §11), so a note, a table, a Julia script or a Simplicial station reads
 *  as what it is. */
export type GraphNode = { id: string; label: string; icon?: IconName; tone?: string; missing?: boolean };
export type GraphLink = { source: string; target: string };

type Props = {
  nodes: readonly GraphNode[];
  links: readonly GraphLink[];
  /** The note open: the accent ring. */
  focus?: string;
  onOpen?: (id: string) => void;
  /** The local graph beside a note: small, labels only where the pointer is, no keys, no wheel zoom. */
  compact?: boolean;
  ariaLabel: string;
  /** A name to keep the layout under between visits (the hub's id), so a big hub's graph opens at once. */
  keep?: string;
};

// where each graph's notes were, so coming back to it opens where it was left (per graph: the hub's, the local);
// with `keep`, also between visits (localStorage: a few hundred kB for a hub of 10 000 notes)
type Places = Map<string, { x: number; y: number }>;
const memory = new Map<string, Places>();
// v2: layouts from before labels took room (a v1 layout would keep its overlaps), dropped on the next write
const store = (keep: string) => `pb.graph.v2.${keep}`;
function recall(name: string, keep?: string): Places {
  let m = memory.get(name);
  if (!m && keep) try {
    const o = JSON.parse(localStorage.getItem(store(keep)) ?? "{}") as Record<string, [number, number]>;
    m = new Map(Object.entries(o).map(([id, [x, y]]) => [id, { x, y }]));
  } catch { /* none kept, or unreadable: a fresh layout */ }
  return m ?? new Map();
}
function keepPlaces(name: string, keep: string | undefined, m: Places) {
  memory.set(name, m);
  if (keep) try { localStorage.removeItem(`pb.graph.${keep}`); localStorage.setItem(store(keep), JSON.stringify(Object.fromEntries([...m].map(([id, p]) => [id, [Math.round(p.x), Math.round(p.y)]])))); } catch { /* full: kept for this visit only */ }
}

// an icon as a picture in one colour, drawn once and reused (the kit's icon rules, ui.css .pb-icon, inlined)
const pictures = new Map<string, HTMLImageElement>();
function picture(name: IconName, colour: string, redraw: () => void) {
  const key = `${name} ${colour}`;
  let img = pictures.get(key);
  if (!img) {
    const [box, body, line] = ICONS[name] as readonly [string, string, true?];
    const stroke = `fill:none;stroke:${colour};stroke-width:1;stroke-linecap:square;stroke-linejoin:miter`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" width="32" height="32" style="fill:${colour}${line ? `;${stroke}` : ""}">`
      + `<style>.ri-l{${stroke}}.ri-v{fill:none;stroke:${colour};stroke-width:1;stroke-dasharray:1.5 1}.ri-fl{fill-opacity:.32}.ri-fd{fill-opacity:.9}</style>${body}</svg>`;
    img = new Image();
    img.onload = redraw;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    pictures.set(key, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

type View = { x: number; y: number; k: number };  // screen = world × k + (x, y)
type Label = [text: string, x: number, y: number, colour: string, state: string, id: string];
const still = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function NoteGraph({ nodes, links, focus, onOpen, compact = false, ariaLabel, keep }: Props) {
  const box = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const sim = useRef<Force | null>(null);
  const view = useRef<View>({ x: 0, y: 0, k: 1 });
  const hover = useRef<string | null>(null);
  const touched = useRef(false);  // the user moved the view or a dot: no more fitting by itself
  const [laying, setLaying] = useState(false);
  const busy = useRef(false);  // laying, for the frames (they outlive a render)
  const live = useRef({ nodes, focus, compact }); live.current = { nodes, focus, compact };

  const degree = useMemo(() => {
    const d = new Map<string, number>();
    for (const l of links) { d.set(l.source, (d.get(l.source) ?? 0) + 1); d.set(l.target, (d.get(l.target) ?? 0) + 1); }
    return d;
  }, [links]);
  const radius = (id: string) => (compact ? 7 : 8) + Math.sqrt(degree.get(id) ?? 0) * (compact ? 1.4 : 2);
  const r = useRef(radius); r.current = radius;

  // ── drawing: one frame at most per animation frame, whatever asked for it
  const frame = useRef(0);
  const redraw = () => { if (!frame.current) frame.current = requestAnimationFrame(() => { frame.current = 0; draw(); }); };
  function draw() {
    const c = canvas.current, f = sim.current, el = box.current;
    if (!c || !el) return;
    const ctx = c.getContext("2d")!, dpr = window.devicePixelRatio || 1, w = el.clientWidth, h = el.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const css = getComputedStyle(el), v = (p: string) => css.getPropertyValue(p).trim();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!f || busy.current) return;
    const { nodes: ns, focus: fo, compact: small } = live.current, { k } = view.current;
    ctx.translate(view.current.x, view.current.y);
    ctx.scale(k, k);
    // what is on screen, in the layout's units (with a margin for labels)
    const x0 = -view.current.x / k - 60, y0 = -view.current.y / k - 60, x1 = x0 + w / k + 120, y1 = y0 + h / k + 120;
    const seen = (n: SimNode) => n.x > x0 && n.x < x1 && n.y > y0 && n.y < y1;
    const at = hover.current, near = at ? new Set([at]) : null;
    if (near) for (const [a, b] of f.pairs) { if (a.id === at) near.add(b.id); if (b.id === at) near.add(a.id); }

    // links: hairlines; lit to the hovered note, faint elsewhere while one is hovered
    ctx.lineWidth = 1 / k;
    ctx.strokeStyle = v("--line-strong");
    ctx.globalAlpha = near ? 0.15 : 1;
    ctx.beginPath();
    for (const [a, b] of f.pairs) if ((seen(a) || seen(b)) && !(near && (a.id === at || b.id === at))) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    ctx.stroke();
    if (near) {
      ctx.globalAlpha = 1; ctx.strokeStyle = v("--line-ink"); ctx.beginPath();
      for (const [a, b] of f.pairs) if (a.id === at || b.id === at) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      ctx.stroke();
    }

    // dots: the type's icon on a disc tinted in the type's colour (as the file tree's glyphs)
    const raised = v("--surface-raised"), sunken = v("--surface-sunken"), muted = v("--text-muted"), text = v("--text");
    const tones = new Map<string, string>(), tone = (t?: string) => { if (!t) return muted; let c = tones.get(t); if (!c) tones.set(t, (c = v(`--file-${t}`) || muted)); return c; };
    const showAll = !small && k >= 0.7;
    const size = parseFloat(v("--size-3xs")) || 11;
    // labels keep their own size at every zoom: readable zoomed out, and zooming in makes room between them
    ctx.font = `${(small ? 10 : size) / k}px ${v("--font-sans") || "sans-serif"}`;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    const byId = new Map(f.nodes.map((n) => [n.id, n]));
    const labels: Label[] = [];
    for (const g of ns) {
      const n = byId.get(g.id);
      if (!n || !seen(n)) continue;
      const rr = r.current(g.id), far = !!near && !near.has(g.id), colour = g.missing ? muted : tone(g.tone);
      ctx.globalAlpha = far ? 0.2 : 1;
      ctx.beginPath(); ctx.arc(n.x, n.y, rr, 0, 2 * Math.PI);
      ctx.fillStyle = g.missing ? sunken : raised; ctx.fill();
      if (!g.missing) { ctx.globalAlpha *= 0.16; ctx.fillStyle = colour; ctx.fill(); ctx.globalAlpha = far ? 0.2 : 1; }
      ctx.lineWidth = 1.5; ctx.strokeStyle = g.missing ? v("--line-strong") : colour;
      ctx.setLineDash(g.missing ? [3, 2] : []); ctx.stroke(); ctx.setLineDash([]);
      if (g.id === fo) {
        ctx.lineWidth = 3; ctx.strokeStyle = sunken; ctx.beginPath(); ctx.arc(n.x, n.y, rr + 1.5, 0, 2 * Math.PI); ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = v("--accent-select"); ctx.beginPath(); ctx.arc(n.x, n.y, rr + 4, 0, 2 * Math.PI); ctx.stroke();
      }
      const s = rr * 1.1, img = g.icon && s * k >= 6 ? picture(g.icon, colour, redraw) : null;  // too small to read: just the disc
      if (img) ctx.drawImage(img, n.x - s / 2, n.y - s / 2, s, s);
      const state = g.id === fo ? "focus" : near?.has(g.id) ? "near" : far ? "far" : "";
      if (showAll ? !far : g.id === fo || g.id === at || state === "near")
        labels.push([g.label, n.x, n.y + rr + 4 / k, state === "focus" || state === "near" ? text : muted, state, g.id]);
    }
    // labels over every dot, so a dot never hides a neighbour's name; ringed in the ground's colour, so a link
    // under one never crosses its letters; one that would meet a label already placed waits (the focus and the
    // hovered neighbourhood first, then the best-linked)
    ctx.globalAlpha = 1;
    ctx.lineWidth = 3 / k; ctx.lineJoin = "round"; ctx.strokeStyle = sunken;
    const lh = (small ? 10 : size) * 1.25 / k, placed: [number, number, number, number][] = [];
    const rank = (l: Label) => (l[4] === "focus" ? 1e9 : l[4] === "near" ? 1e8 : 0) + (degree.get(l[5]) ?? 0);
    for (const l of labels.sort((a, b) => rank(b) - rank(a))) {
      const [s, x, y, c] = l, hw = ctx.measureText(s).width / 2;
      // ponytail: every label against every placed one (fine for the few hundred on screen); a grid if it shows
      if (placed.some(([a, b, cc, d]) => x - hw < cc && x + hw > a && y < d && y + lh > b)) continue;
      placed.push([x - hw, y, x + hw, y + lh]);
      ctx.strokeText(s, x, y); ctx.fillStyle = c; ctx.fillText(s, x, y);
    }
  }

  // fits the layout to the view; a small hub opens at its own size, never blown up past 1.25
  const fit = () => {
    const ns = sim.current?.nodes, el = box.current;
    if (!ns?.length || !el) return;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const n of ns) { x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y); }
    const pad = 40, w = el.clientWidth, h = el.clientHeight;
    y1 += 16;  // a label's height
    const k = Math.max(0.05, Math.min(1.25, (w - 2 * pad) / Math.max(1, x1 - x0), (h - 2 * pad) / Math.max(1, y1 - y0)));
    view.current = { x: w / 2 - ((x0 + x1) / 2) * k, y: h / 2 - ((y0 + y1) / 2) * k, k };
    redraw();
  };

  // a new set of notes or links: a new layout, keeping where known notes were, laid out unseen a share of each
  // frame (the page stays responsive), then shown at rest and fitted once
  const key = nodes.map((n) => n.id).join("\n") + "\n--\n" + links.map((l) => `${l.source}>${l.target}`).join("\n");
  const run = useRef(0);
  useEffect(() => {
    const name = `${keep ?? ""} ${ariaLabel}`, kept = recall(name, compact ? undefined : keep);
    for (const n of sim.current?.nodes ?? []) kept.set(n.id, { x: n.x, y: n.y });
    // the labels' room at the zoom a small hub opens at (1: labels keep their screen size, so zooming in makes more)
    let label: ((id: string) => { w: number; h: number }) | undefined;
    const el = box.current, ctx = !compact && el ? document.createElement("canvas").getContext("2d") : null;
    if (ctx && el) {
      const css = getComputedStyle(el), size = parseFloat(css.getPropertyValue("--size-3xs")) || 11;
      ctx.font = `${size}px ${css.getPropertyValue("--font-sans").trim() || "sans-serif"}`;
      const text = new Map(nodes.map((n) => [n.id, n.label]));
      label = (id) => ({ w: ctx.measureText(text.get(id) ?? "").width, h: size * 1.25 });
    }
    const f = (sim.current = new Force(nodes.map((n) => n.id), links, kept, (id) => r.current(id) + (compact ? 0 : 6), label));
    const fresh = !nodes.every((n) => kept.has(n.id));
    cancelAnimationFrame(run.current);
    const done = () => {
      const m = new Map<string, { x: number; y: number }>();
      for (const n of f.nodes) m.set(n.id, { x: n.x, y: n.y });
      keepPlaces(name, compact ? undefined : keep, m);
      busy.current = false; setLaying(false);
      if (fresh || !touched.current) fit(); else redraw();
      if (!still()) { f.breathe(); animate(); }   // places kept are the ones at rest, before the breath
    };
    if (f.settle(24)) return done();
    busy.current = true; setLaying(true);
    const more = () => { if (sim.current !== f) return; if (f.settle(24)) done(); else run.current = requestAnimationFrame(more); };
    run.current = requestAnimationFrame(more);
    return () => cancelAnimationFrame(run.current);
    // `key` stands for nodes and links
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(redraw);  // focus, labels, a new laying state

  // the size of the box, and the theme (colours are read from the page's tokens at each frame)
  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => (touched.current ? redraw() : fit()));
    ro.observe(el);
    const mo = new MutationObserver(redraw);
    mo.observe(document.documentElement, { attributes: true });
    return () => { ro.disconnect(); mo.disconnect(); cancelAnimationFrame(frame.current); cancelAnimationFrame(moving.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── the pointer: hover, click, drag a dot (the layout follows), drag the ground (pan), wheel (zoom)
  const moving = useRef(0);
  const animate = () => {
    if (moving.current) return;
    const tick = () => { const go = sim.current?.step() ?? false; draw(); moving.current = go ? requestAnimationFrame(tick) : 0; };
    moving.current = requestAnimationFrame(tick);
  };
  const world = (e: { clientX: number; clientY: number }) => {
    const b = canvas.current!.getBoundingClientRect(), { x, y, k } = view.current;
    return { x: (e.clientX - b.left - x) / k, y: (e.clientY - b.top - y) / k };
  };
  const nodeAt = (e: { clientX: number; clientY: number }) => {
    const p = world(e), slack = 3 / view.current.k;
    let best: SimNode | null = null, bd = Infinity;
    for (const n of sim.current?.nodes ?? []) {
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d < r.current(n.id) + slack && d < bd) { best = n; bd = d; }
    }
    return best;
  };
  const press = useRef<{ id: string | null; sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null);
  const down = (e: React.PointerEvent) => {
    if (e.button !== 0 || busy.current) return;
    canvas.current!.setPointerCapture(e.pointerId);
    press.current = { id: nodeAt(e)?.id ?? null, sx: e.clientX, sy: e.clientY, vx: view.current.x, vy: view.current.y, moved: false };
  };
  const move = (e: React.PointerEvent) => {
    const p = press.current;
    if (!p) {
      const id = nodeAt(e)?.id ?? null;
      canvas.current!.style.cursor = id ? "pointer" : "grab";
      if (id !== hover.current) { hover.current = id; redraw(); }
      return;
    }
    if (!p.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 3) return;
    p.moved = touched.current = true;
    if (p.id) { const w = world(e); sim.current?.hold(p.id, w.x, w.y); animate(); }
    else { canvas.current!.style.cursor = "grabbing"; view.current = { ...view.current, x: p.vx + e.clientX - p.sx, y: p.vy + e.clientY - p.sy }; redraw(); }
  };
  const up = () => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    canvas.current!.style.cursor = p.id ? "pointer" : "grab";
    if (p.id && p.moved) { sim.current?.release(p.id); animate(); }
    else if (p.id && !p.moved) onOpen?.(p.id);
  };
  useEffect(() => {
    const c = canvas.current!;
    if (compact) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      touched.current = true;
      const b = c.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top, v = view.current;
      const k = Math.min(4, Math.max(0.05, v.k * Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0015))));
      view.current = { k, x: mx - ((mx - v.x) / v.k) * k, y: my - ((my - v.y) / v.k) * k };
      redraw();
    };
    c.addEventListener("wheel", wheel, { passive: false });
    return () => c.removeEventListener("wheel", wheel);
  }, [compact]);

  return (
    <div ref={box} className={`note-graph${compact ? " compact" : ""}`}>
      <canvas ref={canvas} role="img" aria-label={`${ariaLabel}: ${nodes.length} notes, ${links.length} links`}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onPointerLeave={() => { if (!press.current && hover.current) { hover.current = null; redraw(); } }} />
      {laying && <span className="note-graph-wait">Laying out {nodes.length} notes…</span>}
      {!compact && <span className="note-graph-keys"><Key size="sm" kind="quiet" round icon="screen-full" label="Fit to view" onClick={() => { touched.current = false; fit(); }} /></span>}
    </div>
  );
}
