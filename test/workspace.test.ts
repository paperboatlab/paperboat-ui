import assert from "node:assert/strict";
import { test } from "node:test";
import { keyAction, type Command } from "../src/commands.ts";
import { addRecent, fileMenu, parseRecent, parseSettings, recentFor, recentMenu, RECENT_MAX, tilde, when, type RecentEntry } from "../src/workspace/workspace.ts";

const R = (kind: RecentEntry["kind"], path: string, at: number, app?: string): RecentEntry => ({ kind, path, at, app });
const store = { version: 1 as const, recent: [R("file", "/p/a.jl", 50, "julix"), R("folder", "/p", 40, "julix"), R("hub", "/h/lab", 30, "malachite"), R("file", "/p/b.psf", 20, "simplicial")] };

test("adding puts the entry first, once per kind and path, and keeps 40", () => {
  const s = addRecent(store, R("folder", "/p", 60, "simplicial"));
  assert.deepEqual(s.recent.map((e) => `${e.kind}:${e.path}`), ["folder:/p", "file:/p/a.jl", "hub:/h/lab", "file:/p/b.psf"]);
  assert.equal(addRecent(s, R("file", "/p", 70)).recent.length, 5); // a file and a folder at one path are two entries
  let big = parseRecent(null);
  for (let i = 0; i < 50; i++) big = addRecent(big, R("file", `/f${i}`, i));
  assert.equal(big.recent.length, RECENT_MAX);
  assert.equal(big.recent[0].path, "/f49");
});

test("a broken recent.json reads as an empty list, and bad entries drop", () => {
  assert.deepEqual(parseRecent("nonsense"), { version: 1, recent: [] });
  assert.deepEqual(parseRecent({ recent: [{ kind: "disk", path: "/x", at: 1 }, { kind: "file", path: "", at: 1 }, R("file", "/ok", 1)] }).recent.map((e) => e.path), ["/ok"]);
  assert.equal(parseSettings({ theme: "dark" }).theme, "dark");
  assert.equal(parseSettings({}).theme, "system");
});

test("an app shows every folder and hub, and only its own files", () => {
  const j = recentFor(store, "julix");
  assert.deepEqual(j.files.map((e) => e.path), ["/p/a.jl"]);
  assert.equal(j.folders.length + j.hubs.length, 2);
  assert.equal(recentFor(store, "julix", { hubs: false }).hubs.length, 0); // no Malachite, no hub
  assert.equal(recentFor(store, "malachite", { folders: false }).folders.length, 0);
});

test("Open recent: folders and hubs newest first, the app's files, Clear recent", () => {
  const m = recentMenu(recentFor(store, "simplicial"), () => {}, () => {});
  const labels = m.map((e) => (e === "-" ? "-" : "group" in e ? `#${e.group}` : "note" in e ? e.note : e.label));
  assert.deepEqual(labels, ["#Folders and hubs", "p", "lab", "#Files", "b.psf", "-", "Clear recent"]);
  assert.deepEqual(recentMenu(recentFor(parseRecent(null), "julix"), () => {}, () => {}), [{ note: "Nothing opened yet" }]);
});

test("how long ago, in words", () => {
  const now = 1_764_150_000;
  assert.equal(when(now - 10, now), "now");
  assert.equal(when(now - 7200, now), "2 h ago");
  assert.equal(when(now - 86400 - 60, now), "yesterday");
  assert.equal(when(now - 3 * 86400, now), "3 d ago");
  assert.equal(tilde("/home/me/projects", "/home/me"), "~/projects");
  assert.equal(tilde("/home/meow", "/home/me"), "/home/meow");
});

const run = () => {};
const menu = (o: Partial<Parameters<typeof fileMenu>[0]> = {}) => fileMenu({
  noun: "script", workspace: null, file: false, hubs: true, recent: [], onNew: run, onOpenFile: run, onOpenFolder: run, onConnect: run,
  onSave: run, onSaveAs: run, onCloseFile: run, onCloseWorkspace: run, onSettings: run, ...o,
});

test("the File menu: the same items in the same order, greyed with why", () => {
  assert.deepEqual(menu().map((c) => c.label), ["New script", "Open file…", "Open folder…", "Open recent", "Connect to a hub…", "Save", "Save as…", "Close file", "Close folder", "Settings…"]);
  const save = menu().find((c) => c.id === "file.save")!;
  assert.equal(save.enabled, false);
  assert.equal(save.why, "no file open");
  assert.equal(menu().find((c) => c.id === "file.closeWorkspace")!.why, "no folder open");
  assert.equal(menu({ workspace: { kind: "hub", root: "/h/lab", name: "lab", hub: "1" } }).find((c) => c.id === "file.closeWorkspace")!.label, "Close hub");
  assert.ok(!menu({ hubs: false }).some((c) => c.id === "file.connect")); // no Malachite, no hub
  assert.equal(menu({ hubOnly: true }).find((c) => c.id === "file.connect")!.label, "Open a hub…");
});

const K = (key: string, ctrl = false) => ({ key, ctrlKey: ctrl, metaKey: false, altKey: false, shiftKey: false });

test("Ctrl K Ctrl O: the first stroke waits; anything else gives Ctrl K its own command", () => {
  const cmds: Command[] = [
    ...menu(),
    { id: "search", label: "Search", menu: "view", group: "s", chord: { key: "k", ctrl: true }, run },
  ];
  assert.deepEqual(keyAction(cmds, K("k", true)), { before: undefined, wait: true });
  assert.equal(keyAction(cmds, K("o", true), K("k", true)).run?.id, "file.openFolder");
  const other = keyAction(cmds, K("s", true), K("k", true));
  assert.equal(other.before?.id, "search");
  assert.equal(other.run?.id, "file.save");
  assert.equal(keyAction(cmds, K("o", true)).run?.id, "file.open");
  assert.equal(keyAction(cmds, K("x")).run, undefined);
});

test("Open recent tells two files of the same name apart by their folder", () => {
  let store = parseRecent(null);
  for (const path of ["/p/tank-level/identify.jl", "/p/pendulum/identify.jl", "/p/pendulum/sweep.jl"])
    store = addRecent(store, { kind: "file", path, app: "julix", at: 1 });
  const items = recentMenu(recentFor(store, "julix"), () => {}, () => {}).filter((e) => typeof e === "object" && "label" in e) as { label: string; meta?: string }[];
  assert.deepEqual(items.filter((i) => i.label !== "Clear recent").map((i) => [i.label, i.meta]), [["sweep.jl", undefined], ["identify.jl", "pendulum"], ["identify.jl", "tank-level"]]);
});
