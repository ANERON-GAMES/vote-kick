import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  ALREADY_VOTED,
  CAST,
  CHANGE,
  CHANGED,
  CHOICE,
  CHOICES,
  CLOSED,
  COOLDOWN,
  DISTINCT,
  DURATION,
  EARLY,
  ELIGIBLE,
  END,
  ERROR_TYPES,
  EVENT,
  EVENTS,
  FAILED,
  FLAG,
  HISTORY,
  IMPOSSIBLE,
  INELIGIBLE,
  INITIATOR,
  INITIATOR_RULE,
  LEAVE,
  LEFT,
  MISSING_VOTE,
  MOOT,
  NO,
  OPEN,
  OPTIONS,
  PASSED,
  QUORUM,
  REASONS,
  RECORDS,
  RESOLVED,
  SAME_CHOICE,
  SHORTFALL,
  START,
  STARTED,
  STATUSES,
  TARGET,
  TARGET_LEAVE,
  TARGET_LEFT,
  TARGET_RULE,
  THRESHOLD,
  TICK,
  TIME,
  VOTE,
  VOTER,
  YES
} from "../src/index.js";
import * as api from "../src/index.js";

const root = new URL("..", import.meta.url);

test("public exports stay limited to the documented surface", () => {
  assert.deepEqual(Object.keys(api).sort(), [
    "ALREADY_VOTED",
    "CAST",
    "CHANGE",
    "CHANGED",
    "CHOICE",
    "CHOICES",
    "CLOSED",
    "COOLDOWN",
    "DISTINCT",
    "DURATION",
    "EARLY",
    "ELIGIBLE",
    "END",
    "ERROR_TYPES",
    "EVENT",
    "EVENTS",
    "FAILED",
    "FLAG",
    "HISTORY",
    "IMPOSSIBLE",
    "INELIGIBLE",
    "INITIATOR",
    "INITIATOR_RULE",
    "LEAVE",
    "LEFT",
    "MISSING_VOTE",
    "MOOT",
    "NO",
    "OPEN",
    "OPTIONS",
    "PASSED",
    "QUORUM",
    "REASONS",
    "RECORDS",
    "RESOLVED",
    "SAME_CHOICE",
    "SHORTFALL",
    "START",
    "STARTED",
    "STATUSES",
    "TARGET",
    "TARGET_LEAVE",
    "TARGET_LEFT",
    "TARGET_RULE",
    "THRESHOLD",
    "TICK",
    "TIME",
    "VOTE",
    "VOTER",
    "YES",
    "applyVote",
    "createVote",
    "voteCooldown"
  ]);
  assert.equal(typeof api.createVote, "function");
  assert.equal(typeof api.applyVote, "function");
  assert.equal(typeof api.voteCooldown, "function");
  assert.equal(OPEN, "open");
  assert.equal(PASSED, "passed");
  assert.equal(FAILED, "failed");
  assert.equal(MOOT, "moot");
  assert.deepEqual(STATUSES, ["open", "passed", "failed", "moot"]);
  assert.equal(THRESHOLD, "threshold");
  assert.equal(IMPOSSIBLE, "impossible");
  assert.equal(QUORUM, "quorum");
  assert.equal(SHORTFALL, "shortfall");
  assert.equal(TARGET_LEFT, "target-left");
  assert.deepEqual(REASONS, ["threshold", "impossible", "quorum", "shortfall", "target-left"]);
  assert.equal(YES, "yes");
  assert.equal(NO, "no");
  assert.deepEqual(CHOICES, ["yes", "no"]);
  assert.equal(CAST, "cast");
  assert.equal(CHANGE, "change");
  assert.equal(LEAVE, "leave");
  assert.equal(TARGET_LEAVE, "target-leave");
  assert.equal(TICK, "tick");
  assert.deepEqual(EVENTS, ["cast", "change", "leave", "target-leave", "tick"]);
  assert.equal(STARTED, "started");
  assert.equal(CHANGED, "changed");
  assert.equal(LEFT, "left");
  assert.equal(RESOLVED, "resolved");
  assert.deepEqual(RECORDS, ["started", "cast", "changed", "left", "resolved"]);
  assert.equal(OPTIONS, "options");
  assert.equal(INITIATOR, "initiator");
  assert.equal(TARGET, "target");
  assert.equal(DISTINCT, "distinct");
  assert.equal(ELIGIBLE, "eligible");
  assert.equal(TARGET_RULE, "target-rule");
  assert.equal(INITIATOR_RULE, "initiator-rule");
  assert.equal(START, "start");
  assert.equal(DURATION, "duration");
  assert.equal(END, "end");
  assert.equal(FLAG, "flag");
  assert.equal(VOTE, "vote");
  assert.equal(EVENT, "event");
  assert.equal(TIME, "time");
  assert.equal(VOTER, "voter");
  assert.equal(CHOICE, "choice");
  assert.equal(CLOSED, "closed");
  assert.equal(EARLY, "early");
  assert.equal(ALREADY_VOTED, "already-voted");
  assert.equal(MISSING_VOTE, "missing-vote");
  assert.equal(SAME_CHOICE, "same-choice");
  assert.equal(INELIGIBLE, "ineligible");
  assert.equal(HISTORY, "history");
  assert.equal(COOLDOWN, "cooldown");
  assert.deepEqual(ERROR_TYPES, [
    "options",
    "initiator",
    "target",
    "distinct",
    "eligible",
    "target-rule",
    "initiator-rule",
    "start",
    "duration",
    "end",
    "threshold",
    "quorum",
    "flag",
    "vote",
    "event",
    "time",
    "voter",
    "choice",
    "closed",
    "early",
    "already-voted",
    "missing-vote",
    "same-choice",
    "ineligible",
    "history",
    "cooldown"
  ]);
  for (const list of [STATUSES, REASONS, CHOICES, EVENTS, RECORDS, ERROR_TYPES]) {
    assert.equal(Object.isFrozen(list), true);
  }
});

test("package metadata names the module and the author", () => {
  const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
  assert.equal(pkg.name, "@aneron/vote-kick");
  assert.equal(pkg.license, "MIT");
  assert.equal(pkg.author, "Vadim Gubin");
  assert.equal(pkg.type, "module");
  assert.equal(pkg.sideEffects, false);
  assert.equal(pkg.engines.node, ">=20");
  assert.equal(pkg.private, undefined);
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.main, "./src/index.js");
  assert.equal(pkg.exports, "./src/index.js");
  assert.equal(pkg.repository.type, "git");
  assert.equal(pkg.repository.url, "git+https://github.com/ANERON-GAMES/vote-kick.git");
  assert.deepEqual(pkg.files, ["src", "LICENSE", "README.md"]);
  assert.equal(pkg.scripts.test, "node --test test/*.test.js");
  assert.equal(pkg.scripts.lint, "eslint .");
  assert.equal(pkg.scripts.format, "prettier --write .");
  assert.equal(pkg.scripts["format:check"], "prettier --check .");
  const license = readFileSync(new URL("LICENSE", root), "utf8");
  assert.equal(license.includes("Copyright (c) 2026 Vadim Gubin"), true);
  assert.equal(license.includes("anerongames"), false);
  const readme = readFileSync(new URL("README.md", root), "utf8");
  for (const heading of [
    "## Purpose",
    "## Install",
    "## Usage",
    "## API",
    "## Design",
    "## License"
  ]) {
    assert.equal(readme.includes(heading), true, heading);
  }
  assert.equal(readme.includes("## Design notes"), false);
  assert.equal(readme.includes("## API reference"), false);
  assert.equal(readme.includes('`created.state.status` is `"open"`'), true);
  assert.equal(readme.includes("`created.state.requiredYes` is `3`"), true);
  assert.equal(readme.includes("`created.state.requiredQuorum` is `4`"), true);
  assert.equal(readme.includes('`second.state.yes` is `["player-a", "player-c"]`'), true);
  assert.equal(readme.includes('`third.state.status` is `"passed"`'), true);
  assert.equal(readme.includes('`third.state.reason` is `"threshold"`'), true);
  assert.equal(readme.includes("`third.state.resolvedAt` is `1200`"), true);
  assert.equal(
    readme.includes('`third.state.yes` is `["player-a", "player-b", "player-c"]`'),
    true
  );
  assert.equal(readme.includes('`thirdNo.state.reason` is `"impossible"`'), true);
  assert.equal(
    readme.includes('`thirdNo.state.no` is `["player-b", "player-c", "player-e"]`'),
    true
  );
  assert.equal(readme.includes('`expired.state.reason` is `"quorum"`'), true);
  assert.equal(readme.includes("`expired.state.resolvedAt` is `1500`"), true);
  assert.equal(readme.includes('`timed.state.reason` is `"shortfall"`'), true);
  assert.equal(readme.includes('`timed.state.pending` is `["player-e"]`'), true);
  assert.equal(readme.includes('`quick.state.status` is `"passed"`'), true);
  assert.equal(readme.includes("`quick.state.requiredQuorum` is `2`"), true);
  assert.equal(readme.includes('`shrunk.state.status` is `"passed"`'), true);
  assert.equal(readme.includes('`shrunk.state.eligible` is `["player-a", "player-c"]`'), true);
  assert.equal(readme.includes('`moot.state.status` is `"moot"`'), true);
  assert.equal(readme.includes('`moot.state.reason` is `"target-left"`'), true);
  assert.equal(readme.includes("`waiting.state` is `created.state`"), true);
  assert.equal(readme.includes('`late.state.yes` is `["player-a"]`'), true);
  assert.equal(readme.includes('`closed.error.type` is `"closed"`'), true);
  assert.equal(readme.includes("`window.cooldown.initiatorReadyAt` is `1500`"), true);
  assert.equal(readme.includes("`window.cooldown.targetReadyAt` is `1200`"), true);
  assert.equal(readme.includes("`window.cooldown.readyAt` is `1500`"), true);
});

test("source files do not contain comments, clocks, timers, or network calls", () => {
  const files = readdirSync(new URL("src/", root)).sort();
  assert.deepEqual(files, [
    "constants.js",
    "cooldown.js",
    "decision.js",
    "index.js",
    "shape.js",
    "validate.js",
    "vote.js"
  ]);
  for (const name of files) {
    const source = readFileSync(new URL("src/" + name, root), "utf8");
    const specifiers = source.match(/from "[^"]+"/g) ?? [];
    assert.equal(specifiers.length > 0 || !source.includes("import "), true, name);
    for (const specifier of specifiers) {
      assert.match(specifier, /^from "\.\/[a-z]+\.js"$/);
    }
    assert.equal(source.includes("node:"), false, name);
    assert.equal(source.includes("require("), false, name);
    assert.equal(source.includes("/*"), false, name);
    assert.equal(source.includes("//"), false, name);
    for (const token of [
      "Date",
      "setTimeout",
      "setInterval",
      "Math.random",
      "process",
      "fetch(",
      "globalThis",
      "queueMicrotask",
      "setImmediate",
      "performance"
    ]) {
      assert.equal(source.includes(token), false, name + " " + token);
    }
  }
});

test("the lockfile resolves only from the npm registry", () => {
  const lockPath = new URL("package-lock.json", root);
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  assert.equal(lock.lockfileVersion >= 2, true);
  const text = readFileSync(lockPath, "utf8");
  assert.equal(text.includes("git+"), false);
  assert.equal(text.includes("github:"), false);
  assert.equal(text.includes("registry.yarnpkg.com"), false);
  let resolved = 0;
  const walk = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item);
      }
      return;
    }
    if (value !== null && typeof value === "object") {
      if (typeof value.resolved === "string") {
        resolved += 1;
        assert.equal(
          value.resolved.startsWith("https://registry.npmjs.org/"),
          true,
          value.resolved
        );
      }
      for (const key of Object.keys(value)) {
        walk(value[key]);
      }
    }
  };
  walk(lock);
  assert.equal(resolved > 0, true);
});
