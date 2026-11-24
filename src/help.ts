// Help's pure half: the types every app's provider fills in, the F1 command and the matcher.
import { describe, type Chord, type Command } from "./commands.ts";

export type HelpItem = { id: string; title: string; kind?: string; summary?: string };
/** A page: `text` is plain paragraphs ("## " headings, "- " lists, `code` in backticks); `html` is sanitized before it's shown. */
export type HelpPage = { title: string; kind?: string; text?: string; html?: string; link?: { label: string; href: string } };
export type HelpProvider = {
  /** What matches the query (all of it is the app's: guides, symbols, classes, blocks). */
  items: (query: string) => HelpItem[] | Promise<HelpItem[]>;
  page: (id: string) => HelpPage | null | Promise<HelpPage | null>;
  /** A link in a page that stays in Help (`modelica://…`): the query it opens; null leaves it to the browser. */
  link?: (href: string) => string | null;
};

/** F1, in every app. */
export const HELP_CHORD: Chord = { key: "f1" };

/** The Help command, the same in every app's registry: F1, the View menu and the command search. */
export const helpCommand = (open: () => void): Command => ({
  id: "help", label: "Help…", menu: "view", group: "help", shortcut: describe(HELP_CHORD), chord: HELP_CHORD, run: open,
});

export const SHORTCUTS = "help:shortcuts";

/** The words of a query, lower-cased; an item matches when every word is in its title or summary. */
export function matches(item: HelpItem, query: string): boolean {
  const text = `${item.title} ${item.summary ?? ""} ${item.kind ?? ""}`.toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((w) => text.includes(w));
}
