// Minimal in-memory Figma Plugin API for offline dry runs of generated build scripts.
// It reproduces the traps seen in real runs (white default fills, 5px component-set radius, "." in variable
// names, FILL/HUG misuse, missing TextEncoder). It does not compute layout sizes or render anything.
const AUTO = (node) => Boolean(node && node.layoutMode && node.layoutMode !== "NONE");
const CORNERS = ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"];
const white = () => [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 1, visible: true }];

export function createMockFigma() {
  let seq = 0;
  const nextId = () => `9:${++seq}`;
  const variables = [];
  const collections = [];
  const textStyles = [];
  const effectStyles = [];
  const loadedFonts = new Set();
  const fontKey = (font) => `${font?.family}/${font?.style}`;

  class Node {
    constructor(type, props = {}) {
      Object.assign(this, { id: nextId(), type, name: type, children: [], parent: null, fills: [], strokes: [], boundVariables: {}, width: 100, height: 100, layoutMode: "NONE", visible: true, opacity: 1 }, props);
      this._sizing = { h: "FIXED", v: "FIXED" };
    }
    appendChild(child) { if (child.parent) child.parent.children = child.parent.children.filter((c) => c !== child); this.children.push(child); child.parent = this; }
    insertChild(index, child) { this.appendChild(child); this.children.splice(index, 0, this.children.pop()); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; }
    resize(width, height) { this.width = width; this.height = height; }
    resizeWithoutConstraints(width, height) { this.resize(width, height); }
    setBoundVariable(property, variable) {
      if (!variable?.id) throw new Error(`setBoundVariable(${property}) without a variable on ${this.name}`);
      this.boundVariables = { ...this.boundVariables, [property]: { type: "VARIABLE_ALIAS", id: variable.id } };
      this[property] = variable.values.m0;
    }
    findOne(match) { for (const c of this.children) { if (match(c)) return c; const found = c.findOne(match); if (found) return found; } return null; }
    findAll(match) { const out = []; for (const c of this.children) { if (match(c)) out.push(c); out.push(...c.findAll(match)); } return out; }
    async loadAsync() {}
    get cornerRadius() { return this._radius; }
    set cornerRadius(value) { this._radius = value; for (const corner of CORNERS) this[corner] = value; }
    get layoutSizingHorizontal() { return this._sizing.h; }
    set layoutSizingHorizontal(value) { this._checkSizing(value); this._sizing.h = value; }
    get layoutSizingVertical() { return this._sizing.v; }
    set layoutSizingVertical(value) { this._checkSizing(value); this._sizing.v = value; }
    _checkSizing(value) {
      if (value === "FILL" && !AUTO(this.parent)) throw new Error(`FILL on ${this.name}: append it to an auto-layout parent first`);
      if (value === "HUG" && !(AUTO(this) || this.type === "TEXT")) throw new Error(`HUG on ${this.name}, which is not auto-layout or text`);
    }
    // Text
    get characters() { return this._characters; }
    set characters(value) {
      if (this.type === "TEXT" && !loadedFonts.has(fontKey(this.fontName))) throw new Error(`font ${fontKey(this.fontName)} not loaded before setting characters`);
      this._characters = value;
    }
    async setTextStyleIdAsync(id) {
      const style = textStyles.find((s) => s.id === id);
      if (!style) throw new Error("text style id not found");
      this.textStyleId = id; this.fontName = style.fontName; this.fontSize = style.fontSize; this.lineHeight = style.lineHeight;
    }
    // Components
    addComponentProperty(label, type, defaultValue) { const key = `${label}#${seq}:0`; this._defs = { ...this._defs, [key]: { type, defaultValue } }; return key; }
    get componentPropertyDefinitions() {
      if (this.type !== "COMPONENT_SET" && this.type !== "COMPONENT") return undefined;
      const defs = { ...this._defs };
      if (this.type === "COMPONENT_SET") for (const child of this.children) for (const key of Object.keys(child.variantProperties ?? {})) defs[key] = { type: "VARIANT" };
      return defs;
    }
    get variantProperties() {
      if (this.type !== "COMPONENT" || this.parent?.type !== "COMPONENT_SET") return undefined;
      return Object.fromEntries(this.name.split(/,\s*/).map((pair) => pair.split("=").map((s) => s.trim())).filter((pair) => pair.length === 2));
    }
    createInstance() {
      if (this.type !== "COMPONENT") throw new Error(`createInstance on ${this.type}`);
      const clone = (source) => {
        const copy = new Node(source.type === "COMPONENT" ? "INSTANCE" : source.type, {
          name: source.name, layoutMode: source.layoutMode, width: source.width, height: source.height, fills: source.fills, strokes: source.strokes,
          boundVariables: source.boundVariables, textStyleId: source.textStyleId, textAutoResize: source.textAutoResize, fontName: source.fontName,
          textAlignHorizontal: source.textAlignHorizontal, textAlignVertical: source.textAlignVertical,
          primaryAxisAlignItems: source.primaryAxisAlignItems, counterAxisAlignItems: source.counterAxisAlignItems,
        });
        copy._characters = source._characters;
        for (const child of source.children) copy.appendChild(clone(child));
        return copy;
      };
      const created = clone(this);
      const owner = this.parent?.type === "COMPONENT_SET" ? this.parent : this;
      created.mainComponent = this;
      created.componentProperties = Object.fromEntries(Object.entries(owner._defs ?? {}).map(([key, def]) => [key, { type: def.type, value: def.defaultValue }]));
      created.getMainComponentAsync = async () => this;
      created.setProperties = (values) => {
        for (const [key, value] of Object.entries(values)) {
          if (!(key in created.componentProperties)) throw new Error(`setProperties: ${key} is not a property of ${owner.name}`);
          created.componentProperties[key].value = value;
        }
      };
      return onPage(created);
    }
  }

  const page1 = new Node("PAGE", { name: "Page 1" });
  const onPage = (node) => { figma.currentPage.appendChild(node); return node; };
  const figma = {
    mixed: Symbol("mixed"),
    root: { children: [page1] },
    currentPage: page1,
    createPage() { const p = new Node("PAGE"); this.root.children.push(p); return p; },
    async setCurrentPageAsync(p) { if (!this.root.children.includes(p)) throw new Error("unknown page"); this.currentPage = p; },
    createFrame() { return onPage(new Node("FRAME", { fills: white() })); },
    createComponent() { return onPage(new Node("COMPONENT", { fills: white() })); },
    createText() { return onPage(new Node("TEXT", { fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 1, visible: true }], fontName: { family: "Inter", style: "Regular" }, _characters: "" })); },
    createRectangle() { return onPage(new Node("RECTANGLE", { fills: [{ type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.85 }, opacity: 1, visible: true }] })); },
    createEllipse() { return onPage(new Node("ELLIPSE", { fills: [{ type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.85 }, opacity: 1, visible: true }] })); },
    combineAsVariants(components, parent) {
      if (!components.length || components.some((c) => c.type !== "COMPONENT")) throw new Error("combineAsVariants needs components");
      const set = new Node("COMPONENT_SET", { layoutMode: "NONE" });
      set.cornerRadius = 5; // Real Figma default; G1 counts it as 4 unbound corner values.
      // Like Figma, properties added to each variant before combining are merged onto the set by label.
      set._defs = {};
      for (const c of components) {
        for (const [key, def] of Object.entries(c._defs ?? {})) {
          const label = key.split("#")[0];
          if (!Object.keys(set._defs).some((k) => k.split("#")[0] === label)) set._defs[key] = def;
        }
        delete c._defs;
        set.appendChild(c);
      }
      parent.appendChild(set);
      return set;
    },
    async loadFontAsync(font) { if (!font?.family || !font?.style) throw new Error(`bad font ${JSON.stringify(font)}`); loadedFonts.add(fontKey(font)); },
    createTextStyle() { const s = { id: `S:${++seq},`, name: "", type: "TEXT" }; textStyles.push(s); return s; },
    createEffectStyle() { const s = { id: `S:${++seq},`, name: "", type: "EFFECT" }; effectStyles.push(s); return s; },
    async getLocalTextStylesAsync() { return [...textStyles]; },
    async getLocalEffectStylesAsync() { return [...effectStyles]; },
    variables: {
      async getLocalVariablesAsync() { return [...variables]; },
      async getLocalVariableCollectionsAsync() { return [...collections]; },
      createVariableCollection(name) {
        const c = { id: `C:${++seq}`, name, modes: [{ modeId: "m0", name: "Mode 1" }], renameMode(id, n) { this.modes.find((m) => m.modeId === id).name = n; } };
        collections.push(c);
        return c;
      },
      createVariable(name, collection, type) {
        if (/[.{}]/.test(name)) throw new Error(`invalid variable name ${name}`);
        if (variables.some((v) => v.name === name)) throw new Error(`duplicate variable name ${name}`);
        const v = { id: `VariableID:${++seq}`, name, type, collection: collection.name, values: {}, scopes: [], codeSyntax: {}, setValueForMode(m, x) { this.values[m] = x; }, setVariableCodeSyntax(platform, code) { this.codeSyntax[platform] = code; } };
        variables.push(v);
        return v;
      },
      setBoundVariableForPaint(paint, field, variable) {
        if (!variable?.id) throw new Error("paint bound without a variable");
        return { ...paint, opacity: 1, visible: true, boundVariables: { [field]: { type: "VARIABLE_ALIAS", id: variable.id } } };
      },
    },
  };
  return { figma, state: { variables, collections, textStyles, effectStyles } };
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

/** Run one generated script the way use_figma does, with TextEncoder absent. */
export function runScript(code, figma) {
  return new AsyncFunction("figma", "TextEncoder", code)(figma, undefined);
}
