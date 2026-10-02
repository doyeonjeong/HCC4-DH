import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { loadProjectConfig } from "../lib/config.mjs";
import { evaluateGate, validateDump } from "../lib/gates/evaluate.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const config = await loadProjectConfig(root);
const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures");
const passFixture = JSON.parse(await readFile(resolve(fixtureDir, "dump-pass.json"), "utf8"));
const failFixture = JSON.parse(await readFile(resolve(fixtureDir, "dump-fail.json"), "utf8"));

function testRules() {
  const rules = structuredClone(config.rules);
  rules.components.required = ["Button"];
  rules.components.text_required = [];
  rules.components.interactive = ["Button"];
  rules.components.max_count = 4;
  rules.components.max_variant_axes = 2;
  rules.gates.G1.checks.component_count_max = 4;
  rules.gates.G1.checks.variant_axes_max = 2;
  return rules;
}

const solid = (r, g, b, bound = true) => ({
  type: "SOLID",
  color: { r, g, b },
  ...(bound ? { boundVariables: { color: { id: "variable-color" } } } : {}),
});

function screenDump({ safeBinding = true, duplicateAction = false, titleVisible = true } = {}) {
  const page = { id: "page-screens", name: "Screens", type: "PAGE" };
  const frame = {
    id: "screen-home",
    name: "Home",
    type: "FRAME",
    parentId: page.id,
    layoutMode: "VERTICAL",
    width: 375,
    height: 812,
    fills: [solid(1, 1, 1)],
    ...(safeBinding ? { boundVariables: { paddingTop: { id: "variable-safe-top" } } } : {}),
  };
  const container = { id: "container-home", name: "Content", type: "FRAME", parentId: frame.id, layoutMode: "VERTICAL" };
  const button = {
    id: "button-primary",
    name: "Button",
    type: "INSTANCE",
    parentId: container.id,
    width: 88,
    height: 44,
    componentProperties: { type: { value: "primary" } },
    mainComponent: { name: "type=primary", componentSet: { name: "Button" } },
  };
  const text = {
    id: "title-text",
    name: "Title",
    type: "TEXT",
    parentId: button.id,
    characters: "Example title",
    visible: titleVisible,
    textAutoResize: "HEIGHT",
    fills: [solid(0, 0, 0)],
  };
  const nodes = [frame, container, button, text];
  if (duplicateAction) nodes.push({ ...button, id: "button-secondary", name: "Button", parentId: container.id });
  return { dumper: "figma-dump@1.0.0", page, node_count: nodes.length, nodes };
}

function variantScreenDump({ nested = false } = {}) {
  const page = { id: "page-screens", name: "Screens", type: "PAGE" };
  const parent = {
    id: "screen-home",
    name: "Home",
    type: "FRAME",
    parentId: page.id,
    layoutMode: "VERTICAL",
    width: 375,
    height: 812,
    fills: [solid(1, 1, 1)],
    boundVariables: { paddingTop: { id: "variable-safe-top" } },
  };
  const variants = ["empty", "full"].map((variant) => ({
    id: `screen-home-${variant}`,
    name: `Home/${variant}`,
    type: "FRAME",
    parentId: nested ? parent.id : page.id,
    layoutMode: "VERTICAL",
    width: 375,
    height: 812,
    fills: [solid(1, 1, 1)],
    boundVariables: { paddingTop: { id: "variable-safe-top" } },
  }));
  const shapes = ["empty", "full"].map((variant) => ({
    id: `shape-home-${variant}`,
    name: `Shape ${variant}`,
    type: "RECTANGLE",
    parentId: `screen-home-${variant}`,
  }));
  const nodes = [...(nested ? [parent] : []), ...variants, ...shapes];
  return { dumper: "figma-dump@1.0.0", page, node_count: nodes.length, nodes };
}

function screenRules() {
  const rules = testRules();
  rules.screens = [{ id: "screen-home", title: "Home" }];
  rules.gates.G2.checks.invariants = [];
  return rules;
}

test("G1 passes a generic component set with bound paint and responsive text", () => {
  const rules = testRules();
  const result = evaluateGate(passFixture, rules, config.preset, "G1");
  assert.equal(result.pass, true, JSON.stringify(result.checks));
  assert.equal(result.checks.required_components.pass, true);
});

test("G1 reports unbound paint, missing auto layout, and fixed-height text", () => {
  const rules = testRules();
  rules.components.required = [];
  const dump = structuredClone(failFixture);
  dump.nodes[0] = { ...dump.nodes[0], id: "component-card", type: "COMPONENT", parentId: dump.page.id, fills: [solid(0.5, 0.5, 0.5, false)] };
  dump.nodes.push({ id: "frame-card-content", name: "Content", type: "FRAME", parentId: "component-card", layoutMode: "NONE" });
  dump.nodes[1].parentId = "frame-card-content";
  dump.node_count = dump.nodes.length;
  const result = evaluateGate(dump, rules, config.preset, "G1");
  assert.equal(result.checks.unbound_values.count, 1);
  assert.equal(result.checks.autolayout_off.count, 1);
  assert.equal(result.checks.fixed_height_text.count, 1);
});

test("G1 detects unbound spacing and gradient stops while accepting variable bindings", () => {
  const rules = testRules();
  const dump = structuredClone(passFixture);
  const content = dump.nodes.find((node) => node.id === "frame-button-content");
  content.paddingLeft = 16;
  content.fills = [{ type: "GRADIENT_LINEAR", gradientStops: [{ color: { r: 0.2, g: 0.3, b: 0.4 } }] }];
  let result = evaluateGate(dump, rules, config.preset, "G1");
  assert.equal(result.checks.unbound_values.count, 2);
  content.boundVariables = { paddingLeft: { id: "variable-spacing" }, fills: [{ gradientStops: [{ id: "variable-gradient" }] }] };
  result = evaluateGate(dump, rules, config.preset, "G1");
  assert.equal(result.checks.unbound_values.count, 0);
});

test("G1 accepts individually bound nonzero corner radii without a common binding", () => {
  const rules = testRules();
  const dump = structuredClone(passFixture);
  const shape = dump.nodes.find((node) => node.id === "frame-button-content");
  const corners = ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"];
  shape.cornerRadius = 12;
  Object.assign(shape, Object.fromEntries(corners.map((corner) => [corner, 12])));
  shape.boundVariables = Object.fromEntries(corners.map((corner) => [corner, { id: `variable-${corner}` }]));

  let result = evaluateGate(dump, rules, config.preset, "G1");
  assert.equal(result.checks.unbound_values.count, 0);

  delete shape.boundVariables.bottomRightRadius;
  result = evaluateGate(dump, rules, config.preset, "G1");
  assert.equal(result.checks.unbound_values.count, 1);
});

test("G1 lets a common radius binding cover only equal-valued individual corners", () => {
  const rules = testRules();
  const dump = structuredClone(passFixture);
  const shape = dump.nodes.find((node) => node.id === "frame-button-content");
  shape.cornerRadius = 12;
  shape.topLeftRadius = 12;
  shape.topRightRadius = 8;
  shape.bottomLeftRadius = 12;
  shape.bottomRightRadius = 12;
  shape.boundVariables = { cornerRadius: { id: "variable-radius" } };

  const result = evaluateGate(dump, rules, config.preset, "G1");
  assert.equal(result.checks.unbound_values.count, 1);
});

test("G1 checks common radius when no corner is nonzero and ignores zero", () => {
  const rules = testRules();
  const dump = structuredClone(passFixture);
  const shape = dump.nodes.find((node) => node.id === "frame-button-content");
  shape.cornerRadius = 0;
  Object.assign(shape, {
    topLeftRadius: 0,
    topRightRadius: 0,
    bottomLeftRadius: 0,
    bottomRightRadius: 0,
  });

  let result = evaluateGate(dump, rules, config.preset, "G1");
  assert.equal(result.checks.unbound_values.count, 0);

  shape.cornerRadius = 12;
  result = evaluateGate(dump, rules, config.preset, "G1");
  assert.equal(result.checks.unbound_values.count, 1);

  shape.boundVariables = { cornerRadius: { id: "variable-radius" } };
  result = evaluateGate(dump, rules, config.preset, "G1");
  assert.equal(result.checks.unbound_values.count, 0);
});

test("G1 uses the selected preset minimum target size", async () => {
  const rules = testRules();
  const dump = structuredClone(passFixture);
  dump.nodes.find((node) => node.id === "instance-button").width = 32;
  dump.nodes.find((node) => node.id === "instance-button").height = 32;
  const mobile = evaluateGate(dump, rules, config.preset, "G1");
  const webText = await readFile(resolve(root, "presets/web.yaml"), "utf8");
  const webPreset = parse(webText);
  const web = evaluateGate(dump, rules, webPreset, "G1");
  assert.equal(mobile.checks.min_target_size.pass, false);
  assert.equal(web.checks.min_target_size.pass, true);
});

test("G1 enforces the component library list and variant-axis cap", () => {
  const rules = testRules();
  rules.components.required = ["Button", "Heading"];
  rules.components.max_variant_axes = 0;
  rules.gates.G1.checks.variant_axes_max = 0;
  const result = evaluateGate(passFixture, rules, config.preset, "G1");
  assert.equal(result.checks.required_components.count, 1);
  assert.equal(result.checks.variant_axes_max.count, 1);
});

test("G1 requires text content for configured text-bearing components", () => {
  const rules = testRules();
  rules.components.text_required = ["Button"];
  const dump = structuredClone(passFixture);
  dump.nodes.find((node) => node.id === "text-button-label").characters = "  ";
  const result = evaluateGate(dump, rules, config.preset, "G1");
  assert.equal(result.checks.text_required.count, 1);
});

test("G1 rejects a page whose name differs from rules.yaml", () => {
  assert.throws(() => evaluateGate({ ...passFixture, page: { ...passFixture.page, name: "Wrong" } }, testRules(), config.preset, "G1"), /does not match/);
});

test("G2 accepts a screen with bound safe area, one primary action, and readable text", () => {
  const result = evaluateGate(screenDump(), screenRules(), config.preset, "G2");
  assert.equal(result.pass, true, JSON.stringify(result.checks));
});

test("G2 matches every sibling frame with a screen-name suffix", () => {
  const rules = screenRules();
  rules.screens = ["Home"];
  const result = evaluateGate(variantScreenDump(), rules, config.preset, "G2");
  assert.equal(result.checks.screens.count, 0);
  assert.equal(result.checks.non_instance_elements.count, 2);
});

test("G2 excludes matched child frames covered by a matched ancestor", () => {
  const rules = screenRules();
  rules.screens = ["Home"];
  const result = evaluateGate(variantScreenDump({ nested: true }), rules, config.preset, "G2");
  assert.equal(result.checks.non_instance_elements.count, 2);
});

test("G2 checks safe-area binding only when the selected preset has a top inset", async () => {
  const rules = screenRules();
  const missing = evaluateGate(screenDump({ safeBinding: false }), rules, config.preset, "G2");
  const webPreset = parse(await readFile(resolve(root, "presets/web.yaml"), "utf8"));
  const web = evaluateGate(screenDump({ safeBinding: false }), rules, webPreset, "G2");
  assert.equal(missing.checks.safe_area_binding.pass, false);
  assert.equal(web.checks.safe_area_binding.pass, true);
});

test("G2 limits primary actions per screen", () => {
  const result = evaluateGate(screenDump({ duplicateAction: true }), screenRules(), config.preset, "G2");
  assert.equal(result.checks.primary_action_per_screen_max.count, 1);
});

test("G2 detects project invariants by screen and node name", () => {
  const rules = screenRules();
  rules.gates.G2.checks.invariants = [{ id: "cta-visible", screen: "Home", node: "Title", property: "visible", equals: false }];
  const result = evaluateGate(screenDump(), rules, config.preset, "G2");
  assert.equal(result.checks.invariants.pass, false);
});

test("G2 reports non-instance content outside auto-layout containers", () => {
  const dump = screenDump();
  dump.nodes.push({ id: "loose-shape", name: "Decoration", type: "RECTANGLE", parentId: "screen-home" });
  dump.node_count = dump.nodes.length;
  const result = evaluateGate(dump, screenRules(), config.preset, "G2");
  assert.equal(result.checks.non_instance_elements.count, 1);
});

test("G2 requires explicit screen IDs or titles before evaluation", () => {
  const rules = screenRules();
  rules.screens = [];
  const result = evaluateGate(screenDump(), rules, config.preset, "G2");
  assert.equal(result.checks.screens.pass, false);
});

test("dump validation rejects duplicates, missing parents, and cycles", () => {
  assert.throws(() => validateDump({ ...passFixture, nodes: [...passFixture.nodes, passFixture.nodes[0]], node_count: 6 }), /duplicate node id/);
  const missing = structuredClone(passFixture);
  missing.nodes[0].parentId = "unknown";
  assert.throws(() => validateDump(missing), /missing parent/);
  const cycle = structuredClone(passFixture);
  cycle.nodes[0].parentId = "component-button";
  assert.throws(() => validateDump(cycle), /parent cycle/);
});
