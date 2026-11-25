import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { blockClasses, blockTag } from "../../src/canvas/faces.ts";

const read = (f: string) => fs.readFileSync(new URL(`../../src/canvas/${f}`, import.meta.url), "utf8");

test("the head says what is happening, else what the block is", () => {
  assert.equal(blockTag({ kind: "function" }), "fn");
  assert.equal(blockTag({ kind: "source" }), "source");
  assert.equal(blockTag({ kind: "function", step: true }), "step");
  assert.equal(blockTag({ kind: "function", linked: true }), "linked");
  assert.equal(blockTag({ kind: "function", linked: true, state: "running" }), "running", "a state wins over what it is");
  assert.equal(blockTag({ kind: "function", state: "failed", commented: "out" }), "// commented");
  assert.equal(blockTag({ kind: "function", commented: "through" }), "// bypass");
  assert.equal(blockTag({ kind: "function", object: "joint" }), "joint");
  assert.equal(blockTag({ kind: "function", group: "story" }), "story");
});

test("the card's look follows its state", () => {
  assert.equal(blockClasses({ kind: "function", linked: true, selected: true }), "block kind-function linked selected");
  assert.equal(blockClasses({ kind: "function", object: "joint" }), "block kind-function object joint");
  assert.match(blockClasses({ kind: "monitor", state: "running" }), /\brunning\b/);
});

test("the faces follow the rebrand", () => {
  const css = read("canvas.css").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(css, /\.block\.selected \{ outline: 2px solid var\(--accent-select\)/, "selection is a soft outline");
  assert.doesNotMatch(css, /\.block-progress/, "a running block has no progress bar");
  assert.match(css, /\.block\.linked \{ border-top: 3px solid var\(--line-ink\)/, "a linked block carries the ink bar");
  assert.match(css, /\.block\.missing \{ border: 1\.5px dashed var\(--danger\)/, "missing is dashed red");
  const card = read("BlockCard.tsx");
  assert.match(card, /state === "running" && <Spinner/, "running shows the spinner in the head");
  assert.match(card, /<Icon name="a-station"/, "a linked block shows the station mark from the registry");
  assert.doesNotMatch(card, /✎/, "icons from the registry, not text glyphs");
});

test("a running plate is outlined; the canvas tools are round keys from the registry", () => {
  const css = read("canvas.css").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(css, /\.compact-block\.running \.plate \{ border-color/, "CompactBlock's class is its word");
  const tools = read("CanvasTools.tsx");
  for (const icon of ["question", "zoom-out", "zoom-in", "screen-full"]) assert.match(tools, new RegExp(`icon="${icon}"`));
});
