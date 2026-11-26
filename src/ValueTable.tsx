// Shared value table & modal: inspects or edits a workspace scalar, vector, or matrix as a
// spreadsheet grid (or shows a non-numeric value wrapped in full). Editable mode is used by
// Julix; readOnly mode shows live values (Simplicial's Variables sheet).
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { Dialog } from "./Dialog.tsx";
import { useDismiss } from "./dismiss.tsx";
import { cellNumber, gridOf, valueOfGrid, type ValueGridValue } from "./valueTable.ts";

export { cellNumber, gridOf, valueOfGrid, type ValueGridValue };

const SHOWN_ROWS = 500;
const SHOWN_COLS = 60;
const fmt = (n: number) => (Number.isNaN(n) ? "NaN" : Number.isInteger(n) ? String(n) : String(Number(n.toPrecision(8))));

export function VariableEditor({
  name,
  type,
  value,
  readOnly = false,
  tags,
  onChange,
  onClose,
}: {
  name: string;
  type: string;
  value: ValueGridValue | string;
  readOnly?: boolean;
  tags?: string[];
  onChange?: (value: ValueGridValue) => void;
  onClose: () => void;
}) {
  if (typeof value === "string") {
    return (
      <Dialog title={name} tags={tags ?? [type]} wide className="tall ve-window ve-text-window" onClose={onClose}>
        <div className="ve-text-scroll">
          <pre className="ve-text">{value}</pre>
        </div>
      </Dialog>
    );
  }

  return (
    <GridEditor
      name={name}
      type={type}
      value={value}
      readOnly={readOnly}
      tags={tags}
      onChange={onChange}
      onClose={onClose}
    />
  );
}

function GridEditor({
  name,
  type,
  value,
  readOnly,
  tags,
  onChange,
  onClose,
}: {
  name: string;
  type: string;
  value: ValueGridValue;
  readOnly: boolean;
  tags?: string[];
  onChange?: (value: ValueGridValue) => void;
  onClose: () => void;
}) {
  const kind = typeof value === "number" ? "scalar" : Array.isArray(value[0]) ? "matrix" : "vector";
  const [grid, setGrid] = useState(() => gridOf(value));
  const [at, setAt] = useState<[number, number]>([0, 0]);
  const [draft, setDraft] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const editor = useRef<HTMLInputElement>(null);
  // Escape while editing drops the edit, not the window: the cell is the topmost layer then.
  const dropped = useRef(false);
  useDismiss(editor, (why) => { if (why === "escape") { dropped.current = true; setDraft(null); } }, { enabled: !readOnly && draft !== null, outside: false });
  const rows = grid.length, cols = grid[0]?.length ?? 0;

  useEffect(() => { setGrid(gridOf(value)); }, [value]);
  useEffect(() => {
    box.current?.querySelector(".ve-grid td.on")?.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (draft === null) box.current?.querySelector<HTMLElement>(".ve-grid")?.focus();
    else dropped.current = false;
  }, [at, draft]);

  const emit = (next: number[][]) => {
    if (readOnly) return;
    setGrid(next);
    onChange?.(valueOfGrid(next, kind));
  };
  const move = (dr: number, dc: number) => {
    if (rows === 0 || cols === 0) return;
    setAt(([r, c]) => [Math.max(0, Math.min(rows - 1, r + dr)), Math.max(0, Math.min(cols - 1, c + dc))]);
  };
  const commit = (dr: number, dc: number) => {
    if (readOnly || draft === null) return;
    const n = cellNumber(draft);
    if (n === null) return; // not a number: keep editing
    const next = grid.map((r) => [...r]);
    next[at[0]][at[1]] = n;
    setDraft(null);
    emit(next);
    move(dr, dc);
  };
  /** Put a block at [r, c], growing the array with zeros where it reaches past the edge. */
  const place = (block: number[][], r0: number, c0: number) => {
    if (readOnly) return;
    const h = Math.max(rows, r0 + block.length), w = Math.max(cols, c0 + Math.max(...block.map((b) => b.length)));
    const next = Array.from({ length: h }, (_, r) => Array.from({ length: w }, (_, c) => grid[r]?.[c] ?? 0));
    block.forEach((line, i) => line.forEach((n, j) => { next[r0 + i][c0 + j] = n; }));
    emit(next);
  };
  const addRow = () => emit([...grid, Array(Math.max(cols, 1)).fill(0)]);
  const addCol = () => emit(grid.length ? grid.map((r) => [...r, 0]) : [[0]]);
  const dropRow = () => { if (rows > 1) { emit(grid.filter((_, r) => r !== at[0])); setAt([Math.min(at[0], rows - 2), at[1]]); } };
  const dropCol = () => { if (cols > 1) { emit(grid.map((r) => r.filter((_, c) => c !== at[1]))); setAt([at[0], Math.min(at[1], cols - 2)]); } };

  const onGridKey = (e: KeyboardEvent) => {
    if (draft !== null) return;
    const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[e.key]) { e.preventDefault(); move(...arrows[e.key]); }
    else if (e.key === "Tab") { e.preventDefault(); move(0, e.shiftKey ? -1 : 1); }
    else if (!readOnly && (e.key === "Enter" || e.key === "F2") && rows > 0 && cols > 0) { e.preventDefault(); setDraft(fmt(grid[at[0]][at[1]])); }
    else if (!readOnly && (e.key === "Delete" || e.key === "Backspace") && rows > 0 && cols > 0) { e.preventDefault(); const next = grid.map((r) => [...r]); next[at[0]][at[1]] = 0; emit(next); }
    else if (!readOnly && /^[-+.\d]$/.test(e.key) && !e.ctrlKey && !e.metaKey && rows > 0 && cols > 0) { e.preventDefault(); setDraft(e.key); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && rows > 0 && cols > 0) void navigator.clipboard?.writeText(fmt(grid[at[0]][at[1]]));
  };
  const onPaste = (e: ClipboardEvent) => {
    if (readOnly || draft !== null) return;
    const text = e.clipboardData.getData("text/plain");
    const lines = text.replace(/\r?\n$/, "").split(/\r?\n/).map((l) => l.split(/\t|,|;|\s+/).filter((x) => x !== "").map((x) => cellNumber(x) ?? NaN));
    if (!lines.length || !lines[0].length) return;
    e.preventDefault();
    place(lines, at[0], at[1]);
  };

  const shownRows = Math.min(rows, SHOWN_ROWS), shownCols = Math.min(cols, SHOWN_COLS);
  return (
    <Dialog title={name} tags={tags ?? [type, `${rows} × ${cols}`]} wide className="tall ve-window" onClose={onClose}>
      {!readOnly && (
        <div className="ve-tools">
          <button type="button" className="key sm" onClick={addRow}>+ row</button>
          <button type="button" className="key sm" onClick={addCol}>+ column</button>
          <button type="button" className="key sm" onClick={dropRow} disabled={rows < 2} title="Delete the selected row">− row</button>
          <button type="button" className="key sm" onClick={dropCol} disabled={cols < 2} title="Delete the selected column">− column</button>
          <span className="sp" />
          <span className="tag">{name}[{at[0] + 1}{cols > 1 || kind === "matrix" ? `, ${at[1] + 1}` : ""}]</span>
        </div>
      )}
      <div className="ve-scroll" ref={box}>
        <table className="ve-grid" tabIndex={0} onKeyDown={onGridKey} onPaste={onPaste} aria-label={`${name}, ${rows} by ${cols}`}>
          <thead>
            <tr><th />{Array.from({ length: shownCols }, (_, c) => <th key={c} className={c === at[1] ? "on" : ""}>{c + 1}</th>)}</tr>
          </thead>
          <tbody>
            {grid.slice(0, shownRows).map((row, r) => (
              <tr key={r}>
                <th className={r === at[0] ? "on" : ""}>{r + 1}</th>
                {row.slice(0, shownCols).map((n, c) => {
                  const on = r === at[0] && c === at[1];
                  return (
                    <td
                      key={c}
                      className={on ? "on" : ""}
                      onClick={() => { if (!readOnly && draft !== null) commit(0, 0); setAt([r, c]); }}
                      onDoubleClick={() => { if (readOnly) return; setAt([r, c]); setDraft(fmt(n)); }}
                    >
                      {!readOnly && on && draft !== null ? (
                        <input
                          autoFocus
                          ref={editor}
                          value={draft}
                          spellCheck={false}
                          aria-label={`${name}[${r + 1}, ${c + 1}]`}
                          className={cellNumber(draft) === null ? "bad" : ""}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => { if (!dropped.current) commit(0, 0); dropped.current = false; }}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") { e.preventDefault(); commit(1, 0); }
                            else if (e.key === "Tab") { e.preventDefault(); commit(0, e.shiftKey ? -1 : 1); }
                          }}
                        />
                      ) : fmt(n)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(rows > shownRows || cols > shownCols) && (
        <p className="hint ve-more">
          {readOnly
            ? `Showing the first ${shownRows} × ${shownCols} of ${rows} × ${cols}.`
            : `Showing the first ${shownRows} × ${shownCols}; index the rest in the console.`}
        </p>
      )}
    </Dialog>
  );
}
