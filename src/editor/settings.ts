// The editor's settings (kept in the config file by useEditorSettings) and the keys' modes: Standard,
// Vim (@replit/codemirror-vim) or Helix (codemirror-helix), each with its status line under the code.
import { Facet, type Extension } from "@codemirror/state";
import type { Command, EditorView } from "@codemirror/view";
import { vim, Vim } from "@replit/codemirror-vim";
import { helix, commands as helixCommands } from "codemirror-helix";
import type { ThemeSpec } from "./themes/index.ts";

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
  /** The keys: Standard, or Vim's or Helix's modes. */
  keymap: "standard" | "vim" | "helix";
  /** The user's own themes: a base and the colours it changes. */
  themes?: Record<string, ThemeSpec>;
};

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  theme: "fleet", fontSize: 12.5, font: "geist", lineHeight: 20,
  tabSize: 4, wrap: false, autocomplete: true, brackets: true, lint: true, keymap: "standard",
};

/** The app's Save (its Mod-s key), which `:w` runs. */
export const saveKey = Facet.define<Command, Command | undefined>({ combine: (v) => v[0] });
const save = (view: EditorView) => view.state.facet(saveKey)?.(view) ?? false;
Vim.defineEx("write", "w", (cm) => { save(cm.cm6!); });  // Vim's ex commands are global: the view comes with the call

/** The keys of `mode`: nothing for Standard, else the mode and its status line (NORMAL, INSERT…, the `:` line). */
export const keymapMode = (mode: EditorSettings["keymap"]): Extension =>
  mode === "vim" ? vim({ status: true })
  : mode === "helix" ? [helix(), helixCommands.of([{ name: "write", aliases: ["w"], help: "Save the file", handler: (view) => (save(view) ? undefined : { message: "Nothing to save here", error: true }) }])]
  : [];
