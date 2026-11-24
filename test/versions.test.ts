import assert from "node:assert/strict";
import { test } from "node:test";
import { compareVersions, newerRelease } from "../src/versions.ts";

test("versions compare by number, a prerelease before its release", () => {
  assert.ok(compareVersions("0.1.1", "0.1.0") > 0);
  assert.ok(compareVersions("0.10.0", "0.9.9") > 0);
  assert.ok(compareVersions("v0.1.0", "0.1.0-alpha.8") > 0);
  assert.ok(compareVersions("0.1.0-alpha.10", "0.1.0-alpha.9") > 0);
  assert.equal(compareVersions("0.1.0", "0.1.0"), 0);
  assert.ok(Number.isNaN(compareVersions("dev", "0.1.0")));
});

test("the update is the newest release newer than the installed one", () => {
  assert.equal(newerRelease("0.1.0", ["0.1.1", "0.1.0"]), "0.1.1");
  assert.equal(newerRelease("0.1.1", ["0.1.1", "0.1.0"]), undefined);
  assert.equal(newerRelease("0.1.0", ["0.1.0", "0.2.0", "0.1.5"]), "0.2.0");
  // A branch install (dev) or one with no version: the newest release, since nothing says how old it is.
  assert.equal(newerRelease("dev", ["0.1.0", "0.1.1", "dev"]), "0.1.1");
  assert.equal(newerRelease(undefined, ["0.1.1"]), "0.1.1");
  assert.equal(newerRelease("0.1.0", []), undefined);
});
