// The window keys (REBRAND §4 Key order). A Paperboat window (the Launcher's Electron) has no system title
// bar: the app's bar is the title bar, dragged by its empty space, and a double click on it maximizes. On
// Windows and Linux our keys (Minimize, Maximize or Restore, Close) end the bar after a hairline; on macOS
// the system's lights sit at the bar's left and we draw nothing. In a browser tab: nothing at all.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.tsx";
import { pageZoom } from "./scale.ts";

/** What a Paperboat window gives its page: `window.paperboatWindow` (paperboat/apps/launcher/electron/bridge.ts). */
export interface WindowControls {
  /** `process.platform`: "darwin", "win32", "linux". */
  platform: string;
  minimize(): void;
  toggleMaximize(): void;
  close(): void;
  /** The window's zoom (the interface scale, useScale); not in a Launcher older than it. */
  setZoom?(factor: number): void;
  /** `fn` now and on every maximize or restore; returns stop. */
  onMaximized(fn: (maximized: boolean) => void): () => void;
}

/** The window's controls in a Paperboat window, else undefined (a browser tab). */
export const windowControls = (): WindowControls | undefined =>
  typeof window === "undefined" ? undefined : (window as { paperboatWindow?: WindowControls }).paperboatWindow;

/** What a double click on the bar leaves alone: anything that acts on its own. */
const ACTS = "button, a, input, select, textarea, label, [role], [tabindex], [contenteditable]";

/**
 * The keys are drawn on a layer of their own over everything (a dialog's scrim, the search), placed on the
 * room they keep in the bar: the window can always be minimized, maximized or closed.
 *
 * The last thing in an app's bar, after the theme key. Marks the page as a Paperboat window
 * (`html[data-window]`, which makes the frame's bar the title bar) and draws the keys where they belong.
 */
export function WindowKeys() {
  const w = windowControls();
  const [max, setMax] = useState(false);
  const room = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  // follow the room in the bar: after a render (the bar's keys changing), a resize
  const place = () => {
    const r = room.current?.getBoundingClientRect();
    if (!r) return;
    // a bar too full for its window (a narrow window, a large scale) pushes the room out: the keys stay in sight
    const left = Math.min(r.left, innerWidth - r.width - 8);
    setAt((a) => (a && a.top === r.top && a.left === left ? a : { top: r.top, left }));
  };
  useLayoutEffect(place);
  useLayoutEffect(() => {
    const el = room.current;
    if (!el) return;
    const ro = new ResizeObserver(place);
    ro.observe(el);
    ro.observe(document.documentElement);
    addEventListener("resize", place);
    return () => { ro.disconnect(); removeEventListener("resize", place); };
  }, [w]);
  useEffect(() => {
    if (!w) return;
    const root = document.documentElement;
    root.dataset.window = w.platform;
    const stop = w.onMaximized(setMax);
    // the drag region takes the bar's mouse where the system handles it; where it doesn't, this does
    const dbl = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (t?.closest(".frame > .bar") && !t.closest(ACTS)) w.toggleMaximize();
    };
    addEventListener("dblclick", dbl);
    return () => { stop(); removeEventListener("dblclick", dbl); delete root.dataset.window; };
  }, [w]);
  if (!w || w.platform === "darwin") return null;
  return (
    <>
      <span className="sep" />
      <span className="window-keys-room" ref={room} aria-hidden="true" />
      {at && createPortal(
      <span className="window-keys" role="group" aria-label="Window" style={{ top: at.top / pageZoom(), left: at.left / pageZoom() }}>
        <button type="button" className="wk" title="Minimize" aria-label="Minimize" onClick={() => w.minimize()}><Icon name="chrome-minimize" /></button>
        <button type="button" className="wk" title={max ? "Restore" : "Maximize"} aria-label={max ? "Restore" : "Maximize"} onClick={() => w.toggleMaximize()}>
          <Icon name={max ? "chrome-restore" : "chrome-maximize"} />
        </button>
        <button type="button" className="wk" title="Close" aria-label="Close" onClick={() => w.close()}><Icon name="chrome-close" /></button>
      </span>, document.body)}
    </>
  );
}
