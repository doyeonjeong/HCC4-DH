// ---- tokens (tools/figma-scripts/runtime/tokens.js) ----
// Pages, variables and text styles from rules.yaml. Stops before changing anything if they already exist.
if (Object.keys(VAR).length || Object.keys(TEXT_STYLE).length) {
  throw new Error("Variables or text styles already exist. Use a fresh Figma file, or delete them first.");
}
const SYSTEM = page(DATA.pages.system) || Object.assign(figma.root.children.length === 1 && !figma.root.children[0].children.length ? figma.root.children[0] : figma.createPage(), { name: DATA.pages.system });
if (!page(DATA.pages.screens)) figma.createPage().name = DATA.pages.screens;
systemPage = SYSTEM;
await figma.setCurrentPageAsync(SYSTEM);
if (SYSTEM.children.length) throw new Error(`${DATA.pages.system} page is not empty.`);

const collection = (name) => { const c = figma.variables.createVariableCollection(name); c.renameMode(c.modes[0].modeId, "Value"); return c; };
const addVariable = (name, coll, type, value, scopes, code) => {
  const v = figma.variables.createVariable(name, coll, type);
  v.setValueForMode(coll.modes[0].modeId, value);
  v.scopes = scopes;
  if (code && DATA.codeSyntax.platform) v.setVariableCodeSyntax(DATA.codeSyntax.platform, code);
  VAR[name] = v;
  return v;
};
const colors = collection("Color");
for (const [token, value] of Object.entries(DATA.tokens.colors)) {
  addVariable(`color/${token}`, colors, "COLOR", hex(value), DATA.colorScopes[token] || DATA.colorScopes.default, DATA.codeSyntax.colors[token]);
}
const spacing = collection("Spacing");
for (const [token, value] of Object.entries(DATA.tokens.spacing)) addVariable(`spacing/${token}`, spacing, "FLOAT", value, ["GAP"], DATA.codeSyntax.spacing[token]);
addVariable(DATA.safeArea.variable, spacing, "FLOAT", DATA.preset.safeAreaTop, ["GAP"], DATA.codeSyntax.safeArea);
const radii = collection("Radius");
for (const [token, value] of Object.entries(DATA.tokens.radii)) addVariable(`radius/${token}`, radii, "FLOAT", value, ["CORNER_RADIUS"], DATA.codeSyntax.radii[token]);

for (const [token, [size, lineHeight, weight]] of Object.entries(DATA.tokens.typography)) {
  const fontName = { family: DATA.font.family, style: DATA.font.styles[String(weight)] };
  await figma.loadFontAsync(fontName);
  const style = figma.createTextStyle();
  style.name = `type/${token}`;
  style.fontName = fontName;
  style.fontSize = size;
  style.lineHeight = { unit: "PIXELS", value: lineHeight };
  style.letterSpacing = { unit: "PIXELS", value: 0 };
  TEXT_STYLE[style.name] = style;
}
