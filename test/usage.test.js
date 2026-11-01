import assert from "node:assert/strict";
import test from "node:test";
import { applyVote, createVote, voteCooldown } from "../src/index.js";
import { cast, must, openOptions } from "./helpers.js";

test("a vote passes on the yes that reaches the threshold", () => {
  const created = createVote(openOptions());
  assert.equal(created.ok, true);
  assert.equal(created.state.status, "open");
  assert.equal(created.state.reason, null);
  assert.equal(created.state.resolvedAt, null);
  assert.equal(created.state.requiredYes, 3);
  assert.equal(created.state.requiredQuorum, 4);
  assert.equal(created.state.end, 1500);
  assert.equal(created.state.targetCanVote, false);
  assert.equal(created.state.initiatorCountsAsYes, true);
  assert.deepEqual(created.state.yes, ["player-a"]);
  assert.deepEqual(created.state.no, []);
  assert.deepEqual(created.state.pending, ["player-b", "player-c", "player-d", "player-e"]);
  assert.deepEqual(created.events, [
    { type: "started", time: 1000 },
    { type: "cast", voterId: "player-a", choice: "yes", time: 1000 }
  ]);

  const second = applyVote(created.state, cast("player-c", "yes", 1100));
  assert.equal(second.ok, true);
  assert.equal(second.state.status, "open");
  assert.deepEqual(second.state.yes, ["player-a", "player-c"]);
  assert.deepEqual(second.state.pending, ["player-b", "player-d", "player-e"]);
  assert.deepEqual(second.events, [
    { type: "cast", voterId: "player-c", choice: "yes", time: 1100 }
  ]);

  const third = applyVote(second.state, cast("player-b", "yes", 1200));
  assert.equal(third.ok, true);
  assert.equal(third.state.status, "passed");
  assert.equal(third.state.reason, "threshold");
  assert.equal(third.state.resolvedAt, 1200);
  assert.deepEqual(third.state.yes, ["player-a", "player-b", "player-c"]);
  assert.deepEqual(third.state.no, []);
  assert.deepEqual(third.state.pending, ["player-d", "player-e"]);
  assert.deepEqual(third.events, [
    { type: "cast", voterId: "player-b", choice: "yes", time: 1200 },
    { type: "resolved", status: "passed", reason: "threshold", time: 1200 }
  ]);
  assert.equal(second.state.status, "open");
  assert.notEqual(third.state, second.state);
});

test("three no votes fail the vote on the vote that makes passing impossible", () => {
  const losing = createVote(openOptions({ start: 0, duration: 100, threshold: 0.6, quorum: 0.2 }));
  assert.equal(losing.state.requiredYes, 3);
  assert.equal(losing.state.requiredQuorum, 1);
  const firstNo = applyVote(losing.state, cast("player-b", "no", 10));
  const secondNo = applyVote(firstNo.state, cast("player-e", "no", 20));
  assert.equal(secondNo.state.status, "open");
  assert.deepEqual(secondNo.state.pending, ["player-c", "player-d"]);
  const thirdNo = applyVote(secondNo.state, cast("player-c", "no", 30));
  assert.equal(thirdNo.ok, true);
  assert.equal(thirdNo.state.status, "failed");
  assert.equal(thirdNo.state.reason, "impossible");
  assert.equal(thirdNo.state.resolvedAt, 30);
  assert.deepEqual(thirdNo.state.yes, ["player-a"]);
  assert.deepEqual(thirdNo.state.no, ["player-b", "player-c", "player-e"]);
  assert.deepEqual(thirdNo.state.pending, ["player-d"]);
  assert.equal(secondNo.state.status, "open");
});

test("expiry fails for quorum when too few ballots were cast", () => {
  const created = must(createVote(openOptions()));
  const voted = applyVote(created.state, cast("player-b", "no", 1100));
  assert.equal(voted.state.status, "open");
  const expired = applyVote(voted.state, { type: "tick", time: 1500 });
  assert.equal(expired.ok, true);
  assert.equal(expired.state.status, "failed");
  assert.equal(expired.state.reason, "quorum");
  assert.equal(expired.state.resolvedAt, 1500);
  assert.deepEqual(expired.state.yes, ["player-a"]);
  assert.deepEqual(expired.state.no, ["player-b"]);
  assert.deepEqual(expired.state.pending, ["player-c", "player-d", "player-e"]);
  assert.deepEqual(expired.events, [
    { type: "resolved", status: "failed", reason: "quorum", time: 1500 }
  ]);
  assert.equal(voted.state.status, "open");
});

test("expiry fails for shortfall when the quorum is met and the yes count is short", () => {
  const room = must(createVote(openOptions({ start: 0, duration: 100, quorum: 0.4 })));
  assert.equal(room.state.requiredYes, 3);
  assert.equal(room.state.requiredQuorum, 2);
  const yes = applyVote(room.state, cast("player-b", "yes", 10));
  const no = applyVote(yes.state, cast("player-c", "no", 20));
  const another = applyVote(no.state, cast("player-d", "no", 30));
  assert.equal(another.state.status, "open");
  const timed = applyVote(another.state, { type: "tick", time: 100 });
  assert.equal(timed.state.status, "failed");
  assert.equal(timed.state.reason, "shortfall");
  assert.equal(timed.state.resolvedAt, 100);
  assert.deepEqual(timed.state.yes, ["player-a", "player-b"]);
  assert.deepEqual(timed.state.no, ["player-c", "player-d"]);
  assert.deepEqual(timed.state.pending, ["player-e"]);
});

test("the initiator yes passes immediately when it meets the threshold", () => {
  const quick = createVote({
    initiator: "player-a",
    target: "player-z",
    eligible: ["player-a", "player-b"],
    start: 0,
    duration: 30,
    threshold: 0.4,
    quorum: 1
  });
  assert.equal(quick.ok, true);
  assert.equal(quick.state.status, "passed");
  assert.equal(quick.state.reason, "threshold");
  assert.equal(quick.state.resolvedAt, 0);
  assert.equal(quick.state.requiredYes, 1);
  assert.equal(quick.state.requiredQuorum, 2);
  assert.deepEqual(quick.state.yes, ["player-a"]);
  assert.deepEqual(quick.state.pending, ["player-b"]);
  assert.deepEqual(quick.events, [
    { type: "started", time: 0 },
    { type: "cast", voterId: "player-a", choice: "yes", time: 0 },
    { type: "resolved", status: "passed", reason: "threshold", time: 0 }
  ]);
});

test("a leave that drops the required yes count can pass the vote", () => {
  const small = must(
    createVote({
      initiator: "player-a",
      target: "player-z",
      eligible: ["player-a", "player-b", "player-c"],
      start: 0,
      duration: 50,
      threshold: 0.4,
      quorum: 0.4
    })
  );
  assert.equal(small.state.requiredYes, 2);
  assert.equal(small.state.status, "open");
  const shrunk = applyVote(small.state, { type: "leave", voterId: "player-b", time: 15 });
  assert.equal(shrunk.state.status, "passed");
  assert.equal(shrunk.state.reason, "threshold");
  assert.equal(shrunk.state.resolvedAt, 15);
  assert.equal(shrunk.state.requiredYes, 1);
  assert.deepEqual(shrunk.state.eligible, ["player-a", "player-c"]);
  assert.deepEqual(shrunk.state.yes, ["player-a"]);
  assert.deepEqual(shrunk.state.pending, ["player-c"]);
  assert.deepEqual(shrunk.events, [
    { type: "left", voterId: "player-b", time: 15 },
    { type: "resolved", status: "passed", reason: "threshold", time: 15 }
  ]);
});

test("the target leaving ends an open vote as moot", () => {
  const created = must(createVote(openOptions({ start: 0, duration: 100, quorum: 0.4 })));
  const moot = applyVote(created.state, { type: "target-leave", time: 40 });
  assert.equal(moot.ok, true);
  assert.equal(moot.state.status, "moot");
  assert.equal(moot.state.reason, "target-left");
  assert.equal(moot.state.resolvedAt, 40);
  assert.deepEqual(moot.state.eligible, created.state.eligible);
  assert.deepEqual(moot.state.yes, ["player-a"]);
  assert.deepEqual(moot.events, [
    { type: "resolved", status: "moot", reason: "target-left", time: 40 }
  ]);
  assert.equal(created.state.status, "open");
});

test("a tick inside the window keeps the same state and a late cast expires", () => {
  const created = must(createVote(openOptions()));
  const waiting = applyVote(created.state, { type: "tick", time: 1000, note: "ignored" });
  assert.equal(waiting.ok, true);
  assert.equal(waiting.state, created.state);
  assert.deepEqual(waiting.events, []);
  const late = applyVote(created.state, cast("player-b", "yes", 1500));
  assert.equal(late.ok, true);
  assert.equal(late.state.status, "failed");
  assert.equal(late.state.reason, "quorum");
  assert.equal(late.state.resolvedAt, 1500);
  assert.deepEqual(late.state.yes, ["player-a"]);
  assert.deepEqual(late.state.pending, ["player-b", "player-c", "player-d", "player-e"]);
  assert.deepEqual(late.events, [
    { type: "resolved", status: "failed", reason: "quorum", time: 1500 }
  ]);
  const third = applyVote(
    applyVote(created.state, cast("player-c", "yes", 1100)).state,
    cast("player-b", "yes", 1200)
  );
  const closed = applyVote(third.state, cast("player-d", "yes", 1300));
  assert.equal(closed.ok, false);
  assert.equal(closed.error.type, "closed");
  assert.equal(closed.error.message, "vote is closed");
  assert.equal(closed.state, third.state);
});

test("cooldown reports the later ready time for the initiator and the target", () => {
  const passed = applyVote(
    applyVote(must(createVote(openOptions())).state, cast("player-c", "yes", 1100)).state,
    cast("player-b", "yes", 1200)
  );
  const failed = applyVote(
    applyVote(
      applyVote(
        must(createVote(openOptions({ start: 0, duration: 100, quorum: 0.2 }))).state,
        cast("player-b", "no", 10)
      ).state,
      cast("player-e", "no", 20)
    ).state,
    cast("player-c", "no", 30)
  );
  assert.equal(passed.state.resolvedAt, 1200);
  assert.equal(failed.state.resolvedAt, 30);
  const history = [passed.state, failed.state];
  const window = voteCooldown({
    initiator: "player-a",
    target: "player-z",
    history,
    initiatorCooldown: { passed: 300, failed: 120, moot: 0 },
    targetCooldown: { passed: 0, failed: 240, moot: 0 }
  });
  assert.equal(window.ok, true);
  assert.equal(window.cooldown.initiatorReadyAt, 1500);
  assert.equal(window.cooldown.targetReadyAt, 1200);
  assert.equal(window.cooldown.readyAt, 1500);
  history.push({ initiator: "player-a", target: "player-z", status: "moot", resolvedAt: 1 });
  assert.equal(history.length, 3);
});
