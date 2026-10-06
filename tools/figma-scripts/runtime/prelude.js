// ---- prelude (tools/figma-scripts/runtime/prelude.js) ----
// Shared helpers for every generated build script. DATA is injected above by generate.mjs.
// Helpers find variables, styles and components by name, so each script also works as a separate use_figma call.
const VAR = Object.fromEntries((await figma.variables.getLocalVariablesAsync()).map((v) => [v.name, v]));
const TEXT_STYLE = Object.fromEntries((await figma.getLocalTextStylesAsync()).map((s) => [s.name, s]));
const page = (name) => figma.root.children.find((p) => p.name === name);
let systemPage = page(DATA.pages.system); // tokens.js sets it when it creates the page
if (systemPage && systemPage.loadAsync) await systemPage.loadAsync();

const hex = (value) => ({ r: parseInt(value.slice(1, 3), 16) / 255, g: parseInt(value.slice(3, 5), 16) / 255, b: parseInt(value.slice(5, 7), 16) / 255 });
const V = (name) => { const v = VAR[name]; if (!v) throw new Error(`missing variable ${name} — run build-system.js first`); return v; };
const TS = (token) => { const s = TEXT_STYLE[`type/${token}`]; if (!s) throw new Error(`missing text style type/${token} — run build-system.js first`); return s; };

// Every color, spacing and radius is bound to a variable; raw numbers fail G1 unbound_values.
const paint = (token) => figma.variables.setBoundVariableForPaint({ type: "SOLID", color: hex(DATA.tokens.colors[token]) }, "color", V(`color/${token}`));
const fill = (node, token) => { node.fills = token ? [paint(token)] : []; return node; };
const stroke = (node, token, weight = 1) => { node.strokes = token ? [paint(token)] : []; if (token) node.strokeWeight = weight; return node; };
const space = (node, property, token) => { if (token) node.setBoundVariable(property, V(`spacing/${token}`)); else node[property] = 0; return node; };
const pad = (node, top, right = top, bottom = top, left = right) => {
  for (const [property, token] of [["paddingTop", top], ["paddingRight", right], ["paddingBottom", bottom], ["paddingLeft", left]]) space(node, property, token);
  return node;
};
const gap = (node, token) => space(node, "itemSpacing", token);
const radius = (node, token) => {
  for (const corner of ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"]) node.setBoundVariable(corner, V(`radius/${token}`));
  return node;
};
const bindSafeArea = (frame) => { frame.setBoundVariable(DATA.safeArea.bindTo, V(DATA.safeArea.variable)); return frame; };

// createFrame() starts with a white fill; clear it so the frame does not count as an unbound value.
const autoLayout = (direction = "VERTICAL", { name, gap: gapToken, padding } = {}) => {
  const frame = figma.createFrame();
  frame.layoutMode = direction;
  frame.fills = [];
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "AUTO";
  if (name) frame.name = name;
  gap(frame, gapToken);
  if (padding) pad(frame, ...[].concat(padding));
  return frame;
};

// Text grows with its content (fixed-height text fails G1 fixed_height_text).
const text = async (characters, styleToken, colorToken, { name = "label", center = false } = {}) => {
  const style = TS(styleToken);
  await figma.loadFontAsync(style.fontName);
  const node = figma.createText();
  node.fontName = style.fontName;
  await node.setTextStyleIdAsync(style.id);
  node.characters = characters;
  node.name = name;
  node.textAutoResize = "WIDTH_AND_HEIGHT";
  fill(node, colorToken);
  if (center) { node.textAlignHorizontal = "CENTER"; node.textAlignVertical = "CENTER"; }
  return node;
};

// combineAsVariants() gives the new set a 5px corner radius, which G1 counts as 4 unbound values. Reset it to 0.
const combine = (components, name, parent = systemPage) => {
  const set = figma.combineAsVariants(components, parent);
  set.name = name;
  set.cornerRadius = 0;
  set.fills = [];
  return set;
};

// Find a component (or one variant of a set) on the system page and create an instance.
// props uses property labels without the "#id" suffix, e.g. { Label: "Save" }.
const instance = (name, variant = {}, props = {}) => {
  const node = systemPage && systemPage.findOne((n) => (n.type === "COMPONENT_SET" || n.type === "COMPONENT") && n.name === name);
  if (!node) throw new Error(`component ${name} not found on ${DATA.pages.system}`);
  const wanted = Object.entries(variant).map(([key, value]) => `${key}=${value}`);
  const component = node.type === "COMPONENT" ? node : node.children.find((c) => wanted.every((pair) => c.name.split(/,\s*/).includes(pair)));
  if (!component) throw new Error(`variant ${wanted.join(", ")} not found in ${name}`);
  const created = component.createInstance();
  const keys = Object.keys(created.componentProperties || {});
  const mapped = {};
  for (const [label, value] of Object.entries(props)) {
    const key = keys.find((k) => k === label || k.startsWith(`${label}#`));
    if (!key) throw new Error(`property ${label} not found on ${name}`);
    mapped[key] = value;
  }
  if (Object.keys(mapped).length) created.setProperties(mapped);
  return created;
};
