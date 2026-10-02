const DUMPER_VERSION = "1.0.0";
const NODE_FIELDS = [
  "componentPropertyDefinitions", "componentProperties", "variantProperties",
  "layoutMode", "primaryAxisAlignItems", "counterAxisAlignItems", "layoutSizingHorizontal",
  "layoutSizingVertical", "layoutAlign", "width", "height", "textAutoResize",
  "textAlignHorizontal", "textAlignVertical", "textStyleId", "fontName", "fontStyle", "fontSize",
  "fontWeight", "lineHeight", "letterSpacing", "textCase", "textDecoration",
  "opacity", "visible", "characters", "itemSpacing", "counterAxisSpacing",
  "paddingLeft", "paddingRight", "paddingTop", "paddingBottom", "cornerRadius",
  "topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius",
  "boundVariables",
];

function toJson(value, mixed, seen = new WeakSet()) {
  if (value === mixed || typeof value === "symbol") return "MIXED";
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return value;
  if (typeof value === "undefined" || typeof value === "function") return undefined;
  if (Array.isArray(value)) return value.map((item) => toJson(item, mixed, seen));
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  const result = {};
  for (const key of Object.keys(value)) {
    try {
      const item = toJson(value[key], mixed, seen);
      if (item !== undefined) result[key] = item;
    } catch {
      // Figma may throw when a node type does not support a property.
    }
  }
  seen.delete(value);
  return result;
}

function readFields(source, mixed, keys) {
  const result = {};
  for (const key of keys) {
    try {
      const value = source?.[key];
      if (value !== undefined) result[key] = toJson(value, mixed);
    } catch {
      // Unsupported node properties are omitted.
    }
  }
  return result;
}

async function mainComponentInfo(node, mixed) {
  if (node.type !== "INSTANCE" || typeof node.getMainComponentAsync !== "function") return null;
  try {
    const component = await node.getMainComponentAsync();
    if (!component) return null;
    const set = component.parent?.type === "COMPONENT_SET" ? component.parent : null;
    return {
      id: toJson(component.id, mixed),
      name: toJson(component.name, mixed),
      variantProperties: toJson(component.variantProperties, mixed),
      componentProperties: toJson(component.componentProperties, mixed),
      componentSet: set ? { id: toJson(set.id, mixed), name: toJson(set.name, mixed) } : null,
    };
  } catch {
    return null;
  }
}

async function textSegments(node, mixed) {
  if (typeof node.getStyledTextSegments !== "function") return [];
  try {
    const segments = await node.getStyledTextSegments([
      "characters", "textStyleId", "fontName", "fontStyle", "fontSize", "fontWeight",
      "lineHeight", "letterSpacing", "fills", "textCase", "textDecoration",
    ]);
    return (segments ?? []).map((segment) => ({
      ...readFields(segment, mixed, [
        "start", "end", "characters", "textStyleId", "fontName", "fontStyle", "fontSize",
        "fontWeight", "lineHeight", "letterSpacing", "textCase", "textDecoration", "boundVariables",
      ]),
      ...(segment.fills === undefined ? {} : { fills: toJson(segment.fills, mixed) }),
    }));
  } catch {
    return [];
  }
}

/** Read one named Figma page and return JSON-safe node data without changing the document. */
export async function dumpFigmaPage(figma, pageName) {
  if (!figma?.root || typeof pageName !== "string" || !pageName.trim()) {
    throw new TypeError("figma root and a page name are required");
  }
  const page = figma.root.children?.find((candidate) => candidate.name === pageName && candidate.type === "PAGE");
  if (!page) throw new Error(`Figma page not found: ${pageName}`);
  if (typeof page.loadAsync === "function") await page.loadAsync();

  const mixed = figma.mixed;
  const nodes = [];
  async function visit(node, parentId) {
    const record = {
      id: toJson(node.id, mixed),
      name: toJson(node.name, mixed),
      type: toJson(node.type, mixed),
      parentId: parentId ?? page.id,
      ...readFields(node, mixed, NODE_FIELDS),
    };
    for (const key of ["fills", "strokes"]) {
      try {
        if (node[key] !== undefined) record[key] = toJson(node[key], mixed);
      } catch {
        // Unsupported paint fields are omitted.
      }
    }
    if (node.type === "TEXT") {
      const segments = await textSegments(node, mixed);
      if (segments.length) record.textSegments = segments;
    }
    if (node.type === "INSTANCE") record.mainComponent = await mainComponentInfo(node, mixed);
    nodes.push(record);
    for (const child of node.children ?? []) await visit(child, node.id);
  }

  for (const child of page.children ?? []) await visit(child, page.id);
  return {
    dumper: `figma-dump@${DUMPER_VERSION}`,
    page: { id: toJson(page.id, mixed), name: toJson(page.name, mixed), type: "PAGE" },
    node_count: nodes.length,
    nodes,
  };
}
