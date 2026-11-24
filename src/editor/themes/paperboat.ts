// Paperboat (ui-example.html "Editor colours"): few colours, each with a job. Strings blue, constants orange
// (the pair colour-blind readers separate best), definitions bold ink, comments grey italic, the rest ink,
// errors a red wavy line. Light on paper, dark on dark grey under the halation ceiling. Follows the app.
import type { EditorPalette, EditorTheme } from "./palette.ts";

const light: EditorPalette = {
  dark: false, background: "#f2f2ef", foreground: "#161616", gutter: "#f2f2ef", gutterText: "#6b6b65",
  activeLine: "#e6e6e1", selection: "var(--code-selection)", cursor: "#161616",
  comment: "#4f4f4a", keyword: "#161616", string: "#1f5596", builtin: "#8a4a10", escape: "#8a4a10", number: "#8a4a10",
  operator: "#4f4f4a", punctuation: "#4f4f4a", property: "#161616", function: "#161616", type: "#161616",
  definition: "#161616", error: "#b42318",
};
const dark: EditorPalette = {
  dark: true, background: "#222222", foreground: "#e3e3de", gutter: "#222222", gutterText: "#9a9a94",
  activeLine: "#2c2c2c", selection: "var(--code-selection)", cursor: "#e3e3de",
  comment: "#c8c8c2", keyword: "#e3e3de", string: "#a9cbf2", builtin: "#f0bd8a", escape: "#f0bd8a", number: "#f0bd8a",
  operator: "#c8c8c2", punctuation: "#c8c8c2", property: "#e3e3de", function: "#e3e3de", type: "#e3e3de",
  definition: "#e3e3de", error: "#ff6b5e",
};

export const paperboat: EditorTheme = { id: "paperboat", label: "Paperboat", light, dark };
