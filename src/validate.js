import {
  FAILED,
  IMPOSSIBLE,
  MOOT,
  OPEN,
  PASSED,
  QUORUM,
  SHORTFALL,
  TARGET_LEFT,
  THRESHOLD,
  VOTE
} from "./constants.js";
import { addedEnd, isPassing, isPossible, requiredCount } from "./decision.js";
import { exactKeys, isId, isObject, readFinite } from "./shape.js";

const VOTE_KEYS = [
  "duration",
  "eligible",
  "end",
  "initiator",
  "initiatorCountsAsYes",
  "no",
  "pending",
  "quorum",
  "reason",
  "requiredQuorum",
  "requiredYes",
  "resolvedAt",
  "start",
  "status",
  "target",
  "targetCanVote",
  "threshold",
  "yes"
];

const VOTE_FIELDS =
  "vote fields must be status, reason, initiator, target, eligible, yes, no, pending, start, duration, end, threshold, quorum, targetCanVote, initiatorCountsAsYes, requiredYes, requiredQuorum, and resolvedAt";

const PARTITION = "player lists must partition eligible in eligible order";

export function validateVote(vote) {
  if (!isObject(vote)) {
    return problem("vote must be an object");
  }
  if (!exactKeys(vote, VOTE_KEYS)) {
    return problem(VOTE_FIELDS);
  }
  if (
    vote.status !== OPEN &&
    vote.status !== PASSED &&
    vote.status !== FAILED &&
    vote.status !== MOOT
  ) {
    return problem("status must be open, passed, failed, or moot");
  }
  if (!isId(vote.initiator)) {
    return problem("initiator must be a non-empty string");
  }
  if (!isId(vote.target)) {
    return problem("target must be a non-empty string");
  }
  if (vote.initiator === vote.target) {
    return problem("initiator and target must be different players");
  }
  const eligibleError = readStoredEligible(vote.eligible);
  if (eligibleError !== null) {
    return eligibleError;
  }
  const yesError = readIdList(vote.yes, "yes");
  if (yesError !== null) {
    return yesError;
  }
  const noError = readIdList(vote.no, "no");
  if (noError !== null) {
    return noError;
  }
  const pendingError = readIdList(vote.pending, "pending");
  if (pendingError !== null) {
    return pendingError;
  }
  if (!partitioned(vote.eligible, vote.yes, vote.no, vote.pending)) {
    return problem(PARTITION);
  }
  if (typeof vote.targetCanVote !== "boolean") {
    return problem("targetCanVote must be a boolean");
  }
  if (typeof vote.initiatorCountsAsYes !== "boolean") {
    return problem("initiatorCountsAsYes must be a boolean");
  }
  if (vote.targetCanVote !== listed(vote.eligible, vote.target)) {
    if (vote.targetCanVote) {
      return problem("target must be eligible when the target can vote");
    }
    return problem("target must not be eligible when the target cannot vote");
  }
  const start = readFinite(vote.start);
  if (start === null) {
    return problem("start must be a finite number");
  }
  const duration = readFinite(vote.duration);
  if (duration === null || !(duration > 0)) {
    return problem("duration must be a finite number greater than 0");
  }
  const end = addedEnd(start, duration);
  if (end === null) {
    return problem("end must be a finite number greater than start");
  }
  if (readFinite(vote.end) !== end) {
    return problem("end must equal start plus duration");
  }
  if (!unitFraction(vote.threshold)) {
    return problem("threshold must be a finite number greater than 0 and less than or equal to 1");
  }
  if (!unitFraction(vote.quorum)) {
    return problem("quorum must be a finite number greater than 0 and less than or equal to 1");
  }
  const requiredYes = requiredCount(vote.eligible.length, vote.threshold);
  if (requiredYes === null || vote.requiredYes !== requiredYes) {
    return problem("requiredYes must match the eligible count and the threshold");
  }
  const requiredQuorum = requiredCount(vote.eligible.length, vote.quorum);
  if (requiredQuorum === null || vote.requiredQuorum !== requiredQuorum) {
    return problem("requiredQuorum must match the eligible count and the quorum");
  }
  if (vote.status === OPEN) {
    return assertOpen(vote);
  }
  if (vote.status === PASSED) {
    return assertPassed(vote, start, end);
  }
  if (vote.status === FAILED) {
    return assertFailed(vote, start, end);
  }
  return assertMoot(vote, start, end);
}

function assertOpen(vote) {
  if (vote.reason !== null) {
    return problem("reason must be null while the vote is open");
  }
  if (vote.resolvedAt !== null) {
    return problem("resolvedAt must be null while the vote is open");
  }
  if (vote.eligible.length === 0) {
    return problem("an open vote must have eligible voters");
  }
  if (isPassing(vote.yes.length, vote.requiredYes)) {
    return problem("an open vote must be short of the required yes votes");
  }
  if (!isPossible(vote.yes.length, vote.pending.length, vote.requiredYes)) {
    return problem("an open vote must still be able to pass");
  }
  return null;
}

function assertPassed(vote, start, end) {
  if (vote.reason !== THRESHOLD) {
    return problem("reason must be threshold when the vote passed");
  }
  const resolvedAt = readFinite(vote.resolvedAt);
  if (resolvedAt === null) {
    return problem("resolvedAt must be a finite number");
  }
  if (resolvedAt < start) {
    return problem("a passed vote must resolve at or after the start");
  }
  if (resolvedAt >= end) {
    return problem("a passed vote must resolve before the end");
  }
  if (vote.eligible.length === 0) {
    return problem("a passed vote must have eligible voters");
  }
  if (!isPassing(vote.yes.length, vote.requiredYes)) {
    return problem("a passed vote must meet the required yes votes");
  }
  return null;
}

function assertFailed(vote, start, end) {
  if (vote.reason !== IMPOSSIBLE && vote.reason !== QUORUM && vote.reason !== SHORTFALL) {
    return problem("reason must be impossible, quorum, or shortfall when the vote failed");
  }
  const resolvedAt = readFinite(vote.resolvedAt);
  if (resolvedAt === null) {
    return problem("resolvedAt must be a finite number");
  }
  if (vote.reason === IMPOSSIBLE) {
    if (resolvedAt < start) {
      return problem("an impossible failure must resolve at or after the start");
    }
    if (resolvedAt >= end) {
      return problem("an impossible failure must resolve before the end");
    }
    if (isPossible(vote.yes.length, vote.pending.length, vote.requiredYes)) {
      return problem("an impossible failure must make passing impossible");
    }
    return null;
  }
  if (resolvedAt < end) {
    if (vote.reason === QUORUM) {
      return problem("a quorum failure must resolve at or after the end");
    }
    return problem("a shortfall failure must resolve at or after the end");
  }
  if (vote.eligible.length === 0) {
    if (vote.reason === QUORUM) {
      return problem("a quorum failure must have eligible voters");
    }
    return problem("a shortfall failure must have eligible voters");
  }
  if (isPassing(vote.yes.length, vote.requiredYes)) {
    if (vote.reason === QUORUM) {
      return problem("a quorum failure must be short of the required yes votes");
    }
    return problem("a shortfall failure must be short of the required yes votes");
  }
  if (!isPossible(vote.yes.length, vote.pending.length, vote.requiredYes)) {
    if (vote.reason === QUORUM) {
      return problem("a quorum failure must still have been able to pass");
    }
    return problem("a shortfall failure must still have been able to pass");
  }
  const voted = vote.yes.length + vote.no.length;
  if (vote.reason === QUORUM) {
    if (voted >= vote.requiredQuorum) {
      return problem("a quorum failure must be short of the quorum");
    }
    return null;
  }
  if (voted < vote.requiredQuorum) {
    return problem("a shortfall failure must meet the quorum");
  }
  return null;
}

function assertMoot(vote, start, end) {
  if (vote.reason !== TARGET_LEFT) {
    return problem("reason must be target-left when the vote is moot");
  }
  const resolvedAt = readFinite(vote.resolvedAt);
  if (resolvedAt === null) {
    return problem("resolvedAt must be a finite number");
  }
  if (resolvedAt < start) {
    return problem("a moot vote must resolve at or after the start");
  }
  if (resolvedAt >= end) {
    return problem("a moot vote must resolve before the end");
  }
  if (vote.eligible.length === 0) {
    return problem("a moot vote must have eligible voters");
  }
  if (isPassing(vote.yes.length, vote.requiredYes)) {
    return problem("a moot vote must be short of the required yes votes");
  }
  if (!isPossible(vote.yes.length, vote.pending.length, vote.requiredYes)) {
    return problem("a moot vote must still have been able to pass");
  }
  return null;
}

function readStoredEligible(eligible) {
  if (!Array.isArray(eligible)) {
    return problem("eligible must be an array");
  }
  const seen = Object.create(null);
  for (const id of eligible) {
    if (!isId(id)) {
      return problem("player id must be a non-empty string");
    }
    if (Object.hasOwn(seen, id)) {
      return problem("player ids must be unique");
    }
    seen[id] = true;
  }
  return null;
}

function readIdList(list, label) {
  if (!Array.isArray(list)) {
    return problem(label + " must be an array");
  }
  for (const id of list) {
    if (!isId(id)) {
      return problem(label + " must contain player ids");
    }
  }
  return null;
}

function partitioned(eligible, yes, no, pending) {
  const position = Object.create(null);
  for (let index = 0; index < eligible.length; index += 1) {
    position[eligible[index]] = index;
  }
  const seen = Object.create(null);
  const lists = [yes, no, pending];
  let count = 0;
  for (const list of lists) {
    let previous = -1;
    for (const id of list) {
      if (!Object.hasOwn(position, id) || Object.hasOwn(seen, id) || position[id] <= previous) {
        return false;
      }
      previous = position[id];
      seen[id] = true;
      count += 1;
    }
  }
  return count === eligible.length;
}

function listed(ids, id) {
  for (const candidate of ids) {
    if (candidate === id) {
      return true;
    }
  }
  return false;
}

function unitFraction(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 1;
}

function problem(message) {
  return { type: VOTE, message };
}
