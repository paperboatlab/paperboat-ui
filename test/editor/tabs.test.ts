import assert from "node:assert/strict";
import { test } from "node:test";
import { afterClose, orderTabs, tabMenu, tabsToClose } from "../../src/editor/tabs.ts";

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
