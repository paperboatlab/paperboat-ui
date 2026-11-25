// Toasts: for work in the background and its end (ui-example.html §10, "Menus and toasts"; tokens
// --toast-*). The rules, so every app tells news the same way:
// - working: a spinner, stays until the same id is shown again as done or failed;
// - done: a check, leaves on its own after --toast-stay, held while the pointer or focus is on it;
// - failed: the error mark in red, a red border, stays until dismissed, read out as an alert;
// - they stack bottom right, rise in on --glide, fade out on --motion, and the stack closes up on --glide;
// - every toast is kept in the history, the bar's Notifications key (a bell; a dot while some are unseen,
//   red while an unseen one failed), so one that left unread can be found again.
import { useCallback, useEffect, useRef, useState } from "react";
import { useDismiss } from "./dismiss.tsx";
import { Icon } from "./Icon.tsx";
import { Key, RemoveKey } from "./Key.tsx";
import { Spinner } from "./Spinner.tsx";
import { ago, leaves, ms, record, type Note, type ToastState } from "./toast.ts";

export type Toast = { id: number; title: string; detail?: string; state?: ToastState };
export type { Note };
const OUT_MS = 450; // fade on --motion (150), then close up on --glide (300)

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [log, setLog] = useState<Note[]>([]);
  const [seenAt, setSeenAt] = useState(0);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  /** Shows a toast, or updates the one with the same id, and keeps it in the history. Returns its id. */
  const show = useCallback((t: Omit<Toast, "id"> & { id?: number }) => {
    const id = t.id ?? Date.now() + Math.random();
    setToasts((all) => (all.some((x) => x.id === id) ? all.map((x) => (x.id === id ? { ...t, id } : x)) : [...all, { ...t, id }]));
    setLog((l) => record(l, { ...t, id, at: Date.now() }));
    return id;
  }, []);
  const markSeen = useCallback(() => setSeenAt(Date.now()), []);
  const clearLog = useCallback(() => setLog([]), []);
  return { toasts, show, dismiss, log, seenAt, markSeen, clearLog };
}

function Mark({ state }: { state?: ToastState }) {
  if (state === "working") return <Spinner />;
  if (state === "done") return <Icon name="check" className="toast-mark" />;
  if (state === "failed") return <Icon name="error" className="toast-mark" />;
  return null;
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
    <div className={`toast-slot${out ? " out" : ""}`}><div>
      <div className={`toast${toast.state === "failed" ? " failed" : ""}`} role={toast.state === "failed" ? "alert" : "status"} {...hold}>
        <Mark state={toast.state} />
        <div><b>{toast.title}</b>{toast.detail && <small>{toast.detail}</small>}</div>
        <RemoveKey label="Dismiss" onClick={leave} />
      </div>
    </div></div>
  );
}

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toasts">
      {toasts.map((t) => <ToastView key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />)}
    </div>
  );
}

/** The bar's Notifications key and its history: give it what useToasts returns. */
export function Notifications({ log, seenAt, markSeen, clearLog }: { log: Note[]; seenAt: number; markSeen: () => void; clearLog: () => void }) {
  const [open, setOpen] = useState(false);
  const pop = useRef<HTMLDivElement>(null);
  const key = useRef<HTMLButtonElement>(null);
  useDismiss(pop, () => setOpen(false), { enabled: open, triggerRef: key });
  const unseen = open ? [] : log.filter((n) => n.at > seenAt);
  const failed = unseen.some((n) => n.state === "failed");
  const label = unseen.length ? `Notifications: ${unseen.length} unseen${failed ? ", one failed" : ""}` : "Notifications";
  const toggle = () => { setOpen((o) => !o); markSeen(); };
  const now = Date.now();
  return (
    <span className="notes-anchor">
      <button ref={key} type="button" className={`key round${failed ? " failed" : ""}`} aria-label={label} title={label} aria-expanded={open} onClick={toggle}>
        <Icon name={unseen.length ? "bell-dot" : "bell"} />
      </button>
      {open && (
        <div ref={pop} className="popover notes" role="dialog" aria-label="Notifications">
          <h3>Notifications{log.length > 0 && <Key size="sm" kind="quiet" onClick={clearLog}>Clear</Key>}</h3>
          {log.length ? (
            <ul>
              {log.map((n) => (
                <li key={n.id} className={n.state === "failed" ? "failed" : ""}>
                  <Mark state={n.state} />
                  <div><b>{n.title}</b>{n.detail && <small>{n.detail}</small>}</div>
                  <time dateTime={new Date(n.at).toISOString()}>{ago(n.at, now)}</time>
                </li>
              ))}
            </ul>
          ) : <div className="menu-note">Nothing yet: background work and its end show here.</div>}
        </div>
      )}
    </span>
  );
}
