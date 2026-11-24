import { test } from "node:test";
import assert from "node:assert/strict";
import { chordMatches } from "../src/commands.ts";
import { HELP_CHORD, helpCommand, matches } from "../src/help.ts";

test("help items match every word of the query", () => {
  const item = { id: "svd", title: "svd", kind: "function", summary: "singular value decomposition" };
  assert.ok(matches(item, ""));
  assert.ok(matches(item, "SVD value"));
  assert.ok(!matches(item, "svd eigen"));
});

test("F1 opens help in every app", () => {
  let opened = 0;
  const c = helpCommand(() => opened++);
  assert.equal(c.shortcut, "F1");
  assert.ok(chordMatches(HELP_CHORD, { key: "F1", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }));
  c.run();
  assert.equal(opened, 1);
});

import { combineHelp, docsHelp, loadDocs, type DocSite } from "../src/docs.ts";

const site: DocSite = {
  site: "paperboat", title: "Paperboat", url: "https://x.test/paperboat/",
  items: [
    { id: "flow", title: "Flows", page: "Flows", url: "https://x.test/paperboat/flow.html", summary: "Signal and Step flows.", html: "<p>Signal and Step flows.</p>" },
    { id: "blocks/pid", title: "PID", page: "PID", url: "https://x.test/toolkits/control/blocks/pid.html", summary: "A PID.", html: "<p>A PID.</p>", block: "pid" },
    { id: "flow#story-groups", title: "Story groups", page: "Flows", url: "https://x.test/paperboat/flow.html#story-groups", summary: "A procedure.", html: "<p>Make a Step flow read as a procedure. See <a href=\"https://x.test/paperboat/flow.html\">Flows</a>.</p>" },
  ],
  blocks: { pid: "<p>Tune kp first.</p>" },
};

test("docs help lists pages, then finds sections by title before text", async () => {
  let loads = 0;
  const help = docsHelp(async () => { loads++; return [site]; });
  assert.equal(loads, 0, "nothing loads before Help is used");
  assert.deepEqual((await help.items("")).map((i) => i.title), ["Flows"]);
  assert.deepEqual((await help.items("procedure")).map((i) => i.title), ["Story groups"]);
  assert.deepEqual((await help.items("pid")).map((i) => i.title), [], "block pages come from the live catalog");
  assert.deepEqual((await help.items("step flows")).map((i) => i.title), ["Flows", "Story groups"]);
  const page = await help.page("doc:paperboat:flow#story-groups");
  assert.equal(page?.link?.href, "https://x.test/paperboat/flow.html#story-groups");
  assert.equal(help.link?.("https://x.test/paperboat/flow.html"), "Flows");
  assert.equal(await help.blockProse("pid", "control"), "<p>Tune kp first.</p>");
  assert.equal(loads, 1, "loaded once");
});

test("docs that fail to load leave one topic that says so", async () => {
  const help = docsHelp(Promise.reject(new Error("offline")));
  const items = await help.items("anything");
  assert.equal(items[0].id, "doc:offline");
  assert.match((await help.page("doc:offline"))?.text ?? "", /couldn't load/);
});

test("loadDocs reads sites.json, takes the sites asked for, skips the ones that fail", async () => {
  const files: Record<string, unknown> = {
    "https://x.test/sites.json": [
      { site: "paperboat", title: "Paperboat", kind: "engine", help: "paperboat/help.json" },
      { site: "toolkits/control", title: "control", kind: "toolkit", help: "toolkits/control/help.json" },
      { site: "apps/squero-studio-om", title: "OM", kind: "squero", help: "apps/squero-studio-om/help.json" },
    ],
    "https://x.test/paperboat/help.json": site,
  };
  const get = async (url: string) => ({ ok: url in files, status: 404, json: async () => files[url] });
  const got = await loadDocs((s) => s.kind !== "squero", "https://x.test/", get);
  assert.deepEqual(got.map((s) => s.site), ["paperboat"]);
});

test("combined help asks each provider in turn", async () => {
  const a = { items: () => [{ id: "a", title: "A" }], page: (id: string) => (id === "a" ? { title: "A" } : null) };
  const b = { items: () => [{ id: "b", title: "B" }], page: (id: string) => (id === "b" ? { title: "B" } : null), link: () => "B" };
  const help = combineHelp(a, b);
  assert.deepEqual((await help.items("")).map((i) => i.id), ["a", "b"]);
  assert.equal((await help.page("b"))?.title, "B");
  assert.equal(help.link?.("x"), "B");
});
