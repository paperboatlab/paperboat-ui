// Data files: JSON and TOML, checked here (no runtime needed).
import { json as jsonGrammar, jsonLanguage } from "@codemirror/lang-json";
import { StreamLanguage } from "@codemirror/language";
import { toml as tomlMode } from "@codemirror/legacy-modes/mode/toml";
import { parse as parseToml, TomlError } from "smol-toml";
import { widen, type Language, type Problem } from "../../language.ts";

/** Where a parser says the problem is, as an offset: "line 2 column 3" or "position 12". */
function located(code: string, message: string): number {
  const lc = /line (\d+),? column (\d+)/i.exec(message);
  if (lc) {
    const lines = code.split("\n").slice(0, Number(lc[1]) - 1);
    return Math.min(code.length, lines.reduce((n, l) => n + l.length + 1, 0) + Number(lc[2]) - 1);
  }
  const at = /position (\d+)/i.exec(message);
  return at ? Math.min(code.length, Number(at[1])) : 0;
}

export async function jsonProblems(code: string): Promise<Problem[]> {
  if (!code.trim()) return [];
  try {
    JSON.parse(code);
    return [];
  } catch (e) {
    // the words from JSON.parse (without the document it echoes), the place from JSON's own grammar
    const message = (e as Error).message.replace(/,\s*"[\s\S]*" is not valid JSON$/, "").replace(/\s*\(line \d+ column \d+\)|\s*in JSON at position \d+/i, "");
    let from = -1;
    jsonLanguage.parser.parse(code).iterate({ enter: (n) => { if (from < 0 && n.type.isError) from = n.from; } });
    if (from < 0) from = located(code, (e as Error).message);
    return [widen(code, { from, to: from, severity: "error", message })];
  }
}

export async function tomlProblems(code: string): Promise<Problem[]> {
  try {
    parseToml(code);
    return [];
  } catch (e) {
    if (!(e instanceof TomlError)) throw e;
    const lines = code.split("\n").slice(0, e.line - 1);
    const from = Math.min(code.length, lines.reduce((n, l) => n + l.length + 1, 0) + Math.max(0, e.column - 1));
    return [widen(code, { from, to: from, severity: "error", message: e.message.split("\n")[0] })];
  }
}

export const json: Language = { id: "json", label: "JSON", extensions: ["json"], grammar: () => jsonGrammar(), lint: jsonProblems };
export const toml: Language = {
  id: "toml", label: "TOML", extensions: ["toml"], names: ["Project.toml", "Manifest.toml"],
  grammar: () => StreamLanguage.define(tomlMode), lint: tomlProblems,
};
