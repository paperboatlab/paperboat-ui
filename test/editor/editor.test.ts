import assert from "node:assert/strict";
import { test } from "node:test";
import { fromBytes, toBytes, widen } from "../../src/editor/language.ts";
import { jsonProblems, tomlProblems } from "../../src/editor/lang/data/index.ts";
import { languageFor } from "../../src/editor/lang/index.ts";
import { EDITOR_THEMES, paletteOf, type EditorPalette } from "../../src/editor/themes/index.ts";

// WCAG 2 contrast
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const TEXT: (keyof EditorPalette)[] = ["foreground", "gutterText", "comment", "keyword", "string", "builtin", "escape", "number", "operator", "punctuation", "property", "function", "type", "definition", "error"];

test("every theme of the collection reads at ≥ 4.5:1, in each app theme it follows", () => {
  for (const t of EDITOR_THEMES)
    for (const p of [t.light, t.dark].filter(Boolean) as EditorPalette[])
      for (const k of TEXT) {
        const c = p[k] as string;
        assert.match(c, /^#[0-9a-f]{6}$/i, `${t.id} ${k} is plain hex`);
        assert.ok(ratio(c, p.background) >= 4.5, `${t.id} (${p.dark ? "dark" : "light"}) ${k} ${c} on ${p.background}: ${ratio(c, p.background).toFixed(2)}`);
      }
});

test("the cursor is never the accent and red is only for errors", () => {
  for (const t of EDITOR_THEMES)
    for (const p of [t.light, t.dark].filter(Boolean) as EditorPalette[]) {
      assert.doesNotMatch(p.cursor, /accent|signal/, t.id);
      for (const k of TEXT.filter((k) => k !== "error")) assert.notEqual(p[k], p.error, `${t.id} ${k}`);
    }
});

test("Ink is the default and follows light and dark; a user theme starts from its base", () => {
  assert.equal(paletteOf("ink", "light").dark, false);
  assert.equal(paletteOf("ink", "dark").dark, true);
  assert.equal(paletteOf("nope", "dark").background, paletteOf("ink", "dark").background);
  assert.equal(paletteOf("harbor", "light").dark, true);  // a fixed theme stays itself
  const mine = paletteOf("mine", "light", { mine: { base: "sepia", keyword: "#123456" } });
  assert.equal(mine.keyword, "#123456");
  assert.equal(mine.background, paletteOf("sepia", "light").background);
});

test("a file's language: whole names first, then the ending", () => {
  assert.equal(languageFor("src/pendulum.jl").id, "julia");
  assert.equal(languageFor("fit.py").id, "python");
  assert.equal(languageFor("Tank.mo").id, "modelica");
  assert.equal(languageFor("Project.toml").id, "toml");
  assert.equal(languageFor("data/run.JSON").id, "json");
  assert.equal(languageFor("README.md").id, "markdown");
  assert.equal(languageFor("Makefile").id, "plaintext");
});

test("bytes (the runtime) and characters (the editor) convert both ways", () => {
  const code = "θ = 1 # é😀x";
  for (let i = 0; i <= code.length; i++) {
    if (i > 0 && code.codePointAt(i - 1)! > 0xffff) continue;  // inside a surrogate pair
    assert.equal(fromBytes(code, toBytes(code, i)), i);
  }
  assert.deepEqual(widen("ab", { from: 2, to: 2, severity: "error", message: "" }).from, 1);
  const eol = widen("version = \nx", { from: 10, to: 10, severity: "error", message: "" });
  assert.equal("version = \nx".slice(eol.from, eol.to), "=");  // the last thing written, not the line break
});

test("JSON and TOML are checked here, with the place of the problem", async () => {
  assert.deepEqual(await jsonProblems('{"a": 1}'), []);
  const j = await jsonProblems('{"a": 1,\n "b": }');
  assert.equal(j.length, 1);
  assert.ok(j[0].from > 8, `json problem on line 2 (at ${j[0].from})`);
  assert.deepEqual(await tomlProblems('name = "pendulum"\nauthors = ["a", "b"]\n[deps]\nJSON = "682c06a0"\n[[runs]]\nt = 1.5\n'), []);
  const t = await tomlProblems('name = "x"\nversion = \n');
  assert.equal(t.length, 1);
  assert.ok(t[0].from >= 11, `toml problem on line 2 (at ${t[0].from})`);
});
