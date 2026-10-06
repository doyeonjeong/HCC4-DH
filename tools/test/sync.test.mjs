import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectConfig } from "../lib/config.mjs";
import { checkSync } from "../lib/gates/sync.js";

// Tool tests read a fixed starter project so filling rules.yaml/docs for a real project does not break them.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures/starter-project");
const design = await readFile(resolve(root, "docs/design.md"), "utf8");
const { rules } = await loadProjectConfig(root);

test("check-sync accepts the starter design document and mobile preset", async () => {
  const { preset } = await loadProjectConfig(root);
  assert.deepEqual(checkSync(design, rules, preset), []);
  assert.equal(preset.name, "mobile");
});

test("check-sync also accepts web values through the preset reference", async () => {
  const { rules: webRules, preset: web } = await loadProjectConfig(root, { presetOverride: "web" });
  assert.deepEqual(checkSync(design, webRules, web), []);
  assert.equal(web.viewport.width, 1440);
  assert.equal(web.safe_area.top, 0);
  assert.equal(web.target.minimum_size, 24);
});

test("check-sync detects changed, missing, and unregistered token rows", async () => {
  const { preset } = await loadProjectConfig(root);
  assert.ok(checkSync(design.replace("#315FE8", "#000000"), rules, preset).some((item) => item.includes("tokens.colors.primary")));
  assert.ok(checkSync(design.replace("| spacing | xs | 8px |\n", ""), rules, preset).some((item) => item.includes("tokens.spacing.xs")));
  assert.ok(checkSync(design.replace("| radius | full | 9999px |", "| radius | extra | 7px |"), rules, preset).some((item) => item.includes("tokens.radii.extra")));
});

test("check-sync requires the selected preset and safe-area token references", async () => {
  const { preset } = await loadProjectConfig(root);
  const missingPreset = design.replaceAll("presets/{rules.preset}.yaml", "presets/mobile.yaml");
  assert.ok(checkSync(missingPreset, rules, preset).some((item) => item.includes("preset")));
  const missingBinding = design.replaceAll("paddingTop", "topPadding");
  assert.ok(checkSync(missingBinding, rules, preset).some((item) => item.includes("tokens.safe_area")));
});

test("check-sync catches divergent component limits in rules.yaml", async () => {
  const { preset } = await loadProjectConfig(root);
  const changed = structuredClone(rules);
  changed.gates.G1.checks.component_count_max += 1;
  changed.gates.G1.checks.variant_axes_max += 1;
  const differences = checkSync(design, changed, preset);
  assert.ok(differences.some((item) => item.includes("component_count_max")));
  assert.ok(differences.some((item) => item.includes("variant_axes_max")));
});
