import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";
import { generateFigmaScripts, MAX_SCRIPT_BYTES, scriptOrder, writeFigmaScripts } from "../figma-scripts/generate.mjs";
import { createMockFigma, runScript } from "../figma-scripts/mock-figma.mjs";
import { mockRun } from "../figma-scripts/mock-run.mjs";

const fixture = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures/starter-project");

// Copy the starter fixture to a temp folder, optionally edit rules.yaml and add figma/ files.
async function project(t, { rules, files = {} } = {}) {
  const root = await mkdtemp(join(tmpdir(), "figma-scripts-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(fixture, root, { recursive: true });
  if (rules) {
    const path = resolve(root, "rules.yaml");
    const parsed = parse(await readFile(path, "utf8"));
    rules(parsed);
    await writeFile(path, stringify(parsed));
  }
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(resolve(root, path)), { recursive: true });
    await writeFile(resolve(root, path), content);
  }
  return root;
}

const BUTTON_AND_HEADING = `
const buttons = [];
for (const [type, background, label] of [["primary", "primary", "canvas"], ["secondary", "surface", "text-primary"]]) {
  const button = figma.createComponent();
  button.name = \`type=\${type}\`;
  button.layoutMode = "HORIZONTAL";
  fill(button, background);
  pad(button, "sm", "md");
  radius(button, "md");
  const caption = await text("Button", "body", label, { name: "Label", center: true });
  button.appendChild(caption);
  caption.componentPropertyReferences = { characters: button.addComponentProperty("Label", "TEXT", "Button") };
  buttons.push(button);
}
__COMBINE__
const heading = figma.createComponent();
heading.name = "Heading";
heading.layoutMode = "VERTICAL";
fill(heading, null);
heading.appendChild(await text("Heading", "heading", "text-primary", { name: "Text" }));
`;
const systemBody = (combine = 'combine(buttons, "Button");') => BUTTON_AND_HEADING.replace("__COMBINE__", combine);

const SCREENS_BODY = `
const SCREENS = page(DATA.pages.screens);
await figma.setCurrentPageAsync(SCREENS);
for (const screen of DATA.screens) {
  const frame = autoLayout("VERTICAL", { name: screen.id, gap: "md", padding: [null, "md", "md", "md"] });
  SCREENS.appendChild(frame);
  fill(frame, "canvas");
  bindSafeArea(frame);
  frame.appendChild(instance("Heading"));
  frame.appendChild(instance("Button", { type: "primary" }, { Label: "Continue" }));
  frame.appendChild(instance("Button", { type: "secondary" }, { Label: "Later" }));
}
return { screens: DATA.screens.length };
`;

const smallProject = (parsed) => {
  parsed.components.required = ["Button", "Heading"];
  parsed.components.interactive = ["Button"];
  parsed.components.text_required = ["Heading"];
  parsed.screens = [{ id: "home", title: "Home" }];
};

test("starter project generates a system script under the use_figma limit with valid syntax", async (t) => {
  const root = await project(t);
  const { outputs, order, problems } = await generateFigmaScripts(root);
  assert.deepEqual(problems, []);
  assert.deepEqual(order, ["system"]);
  assert.deepEqual(Object.keys(outputs).sort(), ["figma/ai-prompts.md", "figma/build-system.js"]);
  const code = outputs["figma/build-system.js"];
  assert.ok(Buffer.byteLength(code) < MAX_SCRIPT_BYTES);
  assert.match(code, /^\/\/ build-system\.js — GENERATED .*sha256 [\da-f]{12}…/);
  assert.doesNotMatch(code, /TextEncoder/);
});

test("tokens step creates variables and text styles and writes safe-area.top as safe-area/top", async (t) => {
  const root = await project(t, { rules: (parsed) => { parsed.tokens.safe_area.variable = "safe-area.top"; } });
  const { outputs, notes } = await generateFigmaScripts(root);
  assert.match(notes.join("\n"), /safe-area\.top.*safe-area\/top/);
  const { figma, state } = createMockFigma();
  await runScript(outputs["figma/build-system.js"], figma);
  const names = state.variables.map((v) => v.name);
  assert.ok(names.includes("safe-area/top"));
  assert.ok(names.every((name) => !name.includes(".")));
  assert.equal(state.variables.length, 6 + 8 + 1 + 6);
  assert.deepEqual(state.textStyles.map((s) => s.name), ["type/display", "type/heading", "type/body", "type/caption"]);
  assert.deepEqual(figma.root.children.map((p) => p.name), ["Design System", "Screens"]);
  assert.equal(state.variables.find((v) => v.name === "safe-area/top").values.m0, 54);
});

test("tokens step stops instead of creating variables twice", async (t) => {
  const root = await project(t);
  const { outputs } = await generateFigmaScripts(root);
  const { figma } = createMockFigma();
  await runScript(outputs["figma/build-system.js"], figma);
  await assert.rejects(runScript(outputs["figma/build-system.js"], figma), /already exist/);
});

test("combine() resets the 5px component-set radius that otherwise fails G1", async (t) => {
  const withHelper = await mockRun(await project(t, { rules: smallProject, files: { "figma/src/system.js": systemBody() } }));
  assert.equal(withHelper.preview.G1.pass, true, withHelper.preview.G1.failed.join(", "));
  const raw = await mockRun(await project(t, { rules: smallProject, files: { "figma/src/system.js": systemBody('const set = figma.combineAsVariants(buttons, systemPage); set.name = "Button";') } }));
  assert.equal(raw.preview.G1.pass, false);
  assert.ok(raw.preview.G1.failed.includes("unbound_values 4"));
});

test("small complete project passes mock G1 and G2 end to end", async (t) => {
  const root = await project(t, { rules: smallProject, files: { "figma/src/system.js": systemBody(), "figma/src/screens.js": SCREENS_BODY } });
  const result = await mockRun(root);
  assert.deepEqual(result.scripts.map((s) => [s.name, s.ok]), [["build-system.js", true], ["build-screens.js", true]], JSON.stringify(result.scripts));
  assert.deepEqual(result.preview, { G1: { pass: true, failed: [] }, G2: { pass: true, failed: [] } });
  assert.equal(result.ok, true);
});

test("instance() fails clearly for an unknown variant", async (t) => {
  const root = await project(t, { rules: smallProject, files: {
    "figma/src/system.js": systemBody(),
    "figma/src/screens.js": SCREENS_BODY.replace('{ type: "primary" }', '{ type: "ghost" }'),
  } });
  const result = await mockRun(root);
  assert.equal(result.ok, false);
  assert.match(result.scripts.at(-1).error, /variant type=ghost not found in Button/);
});

test("--check reports missing and stale outputs", async (t) => {
  const root = await project(t);
  assert.match((await writeFigmaScripts(root, { check: true })).problems.join("\n"), /build-system\.js: 없거나 낡았다/);
  assert.deepEqual((await writeFigmaScripts(root)).problems, []);
  assert.deepEqual((await writeFigmaScripts(root, { check: true })).problems, []);
  await writeFile(resolve(root, "figma/build-system.js"), "// edited by hand\n");
  assert.match((await writeFigmaScripts(root, { check: true })).problems.join("\n"), /build-system\.js: 없거나 낡았다/);
});

test("oversized scripts, TextEncoder use and syntax errors are reported", async (t) => {
  const root = await project(t, { files: {
    "figma/src/big.js": `const blob = "${"x".repeat(MAX_SCRIPT_BYTES)}";`,
    "figma/src/bytes.js": "const n = new TextEncoder().encode('a').byteLength;",
    "figma/src/broken.js": "const = ;",
  } });
  const problems = (await generateFigmaScripts(root)).problems.join("\n");
  assert.match(problems, /build-big\.js: \d+ bytes/);
  assert.match(problems, /build-bytes\.js: Figma 실행 환경에는 TextEncoder가 없다/);
  assert.match(problems, /build-broken\.js: 문법 오류/);
});

test("Figma AI prompts carry tokens, the gated-page warning and per-screen prompts", async (t) => {
  const root = await project(t, { rules: smallProject, files: { "figma/prompts/home.md": "홈 화면: 제목과 주 버튼 하나." } });
  const prompts = (await generateFigmaScripts(root)).outputs["figma/ai-prompts.md"];
  assert.match(prompts, /AI Drafts/);
  assert.match(prompts, /G1\/G2에서 떨어진다/);
  assert.match(prompts, /primary #315FE8/);
  assert.match(prompts, /최소 44×44/);
  assert.match(prompts, /## home — Home\n\n홈 화면: 제목과 주 버튼 하나\./);
});

test("figma/config.json sets the font and must cover every typography weight", async (t) => {
  const root = await project(t, { files: { "figma/config.json": JSON.stringify({ font: { family: "Noto Sans KR", styles: { 700: "Bold", 400: "Regular", 600: null } } }) } });
  const { outputs, problems } = await generateFigmaScripts(root);
  assert.deepEqual(problems, []);
  assert.match(outputs["figma/build-system.js"], /"family":"Noto Sans KR"/);
  const missing = await project(t, { files: { "figma/config.json": JSON.stringify({ font: { styles: { 700: "" } } }) } });
  assert.match((await generateFigmaScripts(missing)).problems.join("\n"), /굵기 700/);
});

test("system runs first, then figma/config.json order, then the rest by name", () => {
  assert.deepEqual(scriptOrder(["screens", "components", "system"]), ["system", "components", "screens"]);
  assert.deepEqual(scriptOrder(["screens", "components", "extras", "system"], ["screens"]), ["system", "screens", "components", "extras"]);
});
