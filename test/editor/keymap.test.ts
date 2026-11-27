import assert from "node:assert/strict";
import { test } from "node:test";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { DEFAULT_EDITOR_SETTINGS, keymapMode } from "../../src/editor/settings.ts";
import { configTemplate, readConfig } from "../../src/editor/useEditorSettings.ts";
import { patchToml } from "../../src/toml.ts";

test("the keys setting: standard by default, vim or helix from the file, anything else the default", () => {
  assert.equal(DEFAULT_EDITOR_SETTINGS.keymap, "standard");
  assert.equal(readConfig("[editor]\n").editor.keymap, "standard");
  assert.equal(readConfig('[editor]\nkeymap = "vim"\n').editor.keymap, "vim");
  assert.equal(readConfig('[editor]\nkeymap = "helix"\n').editor.keymap, "helix");
  assert.equal(readConfig('[editor]\nkeymap = "emacs"\n').editor.keymap, "standard");
  assert.equal(readConfig("[editor]\nkeymap = true\n").editor.keymap, "standard");
});

test("the keys round-trip through the config file", () => {
  const file = configTemplate({ ...DEFAULT_EDITOR_SETTINGS, keymap: "helix" });
  assert.match(file, /^keymap = "helix"/m);
  assert.deepEqual(readConfig(file).editor, { ...DEFAULT_EDITOR_SETTINGS, keymap: "helix" });
  assert.equal(readConfig(patchToml(file, "editor", { keymap: "vim" })).editor.keymap, "vim");
});

test("switching the keys reconfigures the mode's compartment in place", () => {
  const mode = new Compartment();
  const bindings = (s: EditorState) => s.facet(keymap).flat().length;
  const inputs = (s: EditorState) => s.facet(EditorView.inputHandler).length;
  const switchTo = (s: EditorState, m: "standard" | "vim" | "helix") => s.update({ effects: mode.reconfigure(keymapMode(m)) }).state;
  const standard = EditorState.create({ doc: "x = 1", extensions: mode.of(keymapMode("standard")) });
  assert.equal(bindings(standard), 0);
  assert.equal(inputs(standard), 0);
  const vim = switchTo(standard, "vim");
  assert.ok(inputs(vim) > 0, "vim's input handler");
  assert.equal(bindings(vim), 0, "vim keeps its own keys, no keymap");
  const helix = switchTo(vim, "helix");
  assert.ok(bindings(helix) > 50, "helix's keymap");
  const back = switchTo(helix, "standard");
  assert.deepEqual([bindings(back), inputs(back)], [0, 0]);
  assert.equal(back.doc.toString(), "x = 1");
});
