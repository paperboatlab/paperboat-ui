// Panel size (brand.html §14 "Panel size"): the rules of a drag between two panes, pure so they are tested.
// A drag sets the sized pane's size, kept between its minimum and what leaves the other pane its minimum.
// Dragged on past its minimum by more than the snap distance, the pane hides (the app turns it into its slim
// bar, Show / hide panels); back over it, it shows again. Keys move it in steps.

export type SplitLimits = { min: number; max?: number; otherMin: number; total: number; snap?: number };
export type SplitResult = { size: number; hidden: boolean };

export const SPLIT_STEP = 16;      // an arrow key
export const SPLIT_STEP_BIG = 64;  // Shift and an arrow key
export const SPLIT_SNAP = 48;      // past the minimum by this much, the pane hides

/** The largest the sized pane may be: its max, and room for the other pane's minimum. */
export const maxSize = (l: SplitLimits) => Math.max(l.min, Math.min(l.max ?? Infinity, l.total - l.otherMin));

/** A wanted size (from a drag or a key) made legal: clamped, or hidden when pushed well under the minimum. */
export function resolveSize(wanted: number, l: SplitLimits, canHide = true): SplitResult {
  if (canHide && wanted < l.min - (l.snap ?? SPLIT_SNAP)) return { size: l.min, hidden: true };
  return { size: Math.round(Math.min(maxSize(l), Math.max(l.min, wanted))), hidden: false };
}

/** The size a key asks for: arrows step (Shift: further), Home and End go to the limits. `grows` is the
 *  arrow that makes the sized pane bigger (ArrowLeft when it is the end pane of a row). */
export function keySize(key: string, shift: boolean, size: number, l: SplitLimits, grows: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown"): number | undefined {
  const step = shift ? SPLIT_STEP_BIG : SPLIT_STEP;
  const shrinks = { ArrowLeft: "ArrowRight", ArrowRight: "ArrowLeft", ArrowUp: "ArrowDown", ArrowDown: "ArrowUp" }[grows];
  if (key === grows) return size + step;
  if (key === shrinks) return size - step;
  if (key === "Home") return l.min;
  if (key === "End") return maxSize(l);
  return undefined;
}
