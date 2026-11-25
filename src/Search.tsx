// The floating search (REBRAND "Floating search"): one component for command search (Ctrl+K, top
// centre, over everything) and its scopes. A field, scopes as a segmented choice (Tab steps), grouped
// results with fuzzy matching (matched letters in the accent text), the selected row tinted, and a
// fixed key footer. Unavailable commands stay, greyed, with why. Esc closes; focus returns. Given `at`, it is
// quick add: the same search floating at the cursor (no scrim), its Enter saying what it does (`action`).
import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useDismiss, useFocusReturn } from "./dismiss.tsx";
import { fuzzy } from "./fuzzy.ts";
import { Icon } from "./Icon.tsx";
import type { IconName } from "./icons.ts";

export type SearchItem = {
  id: string;
  label: string;
  group: string;
  icon?: IconName;
  /** Small text after the label (a usage, a path). */
  detail?: string;
  shortcut?: string;
  scope?: string;
  disabled?: boolean;
  why?: string;
  run: () => void;
};

function Marked({ text, at }: { text: string; at: number[] }) {
  if (!at.length) return <>{text}</>;
  const on = new Set(at);
  const parts: { s: string; m: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const m = on.has(i);
    if (parts.length && parts[parts.length - 1].m === m) parts[parts.length - 1].s += text[i];
    else parts.push({ s: text[i], m });
  }
  return <>{parts.map((p, i) => (p.m ? <mark key={i}>{p.s}</mark> : <span key={i}>{p.s}</span>))}</>;
}

export function Search({ items, scopes = [], placeholder = "Search commands", at, action = "run", onClose }: {
  items: SearchItem[];
  /** e.g. ["All", "Commands", "Files"]: the first shows everything. */
  scopes?: string[];
  placeholder?: string;
  /** Quick add: where it floats (the cursor, in the viewport); no scrim. */
  at?: { x: number; y: number };
  /** What Enter does, in the footer ("run", "add here"). */
  action?: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState(scopes[0]);
  const [sel, setSel] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useDismiss(box, () => onClose());
  useFocusReturn();

  const results = useMemo(() => {
    const inScope = items.filter((it) => !scope || scope === scopes[0] || it.scope === scope);
    const hits = inScope.flatMap((it, order) => {
      const m = fuzzy(query, it.label);
      return m ? [{ it, at: m.at, score: m.score + (it.disabled ? 100 : 0), order }] : [];
    });
    if (query) hits.sort((a, b) => a.score - b.score || a.order - b.order);
    return hits;
  }, [items, query, scope, scopes]);

  const run = (n: number) => {
    const r = results[n];
    if (!r || r.it.disabled) return;
    onClose();
    r.it.run();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const d = e.key === "ArrowDown" ? 1 : -1;
      setSel((s) => (results.length ? (s + d + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(sel);
    } else if (e.key === "Tab" && scopes.length > 1) {
      e.preventDefault();
      const i = scopes.indexOf(scope ?? scopes[0]);
      setScope(scopes[(i + (e.shiftKey ? -1 : 1) + scopes.length) % scopes.length]);
      setSel(0);
    }
  };

  let lastGroup = "";
  return (
    <div className={`search${at ? " at" : ""}`} data-own-keys style={at ? ({ "--search-x": `${at.x}px`, "--search-y": `${at.y}px` } as CSSProperties) : undefined}>
      {!at && <div className="search-scrim" />}
      <div ref={box} className="search-box" role="dialog" aria-label="Search">
        <label className="search-field">
          <Icon name="search" />
          <input
            autoFocus
            value={query}
            placeholder={placeholder}
            onChange={(e) => { setQuery(e.target.value); setSel(0); }}
            onKeyDown={onKey}
            role="combobox"
            aria-expanded="true"
            aria-controls="pb-search-list"
            aria-activedescendant={results[sel] ? `pb-search-${results[sel].it.id}` : undefined}
          />
          {scope && scope !== scopes[0] && <span className="search-scope">{scope}</span>}
          <kbd className="pb-kbd">Esc</kbd>
        </label>
        {scopes.length > 1 && (
          <div className="tabs" role="tablist" aria-label="Scope" style={{ height: 34 }}>
            {scopes.map((s) => (
              <button key={s} type="button" role="tab" aria-selected={s === scope} tabIndex={-1} onClick={() => { setScope(s); setSel(0); }}>{s}</button>
            ))}
          </div>
        )}
        <div className="search-list" id="pb-search-list" role="listbox">
          {results.length === 0 && <div className="search-empty">Nothing matches “{query}”</div>}
          {results.map((r, n) => {
            const head = !query && r.it.group !== lastGroup ? (lastGroup = r.it.group) : undefined;
            return (
              <div key={r.it.id}>
                {head && <div className="search-group">{head}</div>}
                <div
                  id={`pb-search-${r.it.id}`}
                  className={`search-row${r.it.disabled ? " unavailable" : ""}`}
                  role="option"
                  aria-selected={n === sel}
                  aria-disabled={r.it.disabled || undefined}
                  title={r.it.disabled ? r.it.why : undefined}
                  onMouseMove={() => setSel(n)}
                  onClick={() => run(n)}
                >
                  {r.it.icon ? <Icon name={r.it.icon} /> : <span />}
                  <span><Marked text={r.it.label} at={r.at} />{r.it.detail && <small>{r.it.detail}</small>}</span>
                  {r.it.shortcut ? <kbd className="pb-kbd">{r.it.shortcut}</kbd> : <span />}
                </div>
              </div>
            );
          })}
        </div>
        <div className="search-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
          <span><kbd>Enter</kbd> {action}</span>
          {scopes.length > 1 && <span><kbd>Tab</kbd> scope</span>}
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
