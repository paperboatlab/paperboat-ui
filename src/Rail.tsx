// The rail (REBRAND "Rail"): a card at the window's left, 52 px (icons, tooltips with name and keys) or
// 208 px (icon and label), switched only by the quiet key under its foot (Ctrl+\); clicking an item
// never changes the width. Groups: pages (at most six, Alt+1…), tools that open panels, and a foot.
// The current page is a raised chip that glides on --slide; an open tool is pressed; counts are grey at
// the row's end, and narrow, only errors (red) and live work (the spinner) show on the icon.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "./Icon.tsx";
import type { IconName } from "./icons.ts";
import { Spinner } from "./Spinner.tsx";

export type RailItem = {
  id: string;
  label: string;
  icon: IconName;
  keys?: string;
  /** A number, "live" (the spinner) or an error count ("2!"). */
  count?: number | string;
};


function Count({ count }: { count: RailItem["count"] }) {
  if (count === undefined || count === "" || count === 0) return null;
  if (count === "live") return <span className="rail-count attention"><Spinner size={10} /></span>;
  const err = typeof count === "string" && count.endsWith("!");
  return <span className={`rail-count${err ? " error attention" : ""}`}>{err ? count.slice(0, -1) : count}</span>;
}

function Row({ item, current, pressed, onClick }: { item: RailItem; current?: boolean; pressed?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="rail-item" aria-current={current ? "page" : undefined} aria-pressed={pressed} aria-label={item.label} onClick={onClick}>
      <Icon name={item.icon} />
      <span className="rail-label">{item.label}</span>
      <Count count={item.count} />
      <span className="rail-tip">{item.label}{item.keys && <kbd>{item.keys}</kbd>}</span>
    </button>
  );
}

export function Rail({ label, pages, page, onPage, tools = [], open = [], onTool, foot = [], onFoot, wide, onWide }: {
  label: string;
  pages: RailItem[];
  page: string;
  onPage: (id: string) => void;
  tools?: RailItem[];
  /** The tools whose panel is open. */
  open?: string[];
  onTool?: (id: string) => void;
  foot?: RailItem[];
  onFoot?: (id: string) => void;
  /** Kept per app by the caller. */
  wide: boolean;
  onWide: (wide: boolean) => void;
}) {
  const at = Math.max(0, pages.findIndex((p) => p.id === page));
  const chip = useRef<HTMLSpanElement>(null);
  const [placed, setPlaced] = useState(false);
  useLayoutEffect(() => {
    const item = chip.current?.parentElement?.querySelectorAll<HTMLElement>(".rail-item")[at];
    if (chip.current && item) chip.current.style.transform = `translateY(${item.offsetTop}px)`;
    setPlaced(true);
  }, [at]);

  // Alt+1… for the pages, Ctrl+\ for the width
  const latest = useRef({ pages, onPage, wide, onWide });
  latest.current = { pages, onPage, wide, onWide };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const l = latest.current;
      if (e.altKey && !e.ctrlKey && !e.metaKey && /^[1-9]$/.test(e.key)) {
        const p = l.pages[Number(e.key) - 1];
        if (p) { e.preventDefault(); l.onPage(p.id); }
      } else if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        l.onWide(!l.wide);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <nav className={`rail${wide ? " wide" : ""}`} aria-label={label}>
      <div className="rail-group">
        <span ref={chip} className="rail-chip" style={placed ? undefined : { transition: "none" }} aria-hidden="true" />
        {pages.map((p) => <Row key={p.id} item={p} current={p.id === page} onClick={() => onPage(p.id)} />)}
      </div>
      {tools.length > 0 && (
        <>
          <hr />
          <div className="rail-group">
            {tools.map((t) => <Row key={t.id} item={t} pressed={open.includes(t.id)} onClick={() => onTool?.(t.id)} />)}
          </div>
        </>
      )}
      <div className="rail-foot">
        {foot.map((f) => <Row key={f.id} item={f} onClick={() => onFoot?.(f.id)} />)}
        <button type="button" className="rail-toggle" aria-label={wide ? "Narrow the rail" : "Widen the rail"} onClick={() => onWide(!wide)}>
          <Icon name="hide-left" size={14} />
          <span className="rail-tip">{wide ? "Narrow" : "Widen"}<kbd>Ctrl+\</kbd></span>
        </button>
      </div>
    </nav>
  );
}
