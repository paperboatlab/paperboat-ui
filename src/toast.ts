// The toast rules that are logic, not looks (Toasts.tsx draws them).

/** A duration token (`5s`, `5000ms`) in ms; `fallback` when it isn't set. */
export function ms(v: string, fallback: number) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? (/ms\s*$/.test(v) ? n : n * 1000) : fallback;
}

/** Whether a toast leaves on its own: working waits for its end; a failure, a warning or one that offers a key
 *  waits for the user. */
export const leaves = (state?: ToastState, actions?: readonly NoteAction[]) =>
  state !== "working" && state !== "failed" && state !== "warning" && !actions?.length;

/** warning: something to look at that didn't stop the work (the warning mark in ink, never red). */
export type ToastState = "working" | "done" | "warning" | "failed";
/** A key on a toast, under its words (Save, Review): a follow-up, never a question. One may be primary. */
export type NoteAction = { label: string; run: () => void; primary?: boolean };
/** One entry of the notifications history: a toast and when it last changed. */
export type Note = { id: number; title: string; detail?: string; state?: ToastState; actions?: NoteAction[]; at: number };
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
