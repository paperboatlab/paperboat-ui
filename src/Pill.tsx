// A status pill, one indicator each: live (the border light), working (the spinner before the word),
// idle, failed (red line and word), or progress you can count (a 2 px bar). `labels` lists every text
// it may show, so it keeps the widest one's room and nothing beside it shifts.
import type { ReactNode } from "react";
import { Spinner } from "./Spinner.tsx";

export type PillState = "live" | "working" | "idle" | "failed" | "progress" | "plain";

export function Pill({ state = "plain", label, labels = [], progress, title, className = "" }: {
  state?: PillState;
  label: string;
  labels?: string[];
  /** 0–1, with state "progress". */
  progress?: number;
  title?: string;
  className?: string;
}) {
  return (
    <span className={`pill ${state}${className ? ` ${className}` : ""}`} role="status" title={title}>
      {state === "working" && <Spinner size={12} />}
      <span className="pill-room">
        {labels.filter((l) => l !== label).map((l) => <span key={l} aria-hidden="true">{l}</span>)}
        <span>{label}</span>
      </span>
      {state === "progress" && <span className="bar"><i style={{ width: `${Math.round(Math.min(1, Math.max(0, progress ?? 0)) * 100)}%` }} /></span>}
    </span>
  );
}

export function Tag({ children, ask, title }: { children: ReactNode; ask?: boolean; title?: string }) {
  return <span className={`tag${ask ? " ask" : ""}`} title={title}>{children}</span>;
}
