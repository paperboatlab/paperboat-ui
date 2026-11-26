// A number param typed as in a block diagram's dialog: a number, a variable's name or a formula of them (`kp / 5`).
// Typing a name lists the variables it may mean, each with its type line and value; ↑ ↓ pick, Tab or Enter takes
// one, Esc hides the list (again: undoes the edit). Leaving the field or Enter sets the param: a number, `{ var }`
// for a variable's name alone, `{ expr }` for anything else. Bound, it shows the name or formula in an ink outline.
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isRef, nameAt, paramText, parseParam, suggestVars, type VarHint } from "./bindings.ts";
import type { ParamValue } from "./types.ts";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function ParamField({ value, fallback, vars, onChange, disabled, label }: {
  value: ParamValue | undefined;
  /** Shown while `value` is unset: the param's default. */
  fallback: number;
  vars: readonly VarHint[];
  onChange: (v: ParamValue) => void;
  disabled?: boolean;
  label: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState<string | null>(null); // null: not editing, show the value
  const [caret, setCaret] = useState(0);
  const [pick, setPick] = useState(0);
  const [hidden, setHidden] = useState(false); // Esc hid the list
  const undo = useRef(false);
  const shown = text ?? paramText(value ?? fallback);
  const at = text !== null && !hidden ? nameAt(text, caret) : null;
  const hits = at ? suggestVars(vars, at.word) : [];
  const sel = Math.min(pick, Math.max(0, hits.length - 1));

  const edit = (next: string, to: number) => {
    setText(next);
    setCaret(to);
    setPick(0);
    setHidden(false);
  };
  const take = (h: VarHint) => {
    if (!at || text === null) return;
    const to = at.from + h.name.length;
    edit(text.slice(0, at.from) + h.name + text.slice(caret), to);
    requestAnimationFrame(() => input.current?.setSelectionRange(to, to));
  };
  const box = hits.length ? input.current?.getBoundingClientRect() : undefined;

  return (
    <>
      <input
        ref={input}
        className={`param-well param-expr nodrag nowheel${isRef(value) && text === null ? " bound" : ""}`}
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={hits.length > 0}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        value={shown}
        style={{ width: `${Math.min(24, Math.max(8, shown.length + 2))}ch` }}
        title={isRef(value) ? ("var" in value ? `Bound to ${value.var}` : `ƒ ${value.expr}`) : undefined}
        onFocus={(e) => (edit(e.currentTarget.value, e.currentTarget.selectionStart ?? 0), setHidden(true))} // the list waits for typing
        onChange={(e) => edit(e.target.value, e.target.selectionStart ?? e.target.value.length)}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
        onBlur={() => {
          const v = text === null || undo.current ? undefined : parseParam(text, vars.map((x) => x.name));
          undo.current = false;
          setText(null);
          if (v !== undefined && !same(v, value)) onChange(v);
        }}
        onKeyDown={(e) => {
          if (hits.length && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            setPick((sel + (e.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length);
          } else if (hits.length && (e.key === "Tab" || (e.key === "Enter" && hits[sel].name !== at?.word))) {
            e.preventDefault();
            take(hits[sel]);
          } else if (e.key === "Escape" && hits.length) {
            e.stopPropagation();
            setHidden(true);
          } else if (e.key === "Enter" || e.key === "Escape") {
            undo.current = e.key === "Escape";
            e.currentTarget.blur();
          }
        }}
      />
      {box && createPortal(
        <div className="param-hints" role="listbox" aria-label={`Variables for ${label}`} style={box.bottom + 4 + hits.length * 44 > innerHeight ? { left: box.left, bottom: innerHeight - box.top + 4 } : { left: box.left, top: box.bottom + 4 }}>
          {hits.map((h, i) => (
            <div key={h.name} role="option" aria-selected={i === sel} className="param-hint" onMouseEnter={() => setPick(i)}
              onMouseDown={(e) => { e.preventDefault(); take(h); }}>
              <span><b>{h.name}</b><small>{h.type}</small></span>
              <em>{h.value}</em>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
