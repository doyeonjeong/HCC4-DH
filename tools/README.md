# Tools

Run `npm install` and `npm test` from this directory. `check-sync.mjs` compares `docs/design.md` with `rules.yaml` and the selected preset. Pass `--preset web` to validate another available preset without editing `rules.yaml`.

Build the self-contained Figma gate from the repository root:

```bash
node tools/build-figma-gate.mjs --gate G1
node tools/build-figma-gate.mjs --gate G2
```

The bundle is written under `tools/dist/`. Paste the selected bundle into the Figma MCP code execution context. It reads the configured Figma page, evaluates it in memory, and returns only a bounded summary. Do not paste a raw Figma dump into a chat response.

`check-gates.mjs` accepts a saved JSON dump for local debugging. Its output path must be under `runs/`; the Figma bundle remains the normal gate workflow.
