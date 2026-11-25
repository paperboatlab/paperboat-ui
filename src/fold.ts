// The top-left icon at rest (REBRAND "The top-left icon at rest"): still on its rest pose for at least
// 10 s, then at a random moment it folds back to the parcel and unfolds again once, with the splash's
// frames and times. Pure timing here; AppMark draws it.

export const APPS = ["paperboat", "simplicial", "articula", "julix", "malachite"] as const;
export type App = (typeof APPS)[number];

/** Frames from the parcel (1) to the last before the rest pose: the Paperboat mark has more moves. */
export const FRAMES: Record<App, number> = { paperboat: 25, simplicial: 9, articula: 9, julix: 9, malachite: 9 };
/** One way (fold or unfold), ms. */
export const FOLD_MS: Record<App, number> = { paperboat: 2000, simplicial: 1200, articula: 1200, julix: 1200, malachite: 1200 };
export const REST_MIN_MS = 10_000;
const REST_SPREAD_MS = 20_000;

/** The next still spell: 10 s or more, random, so open windows never fold in step. */
export const restMs = (random: () => number = Math.random) => REST_MIN_MS + random() * REST_SPREAD_MS;

/**
 * The frame to show `t` ms into a fold-and-unfold: `frames` down to 1, then back up; `frames + 1` is
 * the rest pose (shown before and after). Eased by the motion curve's symmetric shape.
 */
export function frameAt(app: App, t: number): number {
  const n = FRAMES[app], one = FOLD_MS[app];
  if (t <= 0 || t >= 2 * one) return n + 1;
  const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
  const p = t < one ? 1 - ease(t / one) : ease((t - one) / one);  // 1 = rest, 0 = parcel
  return Math.min(n + 1, 1 + Math.round(p * n));
}

/** The splash's frame at `p` along the unfold (0 the parcel, 1 the rest pose), eased (smoothstep). */
export function splashFrame(app: App, p: number): number {
  const x = Math.min(1, Math.max(0, p));
  return 1 + Math.round(x * x * (3 - 2 * x) * FRAMES[app]);
}
