// Toasts: for work in the background and its end (ui-example.html §10, "Menus and toasts"; tokens
// --toast-*). The rules, so every app tells news the same way:
// - working: a spinner, stays until the same id is shown again as done or failed;
// - done: a check, leaves on its own after --toast-stay, held while the pointer or focus is on it;
// - failed: the error mark in red, a red border, stays until dismissed, read out as an alert;
// - they stack bottom right, rise in on --glide and fade out on --motion.
import { useCallback, useEffect, useState } from "react";
import { Icon } from "./Icon.tsx";
import { RemoveKey } from "./Key.tsx";
import { Spinner } from "./Spinner.tsx";
import { leaves, ms } from "./toast.ts";

export type Toast = { id: number; title: string; detail?: string; state?: "working" | "done" | "failed" };
const OUT_MS = 150; // --motion

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  /** Shows a toast, or updates the one with the same id. Returns its id. */
  const show = useCallback((t: Omit<Toast, "id"> & { id?: number }) => {
    const id = t.id ?? Date.now() + Math.random();
    setToasts((all) => (all.some((x) => x.id === id) ? all.map((x) => (x.id === id ? { ...t, id } : x)) : [...all, { ...t, id }]));
    return id;
  }, []);
  return { toasts, show, dismiss };
}

function ToastView({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [out, setOut] = useState(false);
  const [held, setHeld] = useState(false);
  const leave = useCallback(() => { setOut(true); setTimeout(onDismiss, OUT_MS); }, [onDismiss]);
  useEffect(() => {
    if (held || !leaves(toast.state)) return;
    const t = setTimeout(leave, ms(getComputedStyle(document.documentElement).getPropertyValue("--toast-stay"), 5000));
    return () => clearTimeout(t);
  }, [toast.state, held, leave]);
  const hold = { onMouseEnter: () => setHeld(true), onMouseLeave: () => setHeld(false), onFocus: () => setHeld(true), onBlur: () => setHeld(false) };
  return (
    <div className={`toast${toast.state === "failed" ? " failed" : ""}${out ? " out" : ""}`} role={toast.state === "failed" ? "alert" : "status"} {...hold}>
      {toast.state === "working" && <Spinner />}
      {toast.state === "done" && <Icon name="check" className="toast-mark" />}
      {toast.state === "failed" && <Icon name="error" className="toast-mark" />}
      <div><b>{toast.title}</b>{toast.detail && <small>{toast.detail}</small>}</div>
      <RemoveKey label="Dismiss" onClick={leave} />
    </div>
  );
}

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toasts">
      {toasts.map((t) => <ToastView key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />)}
    </div>
  );
}
