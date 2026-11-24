// A key (button). One primary per view: a tint of the accent, never a fill. Busy keeps the key's width:
// the spinner takes the icon's place and the label says what is happening.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon.tsx";
import type { IconName } from "./icons.ts";
import { Spinner } from "./Spinner.tsx";

export type KeyProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  kind?: "primary" | "quiet" | "danger" | "confirm-danger";
  size?: "sm" | "lg";
  icon?: IconName;
  /** Round, icon only: give `label` for its name. */
  round?: boolean;
  busy?: boolean;
  shortcut?: string;
  label?: string;
  children?: ReactNode;
};

export function Key({ kind, size, icon, round, busy, shortcut, label, children, className = "", type = "button", ...rest }: KeyProps) {
  const cls = ["key", kind === "confirm-danger" ? "danger confirm" : kind, size, round && "round", className].filter(Boolean).join(" ");
  return (
    <button type={type} className={cls} aria-label={round ? label : undefined} title={round ? label : rest.title} aria-busy={busy || undefined} {...rest}>
      {busy ? <Spinner size={size === "sm" ? 12 : 14} /> : icon && <Icon name={icon} />}
      {!round && (children ?? label)}
      {shortcut && <kbd>{shortcut}</kbd>}
    </button>
  );
}

/** Remove: the round ×. */
export function RemoveKey({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="remove" aria-label={label} title={label} onClick={onClick}>
      <svg viewBox="0 0 8 8" aria-hidden="true"><path d="M1 1l6 6M7 1L1 7" /></svg>
    </button>
  );
}
