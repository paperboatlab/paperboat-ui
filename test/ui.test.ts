import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { FOLD_MS, FRAMES, frameAt, REST_MIN_MS, restMs, APPS } from "../src/fold.ts";
import { fuzzy } from "../src/fuzzy.ts";
import { GLYPH_FRAMES } from "../src/glyphs.ts";

const read = (f: string) => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");

test("every token the components use is defined", () => {
  const defined = new Set([...(read("tokens.css") + read("ui.css")).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  const used = new Set([...(read("ui.css") + read("theme.tsx")).matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
  assert.deepEqual([...used].filter((v) => !defined.has(v)), []);
});

test("components use roles, never a raw colour", () => {
  const css = read("ui.css").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.deepEqual(css.match(/#[0-9a-f]{3,8}\b/gi) ?? [], []);
});

test("no accent bar beside a selected item", () => {
  assert.doesNotMatch(read("ui.css"), /border-left:\s*\d+px solid var\(--accent/);
});

test("the top-left icon rests at least 10 s, at random", () => {
  assert.equal(restMs(() => 0), REST_MIN_MS);
  assert.ok(restMs(() => 0.999) > REST_MIN_MS);
  assert.ok(REST_MIN_MS >= 10_000);
});

test("a fold goes rest → parcel → rest in the splash's times", () => {
  for (const app of APPS) {
    const rest = FRAMES[app] + 1, one = FOLD_MS[app];
    assert.equal(frameAt(app, 0), rest);
    assert.equal(frameAt(app, one), 1, `${app}: the parcel at the turn`);
    assert.equal(frameAt(app, 2 * one), rest);
    for (let t = 0; t < one; t += 50) assert.ok(frameAt(app, t + 50) <= frameAt(app, t), `${app}: folding never unfolds`);
    for (let t = one; t < 2 * one; t += 50) assert.equal(frameAt(app, t), frameAt(app, 2 * one - t), `${app}: unfold mirrors the fold`);
    for (let f = 1; f <= FRAMES[app]; f++) assert.ok(fs.existsSync(new URL(`../src/marks/${app}/${String(f).padStart(2, "0")}.webp`, import.meta.url)), `${app} frame ${f}`);
  }
  assert.equal(FOLD_MS.paperboat, 2000);
  assert.equal(FOLD_MS.malachite, 1200);
});

test("fuzzy: letters in order, word starts first", () => {
  assert.equal(fuzzy("xyz", "runtime list"), undefined);
  assert.deepEqual(fuzzy("rl", "runtime list")?.at, [0, 8]);
  assert.deepEqual(fuzzy("pkg", "package add")?.at, [0, 3, 5]);
  assert.ok(fuzzy("run", "runtime list")!.score < fuzzy("run", "prune volumes")!.score);
  assert.deepEqual(fuzzy("", "anything"), { score: 0, at: [] });
  assert.deepEqual(fuzzy("ab", "a-xb ab")?.at, [5, 6]);
});

test("the TUI spinner: the designed sequence", () => {
  assert.deepEqual(GLYPH_FRAMES.map((g) => g.codePointAt(0)! - 0xe000), [0, 1, 2, 3, 4, 5, 5, 6, 7]);
});
