// Help, the one entry point every app shares: the Help key in the top bar and F1 open the same
// window (search, a list, a page). The app only says what it documents (a HelpProvider): Julia
// docstrings in MX, Modelica class docs in OM, block references in Paperboat. The keyboard
// shortcuts page is built here from the app's command registry, so it can't drift from the menus.
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type { Command } from "./commands.ts";
import { matches, SHORTCUTS, type HelpItem, type HelpPage, type HelpProvider } from "./help.ts";
import { Dialog } from "./Dialog.tsx";

const DROP = "script, style, iframe, object, embed, link, meta, form, input, button, textarea, select, base";

/** Docs HTML from a package or a library, made inert: no scripts, handlers or javascript: links. */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll(DROP).forEach((el) => el.remove());
  for (const el of doc.body.querySelectorAll("*")) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on") || name === "style" || ((name === "href" || name === "src") && /^(javascript|data|vbscript):/.test(value))) el.removeAttribute(attr.name);
    }
    if (el.tagName === "A") {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    }
  }
  return doc.body.innerHTML;
}

/** Plain text: blank lines split paragraphs, "## " starts a heading, "- " a list item, `code` in backticks. */
function TextPage({ text }: { text: string }) {
  const inline = (s: string) => s.split("`").map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));
  return (
    <>
      {text.split(/\n\s*\n/).map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim());
        if (lines.length === 1 && lines[0].startsWith("## ")) return <h3 key={i}>{inline(lines[0].slice(3))}</h3>;
        if (lines.length && lines.every((l) => l.trimStart().startsWith("- ")))
          return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.trimStart().slice(2))}</li>)}</ul>;
        return <p key={i}>{inline(lines.join(" "))}</p>;
      })}
    </>
  );
}

function shortcutsPage(commands: Command[]): HelpPage {
  const keyed = commands.filter((c) => c.shortcut);
  return { title: "Keyboard shortcuts", kind: "guide", text: keyed.map((c) => `- \`${c.shortcut}\` ${c.label.replace(/…$/, "")}`).join("\n") || "No shortcuts." };
}

/**
 * The Help window: a search field, what matches on the left, the chosen page on the right.
 * `query` opens it on something (F1 on a word, a selected block); an exact title match opens that page.
 */
export function HelpWindow({ app, provider, commands = [], query: initial = "", onClose }: {
  /** The app's name, in the head. */
  app: string;
  provider: HelpProvider;
  /** The app's command registry, for the keyboard shortcuts page. */
  commands?: Command[];
  query?: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initial);
  const [items, setItems] = useState<HelpItem[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [page, setPage] = useState<HelpPage | null>(null);
  const [loading, setLoading] = useState(false);
  const shortcuts = useMemo<HelpItem>(() => ({ id: SHORTCUTS, title: "Keyboard shortcuts", kind: "guide", summary: "every key the menus know" }), []);

  useEffect(() => {
    let live = true;
    void Promise.resolve(provider.items(query.trim())).then((got) => {
      if (!live) return;
      const list = [...got, ...(commands.length && matches(shortcuts, query) ? [shortcuts] : [])];
      setItems(list);
      setChosen((prev) => {
        if (prev && list.some((i) => i.id === prev)) return prev;
        const q = query.trim();
        return (list.find((i) => i.title === q) ?? list.find((i) => i.title.toLowerCase() === q.toLowerCase()) ?? list[0])?.id ?? null;
      });
    });
    return () => { live = false; };
  }, [query, provider]);

  useEffect(() => {
    if (!chosen) { setPage(null); return; }
    let live = true;
    setLoading(true);
    void Promise.resolve(chosen === SHORTCUTS ? shortcutsPage(commands) : provider.page(chosen)).then((got) => {
      if (!live) return;
      setPage(got);
      setLoading(false);
    });
    return () => { live = false; };
  }, [chosen, provider]);

  const html = useMemo(() => (page?.html ? sanitizeHtml(page.html) : ""), [page]);
  const at = items.findIndex((i) => i.id === chosen);
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const next = items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % Math.max(1, items.length)];
    if (next) setChosen(next.id);
  };

  return (
    <Dialog title="Help" tags={[app]} wide className="tall help-window" onClose={onClose}>
      <div className="help-search">
        <input autoFocus type="search" value={query} placeholder="Search help" aria-label="Search help" spellCheck={false} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey} />
      </div>
      <div className="help-body">
        <ul className="help-list" role="listbox" aria-label="Help topics">
          {items.map((item) => (
            <li key={item.id} role="option" aria-selected={item.id === chosen} className={item.id === chosen ? "on" : ""} onClick={() => setChosen(item.id)}>
              <b>{item.title}</b>
              {item.kind && <span className="help-kind">{item.kind}</span>}
              {item.summary && <small>{item.summary}</small>}
            </li>
          ))}
          {items.length === 0 && <li className="help-empty">Nothing matches “{query}”.</li>}
        </ul>
        <article className="help-page" aria-live="polite" aria-busy={loading}>
          {page ? (
            <>
              <header>
                <h2>{page.title}</h2>
                {page.kind && <span className="help-kind">{page.kind}</span>}
              </header>
              {page.text && <TextPage text={page.text} />}
              {html && (
                <div
                  className="help-html"
                  dangerouslySetInnerHTML={{ __html: html }}
                  onClick={(e) => {
                    const href = (e.target as HTMLElement).closest("a")?.getAttribute("href");
                    const next = href ? provider.link?.(href) : null;
                    if (next) { e.preventDefault(); setQuery(next); setChosen(null); }
                  }}
                />
              )}
              {page.link && <p><a href={page.link.href} target="_blank" rel="noopener noreferrer">{page.link.label} ↗</a></p>}
            </>
          ) : (
            <p className="help-empty">{loading ? "Loading…" : chosen ? "No documentation found." : "Type a name to look it up."}</p>
          )}
        </article>
      </div>
    </Dialog>
  );
}
