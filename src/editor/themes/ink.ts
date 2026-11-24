// Ink, the default (brand.html §14): weight and greys, like the rest of the UI. Follows light and dark.
import type { EditorPalette, EditorTheme } from "./palette.ts";

const light: EditorPalette = {
  dark: false, background: "#eaeae6", foreground: "#161616", gutter: "#eaeae6", gutterText: "#5f5f5a",
  activeLine: "rgb(0 0 0 / 0.05)", selection: "var(--code-selection)", cursor: "#161616",
  comment: "#4f4f4a", keyword: "#161616", string: "#161616", builtin: "#161616", escape: "#4f4f4a", number: "#161616",
  operator: "#4f4f4a", punctuation: "#4f4f4a", property: "#161616", function: "#161616", type: "#161616",
  definition: "#161616", error: "#b42318", keywordWeight: 600,
};
const dark: EditorPalette = {
  ...light, dark: true, background: "#1a1a1a", foreground: "#e3e3de", gutter: "#1a1a1a", gutterText: "#a3a39d",
  activeLine: "rgb(255 255 255 / 0.05)", cursor: "#e3e3de",
  comment: "#bdbdb8", keyword: "#e3e3de", string: "#e3e3de", builtin: "#e3e3de", escape: "#bdbdb8", number: "#e3e3de",
  operator: "#bdbdb8", punctuation: "#bdbdb8", property: "#e3e3de", function: "#e3e3de", type: "#e3e3de",
  definition: "#e3e3de", error: "#ff5c4d",
};

export const ink: EditorTheme = { id: "ink", label: "Ink", light, dark };
export { light as inkLight, dark as inkDark };
