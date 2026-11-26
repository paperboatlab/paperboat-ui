// The one file workflow (plans/2026-11-26_11-05_one_file_workflow.md, mockup agent-docs/rebrand/apps/files):
// every app works in a workspace, a folder on this computer or a hub. The kit draws; each app's server does
// the files. Here the pure parts: the workspace, the shared store's shapes (`recent.json`, `settings.json`
// under $PAPERBOAT_HOME; no file IO here), the File menu's commands, and the Paperboat window's shell.
import type { Command } from "../commands.ts";
import type { MenuEntry } from "../Menu.tsx";
import type { Theme } from "../theme.tsx";
import { ago } from "../toast.ts";
import { fileIconFor } from "../files/types.ts";

/** What an app works in: a folder, a hub (`hub`: its id), or nothing (the Start page). */
export type Workspace = { kind: "folder" | "hub"; root: string; name: string; hub?: string };

// ── the shared store ──

export type RecentKind = "folder" | "hub" | "file";
/** One thing opened: `at` in seconds since 1970; `app` that opened it; `hub` the id of a hub (or of the hub a file lies in). */
export type RecentEntry = { kind: RecentKind; path: string; hub?: string; app?: string; at: number };
export type RecentStore = { version: 1; recent: RecentEntry[] };
export type SharedSettings = { version: 1; theme: Theme };

/** One entry per (kind, path), newest first, this many at most. */
export const RECENT_MAX = 40;

const KINDS: readonly string[] = ["folder", "hub", "file"];
const isEntry = (e: unknown): e is RecentEntry => {
  const r = e as RecentEntry;
  return !!r && typeof r === "object" && KINDS.includes(r.kind) && typeof r.path === "string" && r.path !== "" && Number.isFinite(r.at);
};

/** `recent.json` as read (anything: a missing or broken file is an empty list), its entries kept in order. */
export function parseRecent(v: unknown): RecentStore {
  const list = (v as RecentStore | null)?.recent;
  return { version: 1, recent: Array.isArray(list) ? list.filter(isEntry).slice(0, RECENT_MAX) : [] };
}

/** The store with `entry` first: an older entry of the same kind and path goes, and the list keeps RECENT_MAX. */
export function addRecent(store: RecentStore, entry: RecentEntry): RecentStore {
  const rest = store.recent.filter((e) => e.kind !== entry.kind || e.path !== entry.path);
  return { version: 1, recent: [entry, ...rest].slice(0, RECENT_MAX) };
}

/** The store without one entry (a folder that is gone), or empty (Clear recent). */
export const dropRecent = (store: RecentStore, entry?: Pick<RecentEntry, "kind" | "path">): RecentStore =>
  ({ version: 1, recent: entry ? store.recent.filter((e) => e.kind !== entry.kind || e.path !== entry.path) : [] });

/**
 * What one app shows, newest first, by group: every folder and hub, and only its own files.
 * `hubs: false` without Malachite (no Malachite, no hub); `folders: false` in a hub-only app (Malachite).
 */
export function recentFor(store: RecentStore, app: string, { hubs = true, folders = true } = {}) {
  const by = (k: RecentKind) => store.recent.filter((e) => e.kind === k).sort((a, b) => b.at - a.at);
  return {
    folders: folders ? by("folder") : [],
    hubs: hubs ? by("hub") : [],
    files: by("file").filter((e) => e.app === app),
  };
}

/** `settings.json` as read: the theme every app starts in ("system" when unset). */
export function parseSettings(v: unknown): SharedSettings {
  const t = (v as SharedSettings | null)?.theme;
  return { version: 1, theme: t === "light" || t === "dark" ? t : "system" };
}

/** How long ago, in words (`at`, `now` in seconds): "now", "5 min ago", "2 h ago", "yesterday", "3 d ago", then the day. */
export function when(at: number, now: number) {
  const days = Math.floor((now - at) / 86400);
  if (days < 1) return ago(at * 1000, now * 1000);
  if (days < 2) return "yesterday";
  if (days < 7) return `${days} d ago`;
  return ago(at * 1000, now * 1000);
}

/** The last part of a path: a folder's or a file's name. */
export const baseName = (path: string) => path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path;

/** A path as the user knows it: the home folder as ~. */
export const tilde = (path: string, home?: string) =>
  home && (path === home || path.startsWith(`${home}/`)) ? `~${path.slice(home.length)}` : path;

// ── the File menu: the same items in the same order in every app ──

export type FileMenuOptions = {
  /** The menu's id in the app's bar (default "file"). */
  menu?: string;
  /** New <noun>: "script", "flow", "model", "note". */
  noun: string;
  workspace: Workspace | null;
  /** A file is open (Save, Save as…, Close file). */
  file: boolean;
  /** Malachite is installed: Connect to a hub… (a hub-only app: Open a hub…). */
  hubs: boolean;
  hubOnly?: boolean;
  /** Open recent's items (`recentMenu`). */
  recent: MenuEntry[];
  onNew: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onConnect?: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onCloseFile: () => void;
  onCloseWorkspace: () => void;
  onSettings: () => void;
};

/**
 * The File menu's commands for the app's registry (MenuBar, the command search and the shortcuts read
 * them): New · Open file… · Open folder… · Open recent › · Connect to a hub… · Save · Save as… · Close file ·
 * Close folder (Close hub) · Settings…. What can't run stays, greyed, with why. The app's own commands
 * live in its own menu.
 */
export function fileMenu(o: FileMenuOptions): Command[] {
  const menu = o.menu ?? "file";
  const noFile = o.file ? {} : { enabled: false, why: "no file open" };
  const c = (id: string, label: string, group: string, run: () => void, more: Partial<Command> = {}): Command =>
    ({ id: `file.${id}`, label, menu, group, run, ...more });
  return [
    c("new", `New ${o.noun}`, "open", o.onNew, { shortcut: "Ctrl N", chord: { key: "n", ctrl: true } }),
    c("open", "Open file…", "open", o.onOpenFile, { shortcut: "Ctrl O", chord: { key: "o", ctrl: true } }),
    c("openFolder", "Open folder…", "open", o.onOpenFolder, { shortcut: "Ctrl Shift O", chord: { key: "o", ctrl: true, shift: true } }),
    c("recent", "Open recent", "open", () => {}, { sub: o.recent, quiet: true }),
    ...(o.hubs && o.onConnect ? [c("connect", o.hubOnly ? "Open a hub…" : "Connect to a hub…", "hub", o.onConnect, { icon: "mark-malachite" })] : []),
    c("save", "Save", "save", o.onSave, { shortcut: "Ctrl S", chord: { key: "s", ctrl: true }, ...noFile }),
    c("saveAs", "Save as…", "save", o.onSaveAs, { shortcut: "Ctrl Shift S", chord: { key: "s", ctrl: true, shift: true }, ...noFile }),
    c("close", "Close file", "close", o.onCloseFile, { shortcut: "Ctrl W", chord: { key: "w", ctrl: true }, ...noFile }),
    c("closeWorkspace", o.workspace?.kind === "hub" ? "Close hub" : "Close folder", "close", o.onCloseWorkspace,
      o.workspace ? {} : { enabled: false, why: "no folder open" }),
    c("settings", "Settings…", "settings", o.onSettings, { shortcut: "Ctrl ,", chord: { key: ",", ctrl: true }, icon: "settings-gear" }),
  ];
}

/** Open recent's items: folders and hubs, then the app's files (`recentFor`'s groups), and Clear recent. */
export function recentMenu(shown: ReturnType<typeof recentFor>, onOpen: (e: RecentEntry) => void, onClear: () => void, max = 8): MenuEntry[] {
  // two entries with the same name tell themselves apart by the folder they're in
  const all = [...shown.folders, ...shown.hubs, ...shown.files];
  const twice = (e: RecentEntry) => all.filter((x) => baseName(x.path) === baseName(e.path)).length > 1;
  const item = (e: RecentEntry): MenuEntry => ({
    id: `${e.kind}:${e.path}`, label: baseName(e.path), run: () => onOpen(e),
    ...(twice(e) ? { meta: baseName(e.path.slice(0, e.path.length - baseName(e.path).length).replace(/[\\/]+$/, "")) } : {}),
    icon: e.kind === "hub" ? "mark-malachite" : fileIconFor(e.path, e.kind === "folder" ? "folder" : "file").icon,
  });
  const places = [...shown.folders, ...shown.hubs].sort((a, b) => b.at - a.at).slice(0, max);
  const files = shown.files.slice(0, max);
  if (!places.length && !files.length) return [{ note: "Nothing opened yet" }];
  return [
    ...(places.length ? [{ group: shown.hubs.length && shown.folders.length ? "Folders and hubs" : shown.hubs.length ? "Hubs" : "Folders" }, ...places.map(item)] : []),
    ...(files.length ? [{ group: "Files" }, ...files.map(item)] : []),
    "-",
    { id: "recent.clear", label: "Clear recent", run: onClear },
  ];
}

// ── the Paperboat window's shell (paperboat/apps/launcher/electron/bridge.ts `Shell`) ──

/** An app's page in a Paperboat window: the system's dialogs and real paths, nothing else. */
export interface Shell {
  /** A file the user picks (`types`: extensions without the dot, e.g. ["psf", "pst"]), or null. */
  pickFile(types?: string[], title?: string): Promise<string | null>;
  /** A folder the user picks, or null. */
  pickFolder(title?: string): Promise<string | null>;
  /** Where to save (`name`: the suggested file name), or null. */
  pickSave(name?: string, types?: string[], title?: string): Promise<string | null>;
  /** Show a file or folder in the system's file manager. */
  reveal(path: string): void;
}

/**
 * `window.paperboatShell` in a Paperboat window, else undefined (a browser tab). Without it: Open folder…
 * and Open a local file… take a typed path (`TypedPath`), Save as… downloads, Reveal is hidden.
 */
export const shell = (): Shell | undefined =>
  typeof window === "undefined" ? undefined : (window as { paperboatShell?: Shell }).paperboatShell;

/** Whether the page gets real local paths and the system's dialogs (and so can Reveal). */
export const hasShell = () => !!shell();
