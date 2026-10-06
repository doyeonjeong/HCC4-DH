import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { loadProjectConfig } from "./lib/config.mjs";

const toolsRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(toolsRoot, "..");

function selectedGate(args) {
  if (args.length !== 2 || args[0] !== "--gate" || !["G1", "G2"].includes(args[1])) {
    throw new TypeError("usage: node tools/build-figma-gate.mjs --gate G1|G2");
  }
  return args[1];
}

function createEntry({ gate, rules, preset, rulesSha256, presetSha256 }) {
  return `
    import { dumpFigmaPage } from "./figma-dump.js";
    import { evaluateGate } from "./lib/gates/evaluate.js";
    const rules = ${JSON.stringify(rules)};
    const preset = ${JSON.stringify(preset)};
    const rulesSha256 = ${JSON.stringify(rulesSha256)};
    const presetSha256 = ${JSON.stringify(presetSha256)};
    export async function run(figmaApi, gate) {
      const pageName = rules.gates[gate].page;
      const dump = await dumpFigmaPage(figmaApi, pageName);
      const result = evaluateGate(dump, rules, preset, gate);
      const checks = Object.entries(result.checks).map(([name, check]) => ({
        name,
        pass: check.pass,
        count: check.count,
        ...(check.pass ? {} : { node_ids: check.nodes.slice(0, 3) }),
      }));
      const summary = {
        gate: result.gate,
        pass: result.pass,
        page: result.page,
        node_count: result.node_count,
        rules_sha256: rulesSha256,
        preset_sha256: presetSha256,
        preset: { name: preset.name, viewport: preset.viewport, safe_area_top: preset.safe_area.top, target_minimum_size: preset.target.minimum_size },
        checks,
      };
      // The Figma plugin sandbox has no TextEncoder, so count UTF-8 bytes directly.
      const json = JSON.stringify(summary);
      let bytes = 0;
      for (const char of json) { const code = char.codePointAt(0); bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4; }
      if (bytes > 18000) {
        throw new Error("gate summary exceeds 18KB; reduce the number of reported violations");
      }
      return summary;
    }
  `.replace(/\/\*BUILD_GATE\*\//, `/*BUILD_GATE:${gate}*/`);
}

export async function buildFigmaGate(gate) {
  if (!["G1", "G2"].includes(gate)) throw new TypeError("gate must be G1 or G2");
  const { rules, preset, rulesText, presetText } = await loadProjectConfig(projectRoot);
  const rulesSha256 = createHash("sha256").update(rulesText).digest("hex");
  const presetSha256 = createHash("sha256").update(presetText).digest("hex");
  const result = await build({
    stdin: { contents: createEntry({ gate, rules, preset, rulesSha256, presetSha256 }), resolveDir: toolsRoot, sourcefile: "figma-gate.entry.js", loader: "js" },
    bundle: true,
    write: false,
    platform: "browser",
    target: "es2020",
    format: "iife",
    globalName: "FigmaGate",
    minify: true,
    legalComments: "none",
    footer: { js: `return FigmaGate.run(figma, ${JSON.stringify(gate)});` },
  });
  const contents = result.outputFiles[0].contents;
  const outputPath = resolve(toolsRoot, "dist", `figma-gate-${gate}.js`);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, contents);
  return { outputPath, sizeBytes: contents.byteLength };
}

async function main() {
  const gate = selectedGate(process.argv.slice(2));
  const result = await buildFigmaGate(gate);
  process.stdout.write(`Figma ${gate} bundle: ${result.sizeBytes} bytes (${resolve(result.outputPath)})\n`);
  if (result.sizeBytes >= 50 * 1024) {
    process.stderr.write("bundle must be smaller than 50KB\n");
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`Figma bundle build failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
