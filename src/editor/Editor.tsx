// The code editor (brand.html §14): CodeMirror 6 with a theme from the collection (themes/), the user's
// settings, a language from lang/ (its grammar, and its lint and completion through the app's runtime
// session when it has one), find (Ctrl+F, docked at the top), a git gutter and the cursor readout.
// From the legacy kit's CodeEditor; the app no longer passes a grammar or a linter, only a language.
import { useEffect, useRef } from "react";
import { Compartment, EditorState, Prec, type Extension } from "@codemirror/state";
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  drawSelection, dropCursor, rectangularSelection, crosshairCursor, type KeyBinding,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, type CompletionContext, type CompletionSource } from "@codemirror/autocomplete";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { gitGutter } from "./gitGutter.ts";
import type { Language, Session } from "./language.ts";
import { paletteOf, themeExtension, type ThemeSpec } from "./themes/index.ts";

export type EditorSettings = {
  /** A theme of the collection (fleet, paperboat) or one of the user's `themes`. */
  theme: string;
  fontSize: number;
  font: "geist" | "system" | "serif";
  lineHeight: number;
  tabSize: number;
  wrap: boolean;
  autocomplete: boolean;
  brackets: boolean;
  lint: boolean;
  /** The user's own themes: a base and the colours it changes. */
  themes?: Record<string, ThemeSpec>;
};

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  theme: "fleet", fontSize: 12.5, font: "geist", lineHeight: 20,
  tabSize: 4, wrap: false, autocomplete: true, brackets: true, lint: true,
};

const FONTS: Record<EditorSettings["font"], string> = {
  geist: "var(--font-mono)",
  system: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  serif: "ui-serif, Georgia, Cambria, serif",
};

const geometry = (s: EditorSettings) => EditorView.theme({
  ".cm-scroller": { fontFamily: FONTS[s.font], fontSize: `${s.fontSize}px`, lineHeight: `${s.lineHeight}px` },
  ".cm-content": { padding: "6px 0" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 6px 0 12px" },
});

const KIND: Record<string, string> = { function: "function", variable: "variable", keyword: "keyword", type: "type", constant: "constant", text: "text" };

/** The language's lint, as CodeMirror diagnostics; quiet while the code is being typed (400 ms). */
const lintOf = (language: Language, session?: Session): Extension =>
  language.lint
    ? [lintGutter(), linter(async (view): Promise<Diagnostic[]> => {
        try {
          return await language.lint!(view.state.doc.toString(), session);
        } catch {
          return [];  // the runtime went away mid-request: no marks rather than stale ones
        }
      }, { delay: 400 })]
    : [];

const completionOf = (language: Language, session?: Session): CompletionSource | null =>
  language.complete
    ? async (ctx: CompletionContext) => {
        if (!ctx.explicit && !ctx.matchBefore(/[\w.]{2,}$/u)) return null;
        const r = await language.complete!(ctx.state.doc.toString(), ctx.pos, session).catch(() => null);
        return r && { from: r.from, to: r.to, options: r.options.map((o) => ({ label: o.label, detail: o.detail, type: KIND[o.kind ?? ""] })) };
      }
    : null;

export type EditorPos = { line: number; col: number; selected: number };

export type EditorProps = {
  value: string;
  onChange?: (value: string) => void;
  /** The file's language (`languageFor(name)`); read at mount. */
  language: Language;
  /** The runtime session that lints and completes it, when one runs; may come and go. */
  session?: Session;
  settings: EditorSettings;
  appTheme: "light" | "dark";
  ariaLabel: string;
  /** Keys above the defaults (run cell…); read at mount, so bind through refs. */
  keys?: readonly KeyBinding[];
  /** The app's own completion sources (Simplicial's block names, say), beside the language's. */
  completions?: readonly CompletionSource[];
  /** Anything else of the app's; reconfigured when it changes identity (memoise it). */
  extra?: Extension;
  /** HEAD's copy of this file for the git gutter; null when untracked or outside a repository. */
  base?: string | null;
  readOnly?: boolean;
  onPos?: (pos: EditorPos) => void;
  onView?: (view: EditorView | null) => void;
};

const posOf = (state: EditorState): EditorPos => {
  const sel = state.selection.main;
  const line = state.doc.lineAt(sel.head);
  return { line: line.number, col: sel.head - line.from + 1, selected: sel.to - sel.from };
};

/** One document; remount (`key`) for another. `value` is the initial text, then the editor owns it. */
export function Editor({
  value, onChange, language, session, settings, appTheme, ariaLabel, keys, completions, extra, base, readOnly, onPos, onView,
}: EditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const pos = useRef(onPos);
  pos.current = onPos;
  const c = useRef({
    theme: new Compartment(), font: new Compartment(), wrap: new Compartment(), tab: new Compartment(),
    auto: new Compartment(), brackets: new Compartment(), lint: new Compartment(), git: new Compartment(),
    extra: new Compartment(), readOnly: new Compartment(),
  }).current;

  const themeExt = () => themeExtension(paletteOf(settings.theme, appTheme, settings.themes));
  const autoExt = () => {
    const sources = [completionOf(language, session), ...(completions ?? [])].filter((s): s is CompletionSource => !!s);
    return settings.autocomplete && sources.length ? autocompletion({ override: sources, activateOnTyping: true, icons: true }) : [];
  };
  const bracketExt = () => (settings.brackets ? [bracketMatching(), closeBrackets()] : []);
  const lintExt = () => (settings.lint ? lintOf(language, session) : []);
  const gitExt = () => (base != null ? gitGutter(base) : []);
  const readOnlyExt = () => (readOnly ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : []);

  useEffect(() => {
    const instance = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(), history(), drawSelection(), dropCursor(),
          rectangularSelection(), crosshairCursor(), indentOnInput(), highlightSelectionMatches(), search({ top: true }),
          Prec.high(keymap.of([...(keys ?? [])])),
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab, ...closeBracketsKeymap, ...completionKeymap]),
          language.grammar(),
          c.theme.of(themeExt()),
          c.font.of(geometry(settings)),
          c.wrap.of(settings.wrap ? EditorView.lineWrapping : []),
          c.tab.of(EditorState.tabSize.of(settings.tabSize)),
          c.auto.of(autoExt()),
          c.brackets.of(bracketExt()),
          c.lint.of(lintExt()),
          c.git.of(gitExt()),
          c.extra.of(extra ?? []),
          c.readOnly.of(readOnlyExt()),
          EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) change.current?.(u.state.doc.toString());
            if (u.docChanged || u.selectionSet) pos.current?.(posOf(u.state));
          }),
        ],
      }),
      parent: host.current!,
    });
    view.current = instance;
    onView?.(instance);
    pos.current?.(posOf(instance.state));
    return () => {
      onView?.(null);
      instance.destroy();
      view.current = null;
    };
    // One document per mount: the caller remounts with `key` for another file.
  }, []);

  useEffect(() => {
    view.current?.dispatch({
      effects: [
        c.theme.reconfigure(themeExt()),
        c.font.reconfigure(geometry(settings)),
        c.wrap.reconfigure(settings.wrap ? EditorView.lineWrapping : []),
        c.tab.reconfigure(EditorState.tabSize.of(settings.tabSize)),
        c.auto.reconfigure(autoExt()),
        c.brackets.reconfigure(bracketExt()),
        c.lint.reconfigure(lintExt()),
      ],
    });
  }, [settings, appTheme, session]);

  useEffect(() => { view.current?.dispatch({ effects: c.git.reconfigure(gitExt()) }); }, [base]);
  useEffect(() => { view.current?.dispatch({ effects: c.extra.reconfigure(extra ?? []) }); }, [extra]);
  useEffect(() => { view.current?.dispatch({ effects: c.readOnly.reconfigure(readOnlyExt()) }); }, [readOnly]);

  return <div className="pb-editor" ref={host} />;
}
