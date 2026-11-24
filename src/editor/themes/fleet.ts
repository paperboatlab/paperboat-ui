// Fleet, the default: JetBrains Fleet's dark theme (as its VS Code and Neovim ports carry it) and a light
// one with the same hues, deepened to read on white. Keywords teal, strings pink, numbers and calls amber,
// types blue, fields purple, definitions bold. Selection and the cursor's line stay the UI's. Follows the app.
import type { EditorPalette, EditorTheme } from "./palette.ts";

const dark: EditorPalette = {
  dark: true, background: "#181818", foreground: "#d1d1d1", gutter: "#181818", gutterText: "#898989",
  activeLine: "rgb(255 255 255 / 0.06)", selection: "var(--code-selection)", cursor: "#d1d1d1",
  comment: "#898989", keyword: "#82d2ce", string: "#e394dc", builtin: "#af9cff", escape: "#82d2ce", number: "#ebc88d",
  operator: "#d1d1d1", punctuation: "#d1d1d1", property: "#af9cff", function: "#ebc88d", type: "#87c3ff",
  definition: "#efefef", error: "#cc7c8a",
};
const light: EditorPalette = {
  dark: false, background: "#ffffff", foreground: "#262626", gutter: "#ffffff", gutterText: "#6e6e6e",
  activeLine: "rgb(0 0 0 / 0.04)", selection: "var(--code-selection)", cursor: "#262626",
  comment: "#6e6e6e", keyword: "#1a7a75", string: "#a8329f", builtin: "#6a4cd4", escape: "#1a7a75", number: "#8a5f00",
  operator: "#262626", punctuation: "#262626", property: "#6a4cd4", function: "#8a5f00", type: "#1f62b0",
  definition: "#000000", error: "#c62828",
};

export const fleet: EditorTheme = { id: "fleet", label: "Fleet", light, dark };
