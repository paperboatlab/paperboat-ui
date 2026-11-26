// A panel: a card with a head (its name, a short count, and for a panel that can hide its hide key at the
// right end: a bar and a chevron toward the edge it goes to). Hidden, a left or right panel becomes a slim
// bar of itself in the same place, 38 px wide, the whole bar the show target; a bottom panel keeps its head
// (its readout stays) and the key flips to point up. Hide is not close: never ×. (The Julix mockup.)
import type { ReactNode } from "react";
import { Icon } from "./Icon.tsx";
import type { IconName } from "./icons.ts";

export function Panel({ name, showName = true, count, side, hidden = false, onHidden, width = 250, icon, head, tools, className = "", children }: {
  name: string;
  /** false: the view already says the name (the rail names the page), so the head opens on its count;
   *  the name still labels the panel and its slim bar. REBRAND "A name once". */
  showName?: boolean;
  count?: ReactNode;
  /** A panel that can hide toward its edge. */
  side?: "left" | "right" | "bottom";
  hidden?: boolean;
  onHidden?: (hidden: boolean) => void;
  width?: number;
  /** Shown on the slim bar (left, right). */
  icon?: IconName;
  /** More in the head, before the count. */
  head?: ReactNode;
  /** Keys at the head's right end, before the hide key (the count then follows the name). */
  tools?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const body = (
    <>
      <div className="panel-head">
        {showName && <b>{name}</b>}
        {head}
        {count !== undefined && <small>{count}</small>}
        {tools && <span className="tools">{tools}</span>}
        {side && onHidden && (
          <button type="button" className="hide-key" aria-label={`${hidden ? "Show" : "Hide"} ${name}`} title={`${hidden ? "Show" : "Hide"} ${name}`} onClick={() => onHidden(!hidden)}>
            <Icon name={`hide-${side}`} />
          </button>
        )}
      </div>
      <div className="panel-body">{children}</div>
    </>
  );
  if (!side) return <section className={`panel${className ? ` ${className}` : ""}`} aria-label={name}>{body}</section>;
  if (side === "bottom") return <section className={`panel bottom${hidden ? " hidden" : ""}${className ? ` ${className}` : ""}`} aria-label={name}>{body}</section>;
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
