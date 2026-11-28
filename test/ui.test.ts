import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { FOLD_MS, FRAMES, frameAt, REST_MIN_MS, restMs, splashFrame, APPS } from "../src/fold.ts";
import { fuzzy } from "../src/fuzzy.ts";
import { GLYPH_FRAMES } from "../src/glyphs.ts";

const read = (f: string) => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");

const STYLES = ["ui.css", "split.css", "parts.css", "canvas/canvas.css", "files/files.css", "plot/plot.css", "scope/scope.css", "packages/packages.css"];
const css = (f: string) => read(f).replace(/\/\*[\s\S]*?\*\//g, "");

test("every token the components use is defined", () => {
  const all = STYLES.map(read).join("\n");
  const defined = new Set([...(read("tokens.css") + all).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  const used = new Set([...(all + read("theme.tsx")).matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
  // set by the component that uses them (inline style), each with its fallback
  const own = new Set(["--s", "--ip-color", "--lr", "--search-x", "--search-y", "--page-zoom"]);
  assert.deepEqual([...used].filter((v) => !defined.has(v) && !own.has(v)), []);
});

for (const f of STYLES) {
  test(`${f}: the rebrand's rules`, () => {
    const c = css(f);
    assert.deepEqual(c.match(/#[0-9a-f]{3,8}\b/gi) ?? [], [], "roles, never a raw colour");
    assert.doesNotMatch(c, /--signal/, "the accent, never the retired orange (--signal)");
    assert.doesNotMatch(c, /border-left:\s*\d+px solid var\(--(accent|signal|line-ink)|inset \d+px 0 0 /, "no bar beside a selected item");
    assert.doesNotMatch(c, /content:\s*"\s*[\[\]]/, "a choice rises or is underlined, never bracketed");
  });
}

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

test("the Console is a floating window, exported from the kit", () => {
  assert.match(read("index.ts"), /ConsoleWindow/);
  const c = read("Console.tsx");
  assert.match(c, /<RemoveKey label="Close the Console/, "closed by the round ×, not a text key");
  assert.doesNotMatch(c, /key small/, "the rebrand's key sizes (sm), not the legacy kit's");
});

test("the page rail, quick add and the run dock follow the rebrand", () => {
  const index = read("index.ts");
  assert.match(index, /PageRail/); assert.match(index, /\bDock\b/);
  const rail = read("PageRail.tsx");
  assert.match(rail, /aria-current=\{p\.id === page/, "the current page is raised, said by aria-current");
  assert.match(rail, /p\.why/, "a page that can't open says why");
  assert.match(css("ui.css"), /\.page-rail-item:hover \.page-rail-chip/, "hovering a page, its chip grows to say what it is");
  assert.match(read("Search.tsx"), /\{!at && <div className="search-scrim"/, "quick add has no scrim");
  const dock = read("Dock.tsx");
  assert.match(dock, /<Key kind="primary" icon="play"/, "Run is the one tinted key");
  assert.doesNotMatch(dock, /[▶■]/, "icons from the registry, not text glyphs");
});

test("the debug dock: Continue swaps with Pause, the steps grey out and say why, Stop isn't red", () => {
  assert.match(read("index.ts"), /\bDebugDock\b/);
  const d = read("Dock.tsx");
  const fn = d.slice(d.indexOf("export function DebugDock"), d.indexOf("export type StationInfo"));
  assert.match(fn, /paused\s*\? <Key kind="primary" icon="debug-continue"[^]*: <Key kind="primary" icon="debug-pause"/, "Continue, else Pause, in one place");
  assert.match(fn, /disabled=\{!paused\} title={paused \? .*? : "Running: pause first"}/, "a step while running stays, greyed, and says why");
  assert.doesNotMatch(fn, /kind="danger"/, "Stop is not red: red is only for errors");
  for (const k of ["continue", "pause", "over", "into", "out", "stop"]) assert.match(fn, new RegExp(`DEBUG_KEYS\\.${k}`), `${k} shows its key`);
});

test("the splash: the parcel to the rest pose, shown late, failed in red with Retry", () => {
  for (const app of APPS) {
    assert.equal(splashFrame(app, 0), 1, `${app}: starts on the parcel`);
    assert.equal(splashFrame(app, 1), FRAMES[app] + 1, `${app}: ends on the rest pose`);
    for (let p = 0; p < 1; p += 0.05) assert.ok(splashFrame(app, p + 0.05) >= splashFrame(app, p), `${app}: unfolding never folds`);
  }
  const index = read("index.ts");
  assert.match(index, /\bSplash\b/); assert.match(index, /\bMenuBar\b/);
  const s = read("Splash.tsx");
  assert.match(s, /SHOW_MS = 350/, "a fast start never flashes");
  assert.match(s, /<Key kind="primary" onClick=\{onRetry\}>Retry/, "Retry is the one tinted key");
  assert.match(css("ui.css"), /\.splash-stage\.failed \.splash-say \{ color: var\(--danger-text\)/);
});

test("a disabled key says why; the kit exports what apps need", () => {
  assert.doesNotMatch(css("ui.css"), /\.key:disabled[^{]*\{[^}]*pointer-events: none/, "a natively disabled key keeps its tooltip");
  const index = read("index.ts");
  assert.match(index, /Menu as CommandMenu/);
  assert.match(index, /NumberField/);
});

test("toasts: done leaves after --toast-stay, working and failed stay", async () => {
  const { ms, leaves } = await import("../src/toast.ts");
  assert.equal(ms("5s", 1), 5000);
  assert.equal(ms(" 1200ms", 1), 1200);
  assert.equal(ms("", 4000), 4000);
  assert.deepEqual([leaves("done"), leaves(undefined), leaves("working"), leaves("failed")], [true, true, false, false]);
  assert.match(read("tokens.css"), /--toast-stay:\s*\d/);
});

test("toasts: a warning, and one that offers a key, wait for the user; the warning is ink", async () => {
  const { leaves, record } = await import("../src/toast.ts");
  const save = [{ label: "Save", run: () => {} }];
  assert.deepEqual([leaves("warning"), leaves("done", save), leaves("done", [])], [false, false, true]);
  const log = record([], { id: 1, title: "Opened", state: "done", actions: save, at: 1 });
  assert.equal(log[0].actions?.[0].label, "Save"); // the bell keeps the keys
  assert.match(read("ui.css"), /\.toast-mark\.warn[^{]*\{ color: var\(--text\)/);
  assert.match(read("Toasts.tsx"), /name="warning"/);
});

test("notifications: newest first, an update moves its entry up, at most LOG_MAX", async () => {
  const { record, ago, LOG_MAX } = await import("../src/toast.ts");
  let log = record([], { id: 1, title: "Pulling", state: "working", at: 1 });
  log = record(log, { id: 2, title: "Saved", state: "done", at: 2 });
  log = record(log, { id: 1, title: "Pulled", state: "done", at: 3 });
  assert.deepEqual(log.map((n) => [n.id, n.title]), [[1, "Pulled"], [2, "Saved"]]);
  for (let i = 10; i < 100; i++) log = record(log, { id: i, title: "x", at: i });
  assert.equal(log.length, LOG_MAX);
  assert.deepEqual([ago(0, 10_000), ago(0, 180_000), ago(0, 7_200_000)], ["now", "3 min ago", "2 h ago"]);
});

test("the history's styles are scoped to its own popover, never a bare class an app may use", () => {
  assert.doesNotMatch(css("ui.css"), /(^|[\s,}])\.notes?(?![\w-])/m);
});

test("about: the app's credits first, the kit's after without repeats; one line of version info", async () => {
  const { builtOn, versionInfo, KIT_CREDITS } = await import("../src/about.ts");
  const own: [string, string, string, string][] = [["three.js", "3D", "MIT", "https://threejs.org"], ["React", "the interface", "MIT", "https://react.dev"]];
  const all = builtOn(own);
  assert.deepEqual(all.slice(0, 2).map(([n]) => n), ["three.js", "React"]);
  assert.equal(all.filter(([n]) => n === "React").length, 1);
  assert.equal(all.length, 2 + KIT_CREDITS.length - 1);
  assert.equal(versionInfo("articula", "0.1.0", "0.1.0-alpha.3", "omc 1.24.0"), "Articula 0.1.0 · Paperboat 0.1.0-alpha.3 · omc 1.24.0");
  assert.equal(versionInfo("julix", "0.2.0", null), "Julix 0.2.0 · Paperboat not installed");
  assert.equal(versionInfo("paperboat", "0.1.0-alpha.3", "x", "commit abc"), "Paperboat 0.1.0-alpha.3 · commit abc");
});

test("an example's banner: it is read-only, Copy is a key, and it sits in the bay like a toast or a panel", () => {
  const b = read("ExampleBanner.tsx");
  assert.match(b, /This example is read-only\. Copy it to make changes\./);
  assert.match(b, /<Key size="sm" icon="copy"/, "Copy is a key beside the words, not a link inside them");
  assert.doesNotMatch(b, /aren't kept/, "an example opened in place is read-only, not a scratch copy");
  const rule = css("parts.css").match(/\.example-banner \{([^}]*)\}/)?.[1] ?? "";
  assert.match(rule, /border: 1px solid var\(--line\)/, "the line all round, as a toast");
  assert.match(rule, /border-radius: var\(--radius-lg\)/, "the panels' and toasts' radius, never square");
  assert.match(rule, /background: var\(--surface-raised\)/, "the toasts' and pills' surface");
  assert.doesNotMatch(rule, /border-bottom|margin/, "no edge-to-edge strip: the app gives it its place");
});

test("the shared fields take readOnly: the value shows, nothing changes it", () => {
  const ctl = read("controls.tsx");
  for (const fn of ["Segmented", "Switch"]) {
    const body = ctl.slice(ctl.indexOf(`export function ${fn}`));
    assert.match(body, /readOnly\?: boolean/, `${fn} takes readOnly`);
    assert.match(body, /aria-readonly=\{readOnly \|\| undefined\}/, `${fn} says it is read-only`);
  }
  assert.match(ctl, /if \(!fixed\) step\(/, "read-only, the arrows don't move the choice");
  assert.match(read("NumberField.tsx"), /if \(readOnly\) return;/);
  assert.match(read("canvas/ParamField.tsx"), /readOnly=\{readOnly\}/);
  const row = read("canvas/ParamRow.tsx");
  assert.equal(row.match(/readOnly=\{readOnly\}/g)?.length, 4, "every kind of param: formula, number, switch, text");
  assert.match(row, /disabled=\{disabled \|\| readOnly\}/, "a select has no readonly: it is disabled, drawn read-only");
  assert.match(read("Key.tsx"), /export function RemoveKey\(\{ label, onClick, disabled, title \}/);
  const ui = css("ui.css");
  assert.match(ui, /input\.read-only[^{]*\{[^}]*background: transparent/, "a read-only field is out of its well");
  assert.match(ui, /\.seg\.read-only button \{ cursor: default; \}/);
});
