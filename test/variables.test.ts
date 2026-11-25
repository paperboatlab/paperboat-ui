// The variables list's words (VariableList.tsx): the type line under a name and the value at the right.
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { typeLine, valueText } from "../src/variables.ts";

test("the type line: the type, then what qualifies it", () => {
  assert.equal(typeLine({ type: "number", value: 0.4, unit: "N·s/rad" }), "number · N·s/rad");
  assert.equal(typeLine({ type: "number", expr: "kp_theta / 5" }), "ƒ kp_theta / 5 · number");
  assert.equal(typeLine({ type: "number", expr: "2 * l", unit: "m" }), "ƒ 2 * l · number · m");
  assert.equal(typeLine({ type: "boolean", value: true }), "boolean");
  assert.equal(typeLine({ type: "enum", value: "a", options: ["a", "b"] }), "enum · a | b");
  assert.equal(typeLine({ type: "matrix", value: "1 0; 0 1" }), "matrix 2×2");
  assert.equal(typeLine({ type: "matrix", value: "[[1, 2, 3]]" }), "matrix 1×3", "a live matrix in JSON");
  assert.equal(typeLine({ type: "matrix", value: "1 2; 3" }), "matrix", "no shape for a broken matrix");
  assert.equal(typeLine({ type: "matrix" }), "matrix", "a live matrix too large to share has no value");
  assert.equal(typeLine({ type: "text", value: "x" }), "text");
  assert.equal(typeLine({ type: "number", value: 1, tunable: true }), "number · tunable");
});

test("a value as the row shows it", () => {
  assert.equal(valueText(-0.123456789), "−0.123457");
  assert.equal(valueText(40), "40");
  assert.equal(valueText(true), "on");
  assert.equal(valueText(false), "off");
  assert.equal(valueText(undefined), "–");
  assert.equal(valueText(""), "–");
  assert.equal(valueText("[[1,2],[3,4]]", "matrix"), "1 2; 3 4");
  assert.equal(valueText("data/runs/step.csv", "file"), "step.csv");
  assert.equal(valueText("fast", "enum"), "fast");
});

test("a row: tinted when picked, outlined when open, live in the accent, never a side bar", () => {
  const css = fs.readFileSync(new URL("../src/ui.css", import.meta.url), "utf8");
  assert.match(css, /\.var-row\.live \.var-row-value \{ color: var\(--accent-text\)/);
  assert.match(css, /\.var-row\.open \{[^}]*box-shadow: 0 0 0 1px var\(--accent-select\)/);
  assert.match(css, /\.var-group-title \{[^}]*font: 600 var\(--size-2xs\)/, "group titles at a label size (12 px), not 10.5 px capitals");
  assert.doesNotMatch(css.slice(css.indexOf(".var-list")), /text-transform: uppercase/);
});

test("an idle instrument says why it is empty, in the app's words unless it has its own", () => {
  const src = fs.readFileSync(new URL("../src/plot/Instrument.tsx", import.meta.url), "utf8");
  assert.match(src, /export const InstrumentIdle = createContext/);
  assert.match(src, /idle \? \(hint \?\? fallback\) : undefined/);
  assert.match(fs.readFileSync(new URL("../src/plot/index.ts", import.meta.url), "utf8"), /InstrumentIdle/);
});
