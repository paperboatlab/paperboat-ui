// A language's `\name` abbreviations (Julia's \alpha → α, \:smile: → 😄): Tab turns the name before the cursor
// into its symbol, as Julia's REPL does, and typing `\al` offers the names that start so. Both work with no
// runtime session, so Unicode can be typed before Julia starts.
import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import type { EditorView } from "@codemirror/view";

export type Abbreviations = ReadonlyMap<string, string>;

/** The table from "name<Tab>symbol" lines. */
export const parseAbbreviations = (lines: string): Abbreviations =>
  new Map(lines.split("\n").filter(Boolean).map((l) => { const t = l.indexOf("\t"); return [l.slice(0, t), l.slice(t + 1)] as const; }));

/** The `\name` that ends at `pos`, with where it starts; null when there is none. */
export function abbreviationAt(text: string, pos: number): { from: number; name: string } | null {
  const m = /\\[^\s\\"'`[\]{},;]*$/u.exec(text.slice(Math.max(0, pos - 64), pos));
  return m ? { from: pos - m[0].length, name: m[0] } : null;
}

/** Tab: the name before the cursor becomes its symbol. False when it isn't one (Tab indents instead). */
export function expandAbbreviation(view: EditorView, table: Abbreviations): boolean {
  const { state } = view;
  const sel = state.selection.main;
  if (!sel.empty) return false;
  const line = state.doc.lineAt(sel.head);
  const at = abbreviationAt(line.text, sel.head - line.from);
  const symbol = at && table.get(at.name);
  if (!at || !symbol) return false;
  const from = line.from + at.from;
  view.dispatch({ changes: { from, to: sel.head, insert: symbol }, selection: { anchor: from + symbol.length }, userEvent: "input.complete" });
  return true;
}

const LIMIT = 200;

/** The names that start with what was typed after `\` (two characters at least: `\n` in a string asks nothing), each shown with its symbol. */
export const abbreviationSource = (table: Abbreviations) => (ctx: CompletionContext): CompletionResult | null => {
  const line = ctx.state.doc.lineAt(ctx.pos);
  const at = abbreviationAt(line.text, ctx.pos - line.from);
  if (!at || (at.name.length < 3 && !ctx.explicit)) return null;
  const options = [];
  for (const [name, symbol] of table) {
    if (!name.startsWith(at.name)) continue;
    options.push({ label: name, detail: symbol, apply: symbol, type: "constant" });
    if (options.length >= LIMIT) break;
  }
  return options.length ? { from: line.from + at.from, options, filter: false } : null;
};
