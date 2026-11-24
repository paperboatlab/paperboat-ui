// Paper, Sepia, Harbor and Contrast: the legacy kit's themes (paperboat-shared-legacy), restyled to the
// rebrand: the cursor in ink (never the accent), red only for errors, every text colour ≥ 4.5:1.
import type { EditorTheme } from "./palette.ts";

export const paper: EditorTheme = { id: "paper", label: "Paper", light: {
  dark: false, background: "#f2f2ef", foreground: "#161616", gutter: "#eaeae6", gutterText: "#66665f",
  activeLine: "rgb(0 0 0 / 0.045)", selection: "var(--code-selection)", cursor: "#161616",
  comment: "#66665f", keyword: "#6d28d9", string: "#15692f", builtin: "#0f6b64", escape: "#9a4a06", number: "#9a4a06",
  operator: "#55554f", punctuation: "#66665f", property: "#1d4ed8", function: "#1d4ed8", type: "#8a5506",
  definition: "#000000", error: "#b42318",
} };

export const sepia: EditorTheme = { id: "sepia", label: "Sepia", light: {
  dark: false, background: "#f3ead7", foreground: "#3a2f23", gutter: "#ebe0c9", gutterText: "#75664d",
  activeLine: "rgb(90 60 20 / 0.06)", selection: "rgb(120 80 30 / 0.18)", cursor: "#3a2f23",
  comment: "#75664d", keyword: "#8f3f71", string: "#4d6a14", builtin: "#246761", escape: "#93501a", number: "#93501a",
  operator: "#6b5d4b", punctuation: "#75664d", property: "#2f5f9a", function: "#2f5f9a", type: "#7a5800",
  definition: "#1f1710", error: "#b3261e",
} };

export const harbor: EditorTheme = { id: "harbor", label: "Harbor", dark: {
  dark: true, background: "#0e1621", foreground: "#c5d1de", gutter: "#0e1621", gutterText: "#7f93ab",
  activeLine: "rgb(120 170 255 / 0.06)", selection: "rgb(120 170 255 / 0.22)", cursor: "#c5d1de",
  comment: "#8296ad", keyword: "#c3a6ff", string: "#a5d68a", builtin: "#6fd3d1", escape: "#f0a35e", number: "#f5c86e",
  operator: "#8fa3ba", punctuation: "#8296ad", property: "#7fb4ff", function: "#7fb4ff", type: "#f5c86e",
  definition: "#eef3f8", error: "#ff7a85",
} };

export const contrast: EditorTheme = { id: "contrast", label: "Contrast", dark: {
  dark: true, background: "#000000", foreground: "#ffffff", gutter: "#000000", gutterText: "#a8a8a8",
  activeLine: "rgb(255 255 255 / 0.08)", selection: "rgb(255 255 255 / 0.3)", cursor: "#ffffff",
  comment: "#b0b0b0", keyword: "#ff9de2", string: "#9fef8f", builtin: "#7ff0ff", escape: "#ffb366", number: "#ffe066",
  operator: "#ffffff", punctuation: "#cfcfcf", property: "#8cc8ff", function: "#8cc8ff", type: "#ffe066",
  definition: "#ffffff", error: "#ff6b6b",
} };
