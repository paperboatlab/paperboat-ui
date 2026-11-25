import assert from "node:assert/strict";
import { test } from "node:test";
import { FULL, drag, fitRatio, pixels, turnRect, turned } from "../src/media/crop.ts";

const close = (a: object, b: object) => assert.deepEqual(JSON.parse(JSON.stringify(a, (_, v) => (typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v))), b);

test("a crop turns with the picture, and four turns come back", () => {
  const r = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
  close(turnRect(r, 90), { x: 0.4, y: 0.1, w: 0.4, h: 0.3 });
  close(turnRect(turnRect(r, 90), -90), r);
  close([90, 90, 90, 90].reduce((x) => turnRect(x, 90), r), r);
  assert.deepEqual(turned(400, 300, 90), { w: 300, h: 400 });
});

test("a ratio fits inside, centred, in pixels", () => {
  const sq = fitRatio(FULL, 1, 400, 200);   // a square in a 2:1 picture
  close(sq, { x: 0.25, y: 0, w: 0.5, h: 1 });
  assert.deepEqual(pixels(sq, 400, 200), { x: 100, y: 0, w: 200, h: 200 });
});

test("dragging moves and resizes, inside the picture, keeping a ratio", () => {
  close(drag(FULL, "", 0.2, 0, null, 100, 100), FULL);   // a full crop can't move
  close(drag({ x: 0.1, y: 0.1, w: 0.5, h: 0.5 }, "se", 0.1, 0.1, null, 100, 100), { x: 0.1, y: 0.1, w: 0.6, h: 0.6 });
  close(drag({ x: 0.1, y: 0.1, w: 0.5, h: 0.5 }, "w", -0.3, 0, null, 100, 100), { x: 0, y: 0.1, w: 0.6, h: 0.5 });
  const kept = drag({ x: 0.1, y: 0.1, w: 0.4, h: 0.4 }, "e", 0.2, 0, 1, 100, 100);
  close(kept, { x: 0.1, y: 0.1, w: 0.6, h: 0.6 });
});
