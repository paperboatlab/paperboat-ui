// The page rail (REBRAND "Simplicial keeps the old app's frame"): the app's pages only, icons alone sharing
// the rail's height; hovering or focusing one, its chip grows to say what it is (name and keys); the current
// one is raised, never bracketed or barred. For an app whose tools live in its bar and menus. Where every page
// is in view at once (Simplicial's Commander and Lookout) it steps aside (`aside`). A page that can't open
// stays, greyed, and says why.
import { Icon } from "./Icon.tsx";
import type { RailItem } from "./Rail.tsx";
import { Spinner } from "./Spinner.tsx";

export type PageRailItem = RailItem & {
  /** Why the page can't open now (it stays, greyed). */
  why?: string;
};

export function PageRail({ label, pages, page, onPage, aside }: {
  label: string;
  pages: PageRailItem[];
  page: string;
  onPage: (id: string) => void;
  aside?: boolean;
}) {
  return (
    <nav className={`page-rail${aside ? " aside" : ""}`} aria-label={label} aria-hidden={aside || undefined} inert={aside || undefined}>
      {pages.map((p) => {
        const err = typeof p.count === "string" && p.count.endsWith("!");
        return (
          <button
            key={p.id}
            type="button"
            className="page-rail-item"
            aria-current={p.id === page ? "page" : undefined}
            aria-disabled={p.why ? true : undefined}
            aria-label={p.why ? `${p.label}: ${p.why}` : p.label}
            onClick={() => { if (!p.why) onPage(p.id); }}
          >
            <span className="page-rail-chip">
              <Icon name={p.icon} />
              <span>{p.why ? `${p.label} · ${p.why}` : p.label}</span>
              {p.keys && !p.why && <kbd>{p.keys}</kbd>}
            </span>
            {p.count === "live" && <span className="rail-count attention"><Spinner size={10} /></span>}
            {err && <span className="rail-count error attention">{String(p.count).slice(0, -1)}</span>}
          </button>
        );
      })}
    </nav>
  );
}
