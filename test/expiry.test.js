import assert from "node:assert/strict";
import test from "node:test";
import { applyVote, createVote } from "../src/index.js";
import { cast, must, openOptions, openVote } from "./helpers.js";

test("a tick before the end waits and a tick at the end resolves", () => {
  const created = openVote();
  const before = applyVote(created.state, { type: "tick", time: 1499 });
  assert.equal(before.ok, true);
  assert.equal(before.state, created.state);
  assert.deepEqual(before.events, []);
  const atEnd = applyVote(created.state, { type: "tick", time: 1500 });
  const after = applyVote(created.state, { type: "tick", time: 1800 });
  assert.equal(atEnd.state.reason, "quorum");
  assert.equal(atEnd.state.resolvedAt, 1500);
  assert.equal(after.state.reason, "quorum");
  assert.equal(after.state.resolvedAt, 1800);
  assert.notEqual(atEnd.state, after.state);
  assert.deepEqual(atEnd.state.pending, created.state.pending);
  assert.notEqual(atEnd.state.pending, created.state.pending);
  assert.equal(created.state.status, "open");
});

test("a ballot one unit before the end counts and a ballot at the end does not", () => {
  const created = must(createVote(openOptions({ quorum: 0.4 })));
  const counted = applyVote(created.state, cast("player-e", "no", 1499));
  assert.equal(counted.state.status, "open");
  assert.deepEqual(counted.state.no, ["player-e"]);
  const ignored = applyVote(created.state, cast("player-e", "no", created.state.end));
  assert.equal(ignored.state.status, "failed");
  assert.equal(ignored.state.reason, "quorum");
  assert.deepEqual(ignored.state.no, []);
  assert.deepEqual(ignored.events, [
    { type: "resolved", status: "failed", reason: "quorum", time: 1500 }
  ]);
});

test("quorum is applied before shortfall", () => {
  const created = must(createVote(openOptions({ start: 0, duration: 20, quorum: 0.8 })));
  const one = applyVote(created.state, cast("player-b", "yes", 1));
  const two = applyVote(one.state, cast("player-c", "no", 2));
  assert.equal(two.state.yes.length + two.state.no.length, 3);
  assert.equal(two.state.requiredQuorum, 4);
  assert.equal(applyVote(two.state, { type: "tick", time: 20 }).state.reason, "quorum");
  const room = must(createVote(openOptions({ start: 0, duration: 20, quorum: 0.4 })));
  const yes = applyVote(room.state, cast("player-b", "yes", 1));
  const no = applyVote(yes.state, cast("player-c", "no", 2));
  const more = applyVote(no.state, cast("player-d", "no", 3));
  assert.equal(more.state.yes.length + more.state.no.length, 4);
  assert.equal(more.state.requiredQuorum, 2);
  assert.equal(more.state.yes.length < more.state.requiredYes, true);
  assert.equal(applyVote(more.state, { type: "tick", time: 20 }).state.reason, "shortfall");
});

test("time checks beat a target leave and a repeated call after resolution stays closed", () => {
  const created = openVote().state;
  const expired = applyVote(created, { type: "target-leave", time: 1500 });
  assert.equal(expired.state.status, "failed");
  assert.equal(expired.state.reason, "quorum");
  const again = applyVote(expired.state, { type: "tick", time: 10 });
  assert.equal(again.ok, false);
  assert.equal(again.error.type, "closed");
  assert.equal(again.state, expired.state);
  const early = applyVote(created, { type: "tick", time: -1 });
  assert.equal(early.error.type, "early");
  assert.equal(early.state, created);
});

test("an event at the start is inside the window", () => {
  const created = openVote().state;
  const tick = applyVote(created, { type: "tick", time: created.start });
  assert.equal(tick.state, created);
  const voted = applyVote(created, cast("player-d", "no", created.start));
  assert.equal(voted.state.status, "open");
  assert.deepEqual(voted.state.no, ["player-d"]);
});
