// A language for the editor: its grammar (highlighting, in the browser, instant) and, when it has them,
// lint and completion. Julia, Python and Modelica ask their runtime (paperboat-runtime/0 `lint` and
// `complete`, through the app's session); JSON, TOML and Markdown are checked here. One folder per
// language in lang/; the app only says which session serves which runtime.
import type { Extension } from "@codemirror/state";

export type Problem = { from: number; to: number; severity: "error" | "warning" | "info"; message: string };
export type Completion = { label: string; detail?: string; kind?: "function" | "variable" | "keyword" | "type" | "constant" | "text" };
export type Completions = { from: number; to: number; options: Completion[] };

/** The app's runtime session for a language (a paperboat-runtime/0 client), when one is running. */
export type Session = { request: (op: string, args: Record<string, unknown>) => Promise<unknown> };

export type Language = {
  id: string;
  label: string;
  /** File endings it takes ("jl"), and whole file names. */
  extensions: string[];
  names?: string[];
  /** The runtime that lints and completes it, when it needs one. */
  runtime?: "julia" | "python" | "omc";
  grammar: () => Extension;
  lint?: (code: string, session?: Session) => Promise<Problem[]>;
  complete?: (code: string, pos: number, session?: Session) => Promise<Completions | null>;
};

// paperboat-runtime/0 counts bytes (UTF-8); the editor counts UTF-16 units.
const enc = new TextEncoder();
export const toBytes = (code: string, pos: number) => enc.encode(code.slice(0, pos)).length;
export function fromBytes(code: string, bytes: number): number {
  let b = 0;
  for (let i = 0; i < code.length; i++) {
    if (b >= bytes) return i;
    const c = code.codePointAt(i)!;
    b += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
    if (c >= 0x10000) i++;
  }
  return code.length;
}

/** A zero-width problem (a missing `)`) still needs a character to underline: the one there, or, at a line's
 *  end, the last thing written before it (`version =` ⏎ underlines the `=`). */
export function widen(code: string, p: Problem): Problem {
  if (p.to > p.from) return p;
  if (p.from < code.length && code[p.from] !== "\n" && code[p.from] !== "\r") return { ...p, to: p.from + 1 };
  let i = Math.min(p.from, code.length);
  while (i > 0 && /\s/.test(code[i - 1])) i--;
  return i > 0 ? { ...p, from: i - 1, to: i } : { ...p, from: 0, to: Math.min(1, code.length) };
}

/** Lint through the runtime: nothing while no session runs (the grammar still colours the code). */
export async function runtimeLint(code: string, session?: Session): Promise<Problem[]> {
  if (!session) return [];
  const r = (await session.request("lint", { code })) as { problems: Problem[] };
  return r.problems.map((p) => widen(code, { ...p, from: fromBytes(code, p.from), to: fromBytes(code, p.to) }));
}

export async function runtimeComplete(code: string, pos: number, session?: Session): Promise<Completions | null> {
  if (!session) return null;
  const r = (await session.request("complete", { code, pos: toBytes(code, pos) })) as { matches: string[]; start: number; end: number };
  if (!r.matches.length) return null;
  return { from: fromBytes(code, r.start), to: fromBytes(code, r.end), options: r.matches.map((label) => ({ label })) };
}
