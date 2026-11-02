import { createVote } from "../src/index.js";

export function must(result) {
  if (!result.ok) {
    throw new Error(result.error.type + ": " + result.error.message);
  }
  return result;
}

export function roster(count) {
  const letters = "abcdefghij";
  const ids = [];
  for (let index = 0; index < count; index += 1) {
    ids.push("player-" + letters[index]);
  }
  return ids;
}

export function openOptions(overrides = {}) {
  const options = {
    initiator: "player-a",
    target: "player-z",
    eligible: ["player-a", "player-b", "player-c", "player-d", "player-e"],
    start: 1000,
    duration: 500,
    threshold: 0.6,
    quorum: 0.8
  };
  for (const key of Object.keys(overrides)) {
    options[key] = overrides[key];
  }
  return options;
}

export function openVote(overrides) {
  return must(createVote(openOptions(overrides)));
}

export function rawVote(overrides = {}) {
  const eligible = Object.hasOwn(overrides, "eligible")
    ? overrides.eligible
    : ["player-a", "player-b", "player-c"];
  const count = Array.isArray(eligible) ? eligible.length : 0;
  const vote = {
    status: "open",
    reason: null,
    initiator: "player-a",
    target: "player-z",
    eligible,
    yes: [],
    no: [],
    pending: Array.isArray(eligible) ? eligible.slice() : [],
    start: 0,
    duration: 100,
    end: 100,
    threshold: 1,
    quorum: 1,
    targetCanVote: false,
    initiatorCountsAsYes: false,
    requiredYes: count === 0 ? 1 : count,
    requiredQuorum: count === 0 ? 1 : count,
    resolvedAt: null
  };
  for (const key of Object.keys(overrides)) {
    vote[key] = overrides[key];
  }
  return vote;
}

export function edit(state, mutate) {
  const copy = JSON.parse(JSON.stringify(state));
  mutate(copy);
  return copy;
}

export function without(vote, key) {
  const copy = {};
  for (const name of Object.keys(vote)) {
    if (name !== key) {
      copy[name] = vote[name];
    }
  }
  return copy;
}

export function cast(voterId, choice, time) {
  return { type: "cast", voterId, choice, time };
}

export function change(voterId, choice, time) {
  return { type: "change", voterId, choice, time };
}

export function leave(voterId, time) {
  return { type: "leave", voterId, time };
}

export function durations(passed, failed, moot) {
  return { passed, failed, moot };
}
