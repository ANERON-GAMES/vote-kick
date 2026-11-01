import assert from "node:assert/strict";
import test from "node:test";
import { applyVote, createVote } from "../src/index.js";
import { cast, change, must, openOptions } from "./helpers.js";

test("a later yes is stored in eligible order and does not change the previous vote", () => {
  const created = must(createVote(openOptions()));
  const event = cast("player-b", "yes", 1300);
  const first = applyVote(created.state, event);
  event.choice = "no";
  event.time = 1;
  const second = applyVote(created.state, cast("player-b", "yes", 1300));
  assert.deepEqual(first, second);
  assert.notEqual(first.state, second.state);
  assert.deepEqual(first.state.yes, ["player-a", "player-b"]);
  assert.equal(created.state.yes.length, 1);
});

test("changing a no to yes can pass", () => {
  const created = must(
    createVote({
      initiator: "player-a",
      target: "player-z",
      eligible: ["player-a", "player-b", "player-c"],
      start: 0,
      duration: 40,
      threshold: 0.5,
      quorum: 0.5
    })
  );
  assert.equal(created.state.requiredYes, 2);
  const no = applyVote(created.state, cast("player-b", "no", 5));
  assert.equal(no.state.status, "open");
  assert.deepEqual(no.state.no, ["player-b"]);
  const yes = applyVote(no.state, change("player-b", "yes", 4));
  assert.equal(yes.state.status, "passed");
  assert.equal(yes.state.resolvedAt, 4);
  assert.deepEqual(yes.state.yes, ["player-a", "player-b"]);
  assert.deepEqual(yes.state.no, []);
  assert.deepEqual(yes.events, [
    { type: "changed", voterId: "player-b", choice: "yes", time: 4 },
    { type: "resolved", status: "passed", reason: "threshold", time: 4 }
  ]);
  assert.equal(no.state.status, "open");
});

test("the last required yes passes a unanimous threshold", () => {
  const created = must(
    createVote({
      initiator: "player-a",
      target: "player-z",
      eligible: ["player-a", "player-b", "player-c"],
      initiatorCountsAsYes: true,
      start: 0,
      duration: 10,
      threshold: 1,
      quorum: 1
    })
  );
  assert.equal(created.state.requiredYes, 3);
  assert.equal(created.state.status, "open");
  const middle = applyVote(created.state, cast("player-c", "yes", 2));
  assert.equal(middle.state.status, "open");
  const done = applyVote(middle.state, cast("player-b", "yes", 3));
  assert.equal(done.state.status, "passed");
  assert.deepEqual(done.state.yes, ["player-a", "player-b", "player-c"]);
  assert.deepEqual(done.state.pending, []);
});

test("the initiator can be left out of the opening yes", () => {
  const created = must(createVote(openOptions({ initiatorCountsAsYes: false })));
  assert.deepEqual(created.events, [{ type: "started", time: 1000 }]);
  assert.deepEqual(created.state.yes, []);
  assert.deepEqual(created.state.pending, [
    "player-a",
    "player-b",
    "player-c",
    "player-d",
    "player-e"
  ]);
  assert.equal(created.state.status, "open");
});

test("a negative zero timestamp is stored as zero", () => {
  const created = must(createVote(openOptions({ start: 0, duration: 10, quorum: 0.4 })));
  const voted = applyVote(created.state, cast("player-b", "no", -0));
  assert.equal(voted.ok, true);
  assert.equal(Object.is(voted.events[0].time, 0), true);
  assert.deepEqual(voted.state.no, ["player-b"]);
});
