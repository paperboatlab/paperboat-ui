import assert from "node:assert/strict";
import { test } from "node:test";
import { keySize, maxSize, resolveSize, SPLIT_SNAP, SPLIT_STEP, SPLIT_STEP_BIG } from "../src/split.ts";

const L = { min: 200, otherMin: 240, total: 1000 };  // Julix: plots at least 200, the editor at least 240

test("a drag is kept between the pane's minimum and the other pane's room", () => {
  assert.deepEqual(resolveSize(420, L), { size: 420, hidden: false });
  assert.deepEqual(resolveSize(900, L), { size: 760, hidden: false });   // the editor keeps its 240
  assert.deepEqual(resolveSize(190, L), { size: 200, hidden: false });   // just under: it stops at its minimum
  assert.equal(maxSize({ ...L, max: 600 }), 600);
});

test("dragged well past its minimum, the pane hides (its slim bar); without a hide it stops", () => {
  assert.deepEqual(resolveSize(200 - SPLIT_SNAP - 1, L), { size: 200, hidden: true });
  assert.deepEqual(resolveSize(10, L, false), { size: 200, hidden: false });
});

test("keys step (Shift further), Home and End go to the limits, the arrow toward the pane grows it", () => {
  assert.equal(keySize("ArrowLeft", false, 400, L, "ArrowLeft"), 400 + SPLIT_STEP);   // the end pane of a row grows leftwards
  assert.equal(keySize("ArrowRight", true, 400, L, "ArrowLeft"), 400 - SPLIT_STEP_BIG);
  assert.equal(keySize("Home", false, 400, L, "ArrowLeft"), 200);
  assert.equal(keySize("End", false, 400, L, "ArrowLeft"), 760);
  assert.equal(keySize("a", false, 400, L, "ArrowLeft"), undefined);
});
