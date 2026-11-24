import type { Language } from "../../language.ts";
import { modelica as grammar } from "./grammar.ts";

/** Modelica: highlighting here. Lint will be omc's checkModel once the omc runtime serves `lint`. */
export const modelica: Language = {
  id: "modelica", label: "Modelica", extensions: ["mo"], runtime: "omc",
  grammar: () => grammar,
};
