// What a variables row says (VariableList.tsx): its type line and its value, from a paperboat/0 Variable.
import { matrixLiteral, parseMatrix } from "./canvas/bindings.ts";
import type { Variable } from "./canvas/types.ts";

const num = (n: number) => String(Number(n.toPrecision(6))).replace("-", "−");

/** The matrix's shape ("2×3"), if `value` is one. */
function shape(value: unknown): string {
  if (value === undefined) return "";
  const m = parseMatrix(matrixLiteral(value));
  return "error" in m || !m.rows ? "" : `${m.rows}×${m.cols}`;
}

/**
 * The line under a variable's name: its type and what qualifies it, joined by " · ".
 * `number · N·s/rad`, `ƒ kp_theta / 5 · number`, `boolean`, `enum · a | b`, `matrix 2×2`, then `tunable`.
 */
export function typeLine(v: Pick<Variable, "type" | "value" | "expr" | "unit" | "options" | "tunable">): string {
  const parts: string[] = [];
  if (v.expr !== undefined) parts.push(`ƒ ${v.expr}`, v.type);
  else if (v.type === "enum") parts.push(v.options?.length ? `enum · ${v.options.join(" | ")}` : "enum");
  else if (v.type === "matrix") parts.push(["matrix", shape(v.value)].filter(Boolean).join(" "));
  else parts.push(v.type);
  if (v.type === "number" && v.unit) parts.push(v.unit);
  if (v.tunable) parts.push("tunable");
  return parts.join(" · ");
}

/** A value as the row shows it: numbers to 6 digits with a real minus, booleans on / off, a file by its name, "–" for none. */
export function valueText(value: unknown, type?: Variable["type"]): string {
  if (value === undefined || value === null || value === "") return "–";
  if (typeof value === "number") return num(value);
  if (typeof value === "boolean") return value ? "on" : "off";
  if (type === "matrix") return matrixLiteral(value);
  if (type === "file") return String(value).split(/[\\/]/).pop() || String(value);
  return String(value);
}
