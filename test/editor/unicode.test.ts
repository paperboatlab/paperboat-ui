// Unicode in the editor: what is typed (any script, astral characters, IME and dead keys end as the same input
// transactions), Julia's \alpha<Tab> with and without a session, and the bytes the runtime counts.
import assert from "node:assert/strict";
import { test } from "node:test";
import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState, type TransactionSpec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { abbreviationAt, abbreviationSource, expandAbbreviation, parseAbbreviations } from "../../src/editor/abbreviations.ts";
import { fromBytes, runtimeComplete, runtimeLint, toBytes } from "../../src/editor/language.ts";
import { julia } from "../../src/editor/lang/index.ts";
import { livePreview } from "../../src/editor/livePreview.ts";

const TEXT = ["é", "α", "∑", "中文", "😀", "x̂", "👩‍🔬", "\uFEFF", "ß∀ℝ₁²"];

/** A view without a DOM: the state, and dispatch applying to it, which is all the commands here use. */
function fakeView(doc: string, at = doc.length) {
  const v = { state: EditorState.create({ doc, selection: { anchor: at } }) } as { state: EditorState; dispatch: (t: TransactionSpec) => void };
  v.dispatch = (t) => { v.state = v.state.update(t).state; };
  return v as unknown as EditorView & { state: EditorState };
}

test("typing any script, astral characters included, keeps every UTF-16 unit and the cursor after it", () => {
  let s = EditorState.create({ doc: "x = 1\n", selection: { anchor: 6 } });
  for (const t of TEXT) s = s.update({ changes: { from: s.selection.main.head, insert: t }, selection: { anchor: s.selection.main.head + t.length }, userEvent: "input.type" }).state;
  const typed = TEXT.join("");
  assert.equal(s.doc.toString(), `x = 1\n${typed}`);
  assert.equal(s.selection.main.head, s.doc.length);
  assert.equal(new TextDecoder().decode(new TextEncoder().encode(s.doc.toString())), s.doc.toString(), "survives UTF-8");
  // CRLF files keep their line breaks: CodeMirror splits on them and joins with what it found
  const crlf = EditorState.create({ doc: "α\r\nβ\r\n" });
  assert.equal(crlf.doc.lines, 3);
  assert.equal(crlf.doc.toString(), "α\nβ\n");
  assert.equal(crlf.doc.sliceString(0, crlf.doc.length, "\r\n"), "α\r\nβ\r\n");
});

test("Julia's table: \\alpha, \\:smile:, sub- and superscripts, combining marks", () => {
  const table = julia.abbreviations!();
  assert.ok(table.size > 3000);
  assert.equal(table.get("\\alpha"), "α");
  assert.equal(table.get("\\sum"), "∑");
  assert.equal(table.get("\\:smile:"), "😄");
  assert.equal(table.get("\\_1"), "₁");
  assert.equal(table.get("\\^("), "⁽");
  assert.equal(table.get("\\hat"), "\u0302");
  assert.equal(julia.abbreviations!(), table, "parsed once");
  assert.deepEqual(parseAbbreviations("\\a\tα\n\\b\tβ\n"), new Map([["\\a", "α"], ["\\b", "β"]]));
});

test("the \\name before the cursor", () => {
  assert.deepEqual(abbreviationAt("x = \\alpha", 10), { from: 4, name: "\\alpha" });
  assert.deepEqual(abbreviationAt("f(\\beta", 7), { from: 2, name: "\\beta" });
  assert.deepEqual(abbreviationAt("\\x\\alpha", 8), { from: 2, name: "\\alpha" });
  assert.deepEqual(abbreviationAt("y\\^(", 4), { from: 1, name: "\\^(" });
  assert.equal(abbreviationAt("alpha", 5), null);
  assert.equal(abbreviationAt("\\alpha x", 8), null);
});

test("Tab turns \\alpha into α with no session, an emoji too, and leaves anything else to indent", () => {
  const table = julia.abbreviations!();
  const v = fakeView("θ = \\alpha");
  assert.equal(expandAbbreviation(v, table), true);
  assert.equal(v.state.doc.toString(), "θ = α");
  assert.equal(v.state.selection.main.head, 5);
  const e = fakeView("s = \"\\:smile:");
  assert.equal(expandAbbreviation(e, table), true);
  assert.equal(e.state.doc.toString(), "s = \"😄");
  assert.equal(e.state.selection.main.head, e.state.doc.length, "after both halves of the surrogate pair");
  const mid = fakeView("\\alpha + 1", 6);
  assert.equal(expandAbbreviation(mid, table), true);
  assert.equal(mid.state.doc.toString(), "α + 1");
  for (const doc of ["x = 1", "\\nosuchname", "x = \\"]) assert.equal(expandAbbreviation(fakeView(doc), table), false, doc);
});

test("typing \\al offers the names that start so, each applying its symbol", () => {
  const source = abbreviationSource(julia.abbreviations!());
  const at = (doc: string, explicit = false) => {
    const state = EditorState.create({ doc });
    return source(new CompletionContext(state, doc.length, explicit));
  };
  const r = at("x = \\alp")!;
  assert.equal(r.from, 4);
  const alpha = r.options.find((o) => o.label === "\\alpha")!;
  assert.deepEqual([alpha.detail, alpha.apply], ["α", "α"]);
  assert.ok(r.options.every((o) => o.label.startsWith("\\alp")));
  assert.equal(at("\"a\\n"), null, "\\n in a string asks nothing while typing");
  assert.ok(at("\\n", true), "asked for (Ctrl Space), it does");
  assert.equal(at("x = alp"), null);
});

test("the runtime's completions and problems land on the right characters in non-ASCII code", async () => {
  // a paperboat-runtime/0 session: byte offsets, as Julia's REPLCompletions and JuliaSyntax give them
  const code = "é = 😀 + \\alpha";
  const asked: Record<string, unknown>[] = [];
  const session = {
    request: async (op: string, args: Record<string, unknown>) => {
      asked.push({ op, ...args });
      const b = new TextEncoder().encode(code).length;
      return op === "complete" ? { matches: ["α"], start: b - 6, end: b } : { problems: [{ from: b - 6, to: b, severity: "error", message: "x" }] };
    },
  };
  const c = (await runtimeComplete(code, code.length, session))!;
  assert.equal(asked[0].pos, toBytes(code, code.length));
  assert.equal(code.slice(c.from, c.to), "\\alpha");
  assert.deepEqual(c.options, [{ label: "α" }]);
  const [p] = await runtimeLint(code, session);
  assert.equal(code.slice(p.from, p.to), "\\alpha");
  assert.equal(fromBytes(code, toBytes(code, code.indexOf("+"))), code.indexOf("+"));
});

test("Live hides a note's front matter after a byte order mark, as without one", () => {
  const hidden = (doc: string) => {
    const state = EditorState.create({ doc, extensions: livePreview({ frontMatter: "hide" }) });
    const out: [number, number][] = [];
    for (const d of state.facet(EditorView.decorations)) if (typeof d !== "function") for (let c = d.iter(); c.value; c.next()) out.push([c.from, c.to]);
    return out;
  };
  const note = "---\nid: n_1\ntitle: Ünï 😀\n---\n# Ünïcode\n";
  assert.deepEqual(hidden(note), [[0, note.indexOf("\n# ")]]);
  assert.deepEqual(hidden(`\uFEFF${note}`), [[0, note.indexOf("\n# ") + 1]]);
});
