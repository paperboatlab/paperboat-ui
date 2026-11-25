// An app's mark (its tile). `idle` makes it the top-left icon at rest: still for at least 10 s, then
// now and then it folds to the parcel and unfolds once. It pauses while the window is hidden or not
// focused (and while `paused`, e.g. under the splash), stops at once on hover or click (finishing the
// unfold, never cut mid-fold), and reduced motion keeps the rest pose.
import { useEffect, useRef, useState } from "react";
import { FOLD_MS, FRAMES, frameAt, restMs, type App } from "./fold.ts";

/** A frame of the app's fold (1 the parcel … FRAMES), past the last the rest pose. */
export const markUrl = (app: App, frame: number) =>
  frame > FRAMES[app] ? new URL(`./marks/${app}/rest.webp`, import.meta.url).href : new URL(`./marks/${app}/${String(frame).padStart(2, "0")}.webp`, import.meta.url).href;

export function AppMark({ app, size = 24, idle = false, paused = false, label }: {
  app: App;
  size?: number;
  idle?: boolean;
  paused?: boolean;
  label?: string;
}) {
  const [frame, setFrame] = useState(FRAMES[app] + 1);
  const still = useRef(false);  // hover or click: no new fold; a fold under way turns back at once

  useEffect(() => {
    if (!idle || typeof window === "undefined") return;
    if (matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    for (let f = 1; f <= FRAMES[app]; f++) new Image().src = markUrl(app, f);  // ready before the first fold
    let timer = 0, raf = 0, rested = 0, last = performance.now(), wait = restMs();
    const awake = () => !document.hidden && document.hasFocus() && !paused && !still.current;
    const tick = () => {  // count rest only while awake
      const now = performance.now();
      if (awake()) rested += now - last;
      last = now;
      if (rested >= wait) return play();
      timer = window.setTimeout(tick, 250);
    };
    const play = () => {
      const one = FOLD_MS[app];
      let t0 = performance.now();
      const step = (now: number) => {
        let t = now - t0;
        if (still.current && t < one) { t = 2 * one - t; t0 = now - t; }  // folding: turn back, unfold from here
        setFrame(frameAt(app, t));
        if (t < 2 * one) raf = requestAnimationFrame(step);
        else { rested = 0; wait = restMs(); last = performance.now(); tick(); }
      };
      raf = requestAnimationFrame(step);
    };
    tick();
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); setFrame(FRAMES[app] + 1); };
  }, [app, idle, paused]);

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
    />
  );
}
