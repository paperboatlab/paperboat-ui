// Toasts: for work in the background and its end. They stack bottom right and leave on their own;
// a failure stays until dismissed.
import { useCallback, useEffect, useState } from "react";
import { RemoveKey } from "./Key.tsx";
import { Spinner } from "./Spinner.tsx";

export type Toast = { id: number; title: string; detail?: string; state?: "working" | "done" | "failed" };
const STAY_MS = 5000;

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
  useEffect(() => {
    if (toast.state === "failed" || toast.state === "working") return;
    const t = setTimeout(onDismiss, STAY_MS);
    return () => clearTimeout(t);
  }, [toast.state, onDismiss]);
  return (
    <div className={`toast${toast.state === "failed" ? " failed" : ""}`} role={toast.state === "failed" ? "alert" : "status"}>
      {toast.state === "working" && <Spinner />}
      <div><b>{toast.title}</b>{toast.detail && <small>{toast.detail}</small>}</div>
      <RemoveKey label="Dismiss" onClick={onDismiss} />
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
