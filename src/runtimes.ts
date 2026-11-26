// The runtimes key's words (RuntimesKey.tsx; ui-example "Runtimes key"): a row's logo and line, the key's
// badge and name. Pure, so the apps show a session the same way whatever their daemon calls it.
import type { IconName } from "./icons.ts";

/** Not started, starting, up and idle, running something, failed. */
export type RuntimeState = "off" | "starting" | "idle" | "busy" | "failed";

/** One runtime or session in the peek. Times in seconds, memory in bytes, cpu in percent. */
export type Runtime = {
  id: string;
  /** What the row says in bold: "Julia 1.11.6". */
  name: string;
  /** Its language ("julia", "python", "openmodelica"; a pin like "julia@1.11.9" too): the logo. */
  lang: string;
  state: RuntimeState;
  /** How it runs: "podman", a mode. */
  via?: string;
  up?: number;
  idle?: number;
  memory?: number;
  cpu?: number;
  /** What runs now (busy, starting): "cell [4] in step-response". */
  now?: string;
  /** A line under it: what uses it, what needs it, why it failed. */
  note?: string;
  /** The row's keys, each shown when given and the state allows it. */
  onInterrupt?: () => void;
  onRestart?: () => void;
  onStop?: () => void;
  onStart?: () => void;
};

export const STATE_WORDS: Record<RuntimeState, string> = { off: "not started", starting: "starting", idle: "idle", busy: "running", failed: "failed" };

const LOGOS: Record<string, string> = { julia: "jl", python: "py", openmodelica: "mo", modelica: "mo", omc: "mo" };
const ICONS: Record<string, IconName> = { jl: "lang-julia", py: "lang-python", mo: "lang-modelica" };

/** The two letters in a row's square: "julia@1.11.9" is jl. */
export function runtimeLogo(lang: string) {
  const l = lang.split("@")[0].trim().toLowerCase();
  return LOGOS[l] ?? l.slice(0, 2);
}

/** The language's icon (icons.toml lang-*), or undefined for a language without one: then its letters. */
export const runtimeIcon = (lang: string): IconName | undefined => ICONS[runtimeLogo(lang)];

export const duration = (s: number) => (s < 60 ? `${Math.round(s)} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`);
export const bytes = (b: number) => (b >= 1 << 30 ? `${(b / (1 << 30)).toFixed(1)} GB` : `${Math.round(b / (1 << 20))} MB`);

/** The mono line under a row's name: "session · podman · up 42 min · 1.2 GB". */
export function runtimeLine(r: Runtime) {
  if (r.state === "off") return "not started · starts on first use";
  const time = r.state === "idle" && r.idle !== undefined ? `idle ${duration(r.idle)}` : r.up !== undefined && r.state !== "failed" ? `up ${duration(r.up)}` : "";
  const head = r.state === "idle" || r.state === "busy" ? "session" : STATE_WORDS[r.state];
  return [head, r.via, time, r.memory ? bytes(r.memory) : "", r.cpu !== undefined && r.state !== "failed" ? `${Math.round(r.cpu)} % cpu` : ""].filter(Boolean).join(" · ");
}

export type RuntimesSummary = { count: number; live: boolean; failed: boolean };

/** The key: its badge counts the sessions up (! when one failed); its border runs while one works. */
export function runtimesSummary(rs: readonly Runtime[]): RuntimesSummary {
  const has = (...s: RuntimeState[]) => rs.filter((r) => s.includes(r.state)).length;
  return { count: has("idle", "busy", "starting"), live: has("busy", "starting") > 0, failed: has("failed") > 0 };
}

/** The key's name for a screen reader and its tooltip: "Runtimes: 2 sessions, running". */
export function runtimesLabel({ count, live, failed }: RuntimesSummary) {
  const parts = [count && `${count} session${count === 1 ? "" : "s"}`, live && "running", failed && "one failed"].filter(Boolean);
  return parts.length ? `Runtimes: ${parts.join(", ")}` : "Runtimes";
}
