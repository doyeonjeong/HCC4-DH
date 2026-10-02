import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadProjectConfig } from "./lib/config.mjs";
import { checkSync } from "./lib/gates/sync.js";

const toolsRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(toolsRoot, "..");
export { checkSync };

async function main(args = process.argv.slice(2)) {
  let presetOverride;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== "--preset" || !args[index + 1] || args[index + 1].startsWith("--") || presetOverride) {
      throw new TypeError("usage: node tools/check-sync.mjs [--preset mobile|web]");
    }
    presetOverride = args[index + 1];
    index += 1;
  }
  const { rules, preset } = await loadProjectConfig(projectRoot, { presetOverride });
  const design = await readFile(resolve(projectRoot, "docs/design.md"), "utf8");
  const differences = checkSync(design, rules, preset);
  if (differences.length) {
    process.stdout.write(`docs/design.md ↔ rules.yaml 불일치 ${differences.length}건\n${differences.join("\n")}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`docs/design.md ↔ rules.yaml 일치 (${preset.name}: ${preset.viewport.width}×${preset.viewport.height}, safe top ${preset.safe_area.top}, target ${preset.target.minimum_size})\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`동기화 검사 실패: ${error.message}\n`);
    process.exitCode = 1;
  });
}
