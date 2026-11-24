// A dialog, only for something that needs a word first (results and errors go to the console):
// on a scrim, a title in Funnel Display, the question in words, the actions with the safe choice
// last. Esc and a press outside are the safe choice; `wait` keeps it open until one is chosen.
import { useRef, type ReactNode } from "react";
import { useDismiss, useFocusReturn } from "./dismiss.tsx";
import { RemoveKey } from "./Key.tsx";

export function Dialog({ title, tags = [], wide, wait, className = "", onClose, actions, children }: {
  title: string;
  /** Short facts beside the title: a version, a backend. */
  tags?: (string | false | undefined | null)[];
  wide?: boolean;
  /** Sizes it for one use (help-window, a value editor). */
  className?: string;
  /** Must be answered: no ×, no outside press. Esc still takes the safe choice. */
  wait?: boolean;
  onClose: () => void;
  /** The keys, the safe one last. */
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  useDismiss(box, () => onClose(), { outside: !wait });
  useFocusReturn(box);
  return (
    <div className="dialog-scrim" data-own-keys>
      <div ref={box} className={`dialog${wide ? " wide" : ""}${className ? ` ${className}` : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="dialog-head">
          <h2>{title}</h2>
          {tags.filter((t): t is string => !!t).map((t) => <span key={t} className="tag">{t}</span>)}
          <span className="grow" />
          {!wait && <RemoveKey label="Close" onClick={onClose} />}
        </header>
        {children}
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>
  );
}
