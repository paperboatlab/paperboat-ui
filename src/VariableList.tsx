// The variables list, one pattern for every app (rebrand apps/julix `.vrow`: Julix's Workspace, Simplicial's
// Variables card): by group, a row per variable with its name in mono, the type line under it in muted 12 px
// (`typeLine`), and its value at the right (a live one in the accent's text). Hover tints the row; the selected
// row is tinted, the open one a soft outline round it and what it holds (an editor, its uses), never a side bar.
// What a variable is and how it is edited stay the app's.
import type { DragEvent, ReactNode } from "react";

/** The scroll of groups and rows. */
export function VariableList({ label = "Variables", children }: { label?: string; children: ReactNode }) {
  return <div className="var-list" aria-label={label}>{children}</div>;
}

/** A group's title (12 px, sentence case as given) and a detail at its right end (a file, a time). */
export function VariableGroup({ title, detail, children }: { title?: string; detail?: ReactNode; children: ReactNode }) {
  return (
    <section className="var-group" aria-label={title || undefined}>
      {title && <h3 className="var-group-title">{title}{detail !== undefined && <span>{detail}</span>}</h3>}
      {children}
    </section>
  );
}

export function VariableRow({ name, type, value, live, selected, open, off, why, error, onOpen, onDragStart, children }: {
  name: string;
  /** Its type line: `number · N·s/rad`, `ƒ kp / 5 · number`, `matrix 2×2` (`typeLine`). */
  type: ReactNode;
  value?: ReactNode;
  /** Set by another app or a run as it goes (Julix's shared variables): the value in the accent's text. */
  live?: boolean;
  /** Picked: the row tinted. */
  selected?: boolean;
  /** Open in place: the row and its children (an editor) in a soft outline. */
  open?: boolean;
  /** Can't change now: its value greyed, `why` on hover. */
  off?: boolean;
  why?: string;
  /** What is wrong with it, in words, under the type line. */
  error?: string;
  onOpen?: () => void;
  /** Makes the row draggable (to bind it to a field). */
  onDragStart?: (e: DragEvent<HTMLButtonElement>) => void;
  /** What an open row shows under its head. */
  children?: ReactNode;
}) {
  return (
    <div className={`var-row${selected ? " on" : ""}${open ? " open" : ""}${live ? " live" : ""}${off ? " off" : ""}${error ? " bad" : ""}`}>
      <button type="button" className="var-row-head" aria-expanded={onOpen ? !!open : undefined} title={why}
        onClick={onOpen} draggable={!!onDragStart} onDragStart={onDragStart}>
        <span className="var-row-name"><b>{name}</b><small>{type}</small></span>
        {value !== undefined && <span className="var-row-value">{value}</span>}
      </button>
      {error && <p className="var-row-error">{error}</p>}
      {open && children !== undefined && <div className="var-row-body">{children}</div>}
    </div>
  );
}
