// The org's docs in Help: every docs site (paperboatlab.github.io) publishes a help.json, its
// pages split by section, and the root's sites.json lists them. An app picks the sites it wants
// (Simplicial: the engine and the toolkits; another app: its own and the engine's) and Help
// searches them with the app's own topics. docs/site/helpjson.py in paperboat writes the files.
import type { HelpItem, HelpPage, HelpProvider } from "./help.ts";

export const DOCS_URL = "https://paperboatlab.github.io/";

/** `block`: a block's page; Help leaves it out, as the app draws its blocks from the live catalog. */
export type DocItem = { id: string; title: string; page: string; url: string; summary: string; html: string; block?: string };
/** One site's help.json. `blocks` is a block's prose by type, for a toolkit. */
export type DocSite = { site: string; title: string; url: string; items: DocItem[]; blocks?: Record<string, string> };
/** An entry of sites.json: `help` is its help.json, relative to the root. */
export type SiteEntry = { site: string; title: string; kind: string; help?: string };

type Fetch = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

/** The sites `want` picks, loaded from `base`; a site that fails to load is left out. */
export async function loadDocs(want: (site: SiteEntry) => boolean, base = DOCS_URL, get: Fetch = fetch): Promise<DocSite[]> {
  const json = async (url: string) => {
    const res = await get(url);
    if (!res.ok) throw new Error(`${url}: ${"status" in res ? res.status : "failed"}`);
    return res.json();
  };
  const sites = (await json(new URL("sites.json", base).href)) as SiteEntry[];
  const loaded = await Promise.allSettled(sites.filter((s) => s.help && want(s)).map((s) => json(new URL(s.help!, base).href)));
  return loaded.flatMap((r) => (r.status === "fulfilled" ? [r.value as DocSite] : []));
}

const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").toLowerCase();

/** How well an item answers the words: 0 all in its title … 3 all in its text; null if not all anywhere. */
export function rankDoc(words: string[], item: DocItem, text: string): number | null {
  const has = (hay: string) => words.every((w) => hay.includes(w));
  const title = item.title.toLowerCase();
  if (has(title)) return 0;
  if (has(`${title} ${item.page.toLowerCase()}`)) return 1;
  if (has(`${title} ${item.summary.toLowerCase()}`)) return 2;
  return has(text) ? 3 : null;
}

const MAX = 60;
const DOC = "doc:";
const OFFLINE = "doc:offline";

/**
 * Help over loaded docs sites. With no query it lists each page once (a contents); with one, the
 * sections that have every word, best first. If nothing loaded, one topic says so and links the site.
 */
export function docsHelp(docs: Promise<DocSite[]> | (() => Promise<DocSite[]>), base = DOCS_URL): HelpProvider & { blockProse: (type: string, group?: string) => Promise<string | undefined> } {
  const index = (sites: DocSite[]) => {
    const all = sites.flatMap((s) => s.items.filter((item) => !item.block).map((item) => ({ site: s, item, id: `${DOC}${s.site}:${item.id}`, text: plain(item.html) })));
    return { sites, all, byId: new Map(all.map((e) => [e.id, e])) };
  };
  // A function is called on the first look, so an app fetches nothing until Help is used.
  let pending: Promise<ReturnType<typeof index>> | undefined;
  // link() is synchronous: it reads what has loaded by the time a page with links is shown.
  let loaded: ReturnType<typeof index> | undefined;
  const ready = () =>
    (pending ??= (typeof docs === "function" ? docs() : docs).catch(() => [] as DocSite[]).then((sites) => (loaded = index(sites))));
  const topic = (e: { site: DocSite; item: DocItem; id: string }): HelpItem => ({
    id: e.id, title: e.item.title, kind: e.site.title,
    summary: e.item.page === e.item.title ? e.item.summary : `${e.item.page} · ${e.item.summary}`,
  });
  return {
    async items(query) {
      const { sites, all } = await ready();
      if (!sites.length) return [{ id: OFFLINE, title: "Documentation unavailable", kind: "docs", summary: "open the docs online" }];
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      if (!words.length) return all.filter((e) => !e.item.id.includes("#")).slice(0, MAX).map(topic);
      return all
        .map((e) => ({ e, r: rankDoc(words, e.item, e.text) }))
        .filter((x): x is { e: (typeof all)[number]; r: number } => x.r !== null)
        .sort((a, b) => a.r - b.r)
        .slice(0, MAX)
        .map((x) => topic(x.e));
    },
    async page(id): Promise<HelpPage | null> {
      if (id === OFFLINE)
        return { title: "Documentation unavailable", kind: "docs", text: "Help couldn't load the documentation. Check the connection, or read it online.", link: { label: "Open the docs", href: base } };
      const e = (await ready()).byId.get(id);
      return e ? { title: e.item.title, kind: e.item.page === e.item.title ? e.site.title : e.item.page, html: e.item.html, link: { label: "Open online", href: e.item.url } } : null;
    },
    link(href) {
      // A link to another loaded page stays in Help: its title is the query that opens it.
      const hit = loaded?.all.find((e) => e.item.url === href || e.item.url === href.split("#")[0]);
      return hit ? hit.item.title : null;
    },
    async blockProse(type, group) {
      const { sites } = await ready();
      const own = sites.find((s) => s.site === `toolkits/${group}`);
      return own?.blocks?.[type] ?? sites.find((s) => s.blocks?.[type])?.blocks?.[type];
    },
  };
}

/** Several providers as one: their items in order, the first page and link that answer. */
export function combineHelp(...providers: HelpProvider[]): HelpProvider {
  return {
    async items(query) {
      return (await Promise.all(providers.map((p) => p.items(query)))).flat();
    },
    async page(id) {
      for (const p of providers) {
        const got = await p.page(id);
        if (got) return got;
      }
      return null;
    },
    link(href) {
      for (const p of providers) {
        const got = p.link?.(href);
        if (got) return got;
      }
      return null;
    },
  };
}
