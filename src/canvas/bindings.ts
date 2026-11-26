// Variables (#36) in the UI, the model: what refers to what, renaming, merging the station's defaults
// with the user's own, and the TOML a developer pastes into a descriptor. The engine
// resolves and checks them (variables.values); nothing here evaluates a formula.

import type { ParamDef, ParamValue, Station, Variable, Variables } from "./types.ts";

export type Ref = { var: string } | { expr: string };
export const isRef = (v: unknown): v is Ref => typeof v === "object" && v !== null && ("var" in v || "expr" in v);

/** Names a formula uses (identifiers, built-ins included: only real variables match later). */
export function namesIn(formula: string): string[] {
  return [...formula.matchAll(/(?<![\w.])[A-Za-z_]\w*/g)].map((m) => m[0]);
}

/** Whether `value` refers to variable `name`. */
export function refersTo(value: unknown, name: string): boolean {
  if (!isRef(value)) return false;
  return "var" in value ? value.var === name : namesIn(value.expr).includes(name);
}

/** `formula` with variable `from` renamed `to`. */
export function renameInFormula(formula: string, from: string, to: string): string {
  return formula.replace(/(?<![\w.])[A-Za-z_]\w*/g, (w) => (w === from ? to : w));
}

/** `value` with variable `from` renamed `to`, if it refers to it. */
export function renameRef(value: ParamValue, from: string, to: string): ParamValue {
  if (!isRef(value)) return value;
  return "var" in value ? (value.var === from ? { var: to } : value) : { expr: renameInFormula(value.expr, from, to) };
}

/** `value` with variable `name` replaced by its value `v` (the variable is going away). */
export function inlineRef(value: ParamValue, name: string, v: number | boolean | string): ParamValue {
  if (!isRef(value) || !refersTo(value, name)) return value;
  if ("var" in value) return v;
  const literal = typeof v === "boolean" ? (v ? "1" : "0") : String(v);
  return { expr: value.expr.replace(/(?<![\w.])[A-Za-z_]\w*/g, (w) => (w === name ? `(${literal})` : w)) };
}

/** A place that uses a variable: a block's param on the Flow, a station object's property, or another variable's formula. */
export type Use = { page: "flow" | "station" | "variables" | "board"; id: string; field: string; formula?: string };

/** Where each variable is used: blocks' params, station props and other variables' formulas. */
export function usesOf(
  name: string,
  blocks: { id: string; params: Record<string, ParamValue> }[],
  station: Station | null,
  variables: Variables,
): Use[] {
  const out: Use[] = [];
  for (const b of blocks)
    for (const [field, v] of Object.entries(b.params))
      if (refersTo(v, name)) out.push({ page: "flow", id: b.id, field, formula: isRef(v) && "expr" in v ? v.expr : undefined });
  for (const o of station?.objects ?? [])
    for (const [field, v] of Object.entries(o.props ?? {}))
      if (refersTo(v, name)) out.push({ page: "station", id: o.id, field, formula: isRef(v) && "expr" in v ? v.expr : undefined });
  for (const v of variables)
    if (v.expr && v.name !== name && namesIn(v.expr).includes(name)) out.push({ page: "variables", id: v.name, field: "", formula: v.expr });
  return out;
}

/** A live matrix value as a text param sees it: JSON arrays become MATLAB-style rows. */
export function matrixLiteral(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.some((row) => Array.isArray(row)))
      return (value as unknown[][]).map((row) => (Array.isArray(row) ? row.join(" ") : String(row))).join("; ");
    return (value as unknown[]).join(" ");
  }
  if (typeof value !== "string") return String(value ?? "");
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return matrixLiteral(parsed);
  } catch {
    // Already a literal matrix, a descriptor, or plain text.
  }
  return value;
}

/**
 * `params` with every reference to a live variable (Julix) replaced by its value. Live
 * variables are not project variables, so a run sends their values, never their names; a
 * matrix becomes its rows. One MX could not send (too large) throws with MX's reason.
 */
export function inlineLive(params: Record<string, ParamValue>, live: Variables): Record<string, ParamValue> {
  const out = { ...params };
  for (const v of live)
    for (const [id, p] of Object.entries(out)) {
      if (!refersTo(p, v.name)) continue;
      if (v.value === undefined) throw new Error(`${v.name}: ${v.note ?? "Julix sent no value"}`);
      out[id] = inlineRef(p, v.name, v.type === "matrix" ? matrixLiteral(v.value) : v.value);
    }
  return out;
}

/** Whether variable `v` can stand for a param of `def`'s type. */
export function fits(v: Variable, def: ParamDef): boolean {
  switch (def.type) {
    case "number":
      return v.type === "number" && (!def.unit || !v.unit || def.unit === v.unit);
    case "boolean":
      return v.type === "boolean";
    case "enum":
      return v.type === "enum" && def.options.includes(String(v.value));
    case "text":
      return v.type === "text" || v.type === "file";
    case "file":
      return v.type === "text" || v.type === "file";
    case "matrix":
      return v.type === "matrix";
    default:
      return false; // a key belongs to its block
  }
}

const NUMBER_TOKEN = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

/** Parse MATLAB-style matrix text ("1 2; 3 4", newlines, commas, brackets) into finite numeric rows. */
export function parseMatrixCells(text: string): { rows: number; cols: number; cells: number[][] } | { error: string } {
  let s = text.trim();
  if (!s || s === "[]") return { rows: 0, cols: 0, cells: [] };
  if (s.startsWith("[")) {
    let depth = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "[") depth++;
      else if (s[i] === "]") {
        depth--;
        if (depth === 0) {
          if (i + 1 !== s.length) return { error: `unexpected "${s.slice(i + 1).trim()}" after "]"` };
          s = s.slice(1, -1).trim();
          break;
        }
      }
    }
    if (depth !== 0) return { error: 'unclosed "["' };
  }
  if (!s) return { rows: 0, cols: 0, cells: [] };
  const rowStrings: string[] = [];
  if (s.startsWith("[")) {
    let i = 0;
    while (i < s.length) {
      if (" \t\r\n,;".includes(s[i])) {
        i++;
        continue;
      }
      if (s[i] !== "[") return { error: `expected "[" to start a row, got "${s[i]}"` };
      const close = s.indexOf("]", i + 1);
      if (close < 0) return { error: 'unclosed "["' };
      const inner = s.slice(i + 1, close);
      if (inner.includes("[")) return { error: 'unexpected "[" inside row' };
      rowStrings.push(inner);
      i = close + 1;
    }
  } else {
    if (s.includes("[") || s.includes("]")) return { error: 'unexpected "[" or "]"' };
    rowStrings.push(...s.split(/[;\r\n]+/));
  }
  let cols = 0;
  const cells: number[][] = [];
  for (const raw of rowStrings) {
    const tokens = raw.replaceAll(",", " ").trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const row: number[] = [];
    for (const tok of tokens) {
      const n = Number(tok);
      if (!NUMBER_TOKEN.test(tok) || !Number.isFinite(n)) return { error: `"${tok}" is not a finite number` };
      row.push(n);
    }
    if (cells.length === 0) cols = row.length;
    else if (row.length !== cols) return { error: `row ${cells.length} has ${row.length} columns, expected ${cols}` };
    cells.push(row);
  }
  return { rows: cells.length, cols, cells };
}

/** Parse MATLAB-style matrix text ("1 2; 3 4", newlines, commas, brackets) and report its shape or error. */
export function parseMatrix(text: string): { rows: number; cols: number } | { error: string } {
  const parsed = parseMatrixCells(text);
  return "error" in parsed ? parsed : { rows: parsed.rows, cols: parsed.cols };
}

const NAME = /^[A-Za-z_]\w*$/;
const RESERVED = new Set(["t", "pi", "e", "sin", "cos", "tan", "asin", "acos", "atan", "atan2", "sinh", "cosh", "tanh", "exp", "log", "log10",
  "sqrt", "abs", "floor", "ceil", "round", "sign", "frac", "min", "max", "clamp", "mod", "pow"]);

/** Why `name` can't be a variable's name among `list` (except `self`), or "". */
export function badName(name: string, list: Variables, self?: string): string {
  if (!NAME.test(name)) return "letters, digits and _, not starting with a digit";
  if (RESERVED.has(name)) return `${name} is a formula's own name`;
  if (name !== self && list.some((v) => v.name === name)) return `there's already a ${name}`;
  return "";
}

/** `base`, or `base_2`, `base_3`… : a name no variable in `list` has. */
export function freeName(base: string, list: Variables): string {
  const clean = /^[A-Za-z_]/.test(base) ? base.replace(/\W/g, "_") : `v_${base.replace(/\W/g, "_")}`;
  const start = RESERVED.has(clean) ? `${clean}_1` : clean;
  if (!list.some((v) => v.name === start)) return start;
  let i = 2;
  while (list.some((v) => v.name === `${start}_${i}`)) i++;
  return `${start}_${i}`;
}

/**
 * The variables in use: the user's own (their order), then the station's defaults they
 * don't mention. A default the user never touched is the station's, so a newer station's
 * new default shows up; deleting a default brings it back (Reset).
 */
export function merged(defaults: Variables, mine: Variables | undefined): Variables {
  if (!mine) return defaults;
  const named = new Set(mine.map((v) => v.name));
  return [...mine, ...defaults.filter((v) => !named.has(v.name))];
}

/** The default value of a new variable of `type`. */
export function emptyOf(type: Variable["type"], options?: string[]): Variable["value"] {
  return type === "number" ? 0 : type === "boolean" ? false : type === "enum" ? (options?.[0] ?? "a") : type === "matrix" ? "1 0; 0 1" : "";
}

const tomlString = (s: string) => JSON.stringify(s);

/** The list as a descriptor's [[variables]] tables, to paste and make them a station's defaults. */
export function toToml(list: Variables): string {
  return list
    .map((v) => {
      const lines = ["[[variables]]", `name = ${tomlString(v.name)}`, `type = ${tomlString(v.type)}`];
      if (v.expr !== undefined) lines.push(`expr = ${tomlString(v.expr)}`);
      else if (v.value !== undefined) lines.push(`value = ${typeof v.value === "string" ? tomlString(v.value) : String(v.value)}`);
      for (const k of ["unit", "note", "group"] as const) if (v[k]) lines.push(`${k} = ${tomlString(v[k]!)}`);
      for (const k of ["min", "max", "step"] as const) if (v[k] !== undefined) lines.push(`${k} = ${v[k]}`);
      if (v.whole) lines.push("whole = true");
      for (const k of ["exposed", "dock", "tunable"] as const) if (v[k]) lines.push(`${k} = true`);
      if (v.options) lines.push(`options = [${v.options.map(tomlString).join(", ")}]`);
      return lines.join("\n");
    })
    .join("\n\n");
}

/** A variable as a param field suggests it: its name, its type line (`typeLine`) and its value as shown (`valueText`). */
export type VarHint = { name: string; type: string; value: string };

/** What a param field shows for `value`: a number, a variable's name, a formula. */
export const paramText = (value: unknown): string =>
  isRef(value) ? ("var" in value ? value.var : value.expr) : value === undefined || value === null ? "" : String(value);

/** What the text typed into a param field means: a number, a variable (a name in `names`), else a formula; nothing if empty. */
export function parseParam(text: string, names: readonly string[]): number | Ref | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (Number.isFinite(n)) return n;
  return names.includes(t) ? { var: t } : { expr: t };
}

/** The name being typed before the caret (`ka` in `2*ka|`): where it starts; none inside a number (`1e`) or after a dot. */
export function nameAt(text: string, caret: number): { from: number; word: string } | null {
  const m = /[A-Za-z_]\w*$/.exec(text.slice(0, caret));
  if (!m || /[\w.]/.test(text[m.index - 1] ?? "")) return null;
  return { from: m.index, word: m[0] };
}

/** The variables a typed `word` may mean: those starting with it, then those containing it (any case); eight at most. */
export function suggestVars<T extends { name: string }>(vars: readonly T[], word: string): T[] {
  const w = word.toLowerCase();
  const starts = vars.filter((v) => v.name.toLowerCase().startsWith(w));
  return [...starts, ...vars.filter((v) => !starts.includes(v) && v.name.toLowerCase().includes(w))].slice(0, 8);
}
