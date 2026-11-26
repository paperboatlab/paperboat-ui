// The note graph's layout (Obsidian's look), on d3-force: notes repel (Barnes–Hut, so a hub of thousands lays
// out in a moment), links pull their notes together, a weak gravity keeps islands near the middle, and no two
// dots overlap. Linked notes gather into clusters and the clusters push apart. The motion cools until it
// rests. Notes start on a spiral in link order (a note's neighbours beside it), so the layout has little to undo
// and a graph always opens the same way; a node kept from the last layout keeps its place, and a new one starts
// beside a known neighbour. A big hub takes fewer, coarser steps: 3000 notes lay out in about a second.
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

  constructor(ids: readonly string[], links: readonly SimLink[], from?: ReadonlyMap<string, { x: number; y: number }>, radius: (id: string) => number = () => 10) {
    this.nodes = ids.map((id) => ({ id, ...from?.get(id) }) as SimNode);
    const by = new Map(this.nodes.map((n) => [n.id, n]));
    const known = links.filter((l) => l.source !== l.target && by.has(l.source) && by.has(l.target)).map((l) => ({ source: l.source, target: l.target }));
    place(this.nodes, known, by);
    const n = this.nodes.length, steps = n < 1000 ? 300 : n < 3000 ? 200 : 120;
    this.sim = forceSimulation(this.nodes).stop().alphaDecay(1 - Math.pow(0.001, 1 / steps))
      .force("repel", forceManyBody<SimNode>().strength(REPEL).distanceMax(REACH).theta(n > 1000 ? 1.2 : 0.9))
      .force("link", forceLink<SimNode, { source: string | SimNode; target: string | SimNode }>(known).id((n) => n.id).distance(LENGTH))
      .force("x", forceX<SimNode>(0).strength(GRAVITY)).force("y", forceY<SimNode>(0).strength(GRAVITY))
      // ponytail: no overlap check past 2000 notes (its cost grows fastest); dots may touch there
      .force("apart", n <= 2000 ? forceCollide<SimNode>((m) => radius(m.id) + 3) : null);
    this.pairs = known.map((l) => [l.source as unknown as SimNode, l.target as unknown as SimNode]);
    if (from && ids.length && ids.every((id) => from.has(id))) this.sim.alpha(0);  // a known layout shows as it was left
  }

  /** One step; false once the layout has come to rest. */
  step(): boolean {
    this.sim.tick();
    return this.sim.alpha() > this.sim.alphaMin();
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
    this.sim.alphaTarget(0.25).alpha(Math.max(this.sim.alpha(), 0.25));
  }
  release(id: string) {
    const n = this.nodes.find((m) => m.id === id);
    if (n) n.fx = n.fy = null;
    this.sim.alphaTarget(0);
  }
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
