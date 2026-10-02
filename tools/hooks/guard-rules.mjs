import { basename, resolve } from "node:path";
import { canonicalPath, findHarnessRoot, readHookInput, block, unlockExists } from "./context.mjs";

function changedPaths(input) {
  const toolInput = input.tool_input ?? {};
  const paths = [toolInput.file_path, toolInput.path, ...(toolInput.edits ?? []).map((edit) => edit.file_path ?? edit.path)];
  return paths.filter((value) => typeof value === "string" && value.length > 0);
}

async function main() {
  const input = await readHookInput();
  if (!["Write", "Edit", "MultiEdit"].includes(input.tool_name)) return;
  const root = await findHarnessRoot(input.cwd ?? process.cwd());
  if (!root) return;
  const rulesPath = await canonicalPath(resolve(root, "rules.yaml"));
  const unlockPath = resolve(root, ".rules-unlock");
  for (const rawPath of changedPaths(input)) {
    const absolute = resolve(input.cwd ?? process.cwd(), rawPath);
    const lexical = resolve(absolute);
    const canonical = await canonicalPath(absolute);
    const touchesUnlock = lexical === unlockPath || basename(lexical) === ".rules-unlock" && lexical.startsWith(`${root}/`);
    if (touchesUnlock || canonical === await canonicalPath(unlockPath)) {
      block(".rules-unlock는 사람만 만들고 제거할 수 있습니다.");
      return;
    }
    if (lexical === resolve(root, "rules.yaml") || canonical === rulesPath) {
      if (!(await unlockExists(root))) {
        block("rules.yaml 변경은 사람 승인 후 루트에 일반 파일 .rules-unlock을 만들어 허용합니다.");
        return;
      }
    }
  }
}

main().catch((error) => {
  block(`규칙 보호 훅이 안전하게 확인하지 못해 변경을 막았습니다: ${error.message}`);
});
