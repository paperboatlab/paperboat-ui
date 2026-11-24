// A menu: raised grey, the chosen item has a check in ink (never a bar beside it), an unavailable one
// stays, greyed, and says why on hover. The caller places it (position: absolute) and opens it.
import { useRef } from "react";
import { useDismiss } from "./dismiss.tsx";
import { Icon } from "./Icon.tsx";
import type { IconName } from "./icons.ts";

export type MenuEntry =
  | { id: string; label: string; icon?: IconName; shortcut?: string; checked?: boolean; disabled?: boolean; why?: string; run: () => void }
  | "-"
  | { note: string };

export function Menu({ label, items, onClose, triggerRef, className = "" }: {
  label: string;
  items: MenuEntry[];
  onClose: () => void;
  triggerRef?: { current: HTMLElement | null };
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  useDismiss(box, () => onClose(), { triggerRef });
  const checkable = items.some((i) => typeof i === "object" && "checked" in i && i.checked !== undefined);
  return (
    <div ref={box} className={`menu${className ? ` ${className}` : ""}`} role="menu" aria-label={label} data-own-keys>
      {items.map((it, n) => {
        if (it === "-") return <hr key={n} />;
        if ("note" in it) return <div key={n} className="menu-note">{it.note}</div>;
        return (
          <button
            key={it.id}
            type="button"
            className="menu-item"
            role={checkable ? "menuitemcheckbox" : "menuitem"}
            aria-checked={checkable ? !!it.checked : undefined}
            aria-disabled={it.disabled || undefined}
            title={it.disabled ? it.why : undefined}
            onClick={() => { if (!it.disabled) { it.run(); onClose(); } }}
          >
            <span>
              {checkable && <Icon name="chosen" className="check" size={14} />}
              {it.icon && <Icon name={it.icon} />}
              {it.label}
            </span>
            {it.shortcut && <kbd>{it.shortcut}</kbd>}
          </button>
        );
      })}
    </div>
  );
}
