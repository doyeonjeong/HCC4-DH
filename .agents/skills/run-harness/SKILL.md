---
name: run-harness
description: Run or resume the Huddling Codex design harness for one MVP flow using Figma MCP, UI Bowl references, and machine-checkable gates.
---

# Run the Huddling Design Harness

1. Read `AGENTS.md`, `rules.yaml`, `defaults.yaml`, and the active run state.
2. Start a new run from `defaults.yaml` or resume the next incomplete step from `state.json`.
3. Delegate reference, flow, key-screen, token, and Figma work to the matching `.codex/agents/*.toml` agent.
4. Run `node harness/scripts/verify.mjs --run <slug>` after each gate.
5. Record pass/fail, evidence, input hashes, and retry stage in the run state.
6. Wait at G5 for a person to sign `runs/<slug>/approval.md`; invalidate that approval if any bound input hash changes.
7. After G7 passes, prepare the Figma link, screenshots, UI Bowl references, and gate report for Public submission. Do not publish without explicit approval.

Natural-language triggers are listed in `harness/r6-roles.md`.
