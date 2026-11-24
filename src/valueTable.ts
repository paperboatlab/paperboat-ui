// Pure helpers for ValueTable: converting between scalars/vectors/matrices and 2D numeric grids.
export type ValueGridValue = number | number[] | number[][];

/** A cell as a number: "1.5", "-2e3", "Inf", "NaN"; anything else is null (text). Empty is NaN. */
export function cellNumber(cell: string | number | null | undefined): number | null {
  if (typeof cell === "number") return cell;
  const t = (cell ?? "").trim();
  if (!t) return NaN;
  const lower = t.toLowerCase();
  if (lower === "nan" || lower === "na") return NaN;
  if (/^[+-]?inf(inity)?$/.test(lower)) return lower.startsWith("-") ? -Infinity : Infinity;
  if (lower === "true") return 1;
  if (lower === "false") return 0;
  const n = Number(t);
  return Number.isNaN(n) ? null : n;
}

/** The grid a value is shown as: a scalar 1 × 1, a vector one column (Julia's vectors are columns). */
export function gridOf(value: ValueGridValue): number[][] {
  if (typeof value === "number") return [[value]];
  if (Array.isArray(value[0])) return (value as number[][]).map((r) => [...r]);
  return (value as number[]).map((v) => [v]);
}

/** Back to the value's own kind while the shape allows it. */
export function valueOfGrid(grid: number[][], kind: "scalar" | "vector" | "matrix"): ValueGridValue {
  const cols = grid[0]?.length ?? 0;
  if (kind === "scalar" && grid.length === 1 && cols === 1) return grid[0][0];
  if (kind !== "matrix" && cols === 1) return grid.map((r) => r[0]);
  return grid;
}
