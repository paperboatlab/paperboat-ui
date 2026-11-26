import assert from "node:assert/strict";
import { test } from "node:test";
import { Force } from "../src/graph/force.ts";

const dist = (f: Force, a: string, b: string) => { const p = f.nodes.find((n) => n.id === a)!, q = f.nodes.find((n) => n.id === b)!; return Math.hypot(p.x - q.x, p.y - q.y); };

test("the layout comes to rest, linked notes near, unlinked apart", () => {
  const ids = ["a", "b", "c", "d", "e", "f"];
  const f = new Force(ids, [{ source: "a", target: "b" }, { source: "b", target: "c" }, { source: "d", target: "e" }]);
  let steps = 0;
  while (f.step()) steps++;
  assert.ok(steps < 400, `rests (${steps} steps)`);
  const linked = [["a", "b"], ["b", "c"], ["d", "e"]], all = ids.flatMap((x, i) => ids.slice(i + 1).map((y) => [x, y]));
  const mean = (ps: string[][]) => ps.reduce((t, [x, y]) => t + dist(f, x, y), 0) / ps.length;
  const unlinked = all.filter(([x, y]) => !linked.some(([p, q]) => (p === x && q === y) || (p === y && q === x)));
  assert.ok(mean(linked) < mean(unlinked), `linked notes sit closer (${mean(linked).toFixed(0)} vs ${mean(unlinked).toFixed(0)})`);
  for (const n of f.nodes) assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y));
});

test("the same notes open the same way, and known places are kept", () => {
  const ids = ["a", "b", "c"], links = [{ source: "a", target: "b" }];
  const one = new Force(ids, links), two = new Force(ids, links);
  one.settle(); two.settle();
  assert.deepEqual(one.nodes.map((n) => [Math.round(n.x), Math.round(n.y)]), two.nodes.map((n) => [Math.round(n.x), Math.round(n.y)]));
  const kept = new Map(one.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  const again = new Force([...ids, "d"], links, kept);
  assert.equal(again.nodes[0].x, one.nodes[0].x);
});

test("a held note stays where it is put", () => {
  const f = new Force(["a", "b"], [{ source: "a", target: "b" }]);
  f.hold("a", 500, 500);
  for (let i = 0; i < 50; i++) f.step();
  assert.deepEqual([f.nodes[0].x, f.nodes[0].y], [500, 500]);
  f.release("a");
  assert.equal(f.nodes[0].fx, null);
});

test("linked notes gather into clusters, and the clusters push apart", () => {
  // two topics: a topic note, its twelve notes, each also linked to the next; one link between the topics
  const topic = (p: string) => Array.from({ length: 12 }, (_, i) => [{ source: `${p}${i + 1}`, target: `${p}0` }, { source: `${p}${i + 1}`, target: `${p}${(i + 1) % 12 + 1}` }]).flat();
  const ids = ["a", "b"].flatMap((p) => Array.from({ length: 13 }, (_, i) => `${p}${i}`));
  const f = new Force(ids, [...topic("a"), ...topic("b"), { source: "a0", target: "b0" }]);
  f.settle();
  const of = (p: string) => f.nodes.filter((n) => n.id.startsWith(p));
  const centre = (p: string) => [of(p).reduce((t, n) => t + n.x, 0) / 13, of(p).reduce((t, n) => t + n.y, 0) / 13];
  const spread = (p: string) => { const [x, y] = centre(p); return of(p).reduce((t, n) => t + Math.hypot(n.x - x, n.y - y), 0) / 13; };
  const [ax, ay] = centre("a"), [bx, by] = centre("b"), apart = Math.hypot(ax - bx, ay - by);
  assert.ok(apart > 2 * (spread("a") + spread("b")), `topics apart (${apart.toFixed(0)} between, ${spread("a").toFixed(0)} and ${spread("b").toFixed(0)} across)`);
});

test("a big hub lays out in a moment", () => {
  const n = 3000, ids = Array.from({ length: n }, (_, i) => `n${i}`);
  const links = ids.flatMap((id, i) => [{ source: id, target: `n${(i * 7 + 1) % n}` }, { source: id, target: `n${Math.floor(i / 10) * 10}` }]);
  const t = performance.now();
  new Force(ids, links).settle();
  const ms = performance.now() - t;
  assert.ok(ms < 8000, `3000 notes, 6000 links: ${ms.toFixed(0)} ms`);
  console.log(`# 3000 notes, 6000 links: ${ms.toFixed(0)} ms`);
});
