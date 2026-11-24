// Markdown, with its fenced code coloured by the other languages (```julia, ```python, ```modelica).
import { markdown as grammar } from "@codemirror/lang-markdown";
import { LanguageDescription, LanguageSupport, StreamLanguage } from "@codemirror/language";
import type { Language } from "../../language.ts";
import { julia } from "../julia/grammar.ts";
import { modelica } from "../modelica/grammar.ts";
import { python } from "@codemirror/lang-python";
import { json } from "@codemirror/lang-json";
import { toml } from "@codemirror/legacy-modes/mode/toml";

const fenced = [
  LanguageDescription.of({ name: "julia", alias: ["jl"], support: new LanguageSupport(julia) }),
  LanguageDescription.of({ name: "python", alias: ["py"], support: python() }),
  LanguageDescription.of({ name: "modelica", alias: ["mo"], support: new LanguageSupport(modelica) }),
  LanguageDescription.of({ name: "json", support: json() }),
  LanguageDescription.of({ name: "toml", support: new LanguageSupport(StreamLanguage.define(toml)) }),
];

export const markdown: Language = { id: "markdown", label: "Markdown", extensions: ["md", "markdown"], grammar: () => grammar({ codeLanguages: fenced }) };
