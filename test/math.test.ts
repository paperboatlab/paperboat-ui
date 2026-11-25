import assert from "node:assert/strict";
import { test } from "node:test";
import { INLINE_MATH, mathHtml } from "../src/math.ts";

const found = (s: string) => [...s.matchAll(INLINE_MATH)].map((m) => m[1]);

test("inline math is $…$, not a price, not \\$, not $$", () => {
  assert.deepEqual(found("the gain $k_p = 40$ and $\\tau$."), ["k_p = 40", "\\tau"]);
  assert.deepEqual(found("costs $5 and $6 today"), []);
  assert.deepEqual(found("a \\$ sign and $$x$$"), []);
  assert.deepEqual(found("$ x $ is not math"), []);
  assert.deepEqual(found("escaped $a\\$b$ inside"), ["a\\$b"]);
});

test("math renders, and a mistake shows instead of throwing", () => {
  assert.match(mathHtml("x^2"), /katex/);
  assert.match(mathHtml("\\frac{1}{2}", true), /katex-display/);
  assert.match(mathHtml("\\notacommand{x}"), /#cc0000|katex-error/);
});
