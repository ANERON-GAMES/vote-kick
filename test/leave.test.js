import assert from "node:assert/strict";
import test from "node:test";
import { applyVote, createVote } from "../src/index.js";
import { cast, leave, must, openOptions } from "./helpers.js";

test("a leave removes that voter from the eligible set and the tally", () => {
  const created = must(createVote(openOptions({ start: 0, duration: 40, quorum: 0.2 })));
  const yes = applyVote(created.state, cast("player-c", "yes", 1));
  const no = applyVote(yes.state, cast("player-e", "no", 2));
  const leftYes = applyVote(no.state, leave("player-c", 3));
  assert.equal(leftYes.state.status, "open");
  assert.deepEqual(leftYes.state.eligible, ["player-a", "player-b", "player-d", "player-e"]);
  assert.deepEqual(leftYes.state.yes, ["player-a"]);
  assert.deepEqual(leftYes.state.no, ["player-e"]);
  assert.deepEqual(leftYes.state.pending, ["player-b", "player-d"]);
  assert.equal(leftYes.state.requiredYes, 3);
  assert.deepEqual(leftYes.events, [{ type: "left", voterId: "player-c", time: 3 }]);
  assert.deepEqual(no.state.yes, ["player-a", "player-c"]);
  const leftNo = applyVote(leftYes.state, leave("player-e", 4));
  assert.deepEqual(leftNo.state.no, []);
  assert.deepEqual(leftNo.state.eligible, ["player-a", "player-b", "player-d"]);
  const leftPending = applyVote(leftNo.state, leave("player-b", 5));
  assert.deepEqual(leftPending.state.pending, ["player-d"]);
  assert.equal(leftPending.state.status, "open");
});

test("pending voters leaving can make the remaining yes votes insufficient", () => {
  const created = must(
    createVote({
      initiator: "player-a",
      target: "player-z",
      eligible: ["player-a", "player-b", "player-c", "player-d", "player-e"],
      start: 0,
      duration: 40,
      threshold: 0.75,
      quorum: 0.2
    })
  );
  assert.equal(created.state.requiredYes, 4);
  const no = applyVote(created.state, cast("player-b", "no", 1));
  const first = applyVote(no.state, leave("player-e", 2));
  assert.equal(first.state.status, "open");
  const second = applyVote(first.state, leave("player-d", 3));
  assert.equal(second.state.status, "failed");
  assert.equal(second.state.reason, "impossible");
  assert.equal(second.state.resolvedAt, 3);
  assert.deepEqual(second.state.eligible, ["player-a", "player-b", "player-c"]);
  assert.equal(second.state.requiredYes, 3);
  assert.deepEqual(second.state.pending, ["player-c"]);
  assert.equal(first.state.status, "open");
});

test("the initiator leaving drops that yes vote and the vote can continue", () => {
  const created = must(createVote(openOptions({ start: 0, duration: 30, quorum: 0.2 })));
  const left = applyVote(created.state, leave("player-a", 5));
  assert.equal(left.state.status, "open");
  assert.equal(left.state.initiator, "player-a");
  assert.equal(left.state.initiatorCountsAsYes, true);
  assert.deepEqual(left.state.yes, []);
  assert.deepEqual(left.state.eligible[0], "player-b");
  assert.equal(left.state.requiredYes, 3);
});

test("a voting target is removed only by target-leave, which ends the vote", () => {
  const created = must(
    createVote({
      initiator: "player-a",
      target: "player-e",
      eligible: ["player-a", "player-b", "player-c", "player-d", "player-e"],
      targetCanVote: true,
      start: 0,
      duration: 40,
      threshold: 0.6,
      quorum: 0.4
    })
  );
  const voted = applyVote(created.state, cast("player-e", "no", 2));
  assert.deepEqual(voted.state.no, ["player-e"]);
  const refused = applyVote(voted.state, leave("player-e", 3));
  assert.equal(refused.ok, false);
  assert.equal(refused.error.type, "target");
  assert.equal(refused.state, voted.state);
  const moot = applyVote(voted.state, { type: "target-leave", time: 4, voterId: "player-e" });
  assert.equal(moot.state.status, "moot");
  assert.equal(moot.state.reason, "target-left");
  assert.deepEqual(moot.state.eligible, created.state.eligible);
  assert.deepEqual(moot.state.no, ["player-e"]);
  assert.equal(voted.state.status, "open");
});

test("a leave of an unknown voter is refused and does not copy the state", () => {
  const created = must(createVote(openOptions()));
  const result = applyVote(created.state, leave("player-y", 1000));
  assert.equal(result.ok, false);
  assert.equal(result.error.type, "ineligible");
  assert.equal(result.state, created.state);
  assert.equal(Object.hasOwn(result, "events"), false);
});
