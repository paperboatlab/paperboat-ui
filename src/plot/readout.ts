// What a Display reads out: a number, a vector cut to its card, a matrix corner or a point list, from the
// latest value as a host sends it (Simplicial: run.cpp matrix_text / points_text); and the Graph's caption.
// Pure, so tests and apps agree.
import type { ScopeChannel } from "../scope/types.ts";

const minus = (s: string) => s.replace("-", "−");
/** How many values a Display lists, by card size, before it shows only the first ones and an ellipsis (#24, #349). */
export const SHOWN = 6;
const SHOWN_BY_SIZE: Record<string, number> = { compact: SHOWN, normal: SHOWN, large: 16, xlarge: 32 };
/** How much of a matrix's corner a card shows as a grid; smaller cards show the one-line preview. */
export const GRID_BY_SIZE: Record<string, number> = { large: 4, xlarge: 8 };

const number = (v: number) => String(+v.toFixed(4));

export interface Grid {
  /** The corner the engine sent, row by row. */
  rows: string[][];
  /** Columns or rows past the corner. */
  moreColumns: boolean;
  moreRows: boolean;
}

export interface Readout {
  /** The value's size, "2 × 2" or "3"; absent for a single value or text. */
  dims?: string;
  /** What kind of value: scalar, vector, matrix, points; absent for plain text. */
  type?: string;
  /** The values, cut to a preview so a huge matrix or list never floods the card. */
  values: string;
  /** A matrix's corner, for a card big enough to show it as a grid. */
  grid?: Grid;
}

/** The engine's matrix corner ("1, 2, …; 3, 4, …; …", run.cpp matrix_text) as rows. */
function gridOf(text: string): Grid {
  const lines = text.split("; ");
  const moreRows = lines[lines.length - 1] === "…";
  if (moreRows) lines.pop();
  let moreColumns = false;
  const rows = lines.map((line) => {
    const cells = line.split(", ");
    if (cells[cells.length - 1] === "…") (cells.pop(), (moreColumns = true));
    return cells;
  });
  return { rows, moreColumns, moreRows };
}

/**
 * What a Display reads out. A vector is cut here to what a card of `size` lists (with its
 * component labels, `vector`, when it has them). A matrix or point list arrives from the engine
 * already as text (run.cpp matrix_text / points_text), so its size is read off that text.
 */
export function readout(latest: unknown, vector?: string, size = "compact"): Readout {
  const shown = SHOWN_BY_SIZE[size] ?? SHOWN;
  if (typeof latest === "number") return { type: "scalar", values: number(latest) };
  if (Array.isArray(latest)) {
    const nums = latest.filter((v): v is number => typeof v === "number");
    // A labelled vector's parts are one per value: keep the labels of the values shown.
    const labels = vector?.split(", ");
    const parts = labels?.length === nums.length ? labels : nums.map(number);
    const values = nums.length > shown ? `${parts.slice(0, shown).join(", ")}, …` : parts.join(", ");
    return { dims: String(nums.length), type: "vector", values };
  }
  const text = String(latest ?? "–");
  const matrix = /^(\d+ × \d+) matrix: (.*)$/s.exec(text);
  if (matrix) {
    const grid = gridOf(matrix[2]);
    const flat = grid.rows.flat();
    const more = flat.length > shown || grid.moreColumns || grid.moreRows;
    return { dims: matrix[1], type: "matrix", values: flat.slice(0, shown).join(", ") + (more ? ", …" : ""), grid };
  }
  const m = /^(\d+) (points?): (.*)$/s.exec(text);
  return m ? { dims: m[1], type: "points", values: m[3] } : { values: text };
}

/** The latest value(s) as the Graph's caption says them: "0.250 m", or "x 0.25  v −1.00" for several. */
export function graphValue(channels: readonly ScopeChannel[], idle?: boolean, unit?: string): string | undefined {
  const last = channels.map((c) => (c.buf.values.length ? c.buf.values[c.buf.values.length - 1] : undefined));
  if (last[0] === undefined) return idle ? "–" : undefined;
  if (channels.length === 1) {
    const u = channels[0].unit ?? unit;
    return `${minus(last[0].toFixed(3))}${u ? ` ${u}` : ""}`;
  }
  return channels.map((c, i) => `${c.label} ${minus((last[i] ?? NaN).toFixed(2))}`).join("  ");
}
