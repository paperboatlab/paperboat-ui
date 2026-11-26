// The editor's tab strip (ui-example.html §14 `.cp-tabs`, REBRAND "Tab menu"): one tab per open file, the
// shown one underlined in the accent, its file icon, a dot while unsaved, a pin for the × when pinned. The
// shown tab is always in view: the strip scrolls sideways (the wheel too, no scrollbar) and brings it in
// when it changes or the strip resizes. A right click opens the kit's TabMenu and keeps the tab tinted;
// a middle click closes. The host owns the tabs, their order (orderTabs), the closes (afterClose) and saving.
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "../Icon.tsx";
import { RemoveKey } from "../Key.tsx";
import type { MenuEntry } from "../Menu.tsx";
import { fileIconFor } from "../files/types.ts";
import { TabMenu } from "./TabMenu.tsx";
import { revealDelta } from "./tabs.ts";

export type EditorTab = {
  /** The file's path: the tab's key, its tooltip and what the callbacks get. */
  id: string;
  /** Shown; the path's last part by default. */
  label?: string;
  /** In place of the file-type icon (a spinner while it runs, a format's own glyph). */
  icon?: ReactNode;
  /** Not saved yet: the dot. */
  dirty?: boolean;
  /** Shows a pin for the ×; a middle click passes it. */
  pinned?: boolean;
  /** false: no ×, no middle-click close (the one tab an app always keeps). */
  closable?: boolean;
};

export type EditorTabsProps = {
  tabs: readonly EditorTab[];
  /** The shown tab's id. */
  current?: string | null;
  onShow: (id: string) => void;
  /** The ×, a middle click, Delete on the focused tab. */
  onClose: (id: string) => void;
  /** The right-click menu (the kit's tabMenu); without it, no menu. */
  menu?: (id: string) => MenuEntry[];
  /** With it, the pin is a key that unpins. */
  onUnpin?: (id: string) => void;
  /** The tablist's name. */
  label?: string;
  /** Keys at the strip's right end (Run, the editor settings, +). */
  children?: ReactNode;
};

const nameOf = (p: string) => p.slice(p.lastIndexOf("/") + 1);

/** Scrolls `strip` sideways, only itself, until `tab` is wholly in it. */
function reveal(strip: HTMLElement, tab: Element | null | undefined) {
  if (tab) strip.scrollLeft += revealDelta(strip.getBoundingClientRect(), tab.getBoundingClientRect());
}

export function EditorTabs({ tabs, current, onShow, onClose, menu, onUnpin, label = "Open files", children }: EditorTabsProps) {
  const strip = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ id: string; x: number; y: number } | null>(null);
  const shown = () => strip.current?.querySelector('[aria-selected="true"]');

  useLayoutEffect(() => { if (strip.current) reveal(strip.current, shown()); }, [current, tabs.length]);
  useEffect(() => {
    const s = strip.current;
    if (!s) return;
    const ro = new ResizeObserver(() => reveal(s, shown()));
    ro.observe(s);
    // a mouse wheel scrolls the strip sideways (a trackpad's own sideways swipe passes through)
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY) || s.scrollWidth <= s.clientWidth) return;
      e.preventDefault();
      s.scrollLeft += e.deltaY;
    };
    s.addEventListener("wheel", wheel, { passive: false });
    return () => { ro.disconnect(); s.removeEventListener("wheel", wheel); };
  }, []);

  const close = (t: EditorTab) => t.closable !== false && !t.pinned && onClose(t.id);

  const key = (e: KeyboardEvent<HTMLDivElement>, t: EditorTab) => {
    if (e.target !== e.currentTarget) return;   // a key inside the tab (the ×) handles its own
    const all = [...strip.current!.querySelectorAll<HTMLElement>('[role="tab"]')], i = all.indexOf(e.currentTarget);
    const to = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : -2;
    if (to !== -2) {
      e.preventDefault();
      const next = all[(to + all.length) % all.length];
      next.focus({ preventScroll: true });
      reveal(strip.current!, next);
    } else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onShow(t.id); }
    else if (e.key === "Delete") { e.preventDefault(); close(t); }
  };

  return (
    <div className="editor-tabs">
      <div ref={strip} className="editor-tabs-strip" role="tablist" aria-label={label}>
        {tabs.map((t) => {
          const name = t.label ?? nameOf(t.id), on = t.id === current;
          const { icon, tone } = fileIconFor(nameOf(t.id), "file");
          return (
            <div key={t.id} role="tab" aria-selected={on} tabIndex={on || (!current && t === tabs[0]) ? 0 : -1} title={t.id}
              className={`editor-tab${on ? " on" : ""}${at?.id === t.id ? " ctx" : ""}`}
              onClick={() => onShow(t.id)} onKeyDown={(e) => key(e, t)}
              onMouseDown={(e) => e.button === 1 && e.preventDefault()}   // no autoscroll on a middle click
              onAuxClick={(e) => e.button === 1 && close(t)}
              onContextMenu={menu && ((e) => { e.preventDefault(); setAt({ id: t.id, x: e.clientX, y: e.clientY }); })}>
              <span className="editor-tab-icon" style={t.icon ? undefined : { color: `var(--file-${tone})` }}>{t.icon ?? <Icon name={icon} size={14} />}</span>
              <span className="editor-tab-name">{name}</span>
              {t.dirty && <i className="editor-tab-dirty" title="Not saved" />}
              {t.pinned
                ? onUnpin
                  ? <button type="button" className="editor-tab-pin" aria-label={`Unpin ${name}`} title="Pinned: click to unpin" onClick={(e) => { e.stopPropagation(); onUnpin(t.id); }}><Icon name="pin" size={12} /></button>
                  : <span className="editor-tab-pin" title="Pinned"><Icon name="pin" size={12} label="Pinned" /></span>
                : t.closable !== false && <span className="editor-tab-x" onClick={(e) => e.stopPropagation()}><RemoveKey label={`Close ${name}`} onClick={() => onClose(t.id)} /></span>}
            </div>
          );
        })}
      </div>
      {children && <div className="editor-tabs-end">{children}</div>}
      {at && menu && <TabMenu path={at.id} x={at.x} y={at.y} items={menu(at.id)} onClose={() => setAt(null)} />}
    </div>
  );
}
