// A menu: raised grey, the chosen item has a check in ink (never a bar beside it), an unavailable one
// stays, greyed, and says why at the right and on hover. One submenu level at most (Open recent ›).
// The caller places it (position: absolute) and opens it.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useDismiss } from "./dismiss.tsx";
import { Icon } from "./Icon.tsx";
import type { IconName } from "./icons.ts";

export type MenuItem = {
  id: string; label: string; icon?: IconName; shortcut?: string; checked?: boolean; disabled?: boolean; why?: string;
  /** Small text at the right, such as a count or where it lives. */
  meta?: string;
  /** A submenu: the item opens it instead of running. */
  sub?: MenuEntry[];
  run: () => void;
};

export type MenuEntry =
  | MenuItem
  | "-"
  | { note: string }
  /** A group's name over its items, in mono caps (the owning app's group in a file or tab menu). */
  | { group: string };

/** ↑/↓ among the enabled items of the menu the focus is in (not its submenu's). */
export function menuArrows(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  const here = (document.activeElement as HTMLElement | null)?.closest(".menu") ?? e.currentTarget.querySelector(".menu");
  if (!here) return;
  e.preventDefault();
  const items = [...here.querySelectorAll<HTMLElement>('.menu-item:not([aria-disabled="true"])')].filter((i) => i.closest(".menu") === here);
  const i = items.indexOf(document.activeElement as HTMLElement);
  items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
}

/** The right-hand side of an item: its key, else its meta, else why it is unavailable. */
export function itemSide(it: { shortcut?: string; meta?: string; why?: string; disabled?: boolean }) {
  if (it.shortcut) return <kbd>{it.shortcut}</kbd>;
  if (it.meta) return <span className="menu-meta">{it.meta}</span>;
  if (it.disabled && it.why) return <span className="menu-meta why">{it.why}</span>;
  return null;
}

/** An item that opens a submenu: on hover, a press, Enter or →; ← goes back. */
export function SubMenu({ label, icon, slot, items, onPick }: {
  label: string;
  icon?: ReactNode;
  /** The check's slot, so the label lines up with its neighbours. */
  slot?: boolean;
  items: MenuEntry[];
  onPick: (run: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const byKey = useRef(false);
  const btn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open && byKey.current) { byKey.current = false; box.current?.querySelector<HTMLElement>('.menu-item:not([aria-disabled="true"])')?.focus(); }
  }, [open]);
  return (
    <div className="menu-sub-wrap" role="none" onPointerEnter={() => setOpen(true)} onPointerLeave={() => setOpen(false)}>
      <button ref={btn} type="button" className="menu-item" role="menuitem" aria-haspopup="menu" aria-expanded={open} tabIndex={-1}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault(); e.stopPropagation();
          byKey.current = true; setOpen(true);
        }}>
        <span className="menu-label">{slot && <span className="check" />}{icon}{label}</span>
        <Icon name="chevron-right" size={12} className="menu-sub-chev" />
      </button>
      {open && (
        <div ref={box} className="menu menu-sub" role="menu" aria-label={label} onKeyDown={(e) => {
          if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); setOpen(false); btn.current?.focus(); }
        }}>
          <MenuItems items={items} onPick={onPick} />
        </div>
      )}
    </div>
  );
}

/** A menu's entries (the Menu's body, a submenu's, the menu bar's Open recent). */
export function MenuItems({ items, onPick }: { items: MenuEntry[]; onPick: (run: () => void) => void }) {
  const checkable = items.some((i) => typeof i === "object" && "checked" in i && i.checked !== undefined);
  return <>
    {items.map((it, n) => {
      if (it === "-") return <hr key={n} />;
      if ("note" in it) return <div key={n} className="menu-note">{it.note}</div>;
      if ("group" in it) return <div key={n} className="menu-group">{it.group}</div>;
      const icon = it.icon && <Icon name={it.icon} />;
      if (it.sub) return <SubMenu key={it.id} label={it.label} icon={icon} slot={checkable} items={it.sub} onPick={onPick} />;
      return (
        <button
          key={it.id}
          type="button"
          className="menu-item"
          role={it.checked !== undefined ? "menuitemcheckbox" : "menuitem"}
          aria-checked={it.checked}
          aria-disabled={it.disabled || undefined}
          title={it.disabled ? it.why : undefined}
          onClick={() => { if (!it.disabled) onPick(it.run); }}
        >
          <span>
            {checkable && <Icon name="chosen" className="check" size={14} />}
            {icon}
            {it.label}
          </span>
          {itemSide(it)}
        </button>
      );
    })}
  </>;
}

export function Menu({ label, items, onClose, triggerRef, head, className = "" }: {
  label: string;
  items: MenuEntry[];
  onClose: () => void;
  triggerRef?: { current: HTMLElement | null };
  /** A line over the items that says what the menu is about (a folder's path, where a hub lives). */
  head?: ReactNode;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  useDismiss(box, () => onClose(), { triggerRef });
  return (
    <div ref={box} className={`menu${className ? ` ${className}` : ""}`} role="menu" aria-label={label} data-own-keys onKeyDown={menuArrows}>
      {head && <div className="menu-head">{head}</div>}
      <MenuItems items={items} onPick={(run) => { run(); onClose(); }} />
    </div>
  );
}
