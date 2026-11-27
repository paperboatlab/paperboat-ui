import assert from "node:assert/strict";
import { test } from "node:test";
import { byMenu, exampleCommands, exampleFromUrl, rank } from "../src/commands.ts";

test("examples: Open example: <name> in the command search only, each opening its id", () => {
  const opened: string[] = [];
  const ex = { app: "simplicial", kind: "simplicial", description: "d", path: "/p" };
  const cmds = exampleCommands([{ ...ex, id: "simplicial/09-modular-synth-cpp", name: "09 Modular Synth" }, { ...ex, id: "simplicial/10-train", name: "10 Train" }], (id) => opened.push(id));
  assert.deepEqual(cmds.map((c) => c.label), ["Open example: 09 Modular Synth", "Open example: 10 Train"]);
  assert.deepEqual(byMenu(cmds, [{ id: "file", label: "File" }]), []);
  rank("example synth", cmds)[0].run();
  assert.deepEqual(opened, ["simplicial/09-modular-synth-cpp"]);
});

test("exampleFromUrl: what paperboat example open put in the URL (paperboat#75)", () => {
  assert.equal(exampleFromUrl(""), null);
  assert.equal(exampleFromUrl("?open=a.jl"), null);
  assert.deepEqual(exampleFromUrl("?example=julix/01-numerics&name=01%20Numerics&to=/home/me/my%20work&cache=1"),
    { id: "julix/01-numerics", name: "01 Numerics", to: "/home/me/my work", cache: true });
  assert.deepEqual(exampleFromUrl("?example=hubs/lab"), { id: "hubs/lab", name: "hubs/lab", cache: false });
});
