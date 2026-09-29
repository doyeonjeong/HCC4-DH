#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeInputHash } from "./gate-lib.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const args=process.argv.slice(2);
const value=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:null;};
const slug=value("--run")??"huddling-mvp-poc";
const gate=value("--gate");
const status=value("--status");
if(!gate||!status||!new Set(["pass","fail"]).has(status)){console.error("usage: node harness/scripts/save-blocks.mjs --run <slug> --gate <G1..G7> --status <pass|fail>");process.exit(2);}
const runDir=path.join(root,"runs",slug);
const statePath=path.join(runDir,"state.json");
const state=JSON.parse(readFileSync(statePath,"utf8"));
const rules=JSON.parse(readFileSync(path.join(root,"rules.yaml"),"utf8"));
if(!rules.trafficLightRules.some(rule=>rule.gate===gate)&&!/^G[1-7]$/.test(gate)){console.error(`unknown gate: ${gate}`);process.exit(2);}
const inputPaths=["docs/prd.md","docs/design.md","docs/story-service.md",`runs/${slug}/screen-spec.json`,`runs/${slug}/references/uibowl.json`,`runs/${slug}/figma/manifest.json`];
const inputHash=computeInputHash(root,inputPaths);
if(gate==="G5"&&status==="pass"){
  const approvalPath=path.join(runDir,"approval.md");
  const approval=readFileSync(approvalPath,"utf8");
  if(!/^APPROVED:\s*yes\s*$/mi.test(approval)||!approval.includes(inputHash)){console.error("G5 blocked: human approval must say APPROVED: yes and include the current input SHA-256.");process.exit(1);}
  writeFileSync(path.join(runDir,"approval.json"),JSON.stringify({status:"approved",input_sha256:inputHash,approved_by:"human",source:"approval.md",gate:"G5"},null,2)+"\n");
}
state.current_gate=gate;
state.input_sha256=inputHash;
state.last_pass=status==="pass"?gate:state.last_pass;
state.status=status==="pass"?"in_progress":"blocked";
state.updated_at=new Date().toISOString();
writeFileSync(statePath,JSON.stringify(state,null,2)+"\n");
console.log(JSON.stringify({run:slug,gate,status,last_pass:state.last_pass,input_sha256:inputHash},null,2));
