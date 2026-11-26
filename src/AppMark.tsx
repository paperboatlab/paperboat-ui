// An app's mark (its tile). `idle` makes it the top-left icon at rest: still for at least 10 s, then
// now and then it folds to the parcel and unfolds once. It pauses while the window is hidden or not
// focused (and while `paused`, e.g. under the splash), stops at once on hover or click (finishing the
// unfold, never cut mid-fold), and reduced motion keeps the rest pose. `loop` (About) folds on and on,
// a second on the finished logo between folds. A click folds it back to the parcel and unfolds it once, as
// the site's icons do; a click while it plays does nothing.
import { useEffect, useRef, useState } from "react";
import { FOLD_MS, FRAMES, frameAt, restMs, type App } from "./fold.ts";

/** A frame of the app's fold (1 the parcel … FRAMES), past the last the rest pose. */
export const markUrl = (app: App, frame: number) =>
  frame > FRAMES[app] ? new URL(`./marks/${app}/rest.webp`, import.meta.url).href : new URL(`./marks/${app}/${String(frame).padStart(2, "0")}.webp`, import.meta.url).href;

export function AppMark({ app, size = 24, idle = false, loop = false, paused = false, label }: {
  app: App;
  size?: number;
  idle?: boolean;
  loop?: boolean;
  paused?: boolean;
  label?: string;
}) {
  const [frame, setFrame] = useState(FRAMES[app] + 1);
  const still = useRef(false);  // hover or click: no new fold; a fold under way turns back at once
  const busy = useRef(false);   // a fold is playing (idle's or a click's)
  const clickRaf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(clickRaf.current), []);
  const fold = () => {
    if (busy.current || matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    busy.current = true;
    const t0 = performance.now(), end = 2 * FOLD_MS[app];
    const step = (now: number) => {
      setFrame(frameAt(app, now - t0));
      if (now - t0 < end) clickRaf.current = requestAnimationFrame(step);
      else busy.current = false;
    };
    clickRaf.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    if (!(idle || loop) || typeof window === "undefined") return;
    if (matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    for (let f = 1; f <= FRAMES[app]; f++) new Image().src = markUrl(app, f);  // ready before the first fold
    const rest = () => (loop ? 1000 : restMs());
    let timer = 0, raf = 0, rested = 0, last = performance.now(), wait = rest();
    const awake = () => !document.hidden && (loop || document.hasFocus()) && !paused && !still.current;
    const tick = () => {  // count rest only while awake
      const now = performance.now();
      if (awake()) rested += now - last;
      last = now;
      if (rested >= wait && !busy.current) return play();
      timer = window.setTimeout(tick, 250);
    };
    const play = () => {
      const one = FOLD_MS[app];
      busy.current = true;
      let t0 = performance.now();
      const step = (now: number) => {
        let t = now - t0;
        if (still.current && t < one) { t = 2 * one - t; t0 = now - t; }  // folding: turn back, unfold from here
        setFrame(frameAt(app, t));
        if (t < 2 * one) raf = requestAnimationFrame(step);
        else { busy.current = false; rested = 0; wait = rest(); last = performance.now(); tick(); }
      };
      raf = requestAnimationFrame(step);
    };
    tick();
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); busy.current = false; setFrame(FRAMES[app] + 1); };
  }, [app, idle, loop, paused]);

  return (
    <img
      className="app-mark"
      src={markUrl(app, frame)}
      width={size}
      height={size}
      alt={label ?? ""}
      draggable={false}
      onPointerEnter={() => (still.current = true)}
      onPointerLeave={() => (still.current = false)}
      onPointerDown={() => (still.current = true)}
      onClick={fold}
    />
  );
}
