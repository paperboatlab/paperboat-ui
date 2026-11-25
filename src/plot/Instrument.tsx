// An instrument's frame (ui-example §14): the black screen, which shows, over the grey caption, which
// names it, says what it reads and ends with its value. Simplicial's Board draws every instrument in
// it (its faces are instruments.tsx; a toolkit adapts its block to one); the Scope is one too. Styles: scope/scope.css. Idle, the dashed frame
// says why in a muted line (`hint`, else the app's `InstrumentIdle`), so an empty Board still reads.
import { createContext, useContext, type ReactNode } from "react";

/** What an idle instrument says when it has no `hint` of its own: the app's words ("No run yet · Run (Ctrl R)"). */
export const InstrumentIdle = createContext<ReactNode>(undefined);

export type InstrumentProps = {
  /** Its name, in ink at the caption's start. */
  name: ReactNode;
  /** What it reads ("cart position"), muted after the name. */
  detail?: ReactNode;
  /** Its value or state at the caption's end, in mono. */
  value?: ReactNode;
  /** Nothing received yet: the same frame, dashed. */
  idle?: boolean;
  /** Idle, the muted line inside the frame; default the app's `InstrumentIdle`. */
  hint?: ReactNode;
  /** The face's own class (`display`, `lamp`), beside `instrument`. */
  className?: string;
  label?: string;
  /** The face, drawn on the screen. */
  children?: ReactNode;
};

export function Instrument({ name, detail, value, idle, hint, className, label, children }: InstrumentProps) {
  const fallback = useContext(InstrumentIdle);
  const say = idle ? (hint ?? fallback) : undefined;
  return (
    <figure className={`instrument${className ? ` ${className}` : ""}${idle ? " idle" : ""}`} aria-label={label}>
      <div className="screen">{children}{say != null && say !== "" && <p className="instrument-hint">{say}</p>}</div>
      <figcaption>
        <b>{name}</b>
        {detail !== undefined && <span className="detail">{detail}</span>}
        {value !== undefined && <output>{value}</output>}
      </figcaption>
    </figure>
  );
}
