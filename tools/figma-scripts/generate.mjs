// Generates paste-ready use_figma scripts and Figma AI prompts from rules.yaml and the selected preset.
// Usage (from the harness root): node tools/figma-scripts/generate.mjs           -> writes figma/build-*.js, figma/ai-prompts.md
//                                node tools/figma-scripts/generate.mjs --check   -> fails if those files are missing or stale
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadProjectConfig } from "../lib/config.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export const MAX_SCRIPT_BYTES = 50000; // use_figma code parameter limit

export const DEFAULT_CONFIG = {
  font: { family: "Inter", styles: { 400: "Regular", 500: "Medium", 600: "Semi Bold", 700: "Bold" } },
  colorScopes: { default: ["FRAME_FILL", "SHAPE_FILL", "TEXT_FILL", "STROKE_COLOR"] },
  codeSyntax: { platform: "", colors: {}, spacing: {}, radii: {}, safeArea: "" },
  order: [],
};

const readOptional = (path) => readFile(path, "utf8").catch((error) => (error.code === "ENOENT" ? undefined : Promise.reject(error)));

async function loadFigmaConfig(root) {
  const text = await readOptional(resolve(root, "figma/config.json"));
  const custom = text ? JSON.parse(text) : {};
  return {
    font: { ...DEFAULT_CONFIG.font, ...custom.font, styles: { ...DEFAULT_CONFIG.font.styles, ...custom.font?.styles } },
    colorScopes: { ...DEFAULT_CONFIG.colorScopes, ...custom.colorScopes },
    codeSyntax: { ...DEFAULT_CONFIG.codeSyntax, ...custom.codeSyntax },
    order: custom.order ?? DEFAULT_CONFIG.order,
  };
}

// Figma variable names cannot contain "." — rules written as safe-area.top become safe-area/top.
export const figmaVariableName = (name) => String(name).replaceAll(".", "/");

async function projectBodies(root) {
  const dir = resolve(root, "figma/src");
  const files = await readdir(dir).catch((error) => (error.code === "ENOENT" ? [] : Promise.reject(error)));
  const bodies = {};
  for (const file of files.filter((name) => name.endsWith(".js")).sort()) bodies[file.slice(0, -3)] = await readFile(resolve(dir, file), "utf8");
  return bodies;
}

export function scriptOrder(names, order = []) {
  const rest = names.filter((name) => name !== "system" && !order.includes(name)).sort();
  return [...(names.includes("system") ? ["system"] : []), ...order.filter((name) => name !== "system" && names.includes(name)), ...rest];
}

function aiPrompts({ rules, preset, data, screenPrompts }) {
  const list = (entries, unit = "") => entries.map(([key, value]) => `${key} ${value}${unit}`).join(", ");
  const type = Object.entries(rules.tokens.typography).map(([key, [size, line, weight]]) => `${key} ${size}/${line} ${weight}`).join(", ");
  const lines = [
    "# Figma AI 프롬프트 (게이트 밖 탐색용)",
    "",
    "> 생성 파일: `node tools/figma-scripts/generate.mjs`가 `rules.yaml`·프리셋·`figma/prompts/*.md`에서 만든다. 직접 고치지 않는다.",
    `> 결과는 \`AI Drafts\` 같은 별도 페이지에만 둔다. \`${data.pages.system}\`·\`${data.pages.screens}\` 페이지에 넣으면 변수에 묶이지 않은 값과 인스턴스가 아닌 레이어 때문에 G1/G2에서 떨어진다.`,
    "> 고른 안은 `docs/`와 `figma/src/*.js`에 옮긴 뒤 스크립트로 다시 만든다.",
    "",
    "## 공통 머리말 (모든 프롬프트 앞에 붙인다)",
    "",
    "```",
    `화면 ${preset.viewport.width}×${preset.viewport.height} (${preset.name}). ${rules.project?.name || "(프로젝트 이름)"} — ${rules.project?.purpose || "(한 문장 목적)"}`,
    `색: ${list(Object.entries(rules.tokens.colors))}.`,
    `간격: ${list(Object.entries(rules.tokens.spacing))}. 이 값 밖의 간격은 쓰지 말 것.`,
    `모서리: ${list(Object.entries(rules.tokens.radii))}.`,
    `글자(크기/줄높이 굵기): ${type}. 서체 ${data.font.family}.`,
    `누르는 요소는 최소 ${preset.target.minimum_size}×${preset.target.minimum_size}. 상단 안전 영역 ${preset.safe_area.top}.`,
    "주어진 문구는 한 글자도 바꾸지 말 것.",
    "```",
    "",
  ];
  for (const screen of rules.screens ?? []) {
    const id = typeof screen === "string" ? screen : screen.id;
    const title = typeof screen === "string" ? "" : screen.title ?? "";
    lines.push(`## ${id}${title ? ` — ${title}` : ""}`, "");
    const body = screenPrompts[id];
    lines.push(body ? body.trim() : `(아직 없음: \`figma/prompts/${id}.md\`에 \`docs/\`의 화면 구성과 문구를 옮겨 적는다.)`, "");
  }
  return lines.join("\n");
}

/** Build every output in memory. Nothing is written. */
export async function generateFigmaScripts(projectRoot) {
  const { root, rules, rulesText, preset } = await loadProjectConfig(projectRoot);
  const config = await loadFigmaConfig(root);
  const problems = [];
  const notes = [];

  const sourceSafeArea = rules.tokens?.safe_area?.variable ?? "safe-area/top";
  const safeAreaVariable = figmaVariableName(sourceSafeArea);
  if (safeAreaVariable !== sourceSafeArea) notes.push(`rules.yaml safe_area.variable "${sourceSafeArea}" → Figma "${safeAreaVariable}" (Figma 변수 이름에 '.' 불가)`);
  for (const [token, [size, , weight]] of Object.entries(rules.tokens.typography)) {
    if (!config.font.styles[String(weight)]) problems.push(`figma/config.json: font.styles에 굵기 ${weight}(type/${token}, ${size}) 서체 스타일이 없다`);
  }

  const rulesSha256 = createHash("sha256").update(rulesText).digest("hex");
  const data = {
    rulesSha256,
    preset: { name: preset.name, viewport: preset.viewport, safeAreaTop: preset.safe_area.top, targetMinimum: preset.target.minimum_size },
    pages: rules.figma.pages,
    tokens: { colors: rules.tokens.colors, spacing: rules.tokens.spacing, radii: rules.tokens.radii, typography: rules.tokens.typography },
    safeArea: { variable: safeAreaVariable, bindTo: rules.tokens?.safe_area?.bind_to ?? "paddingTop" },
    screens: (rules.screens ?? []).map((screen) => (typeof screen === "string" ? { id: screen } : screen)),
    components: rules.components,
    font: config.font,
    colorScopes: config.colorScopes,
    codeSyntax: config.codeSyntax,
  };

  const [prelude, tokens, bodies] = await Promise.all([
    readFile(resolve(here, "runtime/prelude.js"), "utf8"),
    readFile(resolve(here, "runtime/tokens.js"), "utf8"),
    projectBodies(root),
  ]);
  const scriptBodies = { system: tokens + (bodies.system ? `// ---- figma/src/system.js ----\n${bodies.system}` : "") };
  for (const [name, body] of Object.entries(bodies)) if (name !== "system") scriptBodies[name] = `// ---- figma/src/${name}.js ----\n${body}`;

  const order = scriptOrder(Object.keys(scriptBodies), config.order);
  const outputs = {};
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const [index, name] of order.entries()) {
    const path = `figma/build-${name}.js`;
    const code = [
      `// build-${name}.js — GENERATED by tools/figma-scripts/generate.mjs from rules.yaml (sha256 ${rulesSha256.slice(0, 12)}…). Do not edit; edit figma/src/${name}.js and regenerate.`,
      `// Paste the whole file as the \`code\` of ONE use_figma call. Run order ${index + 1}/${order.length}: ${order.map((n) => `build-${n}.js`).join(" → ")}.`,
      `const DATA = ${JSON.stringify(data)};`,
      prelude,
      scriptBodies[name],
    ].join("\n");
    const bytes = Buffer.byteLength(code);
    if (bytes >= MAX_SCRIPT_BYTES) problems.push(`${path}: ${bytes} bytes (use_figma 한도 ${MAX_SCRIPT_BYTES} 미만이어야 함 — figma/src를 파일 두 개로 나눈다)`);
    if (/\bTextEncoder\b/.test(scriptBodies[name])) problems.push(`${path}: Figma 실행 환경에는 TextEncoder가 없다`);
    try { new AsyncFunction("figma", code); } catch (error) { problems.push(`${path}: 문법 오류 ${error.message}`); }
    outputs[path] = code;
  }

  const screenPrompts = {};
  for (const screen of data.screens) {
    const body = await readOptional(resolve(root, "figma/prompts", `${screen.id}.md`));
    if (body) screenPrompts[screen.id] = body;
  }
  outputs["figma/ai-prompts.md"] = aiPrompts({ rules, preset, data, screenPrompts });
  return { root, outputs, order, problems, notes, rulesSha256 };
}

/** Write outputs, or with check: true compare them with the files on disk. */
export async function writeFigmaScripts(projectRoot, { check = false } = {}) {
  const result = await generateFigmaScripts(projectRoot);
  for (const [path, content] of Object.entries(result.outputs)) {
    const target = resolve(result.root, path);
    if (check) {
      if ((await readOptional(target)) !== content) result.problems.push(`${path}: 없거나 낡았다 — node tools/figma-scripts/generate.mjs 실행`);
    } else {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    }
  }
  return result;
}

async function main(args = process.argv.slice(2)) {
  if (args.some((arg) => arg !== "--check")) throw new TypeError("usage: node tools/figma-scripts/generate.mjs [--check]");
  const result = await writeFigmaScripts(resolve(here, "../.."), { check: args.includes("--check") });
  for (const [path, content] of Object.entries(result.outputs)) process.stdout.write(`${path}: ${Buffer.byteLength(content)} bytes\n`);
  for (const note of result.notes) process.stdout.write(`참고: ${note}\n`);
  if (result.problems.length) {
    process.stdout.write(`문제 ${result.problems.length}건\n${result.problems.join("\n")}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`OK — 실행 순서 ${result.order.map((n) => `build-${n}.js`).join(" → ")}, rules sha256 ${result.rulesSha256.slice(0, 12)}…\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`Figma 스크립트 생성 실패: ${error.message}\n`);
    process.exitCode = 1;
  });
}
