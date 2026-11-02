import assert from "node:assert/strict";
import test from "node:test";
import { applyVote, createVote } from "../src/index.js";
import { cast, change, edit, must, openOptions, openVote, rawVote, without } from "./helpers.js";

const FIELDS =
  "vote fields must be status, reason, initiator, target, eligible, yes, no, pending, start, duration, end, threshold, quorum, targetCanVote, initiatorCountsAsYes, requiredYes, requiredQuorum, and resolvedAt";

function rejectsCreate(options, type, message) {
  const result = createVote(options);
  assert.equal(result.ok, false);
  assert.equal(result.error.type, type);
  assert.equal(result.error.message, message);
  assert.equal(Object.hasOwn(result, "state"), false);
  assert.equal(Object.hasOwn(result, "events"), false);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.error), true);
}

function rejectsVote(vote, message) {
  const result = applyVote(vote, { type: "tick", time: 0 });
  assert.equal(result.ok, false, message);
  assert.equal(result.error.type, "vote");
  assert.equal(result.error.message, message);
  assert.equal(Object.hasOwn(result, "state"), false);
}

test("createVote rejects a non-object before it reads fields", () => {
  assert.doesNotThrow(() => createVote());
  assert.doesNotThrow(() => createVote(null));
  for (const options of [undefined, null, [], "players", 1, true]) {
    rejectsCreate(options, "options", "options must be an object");
  }
});

test("createVote reads fields in order and keeps the caller arrays", () => {
  rejectsCreate({}, "initiator", "initiator must be a non-empty string");
  rejectsCreate({ initiator: "" }, "initiator", "initiator must be a non-empty string");
  rejectsCreate({ initiator: 1, target: "" }, "initiator", "initiator must be a non-empty string");
  rejectsCreate({ initiator: "player-a" }, "target", "target must be a non-empty string");
  rejectsCreate(
    { initiator: "player-a", target: "player-a" },
    "distinct",
    "initiator and target must be different players"
  );
  rejectsCreate(
    { initiator: "player-a", target: "player-z" },
    "eligible",
    "eligible must be a non-empty array"
  );
  rejectsCreate(
    { initiator: "player-a", target: "player-z", eligible: [] },
    "eligible",
    "eligible must be a non-empty array"
  );
  rejectsCreate(
    { initiator: "player-a", target: "player-z", eligible: "player-a" },
    "eligible",
    "eligible must be a non-empty array"
  );
  rejectsCreate(
    { initiator: "player-a", target: "player-z", eligible: [""] },
    "eligible",
    "player id must be a non-empty string"
  );
  rejectsCreate(
    { initiator: "player-a", target: "player-z", eligible: ["player-a", 1] },
    "eligible",
    "player id must be a non-empty string"
  );
  rejectsCreate(
    { initiator: "player-a", target: "player-z", eligible: ["player-a", "player-a"] },
    "eligible",
    "player ids must be unique"
  );
  const base = {
    initiator: "player-a",
    target: "player-z",
    eligible: ["player-a", "player-b"]
  };
  rejectsCreate({ ...base, targetCanVote: "false" }, "flag", "targetCanVote must be a boolean");
  rejectsCreate(
    { ...base, initiatorCountsAsYes: 1 },
    "flag",
    "initiatorCountsAsYes must be a boolean"
  );
  rejectsCreate(
    { ...base, target: "player-b", targetCanVote: false },
    "target-rule",
    "target must not be eligible when the target cannot vote"
  );
  rejectsCreate(
    {
      ...base,
      targetCanVote: true,
      initiatorCountsAsYes: false,
      initiator: "player-c"
    },
    "target-rule",
    "target must be eligible when the target can vote"
  );
  rejectsCreate(
    { ...base, eligible: ["player-b"], initiatorCountsAsYes: true, targetCanVote: false },
    "initiator-rule",
    "initiator must be eligible when the initiator counts as yes"
  );
  rejectsCreate({ ...base }, "start", "start must be a finite number");
  for (const start of [undefined, null, "0", Number.NaN, Number.POSITIVE_INFINITY]) {
    rejectsCreate({ ...base, start }, "start", "start must be a finite number");
  }
  rejectsCreate(
    { ...base, start: 0 },
    "duration",
    "duration must be a finite number greater than 0"
  );
  for (const duration of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, "10"]) {
    rejectsCreate(
      { ...base, start: 0, duration },
      "duration",
      "duration must be a finite number greater than 0"
    );
  }
  rejectsCreate(
    { ...base, start: 1e20, duration: 1, threshold: 0.5, quorum: 0.5 },
    "end",
    "end must be a finite number greater than start"
  );
  rejectsCreate(
    { ...base, start: Number.MAX_VALUE, duration: Number.MAX_VALUE, threshold: 0.5, quorum: 0.5 },
    "end",
    "end must be a finite number greater than start"
  );
  rejectsCreate(
    { ...base, start: 0, duration: 10 },
    "threshold",
    "threshold must be a finite number greater than 0 and less than or equal to 1"
  );
  for (const threshold of [0, -0.1, 1.0000001, Number.NaN, "0.5", null]) {
    rejectsCreate(
      { ...base, start: 0, duration: 10, threshold, quorum: 0 },
      "threshold",
      "threshold must be a finite number greater than 0 and less than or equal to 1"
    );
  }
  rejectsCreate(
    { ...base, start: 0, duration: 10, threshold: 0.5 },
    "quorum",
    "quorum must be a finite number greater than 0 and less than or equal to 1"
  );
  for (const quorum of [0, -1, 2, Number.NaN, "1"]) {
    rejectsCreate(
      { ...base, start: 0, duration: 10, threshold: 0.5, quorum },
      "quorum",
      "quorum must be a finite number greater than 0 and less than or equal to 1"
    );
  }
});

test("createVote copies inputs, defaults the flags, and normalizes zero", () => {
  const eligible = ["player-a", "player-b", "player-c"];
  const options = {
    initiator: "player-a",
    target: "player-z",
    eligible,
    start: -0,
    duration: 10,
    threshold: 0.5,
    quorum: 0.5,
    targetCanVote: undefined,
    note: "ignored"
  };
  const created = must(createVote(options));
  eligible.push("player-d");
  options.threshold = 0;
  assert.deepEqual(created.state.eligible, ["player-a", "player-b", "player-c"]);
  assert.equal(created.state.threshold, 0.5);
  assert.equal(created.state.targetCanVote, false);
  assert.equal(created.state.initiatorCountsAsYes, true);
  assert.equal(Object.is(created.state.start, 0), true);
  assert.equal(Object.isFrozen(eligible), false);
  assert.equal(Object.isFrozen(created.state), true);
  assert.equal(Object.isFrozen(created.state.eligible), true);
  assert.equal(Object.isFrozen(created.state.yes), true);
  assert.equal(Object.isFrozen(created.state.no), true);
  assert.equal(Object.isFrozen(created.state.pending), true);
  assert.equal(Object.isFrozen(created.events), true);
  assert.equal(Object.isFrozen(created.events[0]), true);
  assert.throws(() => {
    created.state.status = "passed";
  }, TypeError);
  const again = createVote({
    initiator: "player-a",
    target: "player-z",
    eligible: ["player-a", "player-b", "player-c"],
    start: 0,
    duration: 10,
    threshold: 0.5,
    quorum: 0.5
  });
  assert.deepEqual(created, again);
  assert.notEqual(created.state, again.state);
});

test("required counts use the ceiling of eligible times the fraction", () => {
  const table = [
    [2, 0.1, 1],
    [3, 0.5, 2],
    [4, 0.5, 2],
    [4, 0.75, 3],
    [5, 0.6, 3],
    [7, 0.3, 3],
    [10, 1 / 3, 4]
  ];
  const letters = "abcdefghij";
  for (const [count, fraction, required] of table) {
    const eligible = [];
    for (let index = 0; index < count; index += 1) {
      eligible.push("player-" + letters[index]);
    }
    const created = must(
      createVote({
        initiator: "player-a",
        target: "player-z",
        eligible,
        start: 0,
        duration: 5,
        threshold: fraction,
        quorum: fraction
      })
    );
    assert.equal(created.state.requiredYes, required, String(count) + " " + String(fraction));
    assert.equal(created.state.requiredQuorum, required);
  }
});

test("applyVote rejects a malformed vote before the event", () => {
  assert.doesNotThrow(() => applyVote());
  rejectsVote(null, "vote must be an object");
  rejectsVote([], "vote must be an object");
  rejectsVote("vote", "vote must be an object");
  const open = openVote().state;
  rejectsVote(without(open, "status"), FIELDS);
  rejectsVote({ ...open, label: "x" }, FIELDS);
  rejectsVote(
    edit(open, (copy) => {
      copy.status = "OPEN";
    }),
    "status must be open, passed, failed, or moot"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.initiator = "";
    }),
    "initiator must be a non-empty string"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.target = 1;
    }),
    "target must be a non-empty string"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.target = "player-a";
    }),
    "initiator and target must be different players"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.eligible = null;
    }),
    "eligible must be an array"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.eligible = [""];
    }),
    "player id must be a non-empty string"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.eligible = ["player-a", "player-a"];
    }),
    "player ids must be unique"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.yes = null;
    }),
    "yes must be an array"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.yes = [""];
    }),
    "yes must contain player ids"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.no = "no";
    }),
    "no must be an array"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.no = [1];
    }),
    "no must contain player ids"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.pending = null;
    }),
    "pending must be an array"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.pending = [""];
    }),
    "pending must contain player ids"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.yes = ["player-c", "player-a"];
      copy.pending = ["player-b", "player-d", "player-e"];
    }),
    "player lists must partition eligible in eligible order"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.pending = ["player-b", "player-c", "player-d"];
    }),
    "player lists must partition eligible in eligible order"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.targetCanVote = "false";
    }),
    "targetCanVote must be a boolean"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.initiatorCountsAsYes = 1;
    }),
    "initiatorCountsAsYes must be a boolean"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.eligible = copy.eligible.concat(["player-z"]);
      copy.pending = copy.pending.concat(["player-z"]);
    }),
    "target must not be eligible when the target cannot vote"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.targetCanVote = true;
    }),
    "target must be eligible when the target can vote"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.start = Number.NaN;
    }),
    "start must be a finite number"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.duration = 0;
    }),
    "duration must be a finite number greater than 0"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.start = 1e20;
      copy.duration = 1;
      copy.end = 1e20;
    }),
    "end must be a finite number greater than start"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.end = copy.end + 1;
    }),
    "end must equal start plus duration"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.threshold = 0;
    }),
    "threshold must be a finite number greater than 0 and less than or equal to 1"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.quorum = 2;
    }),
    "quorum must be a finite number greater than 0 and less than or equal to 1"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.requiredYes = copy.requiredYes + 1;
    }),
    "requiredYes must match the eligible count and the threshold"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.requiredQuorum = 1;
    }),
    "requiredQuorum must match the eligible count and the quorum"
  );
});

test("stored votes must satisfy the open, passed, failed, and moot invariants", () => {
  const open = openVote().state;
  rejectsVote(
    edit(open, (copy) => {
      copy.reason = "threshold";
    }),
    "reason must be null while the vote is open"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.resolvedAt = 1000;
    }),
    "resolvedAt must be null while the vote is open"
  );
  rejectsVote(
    rawVote({ eligible: [], yes: [], no: [], pending: [] }),
    "an open vote must have eligible voters"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.yes = ["player-a", "player-b", "player-c"];
      copy.pending = ["player-d", "player-e"];
    }),
    "an open vote must be short of the required yes votes"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.no = ["player-b", "player-c", "player-e"];
      copy.pending = ["player-d"];
    }),
    "an open vote must still be able to pass"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.status = "passed";
    }),
    "reason must be threshold when the vote passed"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.status = "passed";
      copy.reason = "threshold";
    }),
    "resolvedAt must be a finite number"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.status = "passed";
      copy.reason = "threshold";
      copy.resolvedAt = 999;
    }),
    "a passed vote must resolve at or after the start"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.status = "passed";
      copy.reason = "threshold";
      copy.resolvedAt = 1500;
    }),
    "a passed vote must resolve before the end"
  );
  rejectsVote(
    rawVote({
      status: "passed",
      reason: "threshold",
      eligible: [],
      yes: [],
      no: [],
      pending: [],
      resolvedAt: 10
    }),
    "a passed vote must have eligible voters"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.status = "passed";
      copy.reason = "threshold";
      copy.resolvedAt = 1200;
    }),
    "a passed vote must meet the required yes votes"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.status = "failed";
    }),
    "reason must be impossible, quorum, or shortfall when the vote failed"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.status = "failed";
      copy.reason = "impossible";
    }),
    "resolvedAt must be a finite number"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.status = "failed";
      copy.reason = "impossible";
      copy.resolvedAt = 999;
    }),
    "an impossible failure must resolve at or after the start"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.status = "failed";
      copy.reason = "impossible";
      copy.resolvedAt = 1500;
    }),
    "an impossible failure must resolve before the end"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.status = "failed";
      copy.reason = "impossible";
      copy.resolvedAt = 1200;
    }),
    "an impossible failure must make passing impossible"
  );
  const expired = applyVote(open, { type: "tick", time: 1500 }).state;
  rejectsVote(
    edit(expired, (copy) => {
      copy.resolvedAt = 1499;
    }),
    "a quorum failure must resolve at or after the end"
  );
  rejectsVote(
    edit(expired, (copy) => {
      copy.reason = "shortfall";
      copy.resolvedAt = 1499;
    }),
    "a shortfall failure must resolve at or after the end"
  );
  rejectsVote(
    rawVote({
      status: "failed",
      reason: "quorum",
      eligible: [],
      yes: [],
      no: [],
      pending: [],
      resolvedAt: 100
    }),
    "a quorum failure must have eligible voters"
  );
  rejectsVote(
    rawVote({
      status: "failed",
      reason: "shortfall",
      eligible: [],
      yes: [],
      no: [],
      pending: [],
      resolvedAt: 100
    }),
    "a shortfall failure must have eligible voters"
  );
  rejectsVote(
    edit(expired, (copy) => {
      copy.yes = ["player-a", "player-b", "player-c", "player-d", "player-e"];
      copy.no = [];
      copy.pending = [];
    }),
    "a quorum failure must be short of the required yes votes"
  );
  const short = applyVote(
    applyVote(
      applyVote(
        applyVote(
          must(createVote(openOptions({ start: 0, duration: 100, quorum: 0.4 }))).state,
          cast("player-b", "yes", 10)
        ).state,
        cast("player-c", "no", 20)
      ).state,
      cast("player-d", "no", 30)
    ).state,
    { type: "tick", time: 100 }
  ).state;
  rejectsVote(
    edit(short, (copy) => {
      copy.yes = ["player-a", "player-b", "player-c", "player-d", "player-e"];
      copy.no = [];
      copy.pending = [];
    }),
    "a shortfall failure must be short of the required yes votes"
  );
  rejectsVote(
    edit(expired, (copy) => {
      copy.yes = ["player-a"];
      copy.no = ["player-b", "player-c", "player-d", "player-e"];
      copy.pending = [];
    }),
    "a quorum failure must still have been able to pass"
  );
  rejectsVote(
    edit(short, (copy) => {
      copy.yes = ["player-a"];
      copy.no = ["player-b", "player-c", "player-d", "player-e"];
      copy.pending = [];
    }),
    "a shortfall failure must still have been able to pass"
  );
  rejectsVote(
    edit(short, (copy) => {
      copy.reason = "quorum";
    }),
    "a quorum failure must be short of the quorum"
  );
  rejectsVote(
    edit(expired, (copy) => {
      copy.reason = "shortfall";
    }),
    "a shortfall failure must meet the quorum"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.status = "moot";
    }),
    "reason must be target-left when the vote is moot"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.status = "moot";
      copy.reason = "target-left";
      copy.resolvedAt = 999;
    }),
    "a moot vote must resolve at or after the start"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.status = "moot";
      copy.reason = "target-left";
      copy.resolvedAt = 1500;
    }),
    "a moot vote must resolve before the end"
  );
  rejectsVote(
    rawVote({
      status: "moot",
      reason: "target-left",
      eligible: [],
      yes: [],
      no: [],
      pending: [],
      resolvedAt: 10
    }),
    "a moot vote must have eligible voters"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.status = "moot";
      copy.reason = "target-left";
      copy.resolvedAt = 1200;
      copy.yes = ["player-a", "player-b", "player-c"];
      copy.pending = ["player-d", "player-e"];
    }),
    "a moot vote must be short of the required yes votes"
  );
  rejectsVote(
    edit(open, (copy) => {
      copy.status = "moot";
      copy.reason = "target-left";
      copy.resolvedAt = 1200;
      copy.no = ["player-b", "player-c", "player-e"];
      copy.pending = ["player-d"];
    }),
    "a moot vote must still have been able to pass"
  );
});

test("applyVote validates the event, then closure, then time, then the action", () => {
  const open = openVote().state;
  const badEvent = applyVote(open, null);
  assert.equal(badEvent.ok, false);
  assert.equal(badEvent.error.type, "event");
  assert.equal(badEvent.error.message, "event must be an object");
  assert.equal(badEvent.state, open);
  for (const event of [[], "tick", 1]) {
    const result = applyVote(open, event);
    assert.equal(result.error.type, "event");
    assert.equal(result.state, open);
  }
  assert.equal(
    applyVote(open, { time: 1000 }).error.message,
    "event type must be cast, change, leave, target-leave, or tick"
  );
  assert.equal(
    applyVote(open, { type: "Cast", time: 1000 }).error.message,
    "event type must be cast, change, leave, target-leave, or tick"
  );
  assert.equal(applyVote(open, { type: "tick" }).error.type, "time");
  assert.equal(applyVote(open, { type: "tick" }).error.message, "time must be a finite number");
  for (const time of [null, "1000", Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(applyVote(open, { type: "tick", time }).error.type, "time");
  }
  assert.equal(
    applyVote(open, { type: "cast", time: Number.NaN, voterId: "", choice: "yes" }).error.type,
    "time"
  );
  assert.equal(
    applyVote(open, { type: "cast", time: 1000, choice: "yes" }).error.message,
    "voter id must be a non-empty string"
  );
  assert.equal(applyVote(open, { type: "leave", time: 1000, voterId: "" }).error.type, "voter");
  assert.equal(
    applyVote(open, { type: "cast", time: 1000, voterId: "player-b" }).error.message,
    "choice must be yes or no"
  );
  assert.equal(
    applyVote(open, { type: "change", time: 1000, voterId: "player-b", choice: "YES" }).error.type,
    "choice"
  );
  const passed = applyVote(
    applyVote(open, cast("player-c", "yes", 1100)).state,
    cast("player-b", "yes", 1200)
  ).state;
  const lateShape = applyVote(passed, null);
  assert.equal(lateShape.error.type, "event");
  assert.equal(lateShape.state, passed);
  const closed = applyVote(passed, cast("player-d", "yes", 1300));
  assert.equal(closed.error.type, "closed");
  assert.equal(closed.error.message, "vote is closed");
  assert.equal(closed.state, passed);
  const early = applyVote(open, cast("player-y", "no", 999));
  assert.equal(early.error.type, "early");
  assert.equal(early.error.message, "time is before the start");
  assert.equal(early.state, open);
  const expired = applyVote(open, cast("player-y", "yes", 1500));
  assert.equal(expired.ok, true);
  assert.equal(expired.state.reason, "quorum");
  assert.deepEqual(expired.state.yes, ["player-a"]);
  const ineligible = applyVote(open, cast("player-y", "no", 1000));
  assert.equal(ineligible.error.type, "ineligible");
  assert.equal(ineligible.error.message, "voter must be eligible");
  assert.equal(ineligible.state, open);
  const duplicate = applyVote(open, cast("player-a", "no", 1000));
  assert.equal(duplicate.error.type, "already-voted");
  assert.equal(duplicate.error.message, "voter has already cast a vote");
  assert.equal(duplicate.state, open);
  const missing = applyVote(open, change("player-b", "no", 1000));
  assert.equal(missing.error.type, "missing-vote");
  assert.equal(missing.error.message, "voter has not cast a vote");
  assert.equal(missing.state, open);
  const voted = applyVote(open, cast("player-b", "no", 1100)).state;
  const same = applyVote(voted, change("player-b", "no", 1101));
  assert.equal(same.error.type, "same-choice");
  assert.equal(same.error.message, "choice must change");
  assert.equal(same.state, voted);
  const target = applyVote(open, { type: "leave", voterId: "player-z", time: 1000 });
  assert.equal(target.error.type, "target");
  assert.equal(target.error.message, "target leaves with a target-leave event");
  assert.equal(target.state, open);
  const restored = JSON.parse(JSON.stringify(open));
  const next = applyVote(restored, cast("player-b", "yes", 1000));
  const direct = applyVote(open, cast("player-b", "yes", 1000));
  assert.deepEqual(next.state, direct.state);
  assert.equal(Object.isFrozen(open), true);
  const plain = rawVote();
  const waiting = applyVote(plain, { type: "tick", time: 0 });
  assert.equal(waiting.ok, true);
  assert.equal(waiting.state, plain);
  assert.equal(Object.isFrozen(plain), false);
});

test("ids are exact strings, including blank and prototype names", () => {
  const created = must(
    createVote({
      initiator: "__proto__",
      target: "constructor",
      eligible: ["__proto__", "toString", "constructor", " "],
      targetCanVote: true,
      start: 0,
      duration: 20,
      threshold: 0.5,
      quorum: 0.5
    })
  );
  assert.deepEqual(created.state.yes, ["__proto__"]);
  assert.equal(created.state.requiredYes, 2);
  const passed = applyVote(created.state, cast(" ", "yes", 1));
  assert.equal(passed.state.status, "passed");
  assert.deepEqual(passed.state.yes, ["__proto__", " "]);
  const mixed = must(
    createVote({
      initiator: "player-a",
      target: "player-z",
      eligible: ["player-A", "player-a"],
      initiatorCountsAsYes: true,
      start: 0,
      duration: 5,
      threshold: 1,
      quorum: 1
    })
  );
  assert.equal(mixed.state.status, "open");
  assert.deepEqual(mixed.state.yes, ["player-a"]);
  assert.deepEqual(mixed.state.pending, ["player-A"]);
});
