import assert from "node:assert/strict";
import { test } from "node:test";
import { cubeSide, fitDistance, screenBox } from "../../src/scene/fit.ts";

test("fit: the sphere fills the narrower field, with room round it", () => {
  // 90° vertical, square: the sphere's edge is tangent at r / sin 45°
  assert.ok(Math.abs(fitDistance(1, 90, 1, 1) - Math.SQRT2) < 1e-9);
  // a tall, narrow view stands further back than a wide one
  assert.ok(fitDistance(1, 50, 0.5) > fitDistance(1, 50, 2));
  assert.equal(fitDistance(1, 50, 2), fitDistance(1, 50, 3), "wider than tall: the vertical field decides");
  assert.ok(fitDistance(0, 50, 1) > 0, "a point still gets a distance");
});

test("the view cube's thirds: face, edge, corner", () => {
  assert.deepEqual(cubeSide([0.05, 0.5, -0.1]), [0, 1, 0]);
  assert.deepEqual(cubeSide([0.5, 0.3, 0]), [1, 1, 0]);
  assert.deepEqual(cubeSide([-0.4, -0.5, 0.45]), [-1, -1, 1]);
});

test("the screen box skips what is behind the camera", () => {
  assert.deepEqual(screenBox([[10, 20, 0.5], [30, 5, 0.9], [99, 99, 1.5]]), { x: 10, y: 5, w: 20, h: 15 });
  assert.equal(screenBox([[1, 1, 2]]), null);
});
