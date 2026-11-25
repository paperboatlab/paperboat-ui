// What the About window says (About.tsx draws it; REBRAND "About", ui-example.html §10).
import type { App } from "./fold.ts";

/** One attribution: what it is, what it does here, its licence, its link. */
export type Credit = [name: string, what: string, licence: string, url: string];

/** What the kit itself ships into every app (licences from the packages' own files). */
export const KIT_CREDITS: Credit[] = [
  ["React", "the interface", "MIT", "https://react.dev"],
  ["@xyflow/react", "the node canvas", "MIT", "https://xyflow.com"],
  ["CodeMirror, Lezer", "the code editor", "MIT", "https://codemirror.net"],
  ["uPlot", "plots", "MIT", "https://github.com/leeoniya/uPlot"],
  ["KaTeX", "maths", "MIT", "https://katex.org"],
  ["smol-toml", "TOML files", "BSD-3-Clause", "https://github.com/squirrelchat/smol-toml"],
];
export const FONT_CREDITS: Credit[] = [
  ["Geist, Geist Mono", "interface and code", "OFL-1.1", "https://vercel.com/font"],
  ["Funnel Display", "names and titles", "OFL-1.1", "https://fonts.google.com/specimen/Funnel+Display"],
  ["Codicons (classic)", "icons", "CC BY 4.0", "https://github.com/microsoft/vscode-codicons"],
];

export const appName = (app: App) => app[0].toUpperCase() + app.slice(1);

/** The app's own credits first, then the kit's it doesn't already name. */
export const builtOn = (own: Credit[]) => [...own, ...KIT_CREDITS.filter(([n]) => !own.some(([o]) => o === n))];

/** One line for a bug report: the app, its version, Paperboat's, and what it talks to. */
export function versionInfo(app: App, version: string, paperboat?: string | null, info?: string) {
  const pb = paperboat === undefined ? "" : paperboat ? `Paperboat ${paperboat}` : "Paperboat not installed";
  return [app === "paperboat" ? `Paperboat ${version}` : `${appName(app)} ${version}`, app === "paperboat" ? "" : pb, info ?? ""].filter(Boolean).join(" · ");
}
