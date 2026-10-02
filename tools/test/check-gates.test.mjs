import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import test from "node:test";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runGate } from "../check-gates.mjs";

const toolsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = resolve(toolsRoot, "..");
const fixture = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures/dump-pass.json");

test("check-gates writes a hash-bound result under runs and prints only a summary", async () => {
  const runDirectory = mkdtempSync(join(projectRoot, "runs", "check-gates-"));
  try {
    const { result, summary } = await runGate({ gate: "G1", dumpPath: fixture, outPath: join(runDirectory, "G1.json") });
    assert.equal(result.gate, "G1");
    assert.equal(result.pass, false);
    assert.match(result.rules_sha256, /^[\da-f]{64}$/);
    assert.match(summary, /^G1 FAIL:/);
    assert.doesNotMatch(summary, /Continue/);
    const saved = JSON.parse(readFileSync(join(runDirectory, "G1.json"), "utf8"));
    assert.equal(saved.dump_sha256, result.dump_sha256);
    assert.equal(Object.hasOwn(saved, "text"), false);
  } finally {
    rmSync(runDirectory, { recursive: true, force: true });
  }
});

test("check-gates refuses output outside runs, including symlink escapes", async () => {
  await assert.rejects(runGate({ gate: "G1", dumpPath: fixture, outPath: "/private/tmp/unsafe-gate.json" }), /inside runs/);
});
