// Muted colour (brand.html §14): Ink with four low-chroma hues for keywords, strings, numbers and types.
// Never the accent; red only for errors. Follows light and dark.
import { inkDark, inkLight } from "./ink.ts";
import type { EditorTheme } from "./palette.ts";

export const colour: EditorTheme = {
  id: "colour", label: "Muted colour",
  light: { ...inkLight, keyword: "#3f5a8f", string: "#4f6b2c", number: "#8a4f23", type: "#6e4a7d", builtin: "#3f5a8f", escape: "#8a4f23", keywordWeight: 500 },
  dark: { ...inkDark, keyword: "#9fb6e6", string: "#b2c98a", number: "#e2ad7f", type: "#cdb0d9", builtin: "#9fb6e6", escape: "#e2ad7f", keywordWeight: 500 },
};
