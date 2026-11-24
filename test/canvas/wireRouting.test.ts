import assert from "node:assert/strict";
import { test } from "node:test";
import { dragSegment, orthoPoints, routeWires, scoreWireRoutes, simplify, squareUp, type Obstacle, type Point, type RouteInput } from "../../src/canvas/wireRouting.ts";

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
