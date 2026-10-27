import { test } from "node:test";
import assert from "node:assert/strict";
import { validateConfig } from "./protocol.js";
import { checkPolicy, PROFILES, MAPPINGS,completedManagedTurn } from "./policy.js";
import { legacy } from "./migrations.js";
test("fixed modes reject executable or resource input", () => {
  assert.equal(validateConfig({ mode: "managed" }).mode, "managed");
  assert.throws(() => validateConfig({ mode: "managed", session: "foreign" }));
  assert.throws(() => validateConfig({ mode: "shell" }));
});
test("business policy boundaries and validation", () => {
  assert.equal(checkPolicy(75).decision, "APPROVE-59");
  assert.equal(checkPolicy(76).decision, "REVIEW-59");
  assert.throws(() => checkPolicy(-1));
  assert.throws(() => checkPolicy(47.5));
});
test('hosted idle alone does not imply successful completion',()=>{assert.equal(completedManagedTurn({type:'session.status_idle',stop_reason:{type:'budget_reached'}}),false);assert.equal(completedManagedTurn({type:'session.status_idle',stop_reason:{type:'requires_action'}}),false);assert.equal(completedManagedTurn({type:'session.status_idle',stop_reason:{type:'end_turn'}}),true);});
test("migration source is reviewed without evaluating the historical fixture", async () => {
  const m = await legacy();
  assert.ok(Object.values(m.checks).every(Boolean));
  assert.ok(m.before.includes("@anthropic-ai/claude-code"));
  assert.ok(m.after.includes("settingSources: []"));
});
test("retention conflict and handoff semantics stay explicit", () => {
  assert.equal(PROFILES[2].choice, "Review data requirements first");
  assert.ok(MAPPINGS.at(-1)![2].includes("not automatically identical"));
});
