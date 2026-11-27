// Export and import (REBRAND "Export and import"; mockup agent-docs/rebrand/apps/articula/export.html): what an
// app can write out or read in, as kinds. One dialog draws them (Transfer.tsx); the same kinds make the app's
// "Export as ▸" and "Import ▸" submenus, so the menu, Ctrl K and the dialog list the same things.
// Pure functions and types; the app draws its own options and does the work.
import type { IconName } from "./icons.ts";
import type { MenuItem } from "./Menu.tsx";

export type TransferMode = "export" | "import";

export type TransferKind = {
  id: string;
  /** The heading it sits under in the list ("For Paperboat", "Documents"); kinds of one group sit together. */
  group?: string;
  /** What it is, in a word or two: "Station", "PDF". */
  name: string;
  /** The extensions it writes or reads, without the dot: ["pst"], ["jl", "py"]. */
  types: readonly string[];
  /** One line: what it is for, or what it makes. */
  line: string;
  /** Default the file icon. */
  icon?: IconName;
  /** The primary key's label; default "Export PDF" / "Import FMU". */
  action?: string;
  /** Can't be chosen now, and why ("Simulate first"): it stays in the list, greyed. */
  why?: string;
};

export const MODE_NAME: Record<TransferMode, string> = { export: "Export", import: "Import" };

/** ".jl .py .m" */
export const typesText = (types: readonly string[]) => types.map((t) => "." + t).join(" ");

/** The primary key: the kind's own action, else "Export station", keeping a name's capitals ("Export PDF"). */
export function actionLabel(mode: TransferMode, k: TransferKind): string {
  if (k.action) return k.action;
  const name = /^[A-Z][a-z]/.test(k.name) ? k.name[0].toLowerCase() + k.name.slice(1) : k.name;
  return `${MODE_NAME[mode]} ${name}`;
}

/** The kinds in their groups, in the order given (a group appears where its first kind is). */
export function groupKinds(kinds: readonly TransferKind[]): { group: string; kinds: TransferKind[] }[] {
  const out: { group: string; kinds: TransferKind[] }[] = [];
  for (const k of kinds) {
    const g = k.group ?? "";
    (out.find((x) => x.group === g) ?? out[out.push({ group: g, kinds: [] }) - 1]).kinds.push(k);
  }
  return out;
}

/** The kind the dialog opens on: the one asked for, else the one used last, else the first that can be chosen. */
export function pickKind(kinds: readonly TransferKind[], ...wanted: (string | null | undefined)[]): TransferKind | undefined {
  const ok = (id?: string | null) => kinds.find((k) => k.id === id && !k.why);
  for (const id of wanted) { const k = ok(id); if (k) return k; }
  return kinds.find((k) => !k.why);
}

/** "Export as ▸" or "Import ▸": one submenu item per kind, each opening the dialog on it. */
export function transferMenu(mode: TransferMode, kinds: readonly TransferKind[], open: (mode: TransferMode, id: string) => void): MenuItem {
  return {
    id: `${mode}-as`, label: mode === "export" ? "Export as" : "Import",
    sub: kinds.map((k) => ({ id: `${mode}-${k.id}`, label: `${k.name}…`, meta: typesText(k.types), disabled: !!k.why, why: k.why, run: () => open(mode, k.id) })),
    run: () => {},
  };
}

/** One argument for a shell, quoted only when it needs it: the dialog's "In a terminal" line. */
export const shellArg = (a: string) => (/^[\w./:=,@+-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`);
export const shellLine = (argv: readonly string[]) => argv.map(shellArg).join(" ");
