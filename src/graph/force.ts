// The note graph's layout (Obsidian's look), on d3-force: notes repel (Barnes–Hut, so a hub of thousands lays
// out in a moment), links pull their notes together, a weak gravity keeps islands near the middle, and no two
// dots overlap. Linked notes gather into clusters and the clusters push apart. The motion cools until it
// rests. Notes start on a spiral in link order (a note's neighbours beside it), so the layout has little to undo
// and a graph always opens the same way; a node kept from the last layout keeps its place, and a new one starts
// beside a known neighbour. A big hub takes fewer, coarser steps: 3000 notes lay out in about a second.
// Given its labels' sizes, each note's footprint (its dot and the label under it) keeps clear of the others',
// so a long label never runs under a neighbour.
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type Simulation, type SimulationNodeDatum } from "d3-force";

export type SimNode = SimulationNodeDatum & { id: string; x: number; y: number };
export type SimLink = { source: string; target: string };

const REPEL = -220;      // how hard two notes push apart (d3: falls off with distance, so clusters separate)
const REACH = 1200;      // repulsion stops past this: far clusters don't fling each other off
const LENGTH = 46;       // a link's rest length
const GRAVITY = 0.015;   // the pull to the middle, so islands and unlinked notes stay in view

export class Force {
  nodes: SimNode[];
  /** Each link's two ends, resolved: what the picture draws. */
  pairs: [SimNode, SimNode][];
  private sim: Simulation<SimNode, undefined>;
  private decay: number;

  /** `label`: the size of a note's label, drawn centred under its dot (layout units). */
  constructor(ids: readonly string[], links: readonly SimLink[], from?: ReadonlyMap<string, { x: number; y: number }>, radius: (id: string) => number = () => 10,
    label?: (id: string) => { w: number; h: number }) {
    this.nodes = ids.map((id) => ({ id, ...from?.get(id) }) as SimNode);
    const by = new Map(this.nodes.map((n) => [n.id, n]));
    const known = links.filter((l) => l.source !== l.target && by.has(l.source) && by.has(l.target)).map((l) => ({ source: l.source, target: l.target }));
    place(this.nodes, known, by);
    const n = this.nodes.length, steps = n < 1000 ? 300 : n < 3000 ? 200 : 120;
    this.decay = 1 - Math.pow(0.001, 1 / steps);
    this.sim = forceSimulation(this.nodes).stop().alphaDecay(this.decay)
      .force("repel", forceManyBody<SimNode>().strength(REPEL).distanceMax(REACH).theta(n > 1000 ? 1.2 : 0.9))
      .force("link", forceLink<SimNode, { source: string | SimNode; target: string | SimNode }>(known).id((n) => n.id).distance(LENGTH))
      .force("x", forceX<SimNode>(0).strength(GRAVITY)).force("y", forceY<SimNode>(0).strength(GRAVITY))
      // ponytail: no overlap check past 2000 notes (its cost grows fastest); dots may touch there
      .force("apart", n > 2000 ? null : label ? footprints(radius, label) : forceCollide<SimNode>((m) => radius(m.id) + 3));
    this.pairs = known.map((l) => [l.source as unknown as SimNode, l.target as unknown as SimNode]);
    if (from && ids.length && ids.every((id) => from.has(id))) this.sim.alpha(0);  // a known layout shows as it was left
  }

  /** One step; false once the layout has come to rest. */
  step(): boolean {
    this.sim.tick();
    if (this.sim.alpha() > this.sim.alphaMin()) return true;
    this.sim.alphaDecay(this.decay);   // after a breath, the usual cooling
    return false;
  }

  /** From rest, a short visible warm-up: the notes drawn in a little toward their middle, then let go, back at
   *  rest in about `steps` steps (a second at 60 frames), so a graph that opens shows it is live. */
  breathe(steps = 60, by = 0.06) {
    const free = this.nodes.filter((n) => n.fx == null);
    if (!free.length) return;
    const cx = free.reduce((t, n) => t + n.x, 0) / free.length, cy = free.reduce((t, n) => t + n.y, 0) / free.length;
    for (const n of free) { n.x -= (n.x - cx) * by; n.y -= (n.y - cy) * by; }
    const a = 0.1;
    this.sim.alpha(a).alphaDecay(1 - Math.pow(this.sim.alphaMin() / a, 1 / steps));
  }

  /** Runs to rest, or for `ms` at most (then false: call again); for a still picture, or a frame's share. */
  settle(ms = Infinity): boolean {
    const until = performance.now() + ms;
    while (performance.now() < until) if (!this.step()) return true;
    return false;
  }

  /** Moves a node by hand (a drag): it stays where it is put while held, and the rest follows. */
  hold(id: string, x: number, y: number) {
    const n = this.nodes.find((m) => m.id === id);
    if (!n) return;
    n.fx = n.x = x; n.fy = n.y = y;
    this.sim.alphaDecay(this.decay).alphaTarget(0.25).alpha(Math.max(this.sim.alpha(), 0.25));
  }
  release(id: string) {
    const n = this.nodes.find((m) => m.id === id);
    if (n) n.fx = n.fy = null;
    this.sim.alphaTarget(0);
  }
}

/** Two notes' footprints (the dot, and the label under it) pushed apart where they overlap, along the line
 *  between them; boxes swept along x, so it is cheap at every step. Like forceCollide, it acts at full strength
 *  whatever the layout's heat. */
function footprints(radius: (id: string) => number, label: (id: string) => { w: number; h: number }) {
  const PAD = 3, GAP = 4;   // room around a footprint; the label's gap under its dot (NoteGraph draws it there)
  let nodes: SimNode[] = [], half: number[] = [], up: number[] = [], down: number[] = [];
  const force = () => {
    const left = (i: number) => nodes[i].x - half[i];
    const order = nodes.map((_, i) => i).sort((i, j) => left(i) - left(j));
    for (let a = 0; a < order.length; a++) {
      const i = order[a], p = nodes[i], right = p.x + half[i];
      for (let b = a + 1; b < order.length; b++) {
        const j = order[b], q = nodes[j];
        if (left(j) >= right) break;
        const ox = Math.min(right, q.x + half[j]) - left(j);
        const oy = Math.min(p.y + down[i], q.y + down[j]) - Math.max(p.y - up[i], q.y - up[j]);
        if (ox <= 0 || oy <= 0) continue;
        // apart along the line between the footprints' middles (not the shorter axis, which stacks wide labels
        // into a column): as far along it as frees one axis, half each
        let ux = q.x - p.x, uy = q.y + (down[j] - up[j]) / 2 - (p.y + (down[i] - up[i]) / 2);
        if (!ux && !uy) ux = 1;   // one on top of the other: apart sideways
        const len = Math.hypot(ux, uy); ux /= len; uy /= len;
        const t = Math.min(Math.abs(ux) > 1e-6 ? ox / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-6 ? oy / Math.abs(uy) : Infinity) / 2;
        p.vx! -= ux * t; p.vy! -= uy * t; q.vx! += ux * t; q.vy! += uy * t;
      }
    }
  };
  force.initialize = (ns: SimNode[]) => {
    nodes = ns;
    half = ns.map((n) => Math.max(radius(n.id), label(n.id).w / 2) + PAD);
    up = ns.map((n) => radius(n.id) + PAD);
    down = ns.map((n) => radius(n.id) + GAP + label(n.id).h + PAD);
  };
  return force;
}

/** Where the notes without a place start: beside a placed neighbour, else on the spiral in link order (from the
 *  best-linked note out, breadth first), so linked notes start together. */
function place(nodes: SimNode[], links: { source: string; target: string }[], by: Map<string, SimNode>) {
  const near = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (const l of links) { near.get(l.source)!.push(l.target); near.get(l.target)!.push(l.source); }
  const open = nodes.filter((n) => n.x === undefined);
  if (!open.length) return;
  const order: SimNode[] = [], seen = new Set<string>();
  for (const s of [...open].sort((a, b) => near.get(b.id)!.length - near.get(a.id)!.length)) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    const queue = [s];
    for (let i = 0; i < queue.length; i++) {
      order.push(queue[i]);
      for (const m of near.get(queue[i].id)!) { const o = by.get(m)!; if (!seen.has(m) && o.x === undefined) { seen.add(m); queue.push(o); } }
    }
  }
  order.forEach((n, i) => {
    const a = i * Math.PI * (3 - Math.sqrt(5)), beside = near.get(n.id)!.map((m) => by.get(m)!).find((o) => o.x !== undefined && !open.includes(o));
    if (beside) { n.x = beside.x + 20 * Math.cos(a); n.y = beside.y + 20 * Math.sin(a); return; }  // a new note: by its neighbour
    const r = 10 * Math.sqrt(0.5 + i);
    n.x = r * Math.cos(a); n.y = r * Math.sin(a);
  });
}
