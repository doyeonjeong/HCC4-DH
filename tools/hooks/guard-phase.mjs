import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";
import { block, findHarnessRoot, readHookInput, readState } from "./context.mjs";

// Figma MCP direct install and the Claude Code Figma plugin expose different tool names.
const FIGMA_TOOLS = new Set(["mcp__figma__use_figma", "mcp__plugin_figma_figma__use_figma"]);
const isFigmaTool = (name) => FIGMA_TOOLS.has(name);
const isArtifactTool = (name) => /artifact/i.test(String(name ?? ""));

function toolText(input) {
  try {
    return JSON.stringify(input.tool_input ?? {});
  } catch {
    return "";
  }
}

function currentGateRun(text, gate) {
  const compact = text.replace(/\s+/g, "").replace(/\\(["'])/g, "$1");
  return compact.includes(`FigmaGate.run(figma,"${gate}")`)
    || compact.includes(`FigmaGate.run(figma,'${gate}')`)
    || compact.includes(`runFigmaGate(figma,"${gate}")`);
}

function passedWithCurrentRules(state, gate, rulesSha256) {
  const result = state.gates?.[gate];
  return result?.status === "passed" && result.rules_sha256 === rulesSha256;
}

async function main() {
  const input = await readHookInput();
  const toolName = String(input.tool_name ?? "");
  if (!isFigmaTool(toolName) && !isArtifactTool(toolName)) return;
  const root = await findHarnessRoot(input.cwd ?? process.cwd());
  if (!root) {
    block("하네스 루트의 rules.yaml과 state.json을 찾을 수 없습니다.");
    return;
  }

  const [{ state, rulesSha256 }, rulesText] = await Promise.all([
    readState(root),
    readFile(resolve(root, "rules.yaml"), "utf8"),
  ]);
  const rules = parse(rulesText);
  const phase = state.phase;
  const maxFailures = Number(rules.retry?.max_consecutive_failures ?? 3);
  if (Number(state.consecutive_failures ?? 0) >= maxFailures) {
    block(`${maxFailures}회 연속 실패로 하네스가 멈췄습니다. 증거와 원인을 보고하세요.`);
    return;
  }

  if (isFigmaTool(toolName)) {
    if (!["P1", "P2", "G1", "P3", "G2"].includes(phase)) {
      block(`현재 단계 ${phase ?? "없음"}에서는 Figma 작업을 할 수 없습니다.`);
      return;
    }
    if (phase === "P3" && !passedWithCurrentRules(state, "G1", rulesSha256)) {
      block("P3 시작 전 현재 rules.yaml 해시로 G1 통과 증거가 필요합니다.");
      return;
    }
    if (phase === "G1" && !currentGateRun(toolText(input), "G1")) {
      block("G1에서는 FigmaGate의 G1 읽기 전용 번들만 실행할 수 있습니다.");
      return;
    }
    if (phase === "G2" && !currentGateRun(toolText(input), "G2")) {
      block("G2에서는 FigmaGate의 G2 읽기 전용 번들만 실행할 수 있습니다.");
      return;
    }
    if (phase === "G2" && !passedWithCurrentRules(state, "G1", rulesSha256)) {
      block("G2 실행 전 현재 rules.yaml 해시로 G1 통과 증거가 필요합니다.");
      return;
    }
    return;
  }

  if (phase !== "P4") {
    block("프로토타입 Artifact는 G3 승인 후 P4에서만 만들 수 있습니다.");
    return;
  }
  if (!passedWithCurrentRules(state, "G3", rulesSha256)) {
    block("P4 Artifact 작업 전 현재 rules.yaml 해시가 연결된 G3 사람 승인 증거가 필요합니다.");
  }
}

main().catch((error) => {
  block(`단계 보호 훅이 안전하게 확인하지 못해 작업을 막았습니다: ${error.message}`);
});
