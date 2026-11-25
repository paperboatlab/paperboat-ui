// A hub (REBRAND "Hub", paperboat#16): Malachite's store for one piece of work, in a folder on this
// computer or on a cloud. The kit only draws hubs; the app reads them (`$PAPERBOAT_HOME/hubs.toml`)
// and does what the user picks. Words, never Git: sync state is synced / syncing / offline / can't sync.
import type { FileEntry } from "../files/FileTree.tsx";

export type HubPlace = "local" | "google-drive" | "onedrive" | "dropbox";

export const PLACE_NAMES: Record<HubPlace, string> = {
  local: "Local", "google-drive": "Google Drive", onedrive: "OneDrive", dropbox: "Dropbox",
};

export type Hub = {
  id: string;
  name: string;
  place: HubPlace;
  /** Where it lives, as the user knows it: `~/hubs/tank-lab`, `My Drive/Paperboat/pump-rig`. */
  path: string;
  /** A cloud hub's sync state, in words: "synced 12:01", "syncing 3 files", "offline: kept here, syncs later", "can't sync: sign in again". */
  sync?: { state: "synced" | "syncing" | "offline" | "error"; text: string };
  /** The folder is gone (moved or deleted outside Paperboat). */
  missing?: boolean;
  /** A short count of what it holds, for the app asking ("3 flows · 2 stations", "58 notes"). */
  holds?: string;
};

/** Where a hub lives, in one line: "Local · ~/hubs/tank-lab". */
export const hubWhere = (h: Hub) => `${PLACE_NAMES[h.place]} · ${h.path}`;

/** What the bar says after the hub's name: nothing when all is well (synced is in the menu). */
export function hubStatus(h: Hub): { text: string; bad?: boolean; busy?: boolean } | null {
  if (h.missing) return { text: "can't find the folder", bad: true };
  switch (h.sync?.state) {
    case "syncing": return { text: h.sync.text, busy: true };
    case "error": return { text: "can't sync", bad: true };
    case "offline": return { text: "offline" };
    default: return null;
  }
}

/** The folder Paperboat keeps for a hub's own files: never shown in a tree. */
export const HUB_OWN = ".malachite";

const ext = (name: string) => (name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "");

/** Whether an app opens this file (`types` are extensions without the dot). */
export const opens = (name: string, types: readonly string[]) => types.includes(ext(name));

/**
 * The rows of a hub's tree for a picker (entries in tree order, as FileTree takes them):
 * `.malachite/` never; by default only the files the app opens and the folders that hold some;
 * `all` keeps every file; `find` keeps the files whose name has it (and the folders on their way).
 */
export function pickable(entries: readonly FileEntry[], types: readonly string[], all = false, find = ""): FileEntry[] {
  const needle = find.trim().toLowerCase();
  const keep = new Set<string>();
  const parentsOf = (path: string) => {
    const out: string[] = [];
    for (let i = path.indexOf("/"); i !== -1; i = path.indexOf("/", i + 1)) out.push(path.slice(0, i));
    return out;
  };
  for (const e of entries) {
    if (e.path === HUB_OWN || e.path.startsWith(`${HUB_OWN}/`)) continue;
    if (e.kind === "folder") {
      if (all && !needle) keep.add(e.path);
      continue;
    }
    if (!all && !opens(e.name, types)) continue;
    if (needle && !e.name.toLowerCase().includes(needle)) continue;
    keep.add(e.path);
    for (const p of parentsOf(e.path)) keep.add(p);
  }
  return entries.filter((e) => keep.has(e.path));
}
