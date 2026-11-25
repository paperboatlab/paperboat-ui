// The splash (REBRAND "Splash"; agent-docs/rebrand/apps/splash): one template for every app, shown while it
// can't draw its content yet (a runtime starting, a kernel connecting, a station saying hello). The app draws
// its bar only and puts this in the space below. The app's tile (120 px) plays its fold, with two lines: what
// is happening (sentence case, no trailing "…") and the specifics in mono. Working: it unfolds to rest,
// holds, folds back, repeats. `ready`: it finishes the unfold (a fold under way turns back at once, never cut),
// then `onReady` (the app fades in). Failed: it folds back to the parcel and stays, the line in red, with Retry
// and Show log. Slow (8 s on one step): "Taking longer than usual". It shows only after 350 ms, so a fast start
// never flashes; reduced motion shows the rest pose (the parcel when failed).
import { useEffect, useRef, useState } from "react";
import { markUrl } from "./AppMark.tsx";
import { FOLD_MS, FRAMES, splashFrame, type App } from "./fold.ts";
import { Key } from "./Key.tsx";

const SHOW_MS = 350, SLOW_MS = 8000, HOLD_REST = 900, HOLD_PARCEL = 250;

export function Splash({ app, say, detail, failed = false, ready = false, onReady, onRetry, onLog }: {
  app: App;
  /** What is happening now. */
  say: string;
  /** The specifics, in mono (a version, an address, "2 of 3"). */
  detail?: string;
  failed?: boolean;
  /** Finish the unfold, then call `onReady`. */
  ready?: boolean;
  onReady?: () => void;
  onRetry?: () => void;
  onLog?: () => void;
}) {
  const img = useRef<HTMLImageElement>(null);
  const live = useRef({ failed, ready, onReady });
  live.current = { failed, ready, onReady };
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (failed || ready) return;
    const t = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(t);
  }, [say, detail, failed, ready]);

  useEffect(() => {
    const one = FOLD_MS[app], born = performance.now();
    for (let f = 1; f <= FRAMES[app]; f++) new Image().src = markUrl(app, f);
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    let p = 0, dir = 1, wait = 0, last = 0, shown = 1, raf = 0;
    const draw = () => {
      const k = splashFrame(app, p);
      if (k !== shown && img.current) { img.current.src = markUrl(app, k); shown = k; }
    };
    const tick = (now: number) => {
      const dt = Math.min(now - (last || now), 50);
      last = now;
      const { failed, ready, onReady } = live.current;
      if (ready && (reduce || now - born < SHOW_MS)) { p = 1; draw(); return onReady?.(); }  // never shown: no flash
      if (reduce) { p = failed ? 0 : 1; draw(); raf = requestAnimationFrame(tick); return; }
      if (ready) { dir = 1; wait = 0; }  // a fold under way turns back into the unfold
      else if (failed) dir = -1;
      else if (dir === 0) dir = 1;  // retried
      if (wait > 0) wait -= dt;
      else {
        p = Math.min(1, Math.max(0, p + (dir * dt) / one));
        draw();
        if (p === 1 && dir === 1) {
          if (ready) return onReady?.();
          dir = -1; wait = HOLD_REST;
        } else if (p === 0 && dir === -1) {
          if (failed) dir = 0;
          else { dir = 1; wait = HOLD_PARCEL; }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [app]);

  return (
    <div className={`splash-stage${failed ? " failed" : ""}`}>
      <div className="splash" aria-busy={!failed}>
        <img ref={img} className="splash-mark" src={markUrl(app, 1)} width={120} height={120} alt="" aria-hidden="true" draggable={false} />
        <div className="splash-msg" role="status" aria-live="polite">
          <p className="splash-say">{say}</p>
          {detail && <p className="splash-detail">{detail}</p>}
        </div>
        <div className="splash-keys">
          {failed
            ? <>{onRetry && <Key kind="primary" onClick={onRetry}>Retry</Key>}{onLog && <Key kind="quiet" onClick={onLog}>Show log</Key>}</>
            : slow && <><span>Taking longer than usual</span>{onLog && <Key kind="quiet" onClick={onLog}>Show log</Key>}</>}
        </div>
      </div>
    </div>
  );
}
