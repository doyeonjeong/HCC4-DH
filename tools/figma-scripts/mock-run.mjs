// Offline dry run: generate the build scripts, run them in order against the Figma mock, then evaluate
// G1/G2 on the mock pages. The preview finds script errors and obvious gate failures before any Figma call.
// It is NOT gate evidence — only the real G1/G2 bundles running in Figma count.
// Usage (from the harness root): node tools/figma-scripts/mock-run.mjs
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dumpFigmaPage } from "../figma-dump.js";
import { evaluateGate } from "../lib/gates/evaluate.js";
import { loadProjectConfig } from "../lib/config.mjs";
import { generateFigmaScripts } from "./generate.mjs";
import { createMockFigma, runScript } from "./mock-figma.mjs";

const here = dirname(fileURLToPath(import.meta.url));

export async function mockRun(projectRoot) {
  const { outputs, order, problems } = await generateFigmaScripts(projectRoot);
  if (problems.length) return { ok: false, problems, scripts: [], preview: {} };
  const { rules, preset } = await loadProjectConfig(projectRoot);
  const { figma, state } = createMockFigma();
  const scripts = [];
  for (const name of order) {
    try {
      await runScript(outputs[`figma/build-${name}.js`], figma);
      scripts.push({ name: `build-${name}.js`, ok: true });
    } catch (error) {
      scripts.push({ name: `build-${name}.js`, ok: false, error: error.message });
      return { ok: false, problems, scripts, preview: {}, figma, state };
    }
  }
  const preview = {};
  for (const gate of ["G1", "G2"]) {
    if (gate === "G2" && !(rules.screens ?? []).length) continue;
    const pageName = rules.gates[gate].page;
    if (!figma.root.children.some((p) => p.name === pageName)) continue;
    const result = evaluateGate(await dumpFigmaPage(figma, pageName), rules, preset, gate);
    preview[gate] = { pass: result.pass, failed: Object.entries(result.checks).filter(([, c]) => !c.pass).map(([name, c]) => `${name} ${c.count}`) };
  }
  const ok = Object.values(preview).every((p) => p.pass);
  return { ok, problems, scripts, preview, figma, state };
}

async function main() {
  const result = await mockRun(resolve(here, "../.."));
  for (const problem of result.problems) process.stdout.write(`생성 문제: ${problem}\n`);
  for (const script of result.scripts) process.stdout.write(`${script.ok ? "OK  " : "실패"} ${script.name}${script.error ? ` — ${script.error}` : ""}\n`);
  if (result.state) process.stdout.write(`변수 ${result.state.variables.length}, 글자 스타일 ${result.state.textStyles.length}\n`);
  for (const [gate, preview] of Object.entries(result.preview)) {
    process.stdout.write(`모의 ${gate}: ${preview.pass ? "통과" : `실패 (${preview.failed.join(", ")})`}\n`);
  }
  process.stdout.write("모의 실행 결과는 게이트 증거가 아니다. 크기 계산·렌더링은 하지 않는다.\n");
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`모의 실행 실패: ${error.message}\n`);
    process.exitCode = 1;
  });
}
