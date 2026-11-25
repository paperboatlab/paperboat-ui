// Live preview (Obsidian's): Markdown drawn as it reads while you type in it. Headings take their size,
// emphasis, code and links their look, and the marks that make them (#, **, _, `, [[ ]], a link's URL)
// are hidden except on the lines the caret or a selection is on, so what you edit is still the plain text.
// A fenced cell (```julia, ```python) carries a Run key on its opening line when the app runs cells, or
// the app draws it whole (`cells`: its own cell, outputs and all) until the caret goes into its code. The
// front matter can hide, for an app that shows the properties itself (`frontMatter: "hide"`).
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, StateField, type EditorState, type Extension, type Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { INLINE_MATH, mathHtml } from "../math.ts";

export type LivePreviewOptions = {
  /** A click on a link ([[note]] or [text](url)) with Ctrl/Cmd held, or on a link outside the caret's lines. */
  onLink?: (target: string, wiki: boolean) => void;
  /** Languages whose fenced blocks run; the key calls `onRun` with the fence's 1-based line. */
  run?: { langs: readonly string[]; onRun: (line: number) => void };
  /** Fenced blocks the app draws itself while the caret is outside them: `mount` fills the element (a React
   *  portal, say), `unmount` lets it go. A click on the drawn block (not on its keys) puts the caret in its code. */
  cells?: { langs: readonly string[]; mount: (el: HTMLElement, cell: { lang: string; code: string }) => void; unmount?: (el: HTMLElement) => void };
  /** "quiet" (the default): the front matter stays, small and muted; "hide": the app shows the properties. */
  frontMatter?: "quiet" | "hide";
  /** TeX drawn with KaTeX: `$…$` in a line, `$$…$$` as a block (on by default). */
  math?: boolean;
  /** A line that is only an embed (`![[photo.png]]`, `![alt](clip.mp4)`) drawn by the app (a picture, a
   *  player) while the caret is off it; `wiki` says which form, `target` is as written. */
  embeds?: { mount: (el: HTMLElement, e: { target: string; alt: string; wiki: boolean }) => void; unmount?: (el: HTMLElement) => void };
};

const hide = Decoration.replace({});
const mark = (cls: string, attrs?: Record<string, string>) => Decoration.mark({ class: cls, attributes: attrs });
const HEAD = [1, 2, 3, 4, 5, 6].map((n) => Decoration.line({ class: `cm-lp-h cm-lp-h${n}` }));
const QUOTE = Decoration.line({ class: "cm-lp-quote" });
const FENCE = Decoration.line({ class: "cm-lp-fence" });
const META = Decoration.line({ class: "cm-lp-meta" });
const WIKI = /\[\[([^\]|#\n]+)(#[^\]|\n]*)?(?:\|([^\]\n]+))?\]\]/g;

class MathWidget extends WidgetType {
  readonly tex: string;
  readonly display: boolean;
  constructor(tex: string, display: boolean) { super(); this.tex = tex; this.display = display; }
  eq(o: MathWidget) { return o.tex === this.tex && o.display === this.display; }
  toDOM(view: EditorView) {
    const el = document.createElement(this.display ? "div" : "span");
    el.className = this.display ? "cm-lp-math-block" : "cm-lp-math";
    el.innerHTML = mathHtml(this.tex, this.display);
    // a click puts the caret into the TeX, which then shows as written
    el.addEventListener("mousedown", (e) => { e.preventDefault(); const at = view.posAtDOM(el); view.dispatch({ selection: { anchor: this.display ? Math.min(view.state.doc.lineAt(at).to, view.state.doc.length) : at + 1 } }); view.focus(); });
    return el;
  }
  ignoreEvent() { return true; }
}

class EmbedBlock extends WidgetType {
  readonly e: { target: string; alt: string; wiki: boolean };
  readonly o: NonNullable<LivePreviewOptions["embeds"]>;
  constructor(e: { target: string; alt: string; wiki: boolean }, o: NonNullable<LivePreviewOptions["embeds"]>) { super(); this.e = e; this.o = o; }
  eq(w: EmbedBlock) { return w.e.target === this.e.target && w.e.alt === this.e.alt && w.e.wiki === this.e.wiki; }
  toDOM(view: EditorView) {
    const el = document.createElement("div");
    el.className = "cm-lp-embed";
    // a click beside the picture (not on its keys or the player) puts the caret on the line, which shows it as written
    el.addEventListener("mousedown", (ev) => {
      if ((ev.target as HTMLElement).closest("button, a, input, video, audio, [data-keep], .pb-player")) return;
      ev.preventDefault();
      view.dispatch({ selection: { anchor: view.state.doc.lineAt(view.posAtDOM(el)).to } });
      view.focus();
    });
    this.o.mount(el, this.e);
    return el;
  }
  destroy(el: HTMLElement) { this.o.unmount?.(el); }
  ignoreEvent() { return true; }
}

const EMBED_WIKI = /^\s*!\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]\s*$/, EMBED_MD = /^\s*!\[([^\]]*)\]\(<?([^)\s>]+)>?(?:\s+"[^"]*")?\)\s*$/;

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

  // the note's Markdown is parsed inside its front matter's document: make sure that parse reaches what
  // is shown (a short budget; the next update catches up if it runs out)
  const tree = ensureSyntaxTree(state, view.viewport.to, 50) ?? syntaxTree(state);
  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from, to,
      enter: (n) => {
        const name = n.name;
        if ((name === "Frontmatter" || name === "FrontMatter") && o.frontMatter === "hide") return false;   // the blocks field hides it
        if (name === "Frontmatter" || name === "FrontMatter") {   // the properties: kept, quiet
          for (let l = state.doc.lineAt(n.from).number; l <= state.doc.lineAt(n.to).number; l++) add(state.doc.line(l).from, state.doc.line(l).from, META);
          return false;
        }
        const h = /^ATXHeading(\d)$/.exec(name);
        if (h) { add(state.doc.lineAt(n.from).from, state.doc.lineAt(n.from).from, HEAD[+h[1] - 1]); return; }
        if (name === "Blockquote") { for (let l = state.doc.lineAt(n.from).number; l <= state.doc.lineAt(n.to).number; l++) add(state.doc.line(l).from, state.doc.line(l).from, QUOTE); return; }
        if (name === "FencedCode") {
          const first = state.doc.lineAt(n.from), info = /^\s*(`{3,}|~{3,})\s*([\w+-]*)/.exec(first.text)?.[2]?.toLowerCase() ?? "";
          if (o.cells?.langs.includes(info) && !editing(state, n.from, n.to)) return false;   // drawn by the app (the blocks field)
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
      if (o.math !== false && line.text.includes("$") && !inMathBlock(state, line.from)) {
        for (const m of line.text.matchAll(INLINE_MATH)) {
          const a = line.from + m.index!, b = a + m[0].length;
          if (inCode(state, a)) continue;
          add(a, b, shown(a) ? mark("cm-lp-math-src") : Decoration.replace({ widget: new MathWidget(m[1], false) }));
        }
      }
      pos = line.to + 1;
    }
  }
  deco.sort((x, y) => x.from - y.from || x.d.startSide - y.d.startSide);
  const out = new RangeSetBuilder<Decoration>();
  for (const { from, to, d } of deco) out.add(from, to, d);
  return out.finish();
}

/** The caret or a selection is in the block from–to. */
const editing = (state: EditorState, from: number, to: number) => state.selection.ranges.some((r) => r.to >= from && r.from <= to);

class CellBlock extends WidgetType {
  readonly lang: string;
  readonly code: string;
  readonly o: NonNullable<LivePreviewOptions["cells"]>;
  constructor(lang: string, code: string, o: NonNullable<LivePreviewOptions["cells"]>) { super(); this.lang = lang; this.code = code; this.o = o; }
  eq(w: CellBlock) { return w.lang === this.lang && w.code === this.code; }
  toDOM(view: EditorView) {
    const el = document.createElement("div");
    el.className = "cm-lp-cell";
    el.addEventListener("mousedown", (e) => {
      if ((e.target as HTMLElement).closest("button, a, input, select, textarea, [data-keep]")) return;
      e.preventDefault();
      const at = view.posAtDOM(el), first = view.state.doc.lineAt(at);
      view.dispatch({ selection: { anchor: Math.min(first.to + 1, view.state.doc.length) } });
      view.focus();
    });
    this.o.mount(el, { lang: this.lang, code: this.code });
    return el;
  }
  destroy(el: HTMLElement) { this.o.unmount?.(el); }
  ignoreEvent() { return true; }
}

/** The blocks: the front matter hidden, cells drawn by the app. Block decorations must come from a field,
 *  and they are found in the text (as the app's server reads cells), not in a parse that may not be done. */
function blocks(state: EditorState, o: LivePreviewOptions): DecorationSet {
  const out: Range<Decoration>[] = [], doc = state.doc;
  let n = 1;
  if (o.frontMatter === "hide" && doc.lines > 1 && doc.line(1).text === "---") {
    let end = 2;
    while (end <= doc.lines && doc.line(end).text !== "---") end++;
    if (end <= doc.lines) { out.push(Decoration.replace({ block: true }).range(0, doc.line(end).to)); n = end + 1; }
  }
  const start = n;
  if (o.embeds) {
    for (let k = start; k <= doc.lines; k++) {
      const line = doc.line(k), t = line.text.trim();
      if (/^(`{3,}|~{3,})/.test(t)) { const f = t.slice(0, 3); k++; while (k <= doc.lines && !doc.line(k).text.trim().startsWith(f)) k++; continue; }   // not inside code
      const w = EMBED_WIKI.exec(line.text), m = w ? null : EMBED_MD.exec(line.text);
      if (!(w || m) || editing(state, line.from, line.to)) continue;
      const e = w ? { target: w[1].trim(), alt: (w[2] ?? "").trim(), wiki: true } : { target: m![2], alt: m![1], wiki: false };
      out.push(Decoration.replace({ block: true, widget: new EmbedBlock(e, o.embeds) }).range(line.from, line.to));
    }
  }
  if (o.math !== false) {
    for (let k = start; k <= doc.lines; k++) {
      const first = doc.line(k), t = first.text.trim();
      if (/^(`{3,}|~{3,})/.test(t)) { const f = t.slice(0, 3); k++; while (k <= doc.lines && !doc.line(k).text.trim().startsWith(f)) k++; continue; }   // not inside code
      if (!t.startsWith("$$")) continue;
      let m = k;
      if (!(t.length > 4 && t.endsWith("$$"))) { m = k + 1; while (m <= doc.lines && !doc.line(m).text.trim().endsWith("$$")) m++; }
      if (m > doc.lines) break;
      const last = doc.line(m), tex = state.sliceDoc(first.from, last.to).trim().slice(2, -2).trim();
      if (tex && !editing(state, first.from, last.to)) out.push(Decoration.replace({ block: true, widget: new MathWidget(tex, true) }).range(first.from, last.to));
      k = m;
    }
  }
  if (o.cells) {
    for (; n <= doc.lines; n++) {
      const first = doc.line(n), open = /^(`{3,}|~{3,})\s*([\w+-]*)/.exec(first.text);
      if (!open) continue;
      let m = n + 1;
      while (m <= doc.lines && !(/^(`{3,}|~{3,})\s*$/.test(doc.line(m).text) && doc.line(m).text[0] === open[1][0])) m++;
      const last = doc.line(Math.min(m, doc.lines)), lang = open[2].toLowerCase();
      if (o.cells.langs.includes(lang) && !editing(state, first.from, last.to)) {
        const code = m > n + 1 ? state.sliceDoc(doc.line(n + 1).from, doc.line(Math.min(m - 1, doc.lines)).to) : "";
        out.push(Decoration.replace({ block: true, widget: new CellBlock(lang, code, o.cells) }).range(first.from, last.to));
      }
      n = m;
    }
  }
  return Decoration.set(out, true);
}

/** A line inside a $$ … $$ block: its $ signs are the block's, not inline math. */
const inMathBlock = (state: EditorState, pos: number) => {
  let open = false;
  for (let l = 1; l < state.doc.lineAt(pos).number; l++) {
    const t = state.doc.line(l).text.trim();
    if (t.startsWith("$$") && !(t.length > 4 && t.endsWith("$$"))) open = !open;
    else if (open && t.endsWith("$$")) open = false;
  }
  return open || state.doc.lineAt(pos).text.trim().startsWith("$$");
};

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
  const field = StateField.define<DecorationSet>({
    create: (state) => blocks(state, o),
    update: (deco, tr) => (tr.docChanged || tr.selection ? blocks(tr.state, o) : deco),
    provide: (f) => EditorView.decorations.from(f),
  });
  return [plugin, links, field, EditorView.contentAttributes.of({ class: "cm-live" })];
}
