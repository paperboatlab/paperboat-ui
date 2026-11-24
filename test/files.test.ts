import assert from "node:assert/strict";
import { test } from "node:test";
import type { FileEntry } from "../src/files/FileTree.tsx";
import { dropTarget, parentsOf } from "../src/files/tree.ts";

const E = (path: string, depth: number, kind: "file" | "folder" = "file"): FileEntry => ({ path, name: path.split("/").pop()!, depth, kind });
const tree = [E("src", 0, "folder"), E("src/a.jl", 1), E("src/lib", 1, "folder"), E("src/lib/b.jl", 2), E("src/c.jl", 1), E("data", 0, "folder"), E("data/x.csv", 1), E("README.md", 0)];
const parents = parentsOf(tree);
const at = (p: string) => tree.find((e) => e.path === p)!;
const into = (row: string | undefined, source: string) => {
  const t = dropTarget(tree, parents, row ? at(row) : undefined, source);
  return t.ok ? (t.folder?.path ?? "/") : "refused";
};

test("a drop on a row inside an expanded folder lands in that folder, not at the root", () => {
  assert.equal(into("data/x.csv", "README.md"), "data");     // the reported bug
  assert.equal(into("src/c.jl", "data/x.csv"), "src");       // after a subfolder, back at the folder's level
  assert.equal(into("src/lib/b.jl", "src/a.jl"), "src/lib");
});

test("a drop on a folder row lands in it; on a root row or the empty tree, at the root", () => {
  assert.equal(into("data", "src/a.jl"), "data");
  assert.equal(into("README.md", "src/a.jl"), "/");
  assert.equal(into(undefined, "src/lib/b.jl"), "/");
});

test("a folder never moves into itself or its own subfolders, and nothing moves to where it is", () => {
  assert.equal(into("src/lib/b.jl", "src"), "refused");
  assert.equal(into("src/lib", "src/lib"), "refused");
  assert.equal(into("src/c.jl", "src/a.jl"), "refused");    // already in src
  assert.equal(into(undefined, "README.md"), "refused");    // already at the root
});
