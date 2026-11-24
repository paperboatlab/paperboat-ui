// Where a dragged file lands (pure, so it is tested without a browser). A row's drop target is the folder
// that holds it: a folder row is its own target, a row inside an expanded folder lands in that folder, a
// root-level row lands at the root. Parents come from the tree's order and depths, not from path syntax
// (hosts name their entries their own way: Modelica classes, files).
import type { FileEntry } from "./FileTree.tsx";

/** Each entry's folder (undefined at the root), for entries in tree order. */
export function parentsOf(entries: readonly FileEntry[]): Map<string, FileEntry | undefined> {
  const out = new Map<string, FileEntry | undefined>();
  const stack: FileEntry[] = [];
  for (const e of entries) {
    stack.length = e.depth;
    out.set(e.path, e.depth > 0 ? stack[e.depth - 1] : undefined);
    if (e.kind === "folder") stack[e.depth] = e;
  }
  return out;
}

/** True when `folder` is `source` or lies inside it (a folder can't move into itself). */
export function within(parents: Map<string, FileEntry | undefined>, folder: FileEntry | undefined, source: string): boolean {
  for (let f = folder; f; f = parents.get(f.path)) if (f.path === source) return true;
  return false;
}

/**
 * The folder a drop on `row` moves `source` into: `{ ok: true, folder }` (folder undefined = the root), or
 * `{ ok: false }` when the move makes no sense (into itself or its own subfolder, or where it already is).
 */
export function dropTarget(entries: readonly FileEntry[], parents: Map<string, FileEntry | undefined>, row: FileEntry | undefined, source: string):
  { ok: true; folder: FileEntry | undefined } | { ok: false } {
  const folder = row ? (row.kind === "folder" ? row : parents.get(row.path)) : undefined;
  if (within(parents, folder, source)) return { ok: false };
  const from = entries.find((e) => e.path === source);
  if (!from || parents.get(from.path)?.path === folder?.path) return { ok: false };
  return { ok: true, folder };
}
