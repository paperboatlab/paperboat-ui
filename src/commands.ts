// A command list: everything the user can do, once. The menu bar, the command
// search and the registry's own shortcuts all read the same list, so a label, a shortcut and
// whether it is enabled can't drift between them. Pure functions and types; the app draws them.

import { useEffect, useRef } from "react";
import type { IconName } from "./icons.ts";
import type { MenuEntry } from "./Menu.tsx";

/** A menu: an app names its own (`{ id: "file", label: "File" }`), in the order they appear. */
export type Menu = { id: string; label: string };

/** A key combination. `ctrl` also means ⌘ on a Mac. `key` is `KeyboardEvent.key`, lower-case.
 *  `then`: a second stroke, as VS Code's Ctrl K Ctrl O (the first waits for it; see `keyAction`). */
export type Chord = { key: string; ctrl?: boolean; alt?: boolean; shift?: boolean; then?: Chord };

export type Command = {
  id: string;
  label: string;
  /** The menu it sits in (an app's own `Menu.id`). */
  menu: string;
  /** Commands of one group sit together; the next group is set off by a rule. */
  group: string;
  /** Shown beside the label. Only a `chord` makes the registry handle the key; the rest are
   *  handled where the thing lives (undo, copy and paste on the canvas) and shown here. */
  shortcut?: string;
  chord?: Chord;
  /** A function is read when the menu opens, so it can look at what changed since the last render. */
  enabled?: boolean | (() => boolean);
  /** Why it is unavailable: the item says so (title) instead of hiding. */
  why?: string;
  /** Chosen (a page, a mode, a toggle). */
  checked?: boolean;
  /** Small text at the right, such as a count. */
  meta?: string;
  /** Left out of the command search (the command that opens it). */
  quiet?: boolean;
  /** Drawn before the label (only where the registry gives the meaning: Connect to a hub's mark, Settings' gear). */
  icon?: IconName;
  /** A submenu (Open recent): the item opens it instead of running. One level at most. */
  sub?: MenuEntry[];
  run: () => void;
};

/** One example, as `paperboat example list --app <app> --json` gives it (paperboat#72). */
export type Example = { id: string; app: string; kind: string; name: string; description: string; path: string };

/** Ctrl+K's **Open example: <name>**, one per example of the app (paperboat#72). They sit in no menu of the bar,
 *  so only the command search lists them; `open` runs `paperboat example open <id>` (through the app's server). */
export const exampleCommands = (examples: Example[], open: (id: string) => void): Command[] =>
  examples.map((e) => ({ id: `example:${e.id}`, label: `Open example: ${e.name}`, menu: "examples", group: "examples", run: () => open(e.id) }));

export const isEnabled = (c: Command): boolean => (typeof c.enabled === "function" ? c.enabled() : c.enabled ?? true);

/** The key the command search opens with. One place to change it. */
export const SEARCH_CHORD: Chord = { key: "k", ctrl: true };

type KeyLike = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">;

export function chordMatches(c: Chord, e: KeyLike): boolean {
  return (
    e.key.toLowerCase() === c.key &&
    (e.ctrlKey || e.metaKey) === !!c.ctrl &&
    e.altKey === !!c.alt &&
    e.shiftKey === !!c.shift
  );
}

/** "Ctrl+Shift+K", "Ctrl+K Ctrl+O". */
export function describe(c: Chord): string {
  const key = c.key.charAt(0).toUpperCase() + c.key.slice(1); // "K", "F1", "Enter"
  const one = [c.ctrl && "Ctrl", c.alt && "Alt", c.shift && "Shift", key].filter(Boolean).join("+");
  return c.then ? `${one} ${describe(c.then)}` : one;
}

/** The command a single stroke runs (not the first of a sequence). */
const stroke = (commands: Command[], e: KeyLike) => commands.find((c) => c.chord && !c.chord.then && chordMatches(c.chord, e));

/**
 * What a key does. `first` is the stroke still waiting for its second (Ctrl K of Ctrl K Ctrl O).
 * `run`: this key's command (a sequence's second stroke, or its own); `before`: the waiting stroke's own
 * command, run first when this key doesn't finish a sequence (Ctrl K then anything else: the search);
 * `wait`: this key starts a sequence, so it waits for the next one.
 */
export function keyAction(commands: Command[], e: KeyLike, first?: KeyLike): { run?: Command; before?: Command; wait: boolean } {
  let before: Command | undefined;
  if (first) {
    const seq = commands.find((c) => c.chord?.then && chordMatches(c.chord, first) && chordMatches(c.chord.then, e));
    if (seq) return { run: seq, wait: false };
    before = stroke(commands, first);
  }
  if (commands.some((c) => c.chord?.then && chordMatches(c.chord, e))) return { before, wait: true };
  return { run: stroke(commands, e), before, wait: false };
}

/** How long a sequence's first stroke waits for its second before it runs its own command. */
export const SEQUENCE_MS = 1000;

/** The commands by menu, in the menus' order, with their titles. A menu with no commands is left out. */
export function byMenu(commands: Command[], menus: Menu[]): (Menu & { items: Command[] })[] {
  return menus.map((m) => ({ ...m, items: commands.filter((c) => c.menu === m.id) })).filter((m) => m.items.length > 0);
}

/**
 * The commands that match what was typed: every word appears in the label or the menu's name,
 * best first (a label that starts with the word, then one with a word that does, then the rest),
 * in menu order within a rank. Nothing typed: all of them.
 */
export function rank(query: string, commands: Command[], menus: Menu[] = []): Command[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const menuName = new Map(menus.map((m) => [m.id, m.label.toLowerCase()]));
  const order = new Map(commands.map((c, i) => [c.id, i]));
  const scored: { c: Command; score: number }[] = [];
  for (const c of commands) {
    const label = c.label.toLowerCase();
    const text = `${label} ${menuName.get(c.menu) ?? c.menu}`;
    if (!words.every((w) => text.includes(w))) continue;
    let score = 0;
    for (const w of words) {
      if (label.startsWith(w)) score += 0;
      else if (label.split(/[\s…]+/).some((p) => p.startsWith(w))) score += 1;
      else if (label.includes(w)) score += 2;
      else score += 3; // only the menu's name matched
    }
    scored.push({ c, score });
  }
  return scored.sort((a, b) => a.score - b.score || (order.get(a.c.id) ?? 0) - (order.get(b.c.id) ?? 0)).map((s) => s.c);
}

/** True while the key is for a field (typing), which keeps its own keys. */
export function typing(target: EventTarget | null): boolean {
  const t = target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
}

/** True inside the menus and the command search, which use the keys for themselves (arrows, Enter, Space). */
export function ownKeys(target: EventTarget | null): boolean {
  return !!(target as HTMLElement | null)?.closest?.("[data-own-keys]");
}

/**
 * The registry's own shortcuts: every command with a `chord` that is enabled. They work even
 * while typing in a field (a chord with Ctrl or Alt isn't text) and are then not a key for the page.
 * A sequence (Ctrl K Ctrl O) waits up to SEQUENCE_MS for its second stroke; when another key comes, or
 * none, the first stroke's own command runs (Ctrl K alone still opens the search, a moment later).
 * Ctrl N and Ctrl W never reach a browser tab's page; they work in a Paperboat window.
 */
export function useShortcuts(commands: Command[]) {
  const latest = useRef(commands);
  latest.current = commands;
  useEffect(() => {
    let first: KeyLike | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const go = (c?: Command) => c && isEnabled(c) && c.run();
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || ["Control", "Meta", "Shift", "Alt"].includes(e.key)) return;
      clearTimeout(timer);
      const a = keyAction(latest.current, e, first);
      first = undefined;
      go(a.before);
      if (!a.run && !a.wait) return;
      e.preventDefault(); // not a key for the page, and not the browser's (Ctrl+K)
      if (a.wait) {
        const held = { key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, shiftKey: e.shiftKey };
        first = held;
        timer = setTimeout(() => { first = undefined; go(stroke(latest.current, held)); }, SEQUENCE_MS);
      } else go(a.run);
    };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(timer); window.removeEventListener("keydown", onKey); };
  }, []);
}

/** What `paperboat example open` put in the page's URL: `?example=<id>&name=<name>[&to=<folder>][&cache=1]`. */
export type OpenedExample = { id: string; name: string; to?: string; cache: boolean };

/** The example this page opened, or null when it opened no example. */
export function exampleFromUrl(search: string): OpenedExample | null {
  const q = new URLSearchParams(search), id = q.get("example");
  if (!id) return null;
  const to = q.get("to");
  return { id, name: q.get("name") || id, ...(to ? { to } : {}), cache: q.get("cache") === "1" };
}
