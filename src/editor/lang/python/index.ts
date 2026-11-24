import { python as grammar } from "@codemirror/lang-python";
import { runtimeComplete, runtimeLint, type Language } from "../../language.ts";

/** Python: highlighting here; lint (`compile` and its warnings) and completion from the python runtime. */
export const python: Language = {
  id: "python", label: "Python", extensions: ["py", "pyi"], runtime: "python",
  grammar: () => grammar(), lint: runtimeLint, complete: runtimeComplete,
};
