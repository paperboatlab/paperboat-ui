import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { byMenu, isEnabled, type Command, type Menu } from "./commands.ts";

type MenuId = string;
import { useDismiss } from "./dismiss.tsx";
import { Icon } from "./Icon.tsx";

/**
 * The menu bar (#78): one menu per `MenuId` that has commands. An ARIA menubar: Tab enters it once,
 * ←/→ move between menus, ↓ or Enter opens one, ↑/↓ move in it, Esc closes. Disabled items stay and say
 * why in their tooltip. Keys here are the menu's own, never forwarded to the station (`data-own-keys`).
 */
export function MenuBar({ commands, menus: own, groupTitles = {}, menuLabels }: {
  commands: Command[];
  /** The app's menus, in order (File, Edit, View…). */
  menus: Menu[];
  /** A heading above a group of items, where the group needs one ("Theme"). */
  groupTitles?: Record<string, string>;
  menuLabels?: Partial<Record<MenuId, string>>;
}) {
  const menus = byMenu(commands, own);
  const [open, setOpen] = useState<MenuId | null>(null);
  const [rover, setRover] = useState(0); // the one title Tab lands on
  const root = useRef<HTMLDivElement>(null);
  const focusFirst = useRef(false); // opened with the keyboard: move into the menu

  const titles = () => [...(root.current?.querySelectorAll<HTMLButtonElement>(".menu-title") ?? [])];
  const items = () => [...(root.current?.querySelectorAll<HTMLElement>('.menu-item:not([aria-disabled="true"])') ?? [])];

  useEffect(() => {
    if (open && focusFirst.current) {
      focusFirst.current = false;
      items()[0]?.focus();
    }
  }, [open]);

  // A press outside closes.
  useDismiss(root, (reason) => {
    setOpen(null);
    if (reason === "escape") titles()[menus.findIndex((m) => m.id === open)]?.focus();
  }, { enabled: open !== null });

  const openMenu = (id: MenuId, byKey: boolean) => {
    focusFirst.current = byKey;
    setOpen(id);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const ids = menus.map((m) => m.id);
    const target = e.target as HTMLElement;
    const onTitle = target.classList.contains("menu-title");
    const here = onTitle ? (target.dataset.menu as MenuId) : open;
    if (!here) return;
    const step = (d: number) => {
      const list = items();
      const i = list.indexOf(document.activeElement as HTMLElement);
      list[(i + d + list.length) % list.length]?.focus();
    };
    switch (e.key) {
      case "ArrowRight":
      case "ArrowLeft": {
        e.preventDefault();
        const next = ids[(ids.indexOf(here) + (e.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length];
        if (open) openMenu(next, true);
        else titles()[ids.indexOf(next)]?.focus();
        break;
      }
      case "ArrowDown":
        e.preventDefault();
        if (onTitle) openMenu(here, true);
        else step(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (onTitle) openMenu(here, true);
        else step(-1);
        break;
      case "Home":
      case "End":
        if (open && !onTitle) {
          e.preventDefault();
          const list = items();
          list[e.key === "Home" ? 0 : list.length - 1]?.focus();
        }
        break;
      case "Tab":
        setOpen(null);
        break;
    }
  };

  const activate = (c: Command) => {
    if (!isEnabled(c)) return;
    setOpen(null);
    (document.activeElement as HTMLElement | null)?.blur(); // the keys go back to the page
    c.run();
  };

  return (
    <div className="menubar" role="menubar" aria-label="Menus" data-own-keys ref={root} onKeyDown={onKey}>
      {menus.map((m, i) => (
        <div className="menu-wrap" key={m.id}>
          <button
            className="menu-title"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={open === m.id}
            data-menu={m.id}
            tabIndex={i === rover ? 0 : -1}
            onFocus={() => setRover(i)}
            onClick={(e) => (open === m.id ? setOpen(null) : openMenu(m.id, e.detail === 0))}
            onPointerEnter={() => open && open !== m.id && setOpen(m.id)}
          >
            {menuLabels?.[m.id] ?? m.label}
          </button>
          {open === m.id && (
            <div className="menu" role="menu" aria-label={m.label}>
              {m.items.map((c, j) => {
                const first = j === 0 || m.items[j - 1].group !== c.group;
                const on = isEnabled(c);
                const radio = c.group in groupTitles;
                return (
                  <div key={c.id} role="none">
                    {first && j > 0 && <hr role="separator" />}
                    {first && groupTitles[c.group] && <div className="menu-note" role="presentation">{groupTitles[c.group]}</div>}
                    <button
                      className="menu-item"
                      role={c.checked === undefined ? "menuitem" : radio ? "menuitemradio" : "menuitemcheckbox"}
                      aria-checked={c.checked}
                      aria-disabled={on ? undefined : true}
                      tabIndex={-1}
                      title={on ? undefined : c.why}
                      onClick={() => activate(c)}
                    >
                      <span className="menu-label">{m.items.some((x) => x.checked !== undefined) && <Icon name="chosen" className="check" size={14} />}{c.label}</span>
                      <span className="menu-side">
                        {c.meta && <span className="menu-meta">{c.meta}</span>}
                        {c.shortcut && <kbd>{c.shortcut}</kbd>}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
