// The runtimes key (ui-example.html "Runtimes key"; REBRAND: one key, never a row of pills) and its peek: a
// badge counts the sessions up, ! when one failed, and the border runs while one works; the peek lists each
// runtime with its state, what it runs and its keys. Pure: the app fetches, polls and acts in its callbacks.
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useDismiss, useFocusReturn } from "./dismiss.tsx";
import { Icon } from "./Icon.tsx";
import type { IconName } from "./icons.ts";
import { Key } from "./Key.tsx";
import { runtimeLine, runtimeLogo, runtimesLabel, runtimesSummary, type Runtime, type RuntimesSummary } from "./runtimes.ts";
import { Spinner } from "./Spinner.tsx";

export type RuntimesKeyProps = {
  /** The rows; undefined while the app still asks paperboatd (a spinner line). */
  runtimes?: Runtime[];
  /** Whose runtimes, in the peek's head: "this folder", "this hub". */
  scope?: string;
  /** A failed call, in words, under the head. */
  error?: string;
  /** The key before the rows are known (Julix asks only once the peek opens); otherwise drawn from the rows. */
  count?: number;
  live?: boolean;
  failed?: boolean;
  /** The peek's foot: a line and a quiet key (Packages…); a function gets `close`. */
  footer?: ReactNode | ((close: () => void) => ReactNode);
  /** The peek opened or closed: ask the daemon, start or stop polling. */
  onOpenChange?: (open: boolean) => void;
};

export function RuntimesKey({ runtimes, scope, error, footer, onOpenChange, ...key }: RuntimesKeyProps) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const set = (o: boolean) => { setOpen(o); onOpenChange?.(o); };
  const own = runtimesSummary(runtimes ?? []);
  const s: RuntimesSummary = { count: key.count ?? own.count, live: key.live ?? own.live, failed: key.failed ?? own.failed };
  const label = runtimesLabel(s);
  return (
    <span className="runtimes-key">
      <button ref={button} type="button" className={`key round${s.live ? " live" : ""}`} aria-label={label} title={label} aria-expanded={open} aria-haspopup="dialog" onClick={() => set(!open)}>
        <Icon name="a-runtimes" />
        {s.failed ? <b className="badge bad">!</b> : s.count > 0 && <b className={`badge${s.live ? " live" : ""}`}>{s.count}</b>}
      </button>
      {open && (
        <Peek trigger={button} onClose={() => set(false)} scope={scope} error={error} runtimes={runtimes}
          footer={typeof footer === "function" ? footer(() => set(false)) : footer} />
      )}
    </span>
  );
}

function Peek({ trigger, onClose, scope, error, runtimes, footer }: { trigger: RefObject<HTMLButtonElement | null>; onClose: () => void; scope?: string; error?: string; runtimes?: Runtime[]; footer?: ReactNode }) {
  const pop = useRef<HTMLDivElement>(null);
  useDismiss(pop, onClose, { triggerRef: trigger });
  useFocusReturn();
  // never off-screen: the peek hangs from the key's right edge; a key near the left shifts it back in
  // ponytail: placed once on open, not on a resize while open
  useLayoutEffect(() => {
    const el = pop.current;
    if (!el) return;
    const r = el.getBoundingClientRect(), m = 8;
    const dx = r.left < m ? m - r.left : r.right > innerWidth - m ? innerWidth - m - r.right : 0;
    if (dx) el.style.translate = `${dx}px 0`;
  }, []);
  return (
    <div ref={pop} className="popover runtimes" role="dialog" aria-label="Runtimes">
      <div className="runtimes-head"><b>Runtimes</b><span>{scope ? `${scope} · ` : ""}paperboat-runtime/0</span></div>
      {error && <p className="runtimes-error">{error}</p>}
      {!runtimes && !error && <p className="runtimes-wait"><Spinner size={12} />asking paperboatd…</p>}
      {runtimes?.map((r) => <Row key={r.id} r={r} />)}
      {footer && <div className="runtimes-foot">{footer}</div>}
    </div>
  );
}

const act = (icon: IconName, label: string, run?: () => void) => run && <Key key={icon} size="sm" kind="quiet" round icon={icon} label={label} onClick={run} />;

function Row({ r }: { r: Runtime }) {
  const up = r.state !== "off" && r.state !== "failed";
  const working = r.state === "busy" || r.state === "starting";
  return (
    <div className={`runtime ${r.state}`}>
      <span className="runtime-logo" aria-hidden="true">{runtimeLogo(r.lang)}</span>
      <div>
        <b>{r.name}</b>
        <small>{runtimeLine(r)}</small>
        {working && <p className="runtime-now"><Spinner size={12} />{r.now ?? (r.state === "starting" ? "starting" : "running")}</p>}
        {r.note && <p>{r.note}</p>}
      </div>
      <div className="runtime-acts">
        {r.state === "busy" && act("debug-pause", "Interrupt", r.onInterrupt)}
        {up && act("debug-restart", "Restart the session (its variables are lost)", r.onRestart)}
        {up && act("debug-stop", "Stop the session", r.onStop)}
        {!up && act("play", "Start the session", r.onStart)}
      </div>
    </div>
  );
}
