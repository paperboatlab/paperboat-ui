// The window keys (REBRAND §4 Key order). A Paperboat window (the Launcher's Electron) has no system title
// bar: the app's bar is the title bar, dragged by its empty space, and a double click on it maximizes. On
// Windows and Linux our keys (Minimize, Maximize or Restore, Close) end the bar after a hairline; on macOS
// the system's lights sit at the bar's left and we draw nothing. In a browser tab: nothing at all.
import { useEffect, useState } from "react";
import { Icon } from "./Icon.tsx";

/** What a Paperboat window gives its page: `window.paperboatWindow` (paperboat/apps/launcher/electron/bridge.ts). */
export interface WindowControls {
  /** `process.platform`: "darwin", "win32", "linux". */
  platform: string;
  minimize(): void;
  toggleMaximize(): void;
  close(): void;
  /** `fn` now and on every maximize or restore; returns stop. */
  onMaximized(fn: (maximized: boolean) => void): () => void;
}

/** The window's controls in a Paperboat window, else undefined (a browser tab). */
export const windowControls = (): WindowControls | undefined =>
  typeof window === "undefined" ? undefined : (window as { paperboatWindow?: WindowControls }).paperboatWindow;

/** What a double click on the bar leaves alone: anything that acts on its own. */
const ACTS = "button, a, input, select, textarea, label, [role], [tabindex], [contenteditable]";

/**
 * The last thing in an app's bar, after the theme key. Marks the page as a Paperboat window
 * (`html[data-window]`, which makes the frame's bar the title bar) and draws the keys where they belong.
 */
export function WindowKeys() {
  const w = windowControls();
  const [max, setMax] = useState(false);
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
      <span className="window-keys" role="group" aria-label="Window">
        <button type="button" className="wk" title="Minimize" aria-label="Minimize" onClick={() => w.minimize()}><Icon name="chrome-minimize" /></button>
        <button type="button" className="wk" title={max ? "Restore" : "Maximize"} aria-label={max ? "Restore" : "Maximize"} onClick={() => w.toggleMaximize()}>
          <Icon name={max ? "chrome-restore" : "chrome-maximize"} />
        </button>
        <button type="button" className="wk" title="Close" aria-label="Close" onClick={() => w.close()}><Icon name="chrome-close" /></button>
      </span>
    </>
  );
}
