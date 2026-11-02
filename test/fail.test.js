import assert from "node:assert/strict";
import test from "node:test";
import { applyVote, createVote } from "../src/index.js";
import { cast, change, leave, must } from "./helpers.js";

test("changing the last yes to no can make passing impossible", () => {
  const created = must(
    createVote({
      initiator: "player-a",
      target: "player-z",
      eligible: ["player-a", "player-b", "player-c", "player-d", "player-e"],
      start: 0,
      duration: 80,
      threshold: 0.6,
      quorum: 0.2
    })
  );
  const first = applyVote(created.state, cast("player-b", "no", 1));
  const second = applyVote(first.state, cast("player-c", "no", 2));
  assert.equal(second.state.status, "open");
  const flipped = applyVote(second.state, change("player-a", "no", 3));
  assert.equal(flipped.state.status, "failed");
  assert.equal(flipped.state.reason, "impossible");
  assert.equal(flipped.state.resolvedAt, 3);
  assert.deepEqual(flipped.state.yes, []);
  assert.deepEqual(flipped.state.no, ["player-a", "player-b", "player-c"]);
  assert.deepEqual(flipped.state.pending, ["player-d", "player-e"]);
  assert.equal(second.state.status, "open");
});

test("one no fails a vote that requires every eligible yes", () => {
  const created = must(
    createVote({
      initiator: "player-a",
      target: "player-z",
      eligible: ["player-a", "player-b", "player-c"],
      start: 10,
      duration: 10,
      threshold: 1,
      quorum: 0.5
    })
  );
  const failed = applyVote(created.state, cast("player-c", "no", 11));
  assert.equal(failed.state.status, "failed");
  assert.equal(failed.state.reason, "impossible");
  assert.deepEqual(failed.state.no, ["player-c"]);
  assert.deepEqual(failed.state.pending, ["player-b"]);
  assert.equal(created.state.status, "open");
});

test("the last eligible voter leaving fails an empty tally", () => {
  const created = must(
    createVote({
      initiator: "player-a",
      target: "player-z",
      eligible: ["player-a", "player-b", "player-c"],
      initiatorCountsAsYes: false,
      start: 0,
      duration: 30,
      threshold: 0.5,
      quorum: 0.5
    })
  );
  const first = applyVote(created.state, leave("player-c", 1));
  const second = applyVote(first.state, leave("player-a", 2));
  assert.equal(second.state.status, "open");
  assert.deepEqual(second.state.eligible, ["player-b"]);
  assert.equal(second.state.requiredYes, 1);
  const third = applyVote(second.state, leave("player-b", 3));
  assert.equal(third.state.status, "failed");
  assert.equal(third.state.reason, "impossible");
  assert.deepEqual(third.state.eligible, []);
  assert.equal(third.state.requiredYes, 1);
  assert.equal(third.state.requiredQuorum, 1);
  assert.equal(third.state.resolvedAt, 3);
});
