import assert from "node:assert/strict";
import { test } from "node:test";
import { branchPoints, dragSegment, nearestOnRoute, orthoPoints, roundedPolyline, routeWires, scoreWireRoutes, simplify, squareUp, type Obstacle, type Point, type RouteInput } from "../../src/canvas/wireRouting.ts";

const square = (pts: Point[]) => pts.slice(1).every((q, i) => q[0] === pts[i][0] || q[1] === pts[i][1]);

test("a wire between facing ports runs square, out and across", () => {
  assert.deepEqual(orthoPoints([0, 0], "right", [100, 40], "left"), [[0, 0], [50, 0], [50, 40], [100, 40]]);
  assert.deepEqual(orthoPoints([0, 0], "right", [100, 0], "left"), [[0, 0], [100, 0]]);
});

test("ports facing away cross over between them; mixed sides take one corner", () => {
  const back = orthoPoints([100, 0], "right", [0, 60], "left");
  assert.deepEqual(back, [[100, 0], [116, 0], [116, 30], [-16, 30], [-16, 60], [0, 60]]);
  assert.deepEqual(orthoPoints([0, 0], "bottom", [50, 80], "left"), [[0, 0], [0, 80], [50, 80]]);
  for (const [s, t] of [["top", "top"], ["right", "right"], ["bottom", "top"], ["left", "bottom"]] as const)
    assert.ok(square(orthoPoints([10, 20], s, [90, 70], t)), `${s} to ${t} is square`);
});

test("dragging a middle segment moves it across; one at a port keeps the port end", () => {
  const z: Point[] = [[0, 0], [50, 0], [50, 40], [100, 40]];
  assert.deepEqual(dragSegment(z, 1, [70, 999]), [[0, 0], [70, 0], [70, 40], [100, 40]]);
  const straight: Point[] = [[0, 0], [100, 0]];
  assert.deepEqual(dragSegment(straight, 0, [50, 30]), [[0, 0], [0, 30], [100, 30], [100, 0]]);
  assert.deepEqual(dragSegment(z, 5, [0, 0]), z);
});

test("saved bends square up with ports that moved", () => {
  assert.deepEqual(squareUp([100, 103], [[140, 100], [140, 200]], [200, 197]), [[100, 103], [140, 103], [140, 197], [200, 197]]);
  assert.deepEqual(squareUp([0, 0], [], [10, 10]), [[0, 0], [10, 10]]);
  assert.deepEqual(simplify([[0, 0], [0, 0], [5, 0], [10, 0], [10, 5]]), [[0, 0], [10, 0], [10, 5]]);
});

test("every routed wire is square", () => {
  const routes = routeWires([
    { id: "f", source: "A", target: "B", sx: 100, sy: 100, tx: 300, ty: 50 },
    { id: "s", source: "A", target: "C", sx: 100, sy: 100, tx: 300, ty: 250, step: true },
    { id: "b", source: "C", target: "A", sx: 400, sy: 100, tx: 100, ty: 100 },
  ]);
  for (const r of routes.values()) assert.ok(square(r.points), `${r.id} is square`);
});

test("forward wires route around intermediate block obstacles with clearance", () => {
  const obstacles: Obstacle[] = [
    { id: "A", x: 0, y: 0, width: 100, height: 80 },
    { id: "Mid", x: 200, y: 0, width: 140, height: 80 },
    { id: "C", x: 440, y: 0, width: 100, height: 80 },
  ];
  const wires: RouteInput[] = [
    { id: "w", source: "A", sourceHandle: "out", target: "C", targetHandle: "in", sx: 100, sy: 40, tx: 440, ty: 40 },
  ];
  const routes = routeWires(wires, obstacles);
  const r = routes.get("w")!;
  assert.ok(square(r.points));
  const score = scoreWireRoutes(routes.values(), wires, obstacles);
  assert.equal(score.insideBlocks, 0, "detour must stay outside Mid");
  assert.equal(score.clearanceHits, 0, "detour must clear Mid by at least 8px");
});

test("parallel forward wires between columns get distinct non-overlapping lanes", () => {
  const obstacles: Obstacle[] = [
    { id: "A", x: 0, y: 0, width: 100, height: 100 },
    { id: "Mid", x: 200, y: 0, width: 140, height: 100 },
    { id: "B", x: 440, y: 0, width: 100, height: 100 },
  ];
  const wires: RouteInput[] = [
    // Two wires from different ports on A detouring past Mid to B must not share a detour lane or stem
    { id: "d1", source: "A", sourceHandle: "o1", target: "B", targetHandle: "i1", sx: 100, sy: 30, tx: 440, ty: 30 },
    { id: "d2", source: "A", sourceHandle: "o2", target: "B", targetHandle: "i2", sx: 100, sy: 60, tx: 440, ty: 60 },
    // Two wires in the same vertical corridor between columns must get distinct vertical channels
    { id: "v1", source: "A", sourceHandle: "o3", target: "B", targetHandle: "i3", sx: 100, sy: 130, tx: 300, ty: 180 },
    { id: "v2", source: "Mid", sourceHandle: "o1", target: "B", targetHandle: "i4", sx: 100, sy: 190, tx: 300, ty: 240 },
  ];
  const routes = routeWires(wires, obstacles);
  const score = scoreWireRoutes(routes.values(), wires, obstacles);
  assert.equal(score.insideBlocks, 0, "detouring wires must not cross blocks");
  assert.equal(score.collinearOverlaps, 0, "parallel wires must not share collinear segments");
});

test("fan-out from one source port splits cleanly without losing #55 shape", () => {
  const wires: RouteInput[] = [
    { id: "w1", source: "A", sourceHandle: "out", target: "B", targetHandle: "in", sx: 100, sy: 100, tx: 300, ty: 50 },
    { id: "w2", source: "A", sourceHandle: "out", target: "C", targetHandle: "in", sx: 100, sy: 100, tx: 300, ty: 150 },
  ];
  const routes = routeWires(wires, []);
  assert.deepEqual(routes.get("w1")!.points, [[100, 100], [200, 100], [200, 50], [300, 50]]);
  assert.deepEqual(routes.get("w2")!.points, [[100, 100], [200, 100], [200, 150], [300, 150]]);
});

test("wires out of one port share a trunk and branch off it, at a dot", () => {
  // A's output feeds B (near, level with it), C (further, below) and D (above).
  const wires: RouteInput[] = [
    { id: "b", source: "A", sourceHandle: "out", target: "B", targetHandle: "in", sx: 100, sy: 100, tx: 200, ty: 100 },
    { id: "c", source: "A", sourceHandle: "out", target: "C", targetHandle: "in", sx: 100, sy: 100, tx: 400, ty: 260 },
    { id: "d", source: "A", sourceHandle: "out", target: "D", targetHandle: "in", sx: 100, sy: 100, tx: 300, ty: 20 },
  ];
  const routes = routeWires(wires, []);
  const xs = ["c", "d"].map((id) => routes.get(id)!.points[1][0]);
  assert.deepEqual(xs, [150, 150], "one channel, halfway to the nearest reader");
  assert.deepEqual(routes.get("b")!.points, [[100, 100], [200, 100]]);
  const dots = branchPoints(wires.map((w) => ({ id: w.id, from: `${w.source}:${w.sourceHandle}`, points: routes.get(w.id)!.points })));
  assert.deepEqual(dots.get("b"), [[150, 100]], "c and d leave b's line at the channel");
  assert.deepEqual(dots.get("c"), [[150, 100]]);
  // Another port's wires are another tree; a split right at the port is no branch point.
  const apart = branchPoints([
    { id: "x", from: "A:out", points: [[0, 0], [0, 50]] },
    { id: "y", from: "A:out", points: [[0, 0], [0, -50]] },
    { id: "z", from: "A:two", points: [[0, 0], [0, 50]] },
  ]);
  assert.equal(apart.size, 0);
  const score = scoreWireRoutes(routes.values(), wires, []);
  assert.equal(score.collinearOverlaps + score.crossings, 0, "a shared trunk is neither an overlap nor a crossing");
});

test("a port's loops drop down its trunk, so feedback branches off the same line", () => {
  // theta feeds a scope to the right and two controllers to the left (loops): one split point, one dot.
  const wires: RouteInput[] = [
    { id: "scope", source: "P", sourceHandle: "theta", target: "S", targetHandle: "in", sx: 300, sy: 100, tx: 500, ty: 160 },
    { id: "ctrl", source: "P", sourceHandle: "theta", target: "C", targetHandle: "in", sx: 300, sy: 100, tx: 100, ty: 100 },
    { id: "ctrl2", source: "P", sourceHandle: "theta", target: "D", targetHandle: "in", sx: 300, sy: 100, tx: 50, ty: 40 },
  ];
  const obstacles: Obstacle[] = [
    { id: "P", x: 220, y: 70, width: 80, height: 60 },
    { id: "C", x: 100, y: 70, width: 80, height: 60 },
    { id: "D", x: 50, y: 10, width: 40, height: 60 },
    { id: "S", x: 500, y: 130, width: 80, height: 60 },
  ];
  const routes = routeWires(wires, obstacles);
  assert.deepEqual(["scope", "ctrl", "ctrl2"].map((id) => routes.get(id)!.points[1]), [[400, 100], [400, 100], [400, 100]]);
  assert.equal(routes.get("ctrl")!.kind, "back");
  const dots = branchPoints(wires.map((w) => ({ id: w.id, from: "P:theta", points: routes.get(w.id)!.points })));
  assert.deepEqual([...dots.values()], [[[400, 158]], [[400, 158]], [[400, 158]]], "branch points 2 px apart draw as one dot");
});

test("a branch point stays a square corner", () => {
  const pts: Point[] = [[0, 0], [50, 0], [50, 40]];
  assert.match(roundedPolyline(pts, 8), / Q /);
  assert.doesNotMatch(roundedPolyline(pts, 8, [[50, 0]]), / Q /);
});

test("a branch is pulled out of the route where it is nearest", () => {
  const z: Point[] = [[0, 0], [50, 0], [50, 40], [100, 40]];
  assert.deepEqual(nearestOnRoute(z, [20, 7]), [20, 0]);
  assert.deepEqual(nearestOnRoute(z, [58.4, 21]), [50, 21]);
  assert.deepEqual(nearestOnRoute(z, [140, 60]), [100, 40]);
});
