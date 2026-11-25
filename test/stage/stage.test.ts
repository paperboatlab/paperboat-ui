import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { fieldColors, meshGeometry, srgbToLinear } from "../../src/stage/meshes.ts";

test("a mesh's field runs over its range, as linear colours three.js takes", () => {
  const c = fieldColors([0, 5, 10]);
  assert.equal(c.length, 9);
  assert.notDeepEqual([...c.slice(0, 3)], [...c.slice(6, 9)]); // low and high differ
  assert.deepEqual([...fieldColors([3, 3], [0, 10]).slice(0, 3)], [...fieldColors([3], [0, 10])]); // a fixed range, not the values' own
  assert.equal(srgbToLinear(0), 0);
  assert.ok(Math.abs(srgbToLinear(1) - 1) < 1e-9);
});

test("a mesh entity becomes indexed geometry with normals", () => {
  const g = meshGeometry({ id: "m", shape: "mesh", pos: [0, 0, 0], vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2] });
  assert.equal(g.getAttribute("position").count, 3);
  assert.equal(g.getIndex()?.count, 3);
  assert.ok(g.getAttribute("normal"));
});

test("the stage's styles use tokens only, and only the stage loads three", () => {
  const css = fs.readFileSync(fileURLToPath(new URL("../../src/stage/stage.css", import.meta.url)), "utf8");
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
  const index = fs.readFileSync(fileURLToPath(new URL("../../src/index.ts", import.meta.url)), "utf8");
  assert.doesNotMatch(index, /stage|three/, "the main entry stays free of three");
});
