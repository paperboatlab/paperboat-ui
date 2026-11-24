import assert from "node:assert/strict";
import { test } from "node:test";
import { cellNumber, gridOf, valueOfGrid } from "../src/valueTable.ts";

test("gridOf and valueOfGrid preserve scalar, vector, and matrix shapes", () => {
  assert.deepEqual(gridOf(5), [[5]]);
  assert.deepEqual(gridOf([1, 2, 3]), [[1], [2], [3]]);
  assert.deepEqual(gridOf([[1, 2], [3, 4]]), [[1, 2], [3, 4]]);

  assert.equal(valueOfGrid([[5]], "scalar"), 5);
  assert.deepEqual(valueOfGrid([[5], [6]], "scalar"), [5, 6]);
  assert.deepEqual(valueOfGrid([[1], [2]], "vector"), [1, 2]);
  assert.deepEqual(valueOfGrid([[1, 2], [3, 4]], "vector"), [[1, 2], [3, 4]]);
  assert.deepEqual(valueOfGrid([[1], [2]], "matrix"), [[1], [2]]);
});

test("cellNumber parses numeric literals, Inf/NaN, and rejects text", () => {
  assert.equal(cellNumber(" -2.5e1 "), -25);
  assert.ok(Number.isNaN(cellNumber("")));
  assert.ok(Number.isNaN(cellNumber("NaN")));
  assert.equal(cellNumber("-Inf"), -Infinity);
  assert.equal(cellNumber("abc"), null);
});
