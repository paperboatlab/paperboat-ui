// Live preview (Obsidian's): Markdown drawn as it reads while you type in it. Headings take their size,
// emphasis, code and links their look, and the marks that make them (#, **, _, `, [[ ]], a link's URL)
// are hidden except on the lines the caret or a selection is on, so what you edit is still the plain text.
// A fenced cell (```julia, ```python) carries a Run key on its opening line when the app runs cells.
import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";

export type LivePreviewOptions = {
  /** A click on a link ([[note]] or [text](url)) with Ctrl/Cmd held, or on a link outside the caret's lines. */
  onLink?: (target: string, wiki: boolean) => void;
  /** Languages whose fenced blocks run; the key calls `onRun` with the fence's 1-based line. */
  run?: { langs: readonly string[]; onRun: (line: number) => void };
};

const hide = Decoration.replace({});
const mark = (cls: string, attrs?: Record<string, string>) => Decoration.mark({ class: cls, attributes: attrs });
const HEAD = [1, 2, 3, 4, 5, 6].map((n) => Decoration.line({ class: `cm-lp-h cm-lp-h${n}` }));
const QUOTE = Decoration.line({ class: "cm-lp-quote" });
const FENCE = Decoration.line({ class: "cm-lp-fence" });
const WIKI = /\[\[([^\]|#\n]+)(#[^\]|\n]*)?(?:\|([^\]\n]+))?\]\]/g;

class RunKey extends WidgetType {
  readonly line: number;
  readonly onRun: (line: number) => void;
  constructor(line: number, onRun: (line: number) => void) { super(); this.line = line; this.onRun = onRun; }
  eq(o: RunKey) { return o.line === this.line; }
  toDOM() {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cm-lp-run";
    b.textContent = "Run";
    b.title = "Run this cell";
    b.onmousedown = (e) => e.preventDefault();   // the caret stays where it is
    b.onclick = () => this.onRun(this.line);
    return b;
  }
  ignoreEvent() { return true; }
}

/** The lines any selection touches: their marks stay visible. */
function activeLines(state: EditorState): Set<number> {
  const s = new Set<number>();
  for (const r of state.selection.ranges) {
    for (let l = state.doc.lineAt(r.from).number; l <= state.doc.lineAt(r.to).number; l++) s.add(l);
  }
  return s;
}

function build(view: EditorView, o: LivePreviewOptions): DecorationSet {
  const { state } = view, active = activeLines(state), focused = view.hasFocus;
  const shown = (pos: number) => focused && active.has(state.doc.lineAt(pos).number);
  const deco: { from: number; to: number; d: Decoration }[] = [];
  const add = (from: number, to: number, d: Decoration) => { if (to > from || (to === from && d !== hide)) deco.push({ from, to, d }); };

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from, to,
      enter: (n) => {
        const name = n.name;
        if (name === "FrontMatter" || name === "Frontmatter") return false;
        const h = /^ATXHeading(\d)$/.exec(name);
        if (h) { add(state.doc.lineAt(n.from).from, state.doc.lineAt(n.from).from, HEAD[+h[1] - 1]); return; }
        if (name === "Blockquote") { for (let l = state.doc.lineAt(n.from).number; l <= state.doc.lineAt(n.to).number; l++) add(state.doc.line(l).from, state.doc.line(l).from, QUOTE); return; }
        if (name === "FencedCode") {
          const first = state.doc.lineAt(n.from), info = /^\s*(`{3,}|~{3,})\s*([\w+-]*)/.exec(first.text)?.[2]?.toLowerCase() ?? "";
          for (let l = first.number; l <= state.doc.lineAt(n.to).number; l++) add(state.doc.line(l).from, state.doc.line(l).from, FENCE);
          if (o.run && o.run.langs.includes(info)) add(first.to, first.to, Decoration.widget({ widget: new RunKey(first.number, o.run.onRun), side: 1 }));
          return false;   // code stays code
        }
        if (name === "StrongEmphasis") add(n.from, n.to, mark("cm-lp-strong"));
        else if (name === "Emphasis") add(n.from, n.to, mark("cm-lp-em"));
        else if (name === "Strikethrough") add(n.from, n.to, mark("cm-lp-strike"));
        else if (name === "InlineCode") add(n.from, n.to, mark("cm-lp-code"));
        else if (name === "Link") {
          const url = n.node.getChild("URL"), target = url ? state.sliceDoc(url.from, url.to) : "";
          add(n.from, n.to, mark("cm-lp-link", { "data-lp-link": target }));
          if (!shown(n.from) && url) { const marks = n.node.getChildren("LinkMark"); if (marks.length >= 2) add(marks[1].from, n.to, hide); }
        }
        if (shown(n.from)) return;
        if (name === "HeaderMark") add(n.from, Math.min(n.to + 1, state.doc.lineAt(n.from).to), hide);
        else if (name === "EmphasisMark" || name === "CodeMark" || name === "StrikethroughMark") add(n.from, n.to, hide);
        else if (name === "LinkMark" && state.sliceDoc(n.from, n.to) === "[") add(n.from, n.to, hide);
        else if (name === "QuoteMark") add(n.from, Math.min(n.to + 1, state.doc.lineAt(n.from).to), hide);
      },
    });
    // [[wikilinks]]: not Markdown, so found in the text; the target hides behind an alias, the brackets go
    for (let pos = from; pos <= to;) {
      const line = state.doc.lineAt(pos);
      for (const m of line.text.matchAll(WIKI)) {
        const a = line.from + m.index!, b = a + m[0].length, target = m[1].trim();
        if (inCode(state, a)) continue;
        const textFrom = m[3] ? b - 2 - m[3].length : a + 2, textTo = m[3] ? b - 2 : a + 2 + m[1].length + (m[2]?.length ?? 0);
        add(textFrom, textTo, mark("cm-lp-link cm-lp-wiki", { "data-lp-wiki": target }));
        if (!shown(a)) { add(a, textFrom, hide); add(textTo, b, hide); }
      }
      pos = line.to + 1;
    }
  }
  deco.sort((x, y) => x.from - y.from || x.d.startSide - y.d.startSide);
  const out = new RangeSetBuilder<Decoration>();
  for (const { from, to, d } of deco) out.add(from, to, d);
  return out.finish();
}

const inCode = (state: EditorState, pos: number) => {
  for (let n: ReturnType<ReturnType<typeof syntaxTree>["resolveInner"]> | null = syntaxTree(state).resolveInner(pos, 1); n; n = n.parent) {
    if (n.name === "InlineCode" || n.name === "FencedCode" || n.name === "CodeBlock") return true;
  }
  return false;
};

/** The live preview for Markdown in the kit's Editor (pass it as `extra`, memoised). */
export function livePreview(o: LivePreviewOptions = {}): Extension {
  const plugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = build(view, o); }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged || u.selectionSet || u.focusChanged || syntaxTree(u.startState) !== syntaxTree(u.state)) this.decorations = build(u.view, o);
    }
  }, { decorations: (v) => v.decorations });

  const links = EditorView.domEventHandlers({
    mousedown(e, view) {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-lp-wiki], [data-lp-link]");
      if (!el || !o.onLink) return false;
      const pos = view.posAtDOM(el), onCaretLine = view.hasFocus && activeLines(view.state).has(view.state.doc.lineAt(pos).number);
      if (onCaretLine && !(e.ctrlKey || e.metaKey)) return false;   // editing the link: the caret goes in
      e.preventDefault();
      const wiki = el.dataset.lpWiki;
      o.onLink(wiki ?? el.dataset.lpLink ?? "", wiki !== undefined);
      return true;
    },
  });
  return [plugin, links, EditorView.contentAttributes.of({ class: "cm-live" })];
}
