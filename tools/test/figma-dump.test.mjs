import assert from "node:assert/strict";
import test from "node:test";
import { dumpFigmaPage } from "../figma-dump.js";

function makeFigma() {
  const mixed = Symbol("mixed");
  let loads = 0;
  const label = {
    id: "text-label",
    name: "Label",
    type: "TEXT",
    characters: "Example label",
    textAutoResize: "HEIGHT",
    fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, boundVariables: { color: { id: "variable-ink" } } }],
    getStyledTextSegments: async () => [{ start: 0, end: 13, characters: "Example label", fontSize: 16, boundVariables: { fontSize: { id: "variable-body" } } }],
    children: [],
  };
  const buttonSet = { id: "set-button", name: "Button", type: "COMPONENT_SET", componentPropertyDefinitions: { type: { type: "VARIANT" } } };
  const button = {
    id: "instance-button",
    name: "Button",
    type: "INSTANCE",
    width: 88,
    height: 44,
    componentProperties: { type: { value: "primary" } },
    getMainComponentAsync: async () => ({ id: "component-button", name: "type=primary", parent: buttonSet }),
    children: [label],
  };
  const frame = { id: "frame-card", name: "Card", type: "FRAME", layoutMode: "VERTICAL", children: [button] };
  const page = { id: "page-system", name: "Design System", type: "PAGE", children: [frame], loadAsync: async () => { loads += 1; } };
  return { api: { mixed, root: { children: [page] } }, page, getLoads: () => loads };
}

test("Figma dumper reads a named page and returns JSON-safe hierarchy without a file key", async () => {
  const fixture = makeFigma();
  const dump = await dumpFigmaPage(fixture.api, "Design System");
  assert.equal(fixture.getLoads(), 1);
  assert.equal(dump.page.id, "page-system");
  assert.equal(dump.node_count, 3);
  assert.deepEqual(dump.nodes.map(({ id, parentId }) => [id, parentId]), [
    ["frame-card", "page-system"],
    ["instance-button", "frame-card"],
    ["text-label", "instance-button"],
  ]);
  assert.equal(dump.nodes[1].mainComponent.componentSet.name, "Button");
  assert.equal(dump.nodes[2].textSegments[0].boundVariables.fontSize.id, "variable-body");
  assert.equal(Object.hasOwn(dump, "fileKey"), false);
});

test("Figma dumper rejects a page name that is not present", async () => {
  const fixture = makeFigma();
  await assert.rejects(dumpFigmaPage(fixture.api, "Missing page"), /Figma page not found/);
});
