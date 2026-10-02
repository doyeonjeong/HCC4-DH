#!/usr/bin/env node
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { approvalMatches, checkTrafficLightCoverage, computeInputHash, hasManualReviewPolicy, hasSellerGate, validateScreenSpec } from "./gate-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const runArg = args.indexOf("--run");
const runSlug = runArg >= 0 ? args[runArg + 1] : "huddling-mvp-poc";
const runDir = path.join(root, "runs", runSlug);
const read = relative => readFileSync(path.join(root, relative), "utf8");
const json = relative => JSON.parse(read(relative));
const results = [];
const add = (id, status, detail) => results.push({id,status,detail});
const exists = relative => existsSync(path.join(root, relative));

try {
  const rules = json("rules.yaml");
  const defaults = json("defaults.yaml");
  const service = read("docs/story-service.md");
  const work = read("docs/story-work.md");
  const guide = read("harness/guides/figma-design-guide.md");
  const spec = json(`runs/${runSlug}/screen-spec.json`);
  const refs = json(`runs/${runSlug}/references/uibowl.json`).references ?? [];
  const figma = json(`runs/${runSlug}/figma/manifest.json`);
  const state = json(`runs/${runSlug}/state.json`);

  const storyBlock = service.split("## 사용자 스토리")[1]?.split("## 이 서비스에서")[0] ?? "";
  const invariantBlock = service.split("## 이 서비스에서 어기면 안 되는 것")[1] ?? "";
  const storyCount = [...storyBlock.matchAll(/^\d+\. /gm)].length;
  const invariantCount = [...invariantBlock.matchAll(/^\d+\. /gm)].length;
  const sourceOK = storyCount >= rules.stories.min && storyCount <= rules.stories.max && invariantCount >= rules.invariants.min && invariantCount <= rules.invariants.max;
  add("G1-SERVICE", sourceOK, `stories=${storyCount}; invariants=${invariantCount}`);
  add("G1-SELLER", hasSellerGate(spec), "sale request actor must be seller when saleApplications are present");
  add("G1-MANUAL-REVIEW", hasManualReviewPolicy(spec), "operator checklist required; AI first review disabled");

  const specIssues = validateScreenSpec(spec, rules);
  const tokenIssues = specIssues.filter(issue => issue.startsWith("TOKEN "));
  const screenIssues = specIssues.filter(issue => !issue.startsWith("TOKEN "));
  add("G2-SCREEN-SPEC", screenIssues.length === 0, screenIssues.length ? screenIssues.join("; ") : `${spec.screens.length} screens satisfy IDs, role, story, and feature rules`);
  add("G6-TOKENS", tokenIssues.length === 0, tokenIssues.length ? tokenIssues.join("; ") : "screen tokens use values listed in rules.yaml");

  const goodRefs = refs.filter(ref => {
    try { return new URL(ref.url).hostname === rules.references.host; } catch { return false; }
  });
  add("G3-UIBOWL", goodRefs.length >= rules.references.min && goodRefs.every(ref => (ref.observations ?? []).length > 0), `${goodRefs.length}/${rules.references.min} source links with observations`);

  const guideMissing = checkTrafficLightCoverage(rules, guide, [
    "SVC-SELLER-ROLE","SVC-MANUAL-REVIEW","MVP-NO-MARKETPLACE",
    "FLOW-THREE-SCREENS","REF-TWO-SOURCES","TOK-DESIGN-SYSTEM","FIGMA-FRAME-STATE"
  ]);
  add("G4-RULE-COVERAGE", guideMissing.length === 0, guideMissing.length ? `not executable: ${guideMissing.join(", ")}` : "all traffic-light guide rules map to the executable rule registry");

  const frames = figma.frames ?? [];
  const frameIds = new Set(frames.map(frame => frame.screenId));
  const frameProblems = rules.screenIds.filter(id => !frameIds.has(id));
  const frameSizeOK = frames.length === rules.screenCount && frames.every(frame => frame.width === rules.frame.width && frame.height === rules.frame.height && frame.nodeId);
  add("G7-FIGMA", frameProblems.length === 0 && frameSizeOK, frameProblems.length ? `missing frames: ${frameProblems.join(", ")}` : `manifest frames=${frames.length}; size=${rules.frame.width}x${rules.frame.height}`);

  const inputPaths = ["docs/prd.md","docs/design.md","docs/story-service.md",`runs/${runSlug}/screen-spec.json`,`runs/${runSlug}/references/uibowl.json`,`runs/${runSlug}/figma/manifest.json`];
  const inputHash = computeInputHash(root, inputPaths);
  const approvalPath = `runs/${runSlug}/approval.json`;
  const approval = exists(approvalPath) ? json(approvalPath) : null;
  const approved = approvalMatches(approval, inputHash);
  add("G5-APPROVAL", approved, approved ? `approved by ${approval.approved_by}; input hash matches` : "waiting: no current approval bound to the present input hash");

  const manualBaseline = /확인된 사례 없음/.test(work) || /미통과/.test(work) ? "unavailable" : "documented";
  add("R1-B-BASELINE", manualBaseline === "documented", `manual baseline=${manualBaseline}; do not claim historical replay`);

  const blocking = results.filter(result => !["R1-B-BASELINE", "G5-APPROVAL"].includes(result.id) && result.status === false);
  const summary = {
    runSlug,
    defaultFlow: defaults.flowName,
    input_sha256: inputHash,
    results,
    passed: results.filter(result => result.status === true).length,
    failed: blocking.length,
    warnings: results.filter(result => ["R1-B-BASELINE", "G5-APPROVAL"].includes(result.id) && result.status === false).length,
    public_ready: blocking.length === 0 && approved,
    human_approval_pending: !approved
  };
  mkdirSync(runDir, {recursive:true});
  writeFileSync(path.join(runDir,"gate-results.json"), JSON.stringify(summary,null,2)+"\n");
  console.log(JSON.stringify(summary,null,2));
  process.exitCode = blocking.length ? 1 : 0;
} catch (error) {
  console.error(`verify failed: ${error.message}`);
  process.exitCode = 1;
}
