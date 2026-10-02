import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

export function validateScreenSpec(spec, rules) {
  const issues = [];
  const screens = Array.isArray(spec?.screens) ? spec.screens : [];
  const ids = screens.map(screen => screen.id);
  if (screens.length !== rules.screenCount) issues.push(`Expected ${rules.screenCount} screens, got ${screens.length}`);
  for (const id of rules.screenIds) if (!ids.includes(id)) issues.push(`Missing required screen: ${id}`);
  for (const screen of screens) {
    if (!Array.isArray(screen.storyIds) || screen.storyIds.length === 0) issues.push(`${screen.id}: no storyIds`);
    if (!screen.role) issues.push(`${screen.id}: no role`);
    const featureIds = Array.isArray(screen.featureIds) ? screen.featureIds : [];
    for (const id of featureIds) if (rules.forbiddenFeatureIds.includes(id)) issues.push(`${screen.id}: forbidden featureId ${id}`);
    const tokenSet = screen.tokens ?? {};
    for (const color of tokenSet.colors ?? []) if (!rules.design.colors.includes(color)) issues.push(`TOKEN ${screen.id}: color outside system ${color}`);
    for (const px of tokenSet.spacing ?? []) if (!rules.design.spacing.includes(px)) issues.push(`TOKEN ${screen.id}: spacing outside system ${px}`);
    for (const px of tokenSet.radii ?? []) if (!rules.design.radii.includes(px)) issues.push(`TOKEN ${screen.id}: radius outside system ${px}`);
    if (tokenSet.font && !rules.design.fonts.includes(tokenSet.font)) issues.push(`TOKEN ${screen.id}: font outside system ${tokenSet.font}`);
  }
  return issues;
}

export function hasSellerGate(spec) {
  const submissions = (spec?.screens ?? []).flatMap(screen => [
    ...(screen.saleApplications ?? []),
    ...(screen.featureIds ?? []).filter(id => id === "sale_requested").map(() => ({ actor: screen.role }))
  ]);
  return submissions.every(item => item.actor === "seller");
}

export function hasManualReviewPolicy(spec) {
  return spec?.reviewPolicy?.firstReview === "operator_checklist" && spec.reviewPolicy.aiFirstReview === false;
}

export function checkTrafficLightCoverage(rules, guide, implementedRuleIds) {
  const guideIds = [...guide.matchAll(/🚦\s*`([A-Z0-9-]+)`/g)].map(match => match[1]);
  const ruleIds = new Set((rules.trafficLightRules ?? []).map(rule => rule.id));
  const implemented = new Set(implementedRuleIds);
  return [...new Set(guideIds)].filter(id => !ruleIds.has(id) || !implemented.has(id));
}

export function computeInputHash(root, relativePaths) {
  const hash = createHash("sha256");
  for (const relativePath of [...relativePaths].sort()) {
    const absolutePath = path.join(root, relativePath);
    hash.update(relativePath);
    hash.update("\0");
    hash.update(readFileSync(absolutePath));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function approvalMatches(approval, currentHash) {
  return approval?.status === "approved" && approval?.input_sha256 === currentHash && Boolean(approval?.approved_by);
}
