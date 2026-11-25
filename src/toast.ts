// The toast rules that are logic, not looks (Toasts.tsx draws them).

/** A duration token (`5s`, `5000ms`) in ms; `fallback` when it isn't set. */
export function ms(v: string, fallback: number) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? (/ms\s*$/.test(v) ? n : n * 1000) : fallback;
}

/** Whether a toast in this state leaves on its own: working waits for its end, a failure for the user. */
export const leaves = (state?: "working" | "done" | "failed") => state !== "working" && state !== "failed";
