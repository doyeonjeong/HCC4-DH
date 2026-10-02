import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFigmaGate } from "../build-figma-gate.mjs";

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

for (const gate of ["G1", "G2"]) {
  test(`Figma ${gate} bundle is under 50KB and returns a summary only`, async () => {
    const built = await buildFigmaGate(gate);
    assert.ok(built.sizeBytes > 0 && built.sizeBytes < 50 * 1024);
    const source = await readFile(built.outputPath, "utf8");
    const pageName = gate === "G1" ? "Design System" : "Screens";
    const figma = { mixed: Symbol("mixed"), root: { children: [{ id: "page-test", name: pageName, type: "PAGE", children: [] }] } };
    const result = await new AsyncFunction("figma", source)(figma);
    assert.equal(result.gate, gate);
    assert.equal(result.page, pageName);
    assert.match(result.rules_sha256, /^[\da-f]{64}$/);
    assert.match(result.preset_sha256, /^[\da-f]{64}$/);
    assert.ok(JSON.stringify(result).length < 20_000);
    assert.ok(new TextEncoder().encode(JSON.stringify(result)).byteLength < 20_000);
    assert.equal(Object.hasOwn(result, "nodes"), false);
    assert.doesNotMatch(JSON.stringify(result), /characters|fileKey|Example label/);
  });
}

test("builder rejects an unsupported gate", async () => {
  await assert.rejects(buildFigmaGate("G3"), /gate must be G1 or G2/);
});
