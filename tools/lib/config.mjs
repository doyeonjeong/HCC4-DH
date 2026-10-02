import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";

export async function loadProjectConfig(projectRoot, { presetOverride } = {}) {
  const root = resolve(projectRoot);
  const rulesPath = resolve(root, "rules.yaml");
  const rulesText = await readFile(rulesPath, "utf8");
  const sourceRules = parse(rulesText);
  if (!sourceRules || sourceRules.version !== 1) throw new TypeError("rules.yaml must define version: 1");
  const selectedPreset = presetOverride ?? sourceRules.preset;
  if (typeof selectedPreset !== "string" || !/^[a-z0-9-]+$/.test(selectedPreset)) {
    throw new TypeError("rules.yaml must select a valid preset name");
  }

  const rules = selectedPreset === sourceRules.preset ? sourceRules : { ...sourceRules, preset: selectedPreset };
  const presetPath = resolve(root, "presets", `${rules.preset}.yaml`);
  const preset = parse(await readFile(presetPath, "utf8"));
  if (preset?.name !== rules.preset) throw new TypeError(`preset name must match ${rules.preset}`);
  for (const [label, value] of Object.entries({
    "viewport.width": preset?.viewport?.width,
    "viewport.height": preset?.viewport?.height,
    "safe_area.top": preset?.safe_area?.top,
    "target.minimum_size": preset?.target?.minimum_size,
  })) {
    if (!Number.isFinite(value) || value < 0 || ((label.startsWith("viewport.") || label === "target.minimum_size") && value === 0)) {
      throw new TypeError(`preset must define a valid ${label}`);
    }
  }

  return { root, rules, rulesText, preset, presetText: await readFile(presetPath, "utf8") };
}
