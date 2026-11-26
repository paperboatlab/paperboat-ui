export type Side = "left" | "right" | "top" | "bottom";
export type Point = [number, number];

export type RouteInput = {
  id: string;
  source: string;
  sourceHandle?: string | null;
  target: string;
  targetHandle?: string | null;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  sourcePosition?: Side;
  targetPosition?: Side;
  step?: boolean;
};

export type Obstacle = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WireRoute = {
  id: string;
  kind: "forward" | "back" | "step";
  /** The drawn corners, port to port: every segment is horizontal or vertical. */
  points: Point[];
  path: string;
  labelX: number;
  labelY: number;
  /** Where wires from the same port branch off this one (branchPoints): a dot each, a square corner. */
  branches?: Point[];
};

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** `a` before `b`, comparing the first entry that differs. */
const lexLess = (a: readonly number[], b: readonly number[]) => {
  const i = a.findIndex((x, k) => x !== b[k]);
  return i >= 0 && a[i] < b[i];
};

/** Wires grouped by the port they leave (`source`) or reach (`target`), each group in input order. */
function byPort(wires: readonly RouteInput[], end: "source" | "target"): Map<string, RouteInput[]> {
  const groups = new Map<string, RouteInput[]>();
  for (const w of wires) {
    const key = end === "source" ? `${w.source}:${w.sourceHandle ?? ""}` : `${w.target}:${w.targetHandle ?? ""}`;
    const list = groups.get(key) ?? [];
    list.push(w);
    groups.set(key, list);
  }
  return groups;
}

/** Spacing between the horizontal tracks used by back-wires. */
export function backWireLaneOffset(lane: number): number {
  return Math.max(0, lane) * 18;
}

/** Move each loop's vertical stem sideways too, so its route diverges soon after the port. */
export function backWireExitDistance(lane: number): number {
  return 24 + Math.max(0, lane) * 8;
}

/**
 * Produce an SVG path string for a sequence of points with rounded corners.
 * Corners use quadratic beziers (Q) connecting tangent lines at radius `r`; a corner in `sharp`
 * (a branch point, where the wire leaves a trunk it shares) stays square.
 */
export function roundedPolyline(points: readonly [number, number][], radius = 10, sharp: readonly Point[] = []): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0][0]},${points[0][1]}`;
  if (points.length === 2) return `M ${points[0][0]},${points[0][1]} L ${points[1][0]},${points[1][1]}`;

  let d = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1];
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    const d1 = Math.hypot(cx - px, cy - py);
    const d2 = Math.hypot(nx - cx, ny - cy);
    const ra = sharp.some((p) => Math.abs(p[0] - cx) < 0.5 && Math.abs(p[1] - cy) < 0.5) ? 0 : Math.min(radius, d1 / 2, d2 / 2);
    if (ra < 0.5) {
      d += ` L ${cx},${cy}`;
    } else {
      const a = [cx - Math.sign(cx - px) * ra, cy - Math.sign(cy - py) * ra];
      const b = [cx + Math.sign(nx - cx) * ra, cy + Math.sign(ny - cy) * ra];
      d += ` L ${a[0]},${a[1]} Q ${cx},${cy} ${b[0]},${b[1]}`;
    }
  }
  const last = points[points.length - 1];
  d += ` L ${last[0]},${last[1]}`;
  return d;
}

const DIR: Record<Side, [number, number]> = {
  right: [1, 0],
  left: [-1, 0],
  top: [0, -1],
  bottom: [0, 1],
};

/** How far a wire runs straight out of its port before it may turn. */
const STUB = 16;
const CLEARANCE = 12;
const LANE_PITCH = 12;
const OVERLAP_TOL = 8;
const horizontal = (side: Side) => side === "left" || side === "right";

type Rect = { left: number; top: number; right: number; bottom: number };

const rectOf = (o: Obstacle, pad = 0): Rect => ({
  left: o.x - pad,
  top: o.y - pad,
  right: o.x + o.width + pad,
  bottom: o.y + o.height + pad,
});

function segmentHitsRect(a: Point, b: Point, r: Rect): boolean {
  if (a[1] === b[1]) {
    const y = a[1];
    const minX = Math.min(a[0], b[0]);
    const maxX = Math.max(a[0], b[0]);
    return y > r.top && y < r.bottom && maxX > r.left && minX < r.right;
  }
  if (a[0] === b[0]) {
    const x = a[0];
    const minY = Math.min(a[1], b[1]);
    const maxY = Math.max(a[1], b[1]);
    return x > r.left && x < r.right && maxY > r.top && minY < r.bottom;
  }
  return false;
}

function blockingObstacles(
  points: readonly Point[],
  source: string,
  target: string,
  obstacles: readonly Obstacle[],
  pad = CLEARANCE,
): Obstacle[] {
  if (points.length < 2 || obstacles.length === 0) return [];
  const hits: Obstacle[] = [];
  for (const o of obstacles) {
    const endpoint = o.id === source || o.id === target;
    const r = rectOf(o, endpoint ? -1 : pad);
    const startIdx = endpoint ? 1 : 0;
    const endIdx = endpoint ? points.length - 3 : points.length - 2;
    let hit = false;
    for (let i = startIdx; i <= endIdx; i++) {
      if (segmentHitsRect(points[i], points[i + 1], r)) {
        hit = true;
        break;
      }
    }
    if (hit) hits.push(o);
  }
  return hits;
}

type PlacedSegment = {
  wireId: string;
  sourceKey: string;
  targetKey: string;
  isFirst: boolean;
  isLast: boolean;
  axis: "h" | "v";
  pos: number;
  min: number;
  max: number;
};

function segmentsOf(
  points: readonly Point[],
  wireId: string,
  sourceKey: string,
  targetKey: string,
): PlacedSegment[] {
  const out: PlacedSegment[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const [a, b] = [points[i], points[i + 1]];
    if (a[0] === b[0] && a[1] === b[1]) continue;
    const axis: "h" | "v" = a[1] === b[1] ? "h" : "v";
    const pos = axis === "h" ? a[1] : a[0];
    const min = axis === "h" ? Math.min(a[0], b[0]) : Math.min(a[1], b[1]);
    const max = axis === "h" ? Math.max(a[0], b[0]) : Math.max(a[1], b[1]);
    out.push({
      wireId,
      sourceKey,
      targetKey,
      isFirst: i === 0,
      isLast: i === points.length - 2,
      axis,
      pos,
      min,
      max,
    });
  }
  return out;
}

function segmentsCollinearOverlap(a: PlacedSegment, b: PlacedSegment): boolean {
  if (a.axis !== b.axis) return false;
  if (Math.abs(a.pos - b.pos) >= OVERLAP_TOL) return false;
  if (Math.min(a.max, b.max) - Math.max(a.min, b.min) <= 2) return false;
  // Wires from one port carry one signal: where they run together they are one line (a trunk that branches).
  if (a.sourceKey === b.sourceKey) return false;
  if (a.targetKey === b.targetKey && a.isLast && b.isLast) return false;
  return true;
}

function countOverlaps(segs: readonly PlacedSegment[], placed: readonly PlacedSegment[]): number {
  let overlaps = 0;
  for (const s of segs) {
    for (const p of placed) {
      if (segmentsCollinearOverlap(s, p)) overlaps++;
    }
  }
  return overlaps;
}

function manhattanLength(points: readonly Point[]): number {
  let len = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    len += Math.abs(points[i + 1][0] - points[i][0]) + Math.abs(points[i + 1][1] - points[i][1]);
  }
  return len;
}

export type RouteScore = {
  insideBlocks: number;
  clearanceHits: number;
  collinearOverlaps: number;
  crossings: number;
  bends: number;
  length: number;
};

/** Score routed wires against block obstacles and each other (for auto-arrange candidate selection). */
export function scoreWireRoutes(
  routes: Iterable<WireRoute>,
  wires: readonly RouteInput[],
  obstacles: readonly Obstacle[],
): RouteScore {
  const byId = new Map(wires.map((w) => [w.id, w]));
  const allSegs: PlacedSegment[] = [];
  let insideBlocks = 0;
  let clearanceHits = 0;
  let bends = 0;
  let length = 0;

  for (const r of routes) {
    const w = byId.get(r.id);
    if (!w) continue;
    insideBlocks += blockingObstacles(r.points, w.source, w.target, obstacles, 0).length;
    clearanceHits += blockingObstacles(r.points, w.source, w.target, obstacles, 8).length;
    bends += Math.max(0, r.points.length - 2);
    length += manhattanLength(r.points);
    const sKey = `${w.source}:${w.sourceHandle ?? ""}`;
    const tKey = `${w.target}:${w.targetHandle ?? ""}`;
    allSegs.push(...segmentsOf(r.points, r.id, sKey, tKey));
  }

  let collinearOverlaps = 0;
  let crossings = 0;
  for (let i = 0; i < allSegs.length; i++) {
    const a = allSegs[i];
    for (let j = i + 1; j < allSegs.length; j++) {
      const b = allSegs[j];
      if (a.wireId === b.wireId || a.sourceKey === b.sourceKey) continue;
      if (a.axis === b.axis) {
        if (segmentsCollinearOverlap(a, b)) collinearOverlaps++;
      } else {
        const h = a.axis === "h" ? a : b;
        const v = a.axis === "v" ? a : b;
        if (v.pos > h.min + 1 && v.pos < h.max - 1 && h.pos > v.min + 1 && h.pos < v.max - 1) {
          crossings++;
        }
      }
    }
  }

  return { insideBlocks, clearanceHits, collinearOverlaps, crossings, bends, length };
}

/** Drop repeated corners and corners on a straight run (but keep a turn back). */
export function simplify(points: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    if (out.length && out[out.length - 1][0] === p[0] && out[out.length - 1][1] === p[1]) continue;
    if (out.length >= 2) {
      const [a, b] = [out[out.length - 2], out[out.length - 1]];
      const straight = (a[0] === b[0] && b[0] === p[0] && (b[1] - a[1]) * (p[1] - b[1]) >= 0) || (a[1] === b[1] && b[1] === p[1] && (b[0] - a[0]) * (p[0] - b[0]) >= 0);
      if (straight) out.pop();
    }
    out.push([p[0], p[1]]);
  }
  return out;
}

/**
 * A square route from a port on side `sSide` to one on `tSide`: out of each port by a stub,
 * then one or two turns. `channel` is where the middle run sits (x for side ports, y for top
 * and bottom); absent, halfway.
 */
// ponytail: no obstacle avoidance for forward wires; a wire may cross a block until dragged.
export function orthoPoints(s: Point, sSide: Side, t: Point, tSide: Side, channel?: number): Point[] {
  const [sd, td] = [DIR[sSide], DIR[tSide]];
  const a: Point = [s[0] + sd[0] * STUB, s[1] + sd[1] * STUB];
  const b: Point = [t[0] + td[0] * STUB, t[1] + td[1] * STUB];
  let mid: Point[];
  if (horizontal(sSide) === horizontal(tSide)) {
    const k = horizontal(sSide) ? 0 : 1; // the axis the ports face along
    const across = (m: number): Point[] => (k === 0 ? [[m, a[1]], [m, b[1]]] : [[a[0], m], [b[0], m]]);
    const along = (m: number): Point[] => (k === 0 ? [[a[0], m], [b[0], m]] : [[m, a[1]], [m, b[1]]]);
    if (sd[k] === td[k]) mid = across(sd[k] > 0 ? Math.max(a[k], b[k]) : Math.min(a[k], b[k])); // both face the same way
    else if ((b[k] - a[k]) * sd[k] >= 0) mid = across(channel ?? (a[k] + b[k]) / 2); // facing each other
    else mid = along((a[1 - k] + b[1 - k]) / 2); // facing away: cross over between them
  } else {
    mid = [horizontal(sSide) ? [b[0], a[1]] : [a[0], b[1]]];
  }
  return simplify([s, a, ...mid, b, t]);
}

/**
 * A wire's drawn corners from its saved bends: the ports at each end and the bends between,
 * the first and last bend turned square with the port they meet (a block moved since).
 */
export function squareUp(from: Point, bends: readonly Point[], to: Point): Point[] {
  const mid = bends.map((b): Point => [b[0], b[1]]);
  const fix = (b: Point, end: Point) => {
    if (Math.abs(b[1] - end[1]) <= Math.abs(b[0] - end[0])) b[1] = end[1];
    else b[0] = end[0];
  };
  if (mid.length) {
    fix(mid[0], from);
    fix(mid[mid.length - 1], to);
  }
  return [from, ...mid, to];
}

/**
 * Segment `i` (points i to i+1) dragged to pass through `at`: it moves across itself, its
 * neighbours stretch. A segment at a port gets a new corner there, so the port end stays put.
 */
export function dragSegment(points: readonly Point[], i: number, at: Point): Point[] {
  const pts = points.map((p): Point => [p[0], p[1]]);
  if (i < 0 || i >= pts.length - 1) return pts;
  if (i === 0) {
    pts.unshift([pts[0][0], pts[0][1]]);
    i++;
  }
  if (i + 1 === pts.length - 1) pts.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
  const k = pts[i][1] === pts[i + 1][1] ? 1 : 0; // a horizontal run moves in y
  pts[i][k] = pts[i + 1][k] = Math.round(at[k]);
  return simplify(pts);
}

/** The point on a square route nearest to `at` (where a branch is pulled out of it), whole numbers. */
export function nearestOnRoute(points: readonly Point[], at: Point): Point {
  let best: Point = points[0];
  let dist = Infinity;
  for (let i = 0; i + 1 < points.length; i++) {
    const [p, q] = [points[i], points[i + 1]];
    const x = Math.max(Math.min(p[0], q[0]), Math.min(Math.max(p[0], q[0]), at[0]));
    const y = Math.max(Math.min(p[1], q[1]), Math.min(Math.max(p[1], q[1]), at[1]));
    const d = Math.hypot(x - at[0], y - at[1]);
    if (d < dist) [best, dist] = [[Math.round(x), Math.round(y)], d];
  }
  return best;
}

/** The middle of a route's longest segment: where its label (a delete button) goes. */
export function middleOf(points: readonly Point[]): Point {
  let best: Point = points[0];
  let len = -1;
  for (let i = 0; i + 1 < points.length; i++) {
    const [p, q] = [points[i], points[i + 1]];
    const d = Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]);
    if (d > len) [best, len] = [[(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], d];
  }
  return best;
}

/**
 * Route all wires on the canvas in one deterministic pass:
 * 1. Back wires (loops) are assigned distinct horizontal tracks below all intermediate obstacles
 *    and nested so shorter loops sit closer to blocks without overlapping.
 * 2. Forward wires (signal and step) run square, out of each port then across; wires into one
 *    port get distinct vertical channels.
 */
export function routeWires(
  wires: readonly RouteInput[],
  obstacles: readonly Obstacle[] = [],
): Map<string, WireRoute> {
  const results = new Map<string, WireRoute>();
  if (wires.length === 0) return results;

  const isBack = (w: RouteInput) =>
    (w.sourcePosition ?? "right") === "right" &&
    (w.targetPosition ?? "left") === "left" &&
    w.tx < w.sx + 8;

  const backWires = wires.filter(isBack);
  const forwardWires = wires.filter((w) => !isBack(w));

  // --- Back-wires (loops) ---
  if (backWires.length > 0) {
    // Sort loops by horizontal span: inner (shorter) loops get lower lanes (closer to blocks).
    const sortedLoops = [...backWires].sort(
      (a, b) =>
        (a.sx - a.tx) - (b.sx - b.tx) ||
        a.sx - b.sx ||
        byText(a.source, b.source) ||
        byText(a.id, b.id),
    );
    const loopLaneMap = new Map(sortedLoops.map((w, lane) => [w.id, lane]));

    // Exit lanes per source handle
    const bySource = byPort(backWires, "source");
    const sourceExitLaneMap = new Map<string, number>();
    for (const list of bySource.values()) {
      list.sort((a, b) => a.ty - b.ty || byText(a.id, b.id));
      list.forEach((w, i) => sourceExitLaneMap.set(w.id, i));
    }

    // Exit lanes per target handle
    const byTarget = byPort(backWires, "target");
    const targetExitLaneMap = new Map<string, number>();
    for (const list of byTarget.values()) {
      list.sort((a, b) => a.sy - b.sy || byText(a.id, b.id));
      list.forEach((w, i) => targetExitLaneMap.set(w.id, i));
    }

    for (const w of backWires) {
      const loopLane = loopLaneMap.get(w.id) ?? 0;
      const sLane = sourceExitLaneMap.get(w.id) ?? 0;
      const tLane = targetExitLaneMap.get(w.id) ?? 0;

      const exitSource = backWireExitDistance(sLane);
      const exitTarget = backWireExitDistance(tLane);

      // Find obstacles whose horizontal bounds overlap [tx - exitTarget - 4, sx + exitSource + 4]
      const spanMin = w.tx - exitTarget - 4;
      const spanMax = w.sx + exitSource + 4;
      const obstaclesInSpan = obstacles.filter((o) => o.x + o.width >= spanMin && o.x <= spanMax);
      const maxObstacleBottom = obstaclesInSpan.length
        ? Math.max(...obstaclesInSpan.map((o) => o.y + o.height))
        : -Infinity;

      const baseBelow = Math.max(w.sy, w.ty, maxObstacleBottom) + 28;
      const below = baseBelow + backWireLaneOffset(loopLane);

      const pts: [number, number][] = [
        [w.sx, w.sy],
        [w.sx + exitSource, w.sy],
        [w.sx + exitSource, below],
        [w.tx - exitTarget, below],
        [w.tx - exitTarget, w.ty],
        [w.tx, w.ty],
      ];
      const points = simplify(pts);
      results.set(w.id, {
        id: w.id,
        kind: "back",
        points,
        path: roundedPolyline(points, 10),
        labelX: (w.sx + w.tx) / 2,
        labelY: below,
      });
    }
  }

  // --- Forward wires (signal and step): obstacle-aware, parallel-lane separated ---
  const baseChannelByWire = new Map<string, number>();
  for (const list of byPort(forwardWires, "target").values()) {
    list.sort((a, b) => a.sy - b.sy || byText(a.id, b.id));
    const count = list.length;
    list.forEach((w, lane) => {
      const sSide = w.sourcePosition ?? "right";
      const tSide = w.targetPosition ?? "left";
      if (sSide === "right" && tSide === "left" && count > 1) {
        const midX = (w.sx + w.tx) / 2 + (lane - (count - 1) / 2) * LANE_PITCH;
        baseChannelByWire.set(w.id, Math.max(w.sx + STUB, Math.min(w.tx - STUB, midX)));
      }
    });
  }

  const placedSegments: PlacedSegment[] = [];

  // Wires out of one port (left to right) share a trunk: one channel for them all, so they run as one line
  // and branch off it, as in a block diagram. The channel sits halfway to the nearest reader, moved aside
  // when that runs through a block or along another wire; chosen when the first of them is routed.
  const trees = [...byPort(forwardWires, "source").values()].filter(
    (list) => list.length > 1 && list.every((w) => (w.sourcePosition ?? "right") === "right" && (w.targetPosition ?? "left") === "left" && w.tx - w.sx >= 2 * STUB),
  );
  const treeOf = new Map(trees.flatMap((list) => list.map((w) => [w.id, list] as const)));
  const treeChannel = new Map<readonly RouteInput[], number>();
  const channelFor = (list: readonly RouteInput[]): number => {
    const known = treeChannel.get(list);
    if (known !== undefined) return known;
    const sx = list[0].sx;
    const lo = sx + STUB;
    const hi = Math.min(...list.map((w) => w.tx)) - STUB;
    const center = Math.max(lo, Math.min(hi, Math.round(Math.min(...list.map((w) => (w.sx + w.tx) / 2)))));
    let best = center;
    let bestCost: number[] | null = null;
    for (const delta of [0, -12, 12, -24, 24, -36, 36, -48, 48]) {
      const ch = Math.max(lo, Math.min(hi, center + delta));
      const cost = [0, 0, 0];
      for (const w of list) {
        const pts = orthoPoints([w.sx, w.sy], "right", [w.tx, w.ty], "left", ch);
        cost[0] += blockingObstacles(pts, w.source, w.target, obstacles, 0).length;
        cost[1] += blockingObstacles(pts, w.source, w.target, obstacles, CLEARANCE).length;
        cost[2] += countOverlaps(segmentsOf(pts, w.id, `${w.source}:${w.sourceHandle ?? ""}`, `${w.target}:${w.targetHandle ?? ""}`), placedSegments);
      }
      if (!bestCost || lexLess(cost, bestCost)) {
        best = ch;
        bestCost = cost;
      }
    }
    treeChannel.set(list, best);
    return best;
  };

  const orderedForward = [...forwardWires].sort(
    (a, b) =>
      Math.min(a.sx, a.tx) - Math.min(b.sx, b.tx) ||
      Math.min(a.sy, a.ty) - Math.min(b.sy, b.ty) ||
      a.sx - b.sx ||
      a.sy - b.sy ||
      byText(a.id, b.id),
  );

  for (const w of orderedForward) {
    const sSide = w.sourcePosition ?? "right";
    const tSide = w.targetPosition ?? "left";
    const sKey = `${w.source}:${w.sourceHandle ?? ""}`;
    const tKey = `${w.target}:${w.targetHandle ?? ""}`;
    const tree = treeOf.get(w.id);
    const baseChannel = tree ? channelFor(tree) : baseChannelByWire.get(w.id);

    const candidates: Point[][] = [];
    const seen = new Set<string>();
    const addCandidate = (raw: Point[]) => {
      const pts = simplify(raw);
      const key = pts.map((p) => `${p[0]},${p[1]}`).join(";");
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push(pts);
      }
    };

    // 1. Direct orthogonal route + channel shifts for parallel vertical separation
    addCandidate(orthoPoints([w.sx, w.sy], sSide, [w.tx, w.ty], tSide, baseChannel));
    if (horizontal(sSide) && horizontal(tSide) && (w.tx - w.sx) * DIR[sSide][0] >= 2 * STUB && DIR[sSide][0] === -DIR[tSide][0]) {
      const center = baseChannel ?? (w.sx + w.tx) / 2;
      const minCh = Math.min(w.sx, w.tx) + STUB;
      const maxCh = Math.max(w.sx, w.tx) - STUB;
      for (const delta of [12, -12, 24, -24, 36, -36, 48, -48, 60, -60]) {
        const ch = Math.max(minCh, Math.min(maxCh, center + delta));
        addCandidate(orthoPoints([w.sx, w.sy], sSide, [w.tx, w.ty], tSide, ch));
      }
    }

    // 2. Horizontal jogs if direct horizontal run overlaps another wire on the same y
    const directHits = blockingObstacles(candidates[0], w.source, w.target, obstacles, CLEARANCE);
    const directOverlaps = countOverlaps(segmentsOf(candidates[0], w.id, sKey, tKey), placedSegments);

    if (directOverlaps > 0 && sSide === "right" && tSide === "left" && w.tx - w.sx >= 2 * STUB) {
      const x1 = w.sx + STUB;
      const x2 = w.tx - STUB;
      for (const dy of [-12, 12, -24, 24, -36, 36, -48, 48]) {
        const jy = Math.round((w.sy + w.ty) / 2) + dy;
        addCandidate([[w.sx, w.sy], [x1, w.sy], [x1, jy], [x2, jy], [x2, w.ty], [w.tx, w.ty]]);
      }
    }

    // 3. Obstacle-avoiding detours when any obstacle blocks or parallel lanes collide
    if (directHits.length > 0 || directOverlaps > 0) {
      const spanMinX = Math.min(w.sx, w.tx) - STUB * 2;
      const spanMaxX = Math.max(w.sx, w.tx) + STUB * 2;
      const inSpan = obstacles.filter(
        (o) => o.id !== w.source && o.id !== w.target && o.x + o.width + CLEARANCE >= spanMinX && o.x - CLEARANCE <= spanMaxX,
      );

      if (horizontal(sSide) && horizontal(tSide) && inSpan.length > 0) {
        const minTop = Math.min(...inSpan.map((o) => o.y));
        const maxBottom = Math.max(...inSpan.map((o) => o.y + o.height));
        const ys = new Set<number>();
        for (let k = 0; k < 8; k++) {
          ys.add(Math.round(minTop - CLEARANCE - k * LANE_PITCH));
          ys.add(Math.round(maxBottom + CLEARANCE + k * LANE_PITCH));
        }
        for (const o of inSpan) {
          for (let k = 0; k < 4; k++) {
            ys.add(Math.round(o.y - CLEARANCE - k * LANE_PITCH));
            ys.add(Math.round(o.y + o.height + CLEARANCE + k * LANE_PITCH));
          }
        }
        const sortedY = [...inSpan].sort((a, b) => a.y - b.y);
        for (let i = 0; i + 1 < sortedY.length; i++) {
          const gapTop = sortedY[i].y + sortedY[i].height;
          const gapBot = sortedY[i + 1].y;
          if (gapBot - gapTop >= 2 * CLEARANCE) {
            const mid = Math.round((gapTop + gapBot) / 2);
            ys.add(mid);
            if (mid - LANE_PITCH >= gapTop + CLEARANCE) ys.add(mid - LANE_PITCH);
            if (mid + LANE_PITCH <= gapBot - CLEARANCE) ys.add(mid + LANE_PITCH);
          }
        }

        const exitXs = Array.from({ length: 6 }, (_, k) => w.sx + DIR[sSide][0] * (STUB + k * LANE_PITCH));
        const entryXs = Array.from({ length: 6 }, (_, k) => w.tx + DIR[tSide][0] * (STUB + k * LANE_PITCH));
        for (const ex of exitXs) {
          for (const nx of entryXs) {
            for (const dy of ys) {
              addCandidate([[w.sx, w.sy], [ex, w.sy], [ex, dy], [nx, dy], [nx, w.ty], [w.tx, w.ty]]);
            }
          }
        }
      } else if (!horizontal(sSide) || !horizontal(tSide)) {
        const spanMinY = Math.min(w.sy, w.ty) - STUB * 2;
        const spanMaxY = Math.max(w.sy, w.ty) + STUB * 2;
        const inSpanY = obstacles.filter(
          (o) => o.id !== w.source && o.id !== w.target && o.y + o.height + CLEARANCE >= spanMinY && o.y - CLEARANCE <= spanMaxY,
        );
        if (inSpanY.length > 0) {
          const minLeft = Math.min(...inSpanY.map((o) => o.x));
          const maxRight = Math.max(...inSpanY.map((o) => o.x + o.width));
          const exitPt: Point = [w.sx + DIR[sSide][0] * STUB, w.sy + DIR[sSide][1] * STUB];
          const entryPt: Point = [w.tx + DIR[tSide][0] * STUB, w.ty + DIR[tSide][1] * STUB];
          for (let k = 0; k < 6; k++) {
            const lx = Math.round(minLeft - CLEARANCE - k * LANE_PITCH);
            const rx = Math.round(maxRight + CLEARANCE + k * LANE_PITCH);
            addCandidate([[w.sx, w.sy], exitPt, [lx, exitPt[1]], [lx, entryPt[1]], entryPt, [w.tx, w.ty]]);
            addCandidate([[w.sx, w.sy], exitPt, [rx, exitPt[1]], [rx, entryPt[1]], entryPt, [w.tx, w.ty]]);
          }
        }
      }
    }

    let bestPoints = candidates[0];
    let bestTuple: [number, number, number, number] | null = null;
    for (const pts of candidates) {
      const rawHits = blockingObstacles(pts, w.source, w.target, obstacles, 0).length;
      const padHits = blockingObstacles(pts, w.source, w.target, obstacles, CLEARANCE).length;
      const overlaps = countOverlaps(segmentsOf(pts, w.id, sKey, tKey), placedSegments);
      const cost = Math.round(manhattanLength(pts)) + 18 * Math.max(0, pts.length - 2); // whole pixels: float noise picks no route
      const tuple: [number, number, number, number] = [rawHits, padHits, overlaps, cost];
      if (
        !bestTuple ||
        tuple[0] < bestTuple[0] ||
        (tuple[0] === bestTuple[0] &&
          (tuple[1] < bestTuple[1] ||
            (tuple[1] === bestTuple[1] &&
              (tuple[2] < bestTuple[2] || (tuple[2] === bestTuple[2] && tuple[3] < bestTuple[3])))))
      ) {
        bestTuple = tuple;
        bestPoints = pts;
      }
    }

    placedSegments.push(...segmentsOf(bestPoints, w.id, sKey, tKey));
    const [labelX, labelY] = middleOf(bestPoints);
    results.set(w.id, {
      id: w.id,
      kind: w.step ? "step" : "forward",
      points: bestPoints,
      path: roundedPolyline(bestPoints, 8),
      labelX,
      labelY,
    });
  }

  return results;
}

/** Where `b` leaves `a`: both start at one port and run together up to here (null: they don't, or one ends). */
function divergence(a: readonly Point[], b: readonly Point[]): Point | null {
  if (a.length < 2 || b.length < 2 || a[0][0] !== b[0][0] || a[0][1] !== b[0][1]) return null;
  let [i, j] = [0, 0];
  let p: Point = a[0];
  while (i + 1 < a.length && j + 1 < b.length) {
    const [qa, qb] = [a[i + 1], b[j + 1]];
    const da = [Math.sign(qa[0] - p[0]), Math.sign(qa[1] - p[1])];
    const db = [Math.sign(qb[0] - p[0]), Math.sign(qb[1] - p[1])];
    if (da[0] !== db[0] || da[1] !== db[1]) return p;
    const [ra, rb] = [Math.abs(qa[0] - p[0]) + Math.abs(qa[1] - p[1]), Math.abs(qb[0] - p[0]) + Math.abs(qb[1] - p[1])];
    const step = Math.min(ra, rb);
    p = [p[0] + da[0] * step, p[1] + da[1] * step];
    if (ra === step) i++;
    if (rb === step) j++;
  }
  return null;
}

/**
 * The branch points of wires drawn out of one port: where one leaves a line it shared with another
 * (a block diagram's junction dot). Each wire gets the points on it, so it can draw the dot and keep
 * that corner square; a split right at the port has none.
 */
export function branchPoints(wires: readonly { id: string; from: string; points: readonly Point[] }[]): Map<string, Point[]> {
  const out = new Map<string, Point[]>();
  const add = (id: string, p: Point) => {
    const list = out.get(id) ?? [];
    if (!list.some((q) => q[0] === p[0] && q[1] === p[1])) list.push(p);
    out.set(id, list);
  };
  const groups = new Map<string, { id: string; points: Point[] }[]>();
  for (const w of wires) groups.set(w.from, [...(groups.get(w.from) ?? []), { id: w.id, points: simplify(w.points) }]);
  for (const list of groups.values())
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const p = divergence(list[i].points, list[j].points);
        if (!p || (p[0] === list[i].points[0][0] && p[1] === list[i].points[0][1])) continue;
        add(list[i].id, p);
        add(list[j].id, p);
      }
  return out;
}
