import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { runtimeIcon, runtimeLine, runtimeLogo, runtimesLabel, runtimesSummary, type Runtime } from "../src/runtimes.ts";

const rt = (state: Runtime["state"], extra: Partial<Runtime> = {}): Runtime => ({ id: state, name: "Julia 1.11.6", lang: "julia", state, ...extra });

test("a runtime's logo: its language, a pin's version dropped", () => {
  assert.deepEqual(["julia", "julia@1.11.9", "Python", "openmodelica", "omc", "rust"].map(runtimeLogo), ["jl", "jl", "py", "mo", "mo", "ru"]);
  assert.deepEqual(["julia@1.11.9", "Python", "omc", "rust"].map(runtimeIcon), ["lang-julia", "lang-python", "lang-modelica", undefined]);
});

test("a runtime's line says its state in words", () => {
  assert.equal(runtimeLine(rt("off")), "not started · starts on first use");
  assert.equal(runtimeLine(rt("busy", { via: "podman", up: 2520, memory: 1.2 * 2 ** 30, cpu: 87.4 })), "session · podman · up 42 min · 1.2 GB · 87 % cpu");
  assert.equal(runtimeLine(rt("idle", { up: 9000, idle: 240, memory: 310 * 2 ** 20 })), "session · idle 4 min · 310 MB");
  assert.equal(runtimeLine(rt("idle", { up: 30 })), "session · up 30 s");
  assert.equal(runtimeLine(rt("starting", { via: "podman" })), "starting · podman");
  assert.equal(runtimeLine(rt("failed", { up: 60, cpu: 3 })), "failed");
});

test("the key's badge counts the sessions up, ! when one failed; it runs while one works", () => {
  assert.deepEqual(runtimesSummary([]), { count: 0, live: false, failed: false });
  assert.deepEqual(runtimesSummary([rt("idle"), rt("off")]), { count: 1, live: false, failed: false });
  assert.deepEqual(runtimesSummary([rt("busy"), rt("starting"), rt("off")]), { count: 2, live: true, failed: false });
  assert.deepEqual(runtimesSummary([rt("failed"), rt("idle")]), { count: 1, live: false, failed: true });
  assert.equal(runtimesLabel({ count: 0, live: false, failed: false }), "Runtimes");
  assert.equal(runtimesLabel({ count: 2, live: true, failed: true }), "Runtimes: 2 sessions, running, one failed");
});

test("the runtimes key: the kit's popover, a positioned anchor, the kit's live light and the registry's icon", () => {
  const src = fs.readFileSync(new URL("../src/RuntimesKey.tsx", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../src/ui.css", import.meta.url), "utf8");
  assert.match(src, /useDismiss\(pop, onClose, \{ triggerRef: trigger \}\)/);
  assert.match(src, /useFocusReturn\(\)/);
  assert.match(src, /<Icon name="a-runtimes" \/>/);
  assert.match(css, /\.runtimes-key \{ position: relative;/, "the peek hangs from its key (Articula's opened off-screen without it)");
  assert.match(css, /\.key\.live \{[^}]*pb-turn/, "the live border reuses the kit's turn, no second @property");
  assert.doesNotMatch(src, /fetch\(|setInterval/, "pure: the app fetches and polls");
});
