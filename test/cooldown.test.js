import assert from "node:assert/strict";
import test from "node:test";
import { applyVote, createVote, voteCooldown } from "../src/index.js";
import { durations, must, openOptions } from "./helpers.js";

function rules(overrides = {}) {
  const options = {
    initiator: "player-a",
    target: "player-z",
    history: [],
    initiatorCooldown: durations(10, 20, 30),
    targetCooldown: durations(40, 50, 60)
  };
  for (const key of Object.keys(overrides)) {
    options[key] = overrides[key];
  }
  return options;
}

function entry(initiator, target, status, resolvedAt, extra) {
  const value = { initiator, target, status, resolvedAt };
  if (extra !== undefined) {
    for (const key of Object.keys(extra)) {
      value[key] = extra[key];
    }
  }
  return value;
}

function rejects(options, type, message) {
  const result = voteCooldown(options);
  assert.equal(result.ok, false);
  assert.equal(result.error.type, type);
  assert.equal(result.error.message, message);
  assert.equal(Object.hasOwn(result, "cooldown"), false);
  assert.equal(Object.isFrozen(result.error), true);
}

test("an empty history has no ready time", () => {
  const result = voteCooldown(rules());
  assert.equal(result.ok, true);
  assert.deepEqual(result.cooldown, {
    initiatorReadyAt: null,
    targetReadyAt: null,
    readyAt: null
  });
  assert.equal(Object.isFrozen(result.cooldown), true);
});

test("initiator and target cooldowns stay on their own roles", () => {
  const result = voteCooldown(
    rules({
      history: [
        entry("player-a", "player-q", "failed", 100),
        entry("player-q", "player-z", "passed", 80),
        entry("player-m", "player-n", "moot", 1000)
      ]
    })
  );
  assert.equal(result.cooldown.initiatorReadyAt, 120);
  assert.equal(result.cooldown.targetReadyAt, 120);
  assert.equal(result.cooldown.readyAt, 120);
});

test("the latest matching result wins and a zero duration is ready at that time", () => {
  const result = voteCooldown(
    rules({
      initiatorCooldown: durations(0, 5, 0),
      targetCooldown: durations(0, 0, 9),
      history: [
        entry("player-a", "player-z", "passed", 10),
        entry("player-a", "player-z", "failed", 40),
        entry("player-a", "player-z", "moot", 12)
      ]
    })
  );
  assert.equal(result.cooldown.initiatorReadyAt, 45);
  assert.equal(result.cooldown.targetReadyAt, 40);
  assert.equal(result.cooldown.readyAt, 45);
});

test("negative zero durations and times normalize to zero", () => {
  const result = voteCooldown(
    rules({
      initiatorCooldown: { passed: -0, failed: 0, moot: 0 },
      targetCooldown: durations(0, 0, 0),
      history: [entry("player-a", "player-q", "passed", -0)]
    })
  );
  assert.equal(Object.is(result.cooldown.initiatorReadyAt, 0), true);
  assert.equal(result.cooldown.targetReadyAt, null);
  assert.equal(Object.is(result.cooldown.readyAt, 0), true);
});

test("a resolved vote state can be passed in history and is not mutated", () => {
  const created = must(createVote(openOptions({ start: 0, duration: 20, quorum: 0.4 })));
  const moot = applyVote(created.state, { type: "target-leave", time: 6 }).state;
  const history = [moot];
  const result = voteCooldown(
    rules({
      history,
      initiatorCooldown: durations(1, 1, 4),
      targetCooldown: durations(1, 1, 7),
      note: "ignored"
    })
  );
  assert.equal(result.cooldown.initiatorReadyAt, 10);
  assert.equal(result.cooldown.targetReadyAt, 13);
  assert.equal(result.cooldown.readyAt, 13);
  assert.equal(history[0], moot);
  assert.equal(moot.status, "moot");
  history.push(entry("player-a", "player-z", "passed", 1));
  assert.equal(history.length, 2);
});

test("voteCooldown rejects malformed options in field order", () => {
  assert.doesNotThrow(() => voteCooldown());
  rejects(null, "options", "options must be an object");
  rejects({}, "initiator", "initiator must be a non-empty string");
  rejects({ initiator: "player-a" }, "target", "target must be a non-empty string");
  rejects(
    { initiator: "player-a", target: "player-a" },
    "distinct",
    "initiator and target must be different players"
  );
  rejects({ initiator: "player-a", target: "player-z" }, "history", "history must be an array");
  rejects(rules({ history: null }), "history", "history must be an array");
  rejects(rules({ history: [null] }), "history", "history entry must be an object");
  rejects(rules({ history: [{}] }), "history", "history initiator must be a non-empty string");
  rejects(
    rules({ history: [{ initiator: "player-a" }] }),
    "history",
    "history target must be a non-empty string"
  );
  rejects(
    rules({ history: [entry("player-a", "player-a", "passed", 1)] }),
    "history",
    "history initiator and target must be different players"
  );
  rejects(
    rules({ history: [entry("player-a", "player-z", "open", 1)] }),
    "history",
    "history status must be passed, failed, or moot"
  );
  rejects(
    rules({ history: [{ initiator: "player-a", target: "player-z", status: "passed" }] }),
    "history",
    "history resolvedAt must be a finite number"
  );
  rejects(
    rules({ history: [entry("player-a", "player-z", "passed", Number.NaN)] }),
    "history",
    "history resolvedAt must be a finite number"
  );
  rejects(rules({ initiatorCooldown: null }), "cooldown", "initiatorCooldown must be an object");
  rejects(
    rules({ initiatorCooldown: {} }),
    "cooldown",
    "initiatorCooldown.passed must be a finite number greater than or equal to 0"
  );
  rejects(
    rules({ initiatorCooldown: { passed: -1, failed: 0, moot: 0 } }),
    "cooldown",
    "initiatorCooldown.passed must be a finite number greater than or equal to 0"
  );
  rejects(
    rules({ initiatorCooldown: { passed: 0, failed: Number.POSITIVE_INFINITY, moot: 0 } }),
    "cooldown",
    "initiatorCooldown.failed must be a finite number greater than or equal to 0"
  );
  rejects(
    rules({ initiatorCooldown: { passed: 0, failed: 0 } }),
    "cooldown",
    "initiatorCooldown.moot must be a finite number greater than or equal to 0"
  );
  rejects(rules({ targetCooldown: [] }), "cooldown", "targetCooldown must be an object");
  rejects(
    rules({ targetCooldown: { passed: "0", failed: 0, moot: 0 } }),
    "cooldown",
    "targetCooldown.passed must be a finite number greater than or equal to 0"
  );
  rejects(
    rules({ targetCooldown: { passed: 0, failed: -0.1, moot: 0 } }),
    "cooldown",
    "targetCooldown.failed must be a finite number greater than or equal to 0"
  );
  rejects(
    rules({ targetCooldown: { passed: 0, failed: 0, moot: null } }),
    "cooldown",
    "targetCooldown.moot must be a finite number greater than or equal to 0"
  );
  const open = must(createVote(openOptions())).state;
  rejects(rules({ history: [open] }), "history", "history status must be passed, failed, or moot");
  rejects(
    rules({
      history: [entry("player-a", "player-z", "passed", Number.MAX_VALUE)],
      initiatorCooldown: durations(Number.MAX_VALUE, 0, 0)
    }),
    "end",
    "ready time must be a finite number"
  );
});
