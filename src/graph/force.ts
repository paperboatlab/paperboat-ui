// The note graph's layout (Obsidian's look): notes repel, links pull them together, everything drifts to the
// centre, and the motion cools until it rests. Positions start on a sunflower spiral, so a graph always
// opens the same way, and a node kept from the last layout keeps its place.
// ponytail: O(n²) repulsion, fine to a few hundred notes; a Barnes–Hut quadtree when hubs get bigger.

export type SimNode = { id: string; x: number; y: number; vx: number; vy: number; fixed: boolean };
export type SimLink = { source: string; target: string };

const REPEL = 2600;      // how hard two notes push apart
const LENGTH = 70;       // a link's rest length
const SPRING = 0.1;      // how hard a link pulls toward it
const CENTRE = 0.012;    // the pull to the middle, so islands don't drift away
const DAMP = 0.62;       // velocity kept per step
const COOL = 0.988;      // the heat kept per step
const REST = 0.004;       // below this heat the layout stops

export class Force {
  nodes: SimNode[];
  private pairs: [SimNode, SimNode][];
  heat = 1;

  constructor(ids: readonly string[], links: readonly SimLink[], from?: ReadonlyMap<string, { x: number; y: number }>) {
    this.nodes = ids.map((id, i) => {
      const kept = from?.get(id);
      const a = i * 2.39996, r = 18 * Math.sqrt(i + 0.5);  // the golden angle: an even spiral
      return { id, x: kept?.x ?? r * Math.cos(a), y: kept?.y ?? r * Math.sin(a), vx: 0, vy: 0, fixed: false };
    });
    const by = new Map(this.nodes.map((n) => [n.id, n]));
    this.pairs = links.flatMap((l) => { const a = by.get(l.source), b = by.get(l.target); return a && b && a !== b ? [[a, b] as [SimNode, SimNode]] : []; });
    if (from && ids.every((id) => from.has(id))) this.heat = 0.3;  // a known layout only settles
  }

  /** One step; false once the layout has come to rest. */
  step(): boolean {
    const ns = this.nodes, k = this.heat;
    for (let i = 0; i < ns.length; i++) {
      const a = ns[i];
      for (let j = i + 1; j < ns.length; j++) {
        const b = ns[j];
        let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
        const f = (REPEL * k) / d2, d = Math.sqrt(d2);
        a.vx += (dx / d) * f; a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      }
    }
    for (const [a, b] of this.pairs) {
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.hypot(dx, dy));
      const f = (d - LENGTH) * SPRING * k;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }
    for (const n of ns) {
      n.vx = (n.vx - n.x * CENTRE * k) * DAMP;
      n.vy = (n.vy - n.y * CENTRE * k) * DAMP;
      if (n.fixed) { n.vx = n.vy = 0; continue; }
      n.x += n.vx; n.y += n.vy;
    }
    this.heat *= COOL;
    return this.heat > REST;
  }

  /** Runs to rest (or `max` steps): for a still picture, or to start from a settled layout. */
  settle(max = 600) { for (let i = 0; i < max && this.step(); i++); return this; }

  /** Moves a node by hand (a drag): it stays where it is put while held, and the rest follows. */
  hold(id: string, x: number, y: number) {
    const n = this.nodes.find((m) => m.id === id);
    if (!n) return;
    n.x = x; n.y = y; n.fixed = true;
    this.heat = Math.max(this.heat, 0.35);
  }
  release(id: string) {
    const n = this.nodes.find((m) => m.id === id);
    if (n) n.fixed = false;
    this.heat = Math.max(this.heat, 0.2);
  }
}
