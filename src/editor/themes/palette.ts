// An editor theme is a palette: one flat set of colours, turned into CodeMirror's chrome and syntax
// highlighting by themeExtension (index.ts). Text colours are plain hex so the collection's test can hold
// each to ≥ 4.5:1 on its background; chrome may use the UI's tokens (selection, panels).
export type EditorPalette = {
  dark: boolean;
  background: string; foreground: string; gutter: string; gutterText: string;
  activeLine: string; selection: string; cursor: string;
  comment: string; keyword: string; string: string; builtin: string; escape: string; number: string;
  operator: string; punctuation: string; property: string; function: string; type: string;
  definition: string; error: string;
};

/** A theme of the collection: a palette for each app theme it follows (one only: it always shows that one). */
export type EditorTheme = { id: string; label: string; light?: EditorPalette; dark?: EditorPalette };

/** A user's theme ([themes.<name>] in their settings): a theme to start from and the colours it changes. */
export type ThemeSpec = Partial<EditorPalette> & { base?: string; label?: string };
