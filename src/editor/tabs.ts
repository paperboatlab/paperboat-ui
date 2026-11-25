// The editor's tabs (REBRAND "Tab menu"): what a right click on a tab offers, what each close closes and
// which tab shows after. Pure rules; the host owns the tab list, the pins, saving and the files.
//
// - A close never loses work: the host saves a tab before it drops it (the apps save as you type).
// - Pinned tabs sit first and close only by their own Close; Others, To the right, Saved and All pass them.
// - Close saved leaves every tab with unsaved changes open.
// - When the shown tab closes, its right neighbour shows, else its left, else nothing.
// - An item that would do nothing stays, greyed, and says why.
import type { MenuEntry } from "../Menu.tsx";

export type TabClose = "this" | "others" | "right" | "saved" | "all";

export type TabSet = {
  /** The paths in strip order. */
  tabs: readonly string[];
  pinned?: ReadonlySet<string>;
  /** Not saved yet. */
  dirty?: (path: string) => boolean;
};

/** The tabs a close removes, in strip order. */
export function tabsToClose(close: TabClose, path: string, { tabs, pinned, dirty }: TabSet): string[] {
  if (close === "this") return tabs.includes(path) ? [path] : [];
  const at = tabs.indexOf(path);
  return tabs.filter((t, i) => !pinned?.has(t) && (
    close === "others" ? t !== path :
    close === "right" ? i > at :
    close === "saved" ? !dirty?.(t) :
    true));
}

/** The strip and the shown tab once `closing` is gone. */
export function afterClose(tabs: readonly string[], current: string | null, closing: readonly string[]): { tabs: string[]; current: string | null } {
  const gone = new Set(closing);
  const rest = tabs.filter((t) => !gone.has(t));
  if (current === null || !gone.has(current)) return { tabs: rest, current };
  const at = tabs.indexOf(current);
  const next = tabs.slice(at + 1).find((t) => !gone.has(t)) ?? tabs.slice(0, Math.max(at, 0)).reverse().find((t) => !gone.has(t));
  return { tabs: rest, current: next ?? null };
}

/** Pinned tabs first, each group in its own order. */
export function orderTabs(tabs: readonly string[], pinned: ReadonlySet<string>): string[] {
  return [...tabs.filter((t) => pinned.has(t)), ...tabs.filter((t) => !pinned.has(t))];
}

export type TabActions = {
  /** Save what is unsaved among `paths`, then drop them (afterClose gives the new strip). */
  close: (paths: string[]) => void;
  pin?: (path: string, on: boolean) => void;
  /** Show the file in the tree. */
  reveal?: (path: string) => void;
  /** The app's file menu for this file (REBRAND "File menu", as the tree shows it), without its Open group:
   *  the owning app's group, Rename · Duplicate · Move, Copy link · Copy path, …, Move to trash last. */
  file?: MenuEntry[];
};

/** The menu a right click on the tab of `path` opens: the tab's own group (the closes, Pin, Reveal in
 *  Files), then the file's menu, the same one the tree shows. */
export function tabMenu(path: string, set: TabSet, actions: TabActions): MenuEntry[] {
  const pinned = !!set.pinned?.has(path);
  const closeItem = (id: TabClose, label: string, why: string): MenuEntry => {
    const paths = tabsToClose(id, path, set);
    return { id: `tab-${id}`, label, disabled: !paths.length, why, run: () => actions.close(paths) };
  };
  const out: MenuEntry[] = [
    closeItem("this", "Close", ""),
    closeItem("others", "Close others", set.pinned?.size ? "No other unpinned tabs" : "No other tabs"),
    closeItem("right", "Close to the right", "Nothing to the right"),
    closeItem("saved", "Close saved", "Every tab has unsaved changes"),
    closeItem("all", "Close all", "Every tab is pinned"),
  ];
  const tab: MenuEntry[] = [];
  if (actions.pin) tab.push({ id: "tab-pin", label: pinned ? "Unpin" : "Pin", icon: "pin", run: () => actions.pin!(path, !pinned) });
  if (actions.reveal) tab.push({ id: "tab-reveal", label: "Reveal in Files", run: () => actions.reveal!(path) });
  if (tab.length) out.push("-", ...tab);
  if (actions.file?.length) out.push("-", ...actions.file);
  return out;
}
