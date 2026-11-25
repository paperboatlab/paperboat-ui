// The toast rules that are logic, not looks (Toasts.tsx draws them).

/** A duration token (`5s`, `5000ms`) in ms; `fallback` when it isn't set. */
export function ms(v: string, fallback: number) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? (/ms\s*$/.test(v) ? n : n * 1000) : fallback;
}

/** Whether a toast in this state leaves on its own: working waits for its end, a failure for the user. */
export const leaves = (state?: ToastState) => state !== "working" && state !== "failed";

export type ToastState = "working" | "done" | "failed";
/** One entry of the notifications history: a toast and when it last changed. */
export type Note = { id: number; title: string; detail?: string; state?: ToastState; at: number };
export const LOG_MAX = 50;

/** The history with this toast added, or its entry (same id) moved up with the latest news; newest first. */
export function record(log: Note[], note: Note): Note[] {
  return [note, ...log.filter((n) => n.id !== note.id)].slice(0, LOG_MAX);
}

/** How long ago, in words: "now", "3 min ago", "2 h ago", then the day. */
export function ago(at: number, now: number) {
  const s = (now - at) / 1000;
  if (s < 45) return "now";
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
