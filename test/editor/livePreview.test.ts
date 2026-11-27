import assert from "node:assert/strict";
import { test } from "node:test";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { livePreview } from "../../src/editor/livePreview.ts";

// the block decorations (front matter, embeds, $$ math, cells) as [from, to] in the text
const blocksOf = (doc: string, at = doc.length) => {
  const state = EditorState.create({ doc, selection: { anchor: at }, extensions: livePreview({
    frontMatter: "hide", cells: { langs: ["julia"], mount: () => {}, unmount: () => {} }, embeds: { mount: () => {}, unmount: () => {} },
  }) });
  const out: [number, number][] = [];
  for (const d of state.facet(EditorView.decorations)) if (typeof d !== "function") for (let c = d.iter(); c.value; c.next()) out.push([c.from, c.to]);
  return out;
};

test("live preview finds its blocks in the text: front matter, embeds, math, cells; not inside code, not where the caret is", () => {
  const doc = ["---", "id: x", "---", "# Note", "![[plot.png]]", "```", "![[not-this.png]]", "```", "$$", "x^2", "$$", "```julia", "1 + 1", "```", "end"].join("\n");
  const at = (line: number) => doc.split("\n").slice(0, line - 1).join("\n").length + (line > 1 ? 1 : 0);
  const end = (line: number) => at(line) + doc.split("\n")[line - 1].length;
  assert.deepEqual(blocksOf(doc), [[0, end(3)], [at(5), end(5)], [at(9), end(11)], [at(12), end(14)]]);
  // the caret in the cell: it is edited as text
  assert.deepEqual(blocksOf(doc, at(13)), [[0, end(3)], [at(5), end(5)], [at(9), end(11)]]);
  // a long note: the same blocks, wherever they are
  const long = `${doc}\n${Array.from({ length: 5000 }, (_, i) => `line ${i}`).join("\n")}\n![[last.png]]`;
  assert.deepEqual(blocksOf(long, at(4)).at(-1), [long.length - "![[last.png]]".length, long.length]);
});
