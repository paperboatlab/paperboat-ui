import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyOf, fits, inlineLive, matrixLiteral, parseMatrix, parseMatrixCells } from "../../src/canvas/bindings.ts";
import type { ParamDef, Variable } from "../../src/canvas/types.ts";

test("matrixLiteral turns JSON rows into MATLAB-style text and keeps a literal", () => {
  assert.equal(matrixLiteral([[1, 2], [3, 4]]), "1 2; 3 4");
  assert.equal(matrixLiteral("[[1,2],[3,4]]"), "1 2; 3 4");
  assert.equal(matrixLiteral([1, 2, 3]), "1 2 3");
  assert.equal(matrixLiteral("1 0; 0 1"), "1 0; 0 1");
});

test("parseMatrix checks syntax and reports rows and columns", () => {
  assert.deepEqual(parseMatrix("1 2; 3 4"), { rows: 2, cols: 2 });
  assert.deepEqual(parseMatrix("[[1, 2], [3, 4]]"), { rows: 2, cols: 2 });
  assert.deepEqual(parseMatrix("1, 2\n3, 4"), { rows: 2, cols: 2 });
  assert.deepEqual(parseMatrix(""), { rows: 0, cols: 0 });
  assert.deepEqual(parseMatrix("[]"), { rows: 0, cols: 0 });
  assert.match((parseMatrix("1 2; 3") as { error: string }).error, /row 1 has 1 columns, expected 2/);
  assert.match((parseMatrix("1 x") as { error: string }).error, /"x" is not a finite number/);
  assert.match((parseMatrix("[1 2") as { error: string }).error, /unclosed "\["/);
  assert.deepEqual(parseMatrixCells("1 2; 3 4"), { rows: 2, cols: 2, cells: [[1, 2], [3, 4]] });
  assert.deepEqual(parseMatrixCells("[[1.5, -2], [3e1, 4]]"), { rows: 2, cols: 2, cells: [[1.5, -2], [30, 4]] });
});

const A: Variable = { name: "A", type: "matrix", value: "1 2; 3 4", source: "mx" };
const k: Variable = { name: "k", type: "number", value: 2, source: "mx" };
const note: Variable = { name: "note", type: "text", value: "hello" };

test("a matrix fits a matrix param, not text, number or file; text does not fit matrix", () => {
  assert.equal(fits(A, { id: "values", type: "matrix" } as ParamDef), true);
  assert.equal(fits(A, { id: "values", type: "text" } as ParamDef), false);
  assert.equal(fits(A, { id: "gain", type: "number" } as ParamDef), false);
  assert.equal(fits(A, { id: "path", type: "file" } as ParamDef), false);
  assert.equal(fits(note, { id: "values", type: "matrix" } as ParamDef), false);
  assert.equal(emptyOf("matrix"), "1 0; 0 1");
});

test("inlineLive replaces live references with values and leaves the rest", () => {
  const out = inlineLive({ values: { var: "A" }, gain: { var: "k" }, f: { expr: "2 * k" }, own: { var: "m" }, n: 3 }, [A, k]);
  assert.deepEqual(out, { values: "1 2; 3 4", gain: 2, f: { expr: "2 * (2)" }, own: { var: "m" }, n: 3 });
});

test("inlineLive refuses a matrix MX could not send, with its reason", () => {
  const big: Variable = { name: "B", type: "matrix", source: "mx", note: "512 × 512: too large to share live" };
  assert.throws(() => inlineLive({ values: { var: "B" } }, [big]), /B: 512 × 512: too large/);
});
