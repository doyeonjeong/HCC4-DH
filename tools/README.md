# Tools

Run `npm install` and `npm test` from this directory. `check-sync.mjs` compares `docs/design.md` with `rules.yaml` and the selected preset. Pass `--preset web` to validate another available preset without editing `rules.yaml`.

Build the self-contained Figma gate from the repository root:

```bash
node tools/build-figma-gate.mjs --gate G1
node tools/build-figma-gate.mjs --gate G2
```

The bundle is written under `tools/dist/`. Paste the selected bundle into the Figma MCP code execution context. It reads the configured Figma page, evaluates it in memory, and returns only a bounded summary. Do not paste a raw Figma dump into a chat response.

Figma notes learned from real runs (MoreWin, Questers — 2026-10):

- The Figma plugin sandbox has no `TextEncoder`. The bundle counts UTF-8 bytes itself; keep it that way.
- Figma variable names cannot contain `.`. Use `safe-area/top` for `tokens.safe_area.variable`.
- `figma.combineAsVariants()` gives the new component set a 5px corner radius. Set `set.cornerRadius = 0`, or G1 reports `unbound_values` (4 per set).
- The Claude Code Figma plugin names the tool `mcp__plugin_figma_figma__use_figma`; a direct MCP install uses `mcp__figma__use_figma`. The phase guard accepts both.
- Hooks load only when this folder is the Claude Code project root. If you copy the harness into a subfolder of an app repository (for example `design-harness/`), the hooks in `.claude/settings.json` do not run; follow the phase rules manually or register the hooks in the app repository's `.claude/settings.json` with paths to this folder.
- Tool tests read `tools/test/fixtures/starter-project/`, not the project's own `rules.yaml` and `docs/`, so filling in real project values does not break them.

`check-gates.mjs` accepts a saved JSON dump for local debugging. Its output path must be under `runs/`; the Figma bundle remains the normal gate workflow.
