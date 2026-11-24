// A panel: a card with a head (its name, a short count, and for a side panel its hide key at the right
// end: a bar and a chevron toward the edge it goes to). Hidden, a side panel becomes a slim bar of
// itself in the same place, 38 px wide, the whole bar the show target. Hide is not close: never ×.
import type { ReactNode } from "react";
import { Icon } from "./Icon.tsx";
import type { IconName } from "./icons.ts";

export function Panel({ name, count, side, hidden = false, onHidden, width = 250, icon, head, className = "", children }: {
  name: string;
  count?: ReactNode;
  /** A side panel can hide toward its edge. */
  side?: "left" | "right";
  hidden?: boolean;
  onHidden?: (hidden: boolean) => void;
  width?: number;
  /** Shown on the slim bar. */
  icon?: IconName;
  /** More in the head, before the count. */
  head?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const body = (
    <>
      <div className="panel-head">
        <b>{name}</b>
        {head}
        {count !== undefined && <small>{count}</small>}
        {side && onHidden && (
          <button type="button" className="hide-key" aria-label={`Hide ${name}`} title={`Hide ${name}`} onClick={() => onHidden(true)}>
            <Icon name={side === "left" ? "hide-left" : "hide-right"} />
          </button>
        )}
      </div>
      <div className="panel-body">{children}</div>
    </>
  );
  if (!side) return <section className={`panel${className ? ` ${className}` : ""}`} aria-label={name}>{body}</section>;
  return (
    <section className={`panel side${hidden ? " hidden" : ""}${className ? ` ${className}` : ""}`} style={{ width }} aria-label={name}>
      <div className="panel-inner" style={{ width: width - 2 }} inert={hidden || undefined}>{body}</div>
      <button type="button" className="panel-slim" aria-label={`Show ${name}`} title={`Show ${name}`} tabIndex={hidden ? 0 : -1} onClick={() => onHidden?.(false)}>
        <Icon name={side === "left" ? "show-left" : "show-right"} />
        {icon && <Icon name={icon} />}
        <span className="name">{name}</span>
        {count !== undefined && <span className="count">{count}</span>}
      </button>
    </section>
  );
}
