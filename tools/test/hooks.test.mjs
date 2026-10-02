import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import test from "node:test";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const toolsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceHooks = resolve(toolsRoot, "hooks");
const rulesText = "version: 1\nretry:\n  max_consecutive_failures: 3\n";
const rulesHash = createHash("sha256").update(rulesText).digest("hex");

test("Claude Code settings connect both protection hooks", () => {
  const projectRoot = resolve(toolsRoot, "..");
  const settings = JSON.parse(readFileSync(resolve(projectRoot, ".claude/settings.json"), "utf8"));
  assert.deepEqual(settings.hooks.PreToolUse.map((entry) => entry.matcher), ["Write|Edit|MultiEdit", "mcp__figma__use_figma|Artifact"]);
  assert.match(settings.hooks.PreToolUse[0].hooks[0].command, /tools\/hooks\/guard-rules\.mjs/);
  assert.match(settings.hooks.PreToolUse[1].hooks[0].command, /tools\/hooks\/guard-phase\.mjs/);
});

function fixture(state = { phase: "P1", gates: {}, consecutive_failures: 0 }) {
  const root = mkdtempSync("/private/tmp/design-hook-");
  const hooks = join(root, "tools/hooks");
  mkdirSync(hooks, { recursive: true });
  for (const name of ["context.mjs", "guard-rules.mjs", "guard-phase.mjs"]) copyFileSync(join(sourceHooks, name), join(hooks, name));
  symlinkSync(join(toolsRoot, "node_modules"), join(root, "tools/node_modules"));
  writeFileSync(join(root, "rules.yaml"), rulesText);
  writeFileSync(join(root, "state.json"), JSON.stringify(state));
  return { root, hooks };
}

function invoke(fix, script, toolName, toolInput = {}, cwd = fix.root) {
  return spawnSync(process.execPath, [join(fix.hooks, `${script}.mjs`)], {
    input: JSON.stringify({ tool_name: toolName, tool_input: toolInput, cwd }),
    encoding: "utf8",
    cwd: fix.root,
  });
}

function blocked(result, pattern) {
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, pattern);
}

function allowed(result) {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
}

test("guard-rules blocks Write, Edit, and MultiEdit on rules.yaml without human unlock", () => {
  const fix = fixture();
  for (const name of ["Write", "Edit", "MultiEdit"]) {
    blocked(invoke(fix, "guard-rules", name, { file_path: "rules.yaml" }), /사람 승인/);
  }
  rmSync(fix.root, { recursive: true, force: true });
});

test("guard-rules allows rules changes only with a regular unlock and protects the unlock file", () => {
  const fix = fixture();
  writeFileSync(join(fix.root, ".rules-unlock"), "approved\n");
  allowed(invoke(fix, "guard-rules", "Edit", { file_path: "rules.yaml" }));
  blocked(invoke(fix, "guard-rules", "Write", { file_path: ".rules-unlock" }), /사람만/);
  rmSync(fix.root, { recursive: true, force: true });
});

test("guard-rules blocks symlink aliases and nested cwd traversal", () => {
  const fix = fixture();
  symlinkSync(join(fix.root, "rules.yaml"), join(fix.root, "alias.yaml"));
  blocked(invoke(fix, "guard-rules", "Edit", { file_path: "alias.yaml" }), /사람 승인/);
  blocked(invoke(fix, "guard-rules", "Write", { file_path: "../rules.yaml" }, join(fix.root, "tools")), /사람 승인/);
  allowed(invoke(fix, "guard-rules", "Read", { file_path: "rules.yaml" }));
  rmSync(fix.root, { recursive: true, force: true });
});

test("guard-phase permits Figma design work in P1/P2 and only a G1 bundle during G1", () => {
  const fix = fixture();
  allowed(invoke(fix, "guard-phase", "mcp__figma__use_figma", { code: "figma.createFrame()" }));
  const p2 = fixture({ phase: "P2", gates: {}, consecutive_failures: 0 });
  allowed(invoke(p2, "guard-phase", "mcp__figma__use_figma", { code: "figma.createFrame()" }));
  const g1 = fixture({ phase: "G1", gates: {}, consecutive_failures: 0 });
  blocked(invoke(g1, "guard-phase", "mcp__figma__use_figma", { code: "figma.createFrame()" }), /읽기 전용 번들/);
  allowed(invoke(g1, "guard-phase", "mcp__figma__use_figma", { code: 'FigmaGate.run(figma, "G1")' }));
  for (const item of [fix, p2, g1]) rmSync(item.root, { recursive: true, force: true });
});

test("guard-phase requires current G1 evidence before P3 and G2", () => {
  const p3 = fixture({ phase: "P3", gates: {}, consecutive_failures: 0 });
  blocked(invoke(p3, "guard-phase", "mcp__figma__use_figma", { code: "figma.createFrame()" }), /G1 통과/);
  const approved = fixture({ phase: "P3", gates: { G1: { status: "passed", rules_sha256: rulesHash } }, consecutive_failures: 0 });
  allowed(invoke(approved, "guard-phase", "mcp__figma__use_figma", { code: "figma.createFrame()" }));
  const stale = fixture({ phase: "G2", gates: { G1: { status: "passed", rules_sha256: "stale" } }, consecutive_failures: 0 });
  blocked(invoke(stale, "guard-phase", "mcp__figma__use_figma", { code: 'FigmaGate.run(figma, "G2")' }), /G1 통과/);
  for (const item of [p3, approved, stale]) rmSync(item.root, { recursive: true, force: true });
});

test("guard-phase holds Artifact work until current G3 approval in P4", () => {
  const pending = fixture({ phase: "P4", gates: {}, consecutive_failures: 0 });
  blocked(invoke(pending, "guard-phase", "Artifact", { action: "preview" }), /G3 사람 승인/);
  const approved = fixture({ phase: "P4", gates: { G3: { status: "passed", rules_sha256: rulesHash } }, consecutive_failures: 0 });
  allowed(invoke(approved, "guard-phase", "Artifact", { action: "preview" }));
  const early = fixture({ phase: "P3", gates: { G3: { status: "passed", rules_sha256: rulesHash } }, consecutive_failures: 0 });
  blocked(invoke(early, "guard-phase", "Artifact", { action: "preview" }), /P4에서만/);
  for (const item of [pending, approved, early]) rmSync(item.root, { recursive: true, force: true });
});

test("guard-phase stops after three consecutive failures and rejects invalid state", () => {
  const stopped = fixture({ phase: "P1", gates: {}, consecutive_failures: 3 });
  blocked(invoke(stopped, "guard-phase", "mcp__figma__use_figma", {}), /3회 연속 실패/);
  const invalid = fixture({ phase: "P9", gates: {}, consecutive_failures: 0 });
  blocked(invoke(invalid, "guard-phase", "mcp__figma__use_figma", {}), /현재 단계/);
  assert.equal(existsSync(join(stopped.root, "state.json")), true);
  rmSync(stopped.root, { recursive: true, force: true });
  rmSync(invalid.root, { recursive: true, force: true });
});
