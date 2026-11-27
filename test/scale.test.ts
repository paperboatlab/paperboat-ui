import assert from "node:assert/strict";
import { test } from "node:test";
import { applyScale } from "../src/scale.ts";
import { parseSettings } from "../src/workspace/workspace.ts";

test("settings.json: the scale, 1 when unset or unknown", () => {
  assert.equal(parseSettings({ scale: 0.75 }).scale, 0.75);
  assert.equal(parseSettings({ scale: 1.25, theme: "dark" }).scale, 1.25);
  for (const v of [undefined, 2, "1.25", 0, null]) assert.equal(parseSettings({ scale: v }).scale, 1);
  assert.equal(parseSettings(null).scale, 1);
});

const page = () => {
  const props = new Map<string, string>();
  return { style: { zoom: "", setProperty: (k: string, v: string) => props.set(k, v), removeProperty: (k: string) => props.delete(k) } as unknown as CSSStyleDeclaration, props };
};

test("a Paperboat window zooms itself; a browser tab takes CSS zoom", () => {
  const zoomed: number[] = [];
  const win = page();
  applyScale(1.25, win, { setZoom: (f) => zoomed.push(f) });
  assert.deepEqual(zoomed, [1.25]);
  assert.equal(win.style.zoom, "");
  assert.equal(win.props.size, 0);

  const tab = page();
  applyScale(0.75, tab, undefined);
  assert.equal(tab.style.zoom, "0.75");
  assert.equal(tab.props.get("--page-zoom"), "0.75");
  applyScale(1, tab, undefined);   // back to Default: nothing left on <html>
  assert.equal(tab.style.zoom, "");
  assert.equal(tab.props.size, 0);
});
