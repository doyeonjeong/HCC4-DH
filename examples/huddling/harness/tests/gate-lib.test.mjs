import test from "node:test";
import assert from "node:assert/strict";
import { approvalMatches, hasManualReviewPolicy, hasSellerGate, validateScreenSpec } from "../scripts/gate-lib.mjs";

const rules = {
  screenCount: 1,
  screenIds: ["home"],
  forbiddenFeatureIds: ["purchase"],
  design: { colors: ["#fff"], spacing: [8], radii: [16], fonts: ["Noto Sans KR"] }
};
const baseSpec = {
  screens: [{ id: "home", role: "learner", storyIds: ["US-01"], featureIds: ["lesson"], tokens: { colors: ["#fff"] } }]
};

test("structured forbidden feature IDs fail without scanning explanatory prose", () => {
  assert.deepEqual(validateScreenSpec({ ...baseSpec, note: "구매 기능은 범위에서 제외" }, rules), []);
  assert.match(validateScreenSpec({ ...baseSpec, screens: [{ ...baseSpec.screens[0], featureIds: ["purchase"] }] }, rules)[0], /forbidden featureId/);
});

test("manual review policy requires an operator checklist and disables AI first review", () => {
  assert.equal(hasManualReviewPolicy({ reviewPolicy: { firstReview: "operator_checklist", aiFirstReview: false } }), true);
  assert.equal(hasManualReviewPolicy({ reviewPolicy: { firstReview: "ai", aiFirstReview: true } }), false);
});

test("sale request is restricted to the seller role", () => {
  assert.equal(hasSellerGate({ screens: [{ role: "seller", featureIds: ["sale_requested"] }] }), true);
  assert.equal(hasSellerGate({ screens: [{ role: "learner", featureIds: ["sale_requested"] }] }), false);
});

test("approval is rejected when the bound input hash is stale", () => {
  const approval = { status: "approved", input_sha256: "old", approved_by: "human" };
  assert.equal(approvalMatches(approval, "old"), true);
  assert.equal(approvalMatches(approval, "new"), false);
});
