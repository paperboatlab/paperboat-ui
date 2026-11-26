import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { afterClose, orderTabs, revealDelta, tabMenu, tabsToClose } from "../../src/editor/tabs.ts";

const tabs = ["a.jl", "b.jl", "c.jl", "d.jl", "e.jl"];
const set = { tabs, pinned: new Set(["a.jl"]), dirty: (p: string) => p === "d.jl" };

test("each close takes what it says and passes pinned tabs; Close saved keeps unsaved ones", () => {
  assert.deepEqual(tabsToClose("this", "a.jl", set), ["a.jl"]);  // a pinned tab closes by its own Close
  assert.deepEqual(tabsToClose("others", "c.jl", set), ["b.jl", "d.jl", "e.jl"]);
  assert.deepEqual(tabsToClose("right", "c.jl", set), ["d.jl", "e.jl"]);
  assert.deepEqual(tabsToClose("saved", "c.jl", set), ["b.jl", "c.jl", "e.jl"]);
  assert.deepEqual(tabsToClose("all", "c.jl", set), ["b.jl", "c.jl", "d.jl", "e.jl"]);
});

test("the shown tab's right neighbour shows after it closes, else its left, else nothing", () => {
  assert.deepEqual(afterClose(tabs, "c.jl", ["c.jl"]), { tabs: ["a.jl", "b.jl", "d.jl", "e.jl"], current: "d.jl" });
  assert.equal(afterClose(tabs, "c.jl", ["c.jl", "d.jl", "e.jl"]).current, "b.jl");
  assert.equal(afterClose(tabs, "b.jl", ["d.jl"]).current, "b.jl");
  assert.equal(afterClose(tabs, "c.jl", tabs).current, null);
  assert.deepEqual(orderTabs(tabs, new Set(["c.jl", "a.jl"])), ["a.jl", "c.jl", "b.jl", "d.jl", "e.jl"]);
});

test("the menu: an item that would do nothing stays greyed with why; the file's menu follows", () => {
  let closed: string[] = [];
  const items = tabMenu("e.jl", set, { close: (p) => (closed = p), pin: () => {}, file: [{ group: "Julix" }, { id: "run", label: "Run file", run: () => {} }] });
  const byId = Object.fromEntries(items.filter((i) => typeof i === "object" && "id" in i).map((i) => [(i as { id: string }).id, i as { disabled?: boolean; why?: string; label: string; run: () => void }]));
  assert.equal(byId["tab-right"].disabled, true);
  assert.equal(byId["tab-right"].why, "Nothing to the right");
  assert.equal(byId["tab-pin"].label, "Pin");
  assert.ok(items.some((i) => typeof i === "object" && "group" in i && i.group === "Julix"));
  byId["tab-others"].run();
  assert.deepEqual(closed, ["b.jl", "c.jl", "d.jl"]);
  const only = tabMenu("a.jl", { tabs: ["a.jl"], pinned: new Set(["a.jl"]) }, { close: () => {} });
  const all = only.find((i) => typeof i === "object" && "id" in i && i.id === "tab-all") as { disabled?: boolean; why?: string };
  assert.deepEqual([all.disabled, all.why], [true, "Every tab is pinned"]);
});

test("the shown tab scrolls into view by the least move, a too-wide one shows its start", () => {
  const strip = { left: 100, right: 500 };
  assert.equal(revealDelta(strip, { left: 200, right: 300 }), 0);
  assert.equal(revealDelta(strip, { left: 450, right: 560 }), 60);   // past the right edge: just enough
  assert.equal(revealDelta(strip, { left: 40, right: 140 }), -60);   // past the left edge
  assert.equal(revealDelta(strip, { left: 520, right: 1000 }), 420); // wider than the strip: its start
});

test("EditorTabs: a tablist that scrolls, closed by the round ×, its menu the kit's TabMenu", () => {
  const src = fs.readFileSync(new URL("../../src/editor/EditorTabs.tsx", import.meta.url), "utf8");
  assert.match(src, /role="tablist"/);
  assert.match(src, /<RemoveKey label=\{`Close/);
  assert.match(src, /<TabMenu /);
  const css = fs.readFileSync(new URL("../../src/ui.css", import.meta.url), "utf8");
  assert.match(css, /\.editor-tabs-strip \{[^}]*overflow-x: auto[^}]*scrollbar-width: none/, "scrolls, no scrollbar");
  assert.match(css, /\.editor-tabs \{[^}]*height: var\(--panel-head-height\)/, "lines up with panel heads");
});
