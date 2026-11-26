import assert from "node:assert/strict";
import { test } from "node:test";
import { nameAt, paramText, parseParam, suggestVars } from "../../src/canvas/bindings.ts";

test("a param's text is a number, a variable or a formula", () => {
  const names = ["kp", "mass"];
  assert.equal(parseParam(" 2.5 ", names), 2.5);
  assert.equal(parseParam("-1e-3", names), -0.001);
  assert.deepEqual(parseParam("kp", names), { var: "kp" });
  assert.deepEqual(parseParam("kp / 5", names), { expr: "kp / 5" });
  assert.deepEqual(parseParam("kd", names), { expr: "kd" }, "an unknown name is a formula: the station says what is wrong");
  assert.equal(parseParam("  ", names), undefined);
  assert.deepEqual([paramText(3), paramText({ var: "kp" }), paramText({ expr: "kp/5" }), paramText(undefined)], ["3", "kp", "kp/5", ""]);
});

test("the name before the caret is what suggestions match", () => {
  assert.deepEqual(nameAt("2*ka", 4), { from: 2, word: "ka" });
  assert.deepEqual(nameAt("ka + 1", 2), { from: 0, word: "ka" });
  assert.equal(nameAt("1e", 2), null, "an exponent is no name");
  assert.equal(nameAt("m.x", 3), null, "after a dot");
  assert.equal(nameAt("2 + ", 4), null);
});

test("suggestions: names that start with the word first, then those containing it", () => {
  const vars = [{ name: "gain_k" }, { name: "kp" }, { name: "Kd" }, { name: "mass" }];
  assert.deepEqual(suggestVars(vars, "k").map((v) => v.name), ["kp", "Kd", "gain_k"]);
  assert.deepEqual(suggestVars(vars, "zz"), []);
});
