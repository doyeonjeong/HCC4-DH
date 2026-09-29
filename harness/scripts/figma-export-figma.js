#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const runSlug = process.argv.includes("--run") ? process.argv[process.argv.indexOf("--run")+1] : "huddling-mvp-poc";
const dir = path.join(root,"runs",runSlug,"figma");
const xml = readFileSync(path.join(dir,"metadata.xml"),"utf8");
const rules = JSON.parse(readFileSync(path.join(root,"rules.yaml"),"utf8"));
const defaults = JSON.parse(readFileSync(path.join(root,"defaults.yaml"),"utf8"));
const expected = {
  library_home:"library_home",
  skill_detail:"skill_detail",
  mission_submit:"mission_submit"
};
const frames = [];
for (const match of xml.matchAll(/<frame id="([^"]+)" name="([^"]+)" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/g)) {
  const [,nodeId,name,x,y,width,height]=match;
  const screenId=Object.keys(expected).find(id=>name.startsWith(id+" ·"));
  if(screenId) frames.push({screenId,nodeId,name,x:Number(x),y:Number(y),width:Number(width),height:Number(height)});
}
const manifest={fileKey:defaults.figma.fileKey,fileUrl:defaults.figma.fileUrl,pageId:"0:1",frames,source:"Figma MCP get_metadata",rulesVersion:rules.version};
writeFileSync(path.join(dir,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
console.log(JSON.stringify({pageId:manifest.pageId,frames:frames.length,names:frames.map(x=>x.name)},null,2));
if(frames.length!==rules.screenCount) process.exitCode=1;
