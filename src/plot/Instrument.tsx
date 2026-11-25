// An instrument's frame (ui-example §14): the black screen, which shows, over the grey caption, which
// names it, says what it reads and ends with its value. Simplicial's Board draws every instrument in
// it (a toolkit's face goes in the screen); the Scope is one too. Styles: scope/scope.css.
import type { ReactNode } from "react";

export type InstrumentProps = {
  /** Its name, in ink at the caption's start. */
  name: ReactNode;
  /** What it reads ("cart position"), muted after the name. */
  detail?: ReactNode;
  /** Its value or state at the caption's end, in mono. */
  value?: ReactNode;
  /** Nothing received yet: the same frame, dashed. */
  idle?: boolean;
  /** The face's own class (`display`, `lamp`), beside `instrument`. */
  className?: string;
  label?: string;
  /** The face, drawn on the screen. */
  children?: ReactNode;
};

export function Instrument({ name, detail, value, idle, className, label, children }: InstrumentProps) {
  return (
    <figure className={`instrument${className ? ` ${className}` : ""}${idle ? " idle" : ""}`} aria-label={label}>
      <div className="screen">{children}</div>
      <figcaption>
        <b>{name}</b>
        {detail !== undefined && <span className="detail">{detail}</span>}
        {value !== undefined && <output>{value}</output>}
      </figcaption>
    </figure>
  );
}
