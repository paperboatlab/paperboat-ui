import assert from "node:assert/strict";
import { test } from "node:test";
import { actionLabel, groupKinds, pickKind, shellLine, transferMenu, typesText, type TransferKind } from "../src/transfer.ts";

const NOTE: TransferKind[] = [
  { id: "pdf", group: "Documents", name: "PDF", types: ["pdf"], line: "To print or send" },
  { id: "html", group: "Documents", name: "Web page", types: ["html"], line: "Opens in any browser" },
  { id: "md", group: "Notes", name: "Markdown", types: ["md", "zip"], line: "With its attachments" },
  { id: "slides", group: "Documents", name: "Slides", types: ["pdf"], line: "One heading a slide", why: "The note has no headings" },
];

test("kinds keep their order, grouped where a group first appears", () => {
  assert.deepEqual(groupKinds(NOTE).map((g) => [g.group, g.kinds.map((k) => k.id)]), [["Documents", ["pdf", "html", "slides"]], ["Notes", ["md"]]]);
  assert.deepEqual(groupKinds([{ id: "a", name: "A", types: [], line: "" }]).map((g) => g.group), [""]);
});

test("the primary key says what it does, keeping a name's capitals", () => {
  assert.equal(actionLabel("export", NOTE[0]), "Export PDF");
  assert.equal(actionLabel("export", NOTE[1]), "Export web page");
  assert.equal(actionLabel("import", { id: "fmu", name: "FMU", types: ["fmu"], line: "" }), "Import FMU");
  assert.equal(actionLabel("export", { ...NOTE[0], action: "Print to PDF" }), "Print to PDF");
  assert.equal(typesText(["jl", "py"]), ".jl .py");
});

test("it opens on the kind asked for, else the last, else the first that can be chosen", () => {
  assert.equal(pickKind(NOTE, "html")?.id, "html");
  assert.equal(pickKind(NOTE, "gone", "md")?.id, "md");
  assert.equal(pickKind(NOTE, "slides")?.id, "pdf", "a kind that can't be chosen now isn't opened on");
  assert.equal(pickKind(NOTE)?.id, "pdf");
  assert.equal(pickKind([]), undefined);
});

test("Export as ▸ lists every kind, greyed with why", () => {
  const opened: string[] = [];
  const item = transferMenu("export", NOTE, (m, id) => opened.push(`${m}:${id}`));
  assert.equal(item.label, "Export as");
  const sub = item.sub as { id: string; label: string; meta?: string; disabled?: boolean; why?: string; run: () => void }[];
  assert.deepEqual(sub.map((s) => s.label), ["PDF…", "Web page…", "Markdown…", "Slides…"]);
  assert.equal(sub[2].meta, ".md .zip");
  assert.deepEqual([sub[3].disabled, sub[3].why], [true, "The note has no headings"]);
  sub[1].run();
  assert.deepEqual(opened, ["export:html"]);
  assert.equal(transferMenu("import", NOTE, () => {}).label, "Import");
});

test("the terminal line quotes only what needs it", () => {
  assert.equal(shellLine(["articula", "export", "model/Furuta.mo", "--set", "alpha0=0"]), "articula export model/Furuta.mo --set alpha0=0");
  assert.equal(shellLine(["malachite", "export", "notes/E5 MPC.md"]), "malachite export 'notes/E5 MPC.md'");
  assert.equal(shellLine(["x", "it's"]), `x 'it'\\''s'`);
});
