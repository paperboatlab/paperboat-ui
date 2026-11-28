// Choices: a segmented control (the chosen segment rises), tabs (underlined in the accent), a switch. The
// raised thumb and the underline are one element each that glides to the choice (REBRAND "Motion":
// a choice moving glides on --glide); the first placement doesn't move. `readOnly` (an example, articula#57):
// the choice shows, focusable and read out, but can't change (no hover, no click, no arrows); `disabled`: greyed.
import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

function step<T>(e: KeyboardEvent, options: { value: T }[], value: T, onChange: (v: T) => void) {
  const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
  if (!d) return;
  e.preventDefault();
  const i = Math.max(0, options.findIndex((o) => o.value === value));
  onChange(options[(i + d + options.length) % options.length].value);
}

/** Keeps `mark` over the chosen child of `box` (its left and width), gliding after the first time. */
function useGlide() {
  const box = useRef<HTMLDivElement>(null), mark = useRef<HTMLSpanElement>(null), placed = useRef(false);
  useLayoutEffect(() => {
    const on = box.current?.querySelector<HTMLElement>('[aria-checked="true"], [aria-selected="true"]'), m = mark.current;
    if (!m) return;
    m.style.opacity = on ? "1" : "0";
    if (!on) return;
    if (!placed.current) m.style.transition = "none";
    m.style.width = `${on.offsetWidth}px`;
    m.style.transform = `translateX(${on.offsetLeft}px)`;
    if (!placed.current) { void m.offsetWidth; m.style.transition = ""; placed.current = true; }
  });
  return { box, mark };
}

export function Segmented<T extends string>({ label, options, value, onChange, size, readOnly, disabled }: {
  label: string;
  /** Shows the choice but doesn't change it (an example opened read-only). */
  readOnly?: boolean;
  disabled?: boolean;
  /** "sm": in a panel head or a tool strip. */
  size?: "sm";
  options: { value: T; label: ReactNode; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { box, mark } = useGlide();
  const fixed = readOnly || disabled;
  const cls = ["seg", size, readOnly && "read-only", disabled && "disabled"].filter(Boolean).join(" ");
  return (
    <div ref={box} className={cls} role="radiogroup" aria-label={label} aria-readonly={readOnly || undefined} aria-disabled={disabled || undefined}
      onKeyDown={(e) => { if (!fixed) step(e, options, value, onChange); }}>
      <span ref={mark} className="seg-thumb" aria-hidden="true" />
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} tabIndex={o.value === value ? 0 : -1} title={o.hint}
          disabled={disabled} onClick={() => { if (!fixed) onChange(o.value); }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ label, tabs, value, onChange }: {
  label: string;
  tabs: { value: T; label: ReactNode; count?: string | number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { box, mark } = useGlide();
  return (
    <div ref={box} className="tabs" role="tablist" aria-label={label} onKeyDown={(e) => step(e, tabs, value, onChange)}>
      <span ref={mark} className="tabs-line" aria-hidden="true" />
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" aria-selected={t.value === value} tabIndex={t.value === value ? 0 : -1} onClick={() => onChange(t.value)}>
          {t.label}
          {t.count !== undefined && <small>{t.count}</small>}
        </button>
      ))}
    </div>
  );
}

export function Switch({ label, checked, onChange, readOnly, disabled }: {
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
  /** Shows on or off but doesn't change (an example opened read-only). */
  readOnly?: boolean;
  disabled?: boolean;
}) {
  const cls = ["switch", readOnly && "read-only"].filter(Boolean).join(" ");
  return <button type="button" className={cls} role="switch" aria-checked={checked} aria-label={label} aria-readonly={readOnly || undefined} disabled={disabled}
    onClick={() => { if (!readOnly && !disabled) onChange(!checked); }} />;
}
