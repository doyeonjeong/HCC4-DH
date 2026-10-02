const TEXT_AUTO_RESIZE_VALUES = new Set(["HEIGHT", "WIDTH_AND_HEIGHT"]);
const normalize = (value) => String(value ?? "").trim().toLowerCase();
const propertyKey = (value) => normalize(value).replace(/[\s_-]/g, "");
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const hasBinding = (value) => (typeof value === "string" && value.length > 0 && value !== "MIXED")
  || (isRecord(value) && typeof value.id === "string" && value.id.length > 0)
  || (Array.isArray(value) && value.some(hasBinding));

export function validateDump(dump) {
  if (!isRecord(dump) || !Array.isArray(dump.nodes)) throw new TypeError("dump must be an object with a nodes array");
  if (typeof dump.dumper !== "string" || !/^figma-dump@\d+\.\d+\.\d+$/.test(dump.dumper)) {
    throw new TypeError("dump.dumper must match figma-dump@<major>.<minor>.<patch>");
  }
  if (!isRecord(dump.page) || typeof dump.page.id !== "string" || !dump.page.id
    || typeof dump.page.name !== "string" || !dump.page.name || dump.page.type !== "PAGE") {
    throw new TypeError("dump.page must include a PAGE id and name");
  }
  if (dump.node_count !== dump.nodes.length) throw new TypeError("dump.node_count must match nodes length");
  const ids = new Set();
  for (const [index, node] of dump.nodes.entries()) {
    if (!isRecord(node) || typeof node.id !== "string" || !node.id) throw new TypeError(`nodes[${index}].id is invalid`);
    if (ids.has(node.id)) throw new TypeError(`duplicate node id: ${node.id}`);
    ids.add(node.id);
    if (typeof node.name !== "string" || typeof node.type !== "string") throw new TypeError(`nodes[${index}] needs name and type`);
    if (node.parentId !== null && typeof node.parentId !== "string") throw new TypeError(`nodes[${index}].parentId is invalid`);
  }
  for (const node of dump.nodes) {
    if (node.parentId !== null && node.parentId !== dump.page.id && !ids.has(node.parentId)) {
      throw new TypeError(`node ${node.id} references missing parent ${node.parentId}`);
    }
  }
  const parentById = new Map(dump.nodes.map((node) => [node.id, node.parentId]));
  for (const node of dump.nodes) {
    const seen = new Set([node.id]);
    let parentId = node.parentId;
    while (parentId && parentId !== dump.page.id && parentById.has(parentId)) {
      if (seen.has(parentId)) throw new TypeError(`parent cycle includes node ${parentId}`);
      seen.add(parentId);
      parentId = parentById.get(parentId);
    }
  }
  return dump;
}

function createTree(nodes) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const children = new Map();
  for (const node of nodes) {
    const entries = children.get(node.parentId) ?? [];
    entries.push(node);
    children.set(node.parentId, entries);
  }
  const ancestors = (node) => {
    const result = [];
    let current = node.parentId ? byId.get(node.parentId) : undefined;
    while (current) {
      result.push(current);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return result;
  };
  const descendants = (node, stopAtInstance = false) => {
    const result = [];
    const visit = (parent) => {
      for (const child of children.get(parent.id) ?? []) {
        result.push(child);
        if (!(stopAtInstance && child.type === "INSTANCE")) visit(child);
      }
    };
    visit(node);
    return result;
  };
  return { byId, children, ancestors, descendants };
}

function componentNames(node, tree) {
  const parentSet = node.type === "COMPONENT" ? tree?.byId.get(node.parentId) : undefined;
  return [node.name, node.mainComponent?.name, node.mainComponent?.componentSet?.name,
    parentSet?.type === "COMPONENT_SET" ? parentSet.name : undefined]
    .filter((value) => typeof value === "string")
    .flatMap((value) => value.split(/[,/]/).map((part) => part.trim()));
}

function componentMatches(node, name, tree) {
  return componentNames(node, tree).some((candidate) => normalize(candidate) === normalize(name));
}

function componentNodes(nodes) {
  return nodes.filter((node) => node.type === "COMPONENT_SET"
    || (node.type === "COMPONENT" && !nodes.some((parent) => parent.id === node.parentId && parent.type === "COMPONENT_SET")));
}

function propertyValue(node, name) {
  const wanted = propertyKey(name);
  const sources = [node.componentProperties, node.variantProperties, node.mainComponent?.componentProperties, node.mainComponent?.variantProperties];
  for (const source of sources) {
    if (!isRecord(source)) continue;
    for (const [key, raw] of Object.entries(source)) {
      if (propertyKey(key) !== wanted) continue;
      return isRecord(raw) && Object.hasOwn(raw, "value") ? raw.value : raw;
    }
  }
  const propertyPattern = new RegExp(`(?:^|[,/\\s])${String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=\\s*([^,]+)`, "i");
  return componentNames(node).map((value) => value.match(propertyPattern)?.[1]?.trim()).find(Boolean);
}

function addViolation(violations, key, node, count = 1) {
  const current = violations.get(key) ?? { count: 0, nodes: [] };
  current.count += count;
  const id = typeof node === "string" ? node : node?.id;
  if (id && !current.nodes.includes(id) && current.nodes.length < 50) current.nodes.push(id);
  violations.set(key, current);
}

function isVisiblePaint(paint) {
  const opacity = Number(paint?.opacity ?? 1);
  return isRecord(paint) && paint.visible !== false && Number.isFinite(opacity) && opacity > 0;
}

function isSolid(paint) {
  return isVisiblePaint(paint) && normalize(paint.type) === "solid" && isRecord(paint.color);
}

function paintBound(node, paint, index, field) {
  if (hasBinding(paint?.boundVariables?.color)) return true;
  const nodeBindings = node.boundVariables ?? {};
  const group = nodeBindings[field];
  return hasBinding(Array.isArray(group) ? group[index] : group?.[index] ?? group?.[String(index)])
    || hasBinding(nodeBindings.color);
}

function unboundPaint(node, paint, index, field) {
  if (!isVisiblePaint(paint)) return false;
  const type = normalize(paint.type);
  if (type === "solid") return !paintBound(node, paint, index, field);
  if (!type.startsWith("gradient_")) return false;
  const stops = Array.isArray(paint.gradientStops) ? paint.gradientStops : [];
  if (!stops.length) return true;
  const nodeGroup = node.boundVariables?.[field];
  const nodePaintBinding = Array.isArray(nodeGroup) ? nodeGroup[index] : nodeGroup?.[index] ?? nodeGroup?.[String(index)];
  return stops.some((stop, stopIndex) => !hasBinding(stop?.boundVariables?.color)
    && !hasBinding(paint.boundVariables?.gradientStops?.[stopIndex])
    && !hasBinding(nodePaintBinding?.gradientStops?.[stopIndex])
    && !paintBound(node, paint, index, field));
}

function numericValue(value) {
  const raw = isRecord(value) ? value.value : value;
  const result = Number(raw);
  return Number.isFinite(result) ? result : undefined;
}

function unboundTokenValues(node) {
  const properties = [
    "itemSpacing", "counterAxisSpacing", "paddingLeft", "paddingRight", "paddingTop", "paddingBottom",
    "cornerRadius", "topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius",
    "fontSize", "lineHeight", "letterSpacing",
  ];
  return properties.filter((property) => {
    const value = numericValue(node[property]);
    if (value === undefined || value === 0 || hasBinding(node.boundVariables?.[property])) return false;
    if (["fontSize", "lineHeight", "letterSpacing"].includes(property)
      && typeof node.textStyleId === "string" && node.textStyleId !== "MIXED") return false;
    return true;
  });
}

function isUnderInstance(node, tree) {
  return tree.ancestors(node).some((ancestor) => ancestor.type === "INSTANCE");
}

function isAutoLayout(node) {
  return typeof node.layoutMode === "string" && !["", "none"].includes(normalize(node.layoutMode));
}

function variantAxisCount(set, nodes) {
  const definitions = set.componentPropertyDefinitions;
  if (isRecord(definitions)) {
    const axes = Object.values(definitions).filter((definition) => normalize(definition?.type) === "variant").length;
    if (axes) return axes;
  }
  const keys = new Set(nodes.filter((node) => node.parentId === set.id)
    .flatMap((node) => Object.keys(node.variantProperties ?? {})));
  return keys.size;
}

function findScreens(dump, rules) {
  const configured = Array.isArray(rules.screens) ? rules.screens : [];
  const frames = dump.nodes.filter((node) => node.type === "FRAME");
  if (configured.length === 0) return [];
  return configured.map((screen) => {
    const id = typeof screen === "string" ? screen : screen.id;
    const title = typeof screen === "string" ? screen : screen.title;
    return frames.find((frame) => frame.id === id || frame.name === title || frame.name === id);
  }).filter(Boolean);
}

function rgb(paint) {
  if (!isSolid(paint)) return undefined;
  const color = paint.color;
  const channels = [color.r, color.g, color.b].map(Number);
  if (!channels.every(Number.isFinite)) return undefined;
  return {
    r: Math.min(1, Math.max(0, channels[0])),
    g: Math.min(1, Math.max(0, channels[1])),
    b: Math.min(1, Math.max(0, channels[2])),
    a: Math.min(1, Math.max(0, Number(paint.opacity ?? 1))),
  };
}

function colorFromHex(value) {
  const match = String(value ?? "").match(/^#([\da-f]{6})$/i);
  if (!match) return undefined;
  const hex = match[1];
  return { r: parseInt(hex.slice(0, 2), 16) / 255, g: parseInt(hex.slice(2, 4), 16) / 255, b: parseInt(hex.slice(4, 6), 16) / 255, a: 1 };
}

function luminance(color) {
  const linear = (value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
}

function composite(foreground, background) {
  const alpha = foreground.a;
  return {
    r: foreground.r * alpha + background.r * (1 - alpha),
    g: foreground.g * alpha + background.g * (1 - alpha),
    b: foreground.b * alpha + background.b * (1 - alpha),
    a: 1,
  };
}

function contrastRatio(first, second) {
  const high = Math.max(luminance(first), luminance(second));
  const low = Math.min(luminance(first), luminance(second));
  return (high + 0.05) / (low + 0.05);
}

function closestBackground(node, tree, rules) {
  for (const ancestor of tree.ancestors(node)) {
    if (Number(ancestor.opacity ?? 1) < 1 || ancestor.visible === false) continue;
    const paints = Array.isArray(ancestor.fills) ? ancestor.fills : [];
    const found = paints.map(rgb).find((color) => color?.a >= 1);
    if (found) return found;
  }
  return colorFromHex(rules.tokens?.colors?.canvas);
}

function hasLowContrast(node, tree, rules, threshold) {
  const segments = Array.isArray(node.textSegments) && node.textSegments.length ? node.textSegments : [node];
  const background = closestBackground(node, tree, rules);
  if (!background) return true;
  for (const segment of segments) {
    const paints = Array.isArray(segment.fills) ? segment.fills : Array.isArray(node.fills) ? node.fills : [];
    if (!paints.length) return true;
    for (const paint of paints.filter(isVisiblePaint)) {
      const foreground = rgb(paint);
      if (!foreground || contrastRatio(composite(foreground, background), background) < threshold) return true;
    }
  }
  return false;
}

function checkG1(dump, rules, preset, violations, includeLibraryChecks) {
  const checks = rules.gates?.G1?.checks;
  if (!isRecord(checks)) throw new TypeError("rules.yaml must define gates.G1.checks");
  const tree = createTree(dump.nodes);
  const componentDefinitions = componentNodes(dump.nodes);
  const interactive = Array.isArray(rules.components?.interactive) ? rules.components.interactive : [];
  const centerText = Array.isArray(rules.components?.center_text) ? rules.components.center_text : [];

  for (const node of dump.nodes) {
    for (const field of ["fills", "strokes"]) {
      const paints = Array.isArray(node[field]) ? node[field] : [];
      paints.forEach((paint, index) => {
        if (unboundPaint(node, paint, index, field)) addViolation(violations, "unbound_values", node);
      });
    }
    for (const property of unboundTokenValues(node)) addViolation(violations, "unbound_values", node);
    if (node.type === "FRAME" && !isAutoLayout(node) && !isUnderInstance(node, tree)
      && tree.ancestors(node).some((ancestor) => ["COMPONENT", "COMPONENT_SET"].includes(ancestor.type))) {
      addViolation(violations, "autolayout_off", node);
    }
    if (node.type === "TEXT" && !TEXT_AUTO_RESIZE_VALUES.has(String(node.textAutoResize ?? "").toUpperCase())) {
      addViolation(violations, "fixed_height_text", node);
    }
  }

  for (const name of centerText) {
    for (const component of dump.nodes.filter((node) => ["COMPONENT", "INSTANCE"].includes(node.type) && componentMatches(node, name, tree))) {
      if (normalize(component.primaryAxisAlignItems) !== "center" || normalize(component.counterAxisAlignItems) !== "center") {
        addViolation(violations, "text_not_centered", component);
      }
      for (const text of tree.descendants(component, true).filter((node) => node.type === "TEXT")) {
        if (normalize(text.textAlignHorizontal) !== "center" || normalize(text.textAlignVertical) !== "center") {
          addViolation(violations, "text_not_centered", text);
        }
      }
    }
  }

  for (const node of dump.nodes.filter((candidate) => ["COMPONENT", "INSTANCE"].includes(candidate.type)
    && interactive.some((name) => componentMatches(candidate, name, tree)))) {
    if (!(Number(node.width) >= preset.target.minimum_size && Number(node.height) >= preset.target.minimum_size)) {
      addViolation(violations, "min_target_size", node);
    }
  }

  if (includeLibraryChecks) {
    const required = Array.isArray(rules.components?.required) ? rules.components.required : [];
    for (const name of required) {
      if (!componentDefinitions.some((node) => componentMatches(node, name, tree))) addViolation(violations, "required_components", name);
    }
    for (const name of rules.components?.text_required ?? []) {
      const components = componentDefinitions.filter((node) => componentMatches(node, name, tree));
      for (const component of components) {
        if (!tree.descendants(component).some((node) => node.type === "TEXT" && String(node.characters ?? "").trim())) {
          addViolation(violations, "text_required", component);
        }
      }
      if (!components.length) addViolation(violations, "text_required", name);
    }

    const maxComponents = Number(checks.component_count_max ?? rules.components?.max_count);
    if (componentDefinitions.length > maxComponents) {
      for (const component of componentDefinitions.slice(maxComponents)) addViolation(violations, "component_count_max", component);
    }
    const maxAxes = Number(checks.variant_axes_max ?? rules.components?.max_variant_axes);
    for (const set of dump.nodes.filter((node) => node.type === "COMPONENT_SET")) {
      const excess = variantAxisCount(set, dump.nodes) - maxAxes;
      if (excess > 0) addViolation(violations, "variant_axes_max", set, excess);
    }
  }
  return tree;
}

function checkInvariants(dump, rules, screens, tree, violations) {
  const invariants = rules.gates?.G2?.checks?.invariants ?? [];
  for (const invariant of Array.isArray(invariants) ? invariants : Object.values(invariants)) {
    if (!isRecord(invariant)) continue;
    const screenName = typeof invariant.screen === "string" ? invariant.screen : undefined;
    const screen = screens.find((candidate) => candidate.id === screenName || candidate.name === screenName)
      ?? (screenName ? undefined : screens[0]);
    if (!screen) {
      addViolation(violations, "invariants", invariant.id ?? "screen");
      continue;
    }
    const candidates = tree.descendants(screen);
    const node = candidates.find((candidate) => candidate.id === invariant.node_id)
      ?? candidates.find((candidate) => candidate.name === invariant.node);
    if (!node) {
      addViolation(violations, "invariants", screen);
      continue;
    }
    if (invariant.property && Object.hasOwn(invariant, "equals") && node[invariant.property] !== invariant.equals) {
      addViolation(violations, "invariants", node);
    }
    if (invariant.property && Number.isFinite(invariant.minimum) && Number(node[invariant.property]) < invariant.minimum) {
      addViolation(violations, "invariants", node);
    }
    if (invariant.property && Number.isFinite(invariant.maximum) && Number(node[invariant.property]) > invariant.maximum) {
      addViolation(violations, "invariants", node);
    }
  }
}

function checkFrames(dump, rules, preset, tree, violations) {
  const checks = rules.gates?.G2?.checks;
  if (!isRecord(checks)) throw new TypeError("rules.yaml must define gates.G2.checks");
  const frames = findScreens(dump, rules);
  if (!frames.length) {
    addViolation(violations, "screens", dump.page.id);
    return;
  }

  for (const frame of frames) {
    for (const node of tree.descendants(frame)) {
      if (node.type === "INSTANCE" || isUnderInstance(node, tree)) continue;
      const children = tree.children.get(node.id) ?? [];
      const layoutContainer = node.type === "FRAME" && children.length > 0 && isAutoLayout(node);
      if (!layoutContainer) addViolation(violations, "non_instance_elements", node);
    }
  }

  const action = rules.components?.primary_action ?? {};
  const maxActions = Number(checks.primary_action_per_screen_max ?? 1);
  for (const frame of frames) {
    const actions = tree.descendants(frame).filter((node) => node.type === "INSTANCE"
      && componentMatches(node, action.component ?? "Button", tree)
      && normalize(propertyValue(node, action.property ?? "type")) === normalize(action.value ?? "primary"));
    if (actions.length > maxActions) {
      for (const node of actions.slice(maxActions)) addViolation(violations, "primary_action_per_screen_max", node);
    }
  }

  if (checks.min_contrast !== undefined) {
    for (const text of dump.nodes.filter((node) => node.type === "TEXT" && frames.some((frame) => tree.ancestors(node).some((ancestor) => ancestor.id === frame.id)))) {
      if (hasLowContrast(text, tree, rules, Number(checks.min_contrast))) addViolation(violations, "min_contrast", text);
    }
  }

  if (checks.safe_area_binding && preset.safe_area.top > 0) {
    const property = rules.tokens?.safe_area?.bind_to ?? "paddingTop";
    for (const frame of frames) {
      if (!hasBinding(frame.boundVariables?.[property])) addViolation(violations, "safe_area_binding", frame);
    }
  }
  checkInvariants(dump, rules, frames, tree, violations);
}

function gateKeys(gate, rules) {
  const base = ["unbound_values", "autolayout_off", "text_not_centered", "fixed_height_text", "min_target_size"];
  if (gate === "G1") return [...base, "component_count_max", "variant_axes_max", "required_components", "text_required"];
  return [...base, "non_instance_elements", "primary_action_per_screen_max", "min_contrast", "safe_area_binding", "invariants", "screens"];
}

export function evaluateGate(dumpInput, rules, preset, gate) {
  if (!(["G1", "G2"].includes(gate))) throw new TypeError("gate must be G1 or G2");
  const dump = validateDump(dumpInput);
  const expectedPage = rules?.gates?.[gate]?.page;
  if (typeof expectedPage !== "string" || !expectedPage.trim()) throw new TypeError(`rules.yaml must define gates.${gate}.page`);
  if (dump.page.name !== expectedPage) throw new TypeError(`dump page ${dump.page.name} does not match rules.gates.${gate}.page`);
  if (!preset || !Number.isFinite(preset.target?.minimum_size)) throw new TypeError("selected preset is missing target.minimum_size");

  const violations = new Map();
  const tree = checkG1(dump, rules, preset, violations, gate === "G1");
  if (gate === "G2") checkFrames(dump, rules, preset, tree, violations);
  const keys = gateKeys(gate, rules);
  const checks = Object.fromEntries(keys.map((key) => {
    const entry = violations.get(key) ?? { count: 0, nodes: [] };
    return [key, { count: entry.count, nodes: entry.nodes, pass: entry.count === 0 }];
  }));
  return {
    gate,
    page: dump.page.name,
    node_count: dump.node_count,
    pass: Object.values(checks).every((check) => check.pass),
    checks,
  };
}
