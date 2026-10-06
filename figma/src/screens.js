// Screens page. Run after G1 passes (phase P3). One frame per rules.yaml screen, named by its id.
// Every element inside a screen must be an instance or an auto-layout frame that holds them (G2 non_instance_elements).
const SCREENS = page(DATA.pages.screens);
await figma.setCurrentPageAsync(SCREENS);
const existing = DATA.screens.filter((screen) => SCREENS.children.some((n) => n.name === screen.id));
if (existing.length) throw new Error(`Screens already exist: ${existing.map((s) => s.id).join(", ")}`);

const created = {};
for (const [index, screen] of DATA.screens.entries()) {
  const frame = autoLayout("VERTICAL", { name: screen.id, gap: "md" });
  SCREENS.appendChild(frame);
  frame.primaryAxisSizingMode = "FIXED";
  frame.counterAxisSizingMode = "FIXED";
  frame.resize(DATA.preset.viewport.width, DATA.preset.viewport.height);
  frame.x = index * (DATA.preset.viewport.width + 80);
  fill(frame, "canvas");
  pad(frame, null, "md", "md", "md");
  if (DATA.preset.safeAreaTop > 0) bindSafeArea(frame);

  // TODO: build each screen from docs/ with instances, e.g.
  // frame.appendChild(instance("Heading"));
  // frame.appendChild(instance("Button", { type: "primary" }, { Label: "Continue" }));
  created[screen.id] = frame.id;
}
return { screens: created };
