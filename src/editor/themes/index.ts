// The editor theme collection (ui-example.html "Editor colours"): Fleet (the default) and Paperboat, each
// following the app's light and dark. A user adds their own as a base plus the colours it changes. themeExtension turns a palette into CodeMirror's chrome (drawn to the rebrand: the completion's
// chosen row is tinted, never a bar beside it; an error is a red wavy line, a warning a dotted ink one) and
// its syntax highlighting.
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { fleet } from "./fleet.ts";
import { paperboat } from "./paperboat.ts";
import type { EditorPalette, EditorTheme, ThemeSpec } from "./palette.ts";

export type { EditorPalette, EditorTheme, ThemeSpec } from "./palette.ts";

/** The collection, in the order a picker lists it. */
export const EDITOR_THEMES: readonly EditorTheme[] = [fleet, paperboat];
export const DEFAULT_EDITOR_THEME = "fleet";

const byId = (id: string) => EDITOR_THEMES.find((t) => t.id === id);
const pick = (t: EditorTheme, app: "light" | "dark") => (app === "dark" ? t.dark ?? t.light : t.light ?? t.dark)!;

/** The palette a theme id shows for the app's light or dark; a user's theme starts from its base. */
export function paletteOf(id: string, app: "light" | "dark", custom: Record<string, ThemeSpec> = {}): EditorPalette {
  const own = custom[id];
  if (own) {
    const { base, label: _label, ...colours } = own;
    return { ...pick(byId(base ?? "") ?? fleet, app), ...colours };
  }
  return pick(byId(id) ?? fleet, app);
}

// Built once per palette: HighlightStyle.define mints new CSS classes every call.
const built = new Map<string, Extension>();

export function themeExtension(p: EditorPalette): Extension {
  const key = JSON.stringify(p);
  let ext = built.get(key);
  if (!ext) built.set(key, (ext = buildTheme(p)));
  return ext;
}

function buildTheme(p: EditorPalette): Extension {
  const chrome = EditorView.theme({
    "&": { height: "100%", backgroundColor: p.background, color: p.foreground },
    ".cm-content": { caretColor: p.cursor },
    // opaque: the sticky gutters sit over text scrolled sideways when wrap is off
    ".cm-gutters": { backgroundColor: p.gutter, border: "none", color: p.gutterText },
    ".cm-activeLine": { backgroundColor: p.activeLine },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: p.foreground },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: p.cursor, borderLeftWidth: "1.5px" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": { backgroundColor: p.selection },
    ".cm-selectionMatch": { backgroundColor: "var(--code-match)" },
    ".cm-searchMatch": { backgroundColor: "var(--code-match)", borderRadius: "2px" },
    ".cm-searchMatch.cm-searchMatch-selected": { outline: `1px solid ${p.foreground}` },
    ".cm-matchingBracket, .cm-nonmatchingBracket": { backgroundColor: "var(--code-match)", outline: `1px solid ${p.gutterText}` },
    // floating parts: the UI's raised surface, whatever the editor's theme
    ".cm-tooltip": { backgroundColor: "var(--surface-raised)", border: "1px solid var(--line)", color: "var(--text)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-1)", fontFamily: "var(--font-sans)", fontSize: "12.5px" },
    ".cm-tooltip.cm-tooltip-autocomplete": { overflow: "hidden", padding: "4px" },
    ".cm-tooltip-autocomplete > ul": { fontFamily: "var(--font-mono)", fontSize: "12.5px", maxHeight: "16em" },
    ".cm-tooltip-autocomplete > ul > li": { padding: "4px 8px", borderRadius: "5px", lineHeight: "1.5" },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "color-mix(in srgb, var(--accent) var(--tint), transparent)", color: "var(--text)" },
    ".cm-completionDetail": { color: "var(--text-muted)", fontStyle: "normal", fontSize: "11px", marginLeft: "10px" },
    ".cm-completionMatchedText": { textDecoration: "none", fontWeight: "700" },
    ".cm-completionIcon": { opacity: "0.7", width: "1.2em" },
    ".cm-completionInfo": { backgroundColor: "var(--surface-raised)", border: "1px solid var(--line)", color: "var(--text-muted)", padding: "6px 8px", borderRadius: "var(--radius-md)" },
    ".cm-diagnostic": { padding: "6px 10px", borderLeft: "none", fontFamily: "var(--font-sans)" },
    ".cm-diagnostic-error": { color: "var(--danger-text)" },
    ".cm-lintRange-error": { backgroundImage: "none", textDecoration: `underline wavy ${p.error}`, textUnderlineOffset: "3px", textDecorationSkipInk: "none" },
    ".cm-lintRange-warning, .cm-lintRange-info": { backgroundImage: "none", textDecoration: `underline dotted ${p.foreground}`, textUnderlineOffset: "3px" },
    ".cm-lint-marker-error": { content: "none" },
    ".cm-panels": { backgroundColor: "var(--surface-raised)", color: "var(--text)", borderColor: "var(--line)" },
    ".cm-panels-top": { borderBottom: "1px solid var(--line)" },
  }, { dark: p.dark });
  const highlight = HighlightStyle.define([
    { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: p.comment, fontStyle: "italic" },
    { tag: [tags.keyword, tags.operatorKeyword, tags.typeOperator, tags.macroName, tags.controlKeyword, tags.definitionKeyword, tags.moduleKeyword], color: p.keyword },
    { tag: [tags.string, tags.character], color: p.string },
    { tag: [tags.special(tags.string), tags.atom, tags.standard(tags.variableName)], color: p.builtin },
    { tag: tags.escape, color: p.escape },
    { tag: [tags.number, tags.bool, tags.null], color: p.number },
    { tag: tags.operator, color: p.operator },
    { tag: [tags.punctuation, tags.bracket, tags.separator], color: p.punctuation },
    { tag: tags.variableName, color: p.foreground },
    { tag: tags.propertyName, color: p.property },
    { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: p.function },
    { tag: tags.typeName, color: p.type },
    { tag: [tags.definition(tags.variableName), tags.definition(tags.typeName)], color: p.definition, fontWeight: "600" },
    { tag: [tags.heading], color: p.foreground, fontWeight: "600" },
    { tag: [tags.emphasis], fontStyle: "italic" },
    { tag: [tags.strong], fontWeight: "600" },
    { tag: [tags.link, tags.url], color: p.property, textDecoration: "underline" },
    { tag: tags.invalid, color: p.error },
  ]);
  return [chrome, syntaxHighlighting(highlight)];
}
