import { parseAbbreviations, type Abbreviations } from "../../abbreviations.ts";
import { runtimeComplete, runtimeLint, type Language } from "../../language.ts";
import { julia as grammar } from "./grammar.ts";
import { JULIA_SYMBOLS } from "./symbols.ts";

let table: Abbreviations | undefined;

/** Julia: highlighting here; lint (JuliaSyntax) and completion from the julia runtime; \alpha<Tab> → α here. */
export const julia: Language = {
  id: "julia", label: "Julia", extensions: ["jl"], runtime: "julia",
  grammar: () => grammar, lint: runtimeLint, complete: runtimeComplete,
  abbreviations: () => (table ??= parseAbbreviations(JULIA_SYMBOLS)),
};
