import { runtimeComplete, runtimeLint, type Language } from "../../language.ts";
import { julia as grammar } from "./grammar.ts";

/** Julia: highlighting here; lint (JuliaSyntax) and completion from the julia runtime. */
export const julia: Language = {
  id: "julia", label: "Julia", extensions: ["jl"], runtime: "julia",
  grammar: () => grammar, lint: runtimeLint, complete: runtimeComplete,
};
