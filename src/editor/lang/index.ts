// Every language the editor knows, one folder each.
import type { Language } from "../language.ts";
import { json, toml } from "./data/index.ts";
import { julia } from "./julia/index.ts";
import { markdown } from "./markdown/index.ts";
import { modelica } from "./modelica/index.ts";
import { plaintext } from "./plaintext/index.ts";
import { python } from "./python/index.ts";

export { json, julia, markdown, modelica, plaintext, python, toml };
export const LANGUAGES: readonly Language[] = [julia, python, modelica, json, toml, markdown, plaintext];

/** The language for a file name: a whole name first (Project.toml), then its ending; plain text otherwise. */
export function languageFor(file: string): Language {
  const name = file.split(/[\\/]/).pop() ?? file;
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
  return LANGUAGES.find((l) => l.names?.includes(name)) ?? LANGUAGES.find((l) => l.extensions.includes(ext)) ?? plaintext;
}
