import assert from "node:assert/strict";
import { test } from "node:test";
import type { FileEntry } from "../src/files/FileTree.tsx";
import { byParent, folderOf, hubStatus, hubWhere, pickable, saveName, type Hub } from "../src/hub/hub.ts";

const E = (path: string, kind: "file" | "folder" = "file"): FileEntry => ({ path, name: path.split("/").pop()!, depth: path.split("/").length - 1, kind });
const tree = [
  E(".malachite", "folder"), E(".malachite/hub.toml"),
  E("notes", "folder"), E("notes/step.md"),
  E("projects", "folder"), E("projects/pendulum", "folder"), E("projects/pendulum/pendulum.psf"), E("projects/pendulum/cart-pole.pst"), E("projects/pendulum/params.csv"),
  E("runs", "folder"), E("runs/2026-11-25", "folder"), E("runs/2026-11-25/samples.csv"),
  E("Top.PSF"),
];
const paths = (rows: FileEntry[]) => rows.map((r) => r.path);

test("the picker shows only what the app opens, and the folders that hold it", () => {
  assert.deepEqual(paths(pickable(tree, ["psf", "pst"])), ["projects", "projects/pendulum", "projects/pendulum/pendulum.psf", "projects/pendulum/cart-pole.pst", "Top.PSF"]);
});

test("All files shows everything but the hub's own folder", () => {
  const all = paths(pickable(tree, ["psf"], true));
  assert.ok(!all.some((p) => p.startsWith(".malachite")));
  assert.ok(all.includes("notes") && all.includes("runs/2026-11-25/samples.csv"));
});

test("finding keeps the matches and the folders on their way", () => {
  assert.deepEqual(paths(pickable(tree, ["psf", "pst"], false, "cart")), ["projects", "projects/pendulum", "projects/pendulum/cart-pole.pst"]);
  assert.deepEqual(paths(pickable(tree, ["psf"], true, "samples")), ["runs", "runs/2026-11-25", "runs/2026-11-25/samples.csv"]);
});

test("the bar says nothing when a hub is fine, and words when it is not", () => {
  const h: Hub = { id: "1", name: "pump-rig", place: "google-drive", path: "My Drive/Paperboat/pump-rig" };
  assert.equal(hubStatus({ ...h, sync: { state: "synced", text: "synced 12:01" } }), null);
  assert.deepEqual(hubStatus({ ...h, sync: { state: "syncing", text: "syncing 3 files" } }), { text: "syncing 3 files", busy: true });
  assert.deepEqual(hubStatus({ ...h, sync: { state: "error", text: "can't sync: sign in again" } }), { text: "can't sync", bad: true });
  assert.deepEqual(hubStatus({ ...h, missing: true }), { text: "can't find the folder", bad: true });
  assert.equal(hubWhere(h), "Google Drive · My Drive/Paperboat/pump-rig");
  assert.deepEqual(hubStatus({ ...h, conflicts: 2 }), { text: "2 conflict copies", bad: true });
  assert.equal(hubWhere({ ...h, place: "icloud", path: "Paperboat/pump-rig" }), "iCloud Drive · Paperboat/pump-rig");
});

test("Save as adds the app's type unless the name has one of its types", () => {
  assert.equal(saveName(" pendulum ", ["psf", "pst"]), "pendulum.psf");
  assert.equal(saveName("cart.pst", ["psf", "pst"]), "cart.pst");
  assert.equal(saveName("v2.final", ["psf"]), "v2.final.psf");
  assert.equal(saveName("  ", ["psf"]), "");
});

test("By station: each station with its flows under it, the lost ones last", () => {
  const F = (path: string, parent?: string | null, warn?: string): FileEntry => ({ ...E(path), parent, warn });
  const entries = [E("stations", "folder"), F("stations/tank-rig.pst"), F("stations/pendulum.pst"), E("flows", "folder"),
    F("flows/level-loop.psf", "stations/tank-rig.pst"), F("notes/limits.psf", "stations/tank-rig.pst"), F("flows/swing.psf", "stations/pendulum.pst"),
    F("flows/old.psf", null, "pump-rig 0.1.0 not found"), F("flows/stray.psf", "stations/gone.pst"), F("data.csv")];
  const g = byParent(entries, ["psf", "pst"]);
  assert.deepEqual(g.parents.map((p) => [p.entry.name, p.children.map((c) => c.name)]),
    [["tank-rig.pst", ["level-loop.psf", "limits.psf"]], ["pendulum.pst", ["swing.psf"]]]);
  assert.deepEqual(g.orphans.map((e) => e.name), ["old.psf", "stray.psf"]);
  const found = byParent(entries, ["psf", "pst"], "swing");
  assert.deepEqual(found.parents.map((p) => [p.entry.name, p.children.map((c) => c.name)]), [["pendulum.pst", ["swing.psf"]]]);
  assert.deepEqual(found.orphans, []);
  assert.equal(folderOf("flows/a.psf"), "flows");
  assert.equal(folderOf("a.psf"), "");
});
