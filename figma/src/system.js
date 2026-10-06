// Components for the system page. Runs in the same use_figma call as the built-in tokens step
// (variables and text styles already exist). Replace the examples with the components in rules.yaml.
// Helpers: autoLayout, text, fill, stroke, pad, gap, radius, combine, instance — see tools/figma-scripts/runtime/prelude.js.
// If this call grows too heavy, move components into figma/src/components.js; it becomes its own use_figma call.

// Example: a Button set with one variant axis. Variant names use "property=value".
const buttons = [];
for (const [type, background, label] of [["primary", "primary", "canvas"], ["secondary", "surface", "text-primary"]]) {
  const button = figma.createComponent();
  button.name = `type=${type}`;
  button.layoutMode = "HORIZONTAL";
  button.primaryAxisAlignItems = "CENTER";
  button.counterAxisAlignItems = "CENTER";
  button.primaryAxisSizingMode = "AUTO";
  button.counterAxisSizingMode = "AUTO";
  fill(button, background);
  pad(button, "sm", "md");
  radius(button, "md");
  const caption = await text("Button", "body", label, { name: "Label", center: true });
  button.appendChild(caption);
  const labelKey = button.addComponentProperty("Label", "TEXT", "Button");
  caption.componentPropertyReferences = { characters: labelKey };
  buttons.push(button);
}
combine(buttons, "Button");

// Example: a single component with required text.
const heading = figma.createComponent();
heading.name = "Heading";
heading.layoutMode = "VERTICAL";
heading.primaryAxisSizingMode = "AUTO";
heading.counterAxisSizingMode = "AUTO";
fill(heading, null);
heading.appendChild(await text("Heading", "heading", "text-primary", { name: "Text" }));

// TODO: add the remaining components listed in rules.yaml components.required.

return { variables: Object.keys(VAR).length, textStyles: Object.keys(TEXT_STYLE).length, components: systemPage.children.map((n) => n.name) };
