import {
  ALREADY_VOTED,
  CAST,
  CHANGE,
  CHANGED,
  CHOICE,
  CLOSED,
  DISTINCT,
  DURATION,
  EARLY,
  ELIGIBLE,
  END,
  EVENT,
  FAILED,
  FLAG,
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
  RESOLVED,
  SAME_CHOICE,
  START,
  STARTED,
  TARGET,
  TARGET_LEAVE,
  TARGET_LEFT,
  TARGET_RULE,
  THRESHOLD,
  TICK,
  TIME,
  VOTER,
  YES
} from "./constants.js";
import { addedEnd, expiryReason, isPassing, isPossible, requiredCount } from "./decision.js";
import { contains, isId, isObject, normalizeZero, readFinite, toSet } from "./shape.js";
import { validateVote } from "./validate.js";

const TYPE_MESSAGE = "event type must be cast, change, leave, target-leave, or tick";
const VOTER_MESSAGE = "voter id must be a non-empty string";
const CHOICE_MESSAGE = "choice must be yes or no";
const TIME_MESSAGE = "time must be a finite number";
const INELIGIBLE_MESSAGE = "voter must be eligible";
const CLOSED_MESSAGE = "vote is closed";
const EARLY_MESSAGE = "time is before the start";
const ALREADY_MESSAGE = "voter has already cast a vote";
const MISSING_MESSAGE = "voter has not cast a vote";
const SAME_MESSAGE = "choice must change";
const TARGET_MESSAGE = "target leaves with a target-leave event";
const THRESHOLD_MESSAGE =
  "threshold must be a finite number greater than 0 and less than or equal to 1";
const QUORUM_MESSAGE = "quorum must be a finite number greater than 0 and less than or equal to 1";
const DURATION_MESSAGE = "duration must be a finite number greater than 0";
const END_MESSAGE = "end must be a finite number greater than start";
const DISTINCT_MESSAGE = "initiator and target must be different players";

export function createVote(options) {
  const read = readCreate(options);
  if (read.error !== null) {
    return failure(read.error);
  }
  const value = read.value;
  const events = [{ type: STARTED, time: value.start }];
  const yesIds = [];
  if (value.initiatorCountsAsYes) {
    yesIds.push(value.initiator);
    events.push({ type: CAST, voterId: value.initiator, choice: YES, time: value.start });
  }
  return resolveLists(value, value.eligible, yesIds, [], value.start, events);
}

export function applyVote(vote, event) {
  const voteError = validateVote(vote);
  if (voteError !== null) {
    return failure(voteError);
  }
  const read = readEvent(event);
  if (read.error !== null) {
    return failure(read.error, vote);
  }
  if (vote.status !== OPEN) {
    return failure({ type: CLOSED, message: CLOSED_MESSAGE }, vote);
  }
  const time = read.value.time;
  const start = normalizeZero(vote.start);
  const end = normalizeZero(vote.end);
  if (time < start) {
    return failure({ type: EARLY, message: EARLY_MESSAGE }, vote);
  }
  if (time >= end) {
    return expire(vote, time);
  }
  if (read.value.type === TICK) {
    return unchanged(vote);
  }
  if (read.value.type === TARGET_LEAVE) {
    return closeMoot(vote, time);
  }
  if (read.value.type === LEAVE) {
    return leave(vote, read.value);
  }
  if (read.value.type === CHANGE) {
    return change(vote, read.value);
  }
  return cast(vote, read.value);
}

function readCreate(options) {
  if (!isObject(options)) {
    return failRead({ type: OPTIONS, message: "options must be an object" });
  }
  if (!Object.hasOwn(options, "initiator") || !isId(options.initiator)) {
    return failRead({ type: INITIATOR, message: "initiator must be a non-empty string" });
  }
  if (!Object.hasOwn(options, "target") || !isId(options.target)) {
    return failRead({ type: TARGET, message: "target must be a non-empty string" });
  }
  if (options.initiator === options.target) {
    return failRead({ type: DISTINCT, message: DISTINCT_MESSAGE });
  }
  const eligible = readEligible(options);
  if (eligible.error !== null) {
    return eligible;
  }
  const targetCanVote = readFlag(
    options,
    "targetCanVote",
    false,
    "targetCanVote must be a boolean"
  );
  if (targetCanVote.error !== null) {
    return targetCanVote;
  }
  const initiatorCountsAsYes = readFlag(
    options,
    "initiatorCountsAsYes",
    true,
    "initiatorCountsAsYes must be a boolean"
  );
  if (initiatorCountsAsYes.error !== null) {
    return initiatorCountsAsYes;
  }
  const targetListed = contains(eligible.value, options.target);
  if (targetCanVote.value !== targetListed) {
    if (targetCanVote.value) {
      return failRead({
        type: TARGET_RULE,
        message: "target must be eligible when the target can vote"
      });
    }
    return failRead({
      type: TARGET_RULE,
      message: "target must not be eligible when the target cannot vote"
    });
  }
  if (initiatorCountsAsYes.value && !contains(eligible.value, options.initiator)) {
    return failRead({
      type: INITIATOR_RULE,
      message: "initiator must be eligible when the initiator counts as yes"
    });
  }
  if (!Object.hasOwn(options, "start")) {
    return failRead({ type: START, message: "start must be a finite number" });
  }
  const start = readFinite(options.start);
  if (start === null) {
    return failRead({ type: START, message: "start must be a finite number" });
  }
  if (!Object.hasOwn(options, "duration")) {
    return failRead({ type: DURATION, message: DURATION_MESSAGE });
  }
  const duration = readFinite(options.duration);
  if (duration === null || !(duration > 0)) {
    return failRead({ type: DURATION, message: DURATION_MESSAGE });
  }
  const end = addedEnd(start, duration);
  if (end === null) {
    return failRead({ type: END, message: END_MESSAGE });
  }
  if (!Object.hasOwn(options, "threshold") || !unitFraction(options.threshold)) {
    return failRead({ type: THRESHOLD, message: THRESHOLD_MESSAGE });
  }
  if (!Object.hasOwn(options, "quorum") || !unitFraction(options.quorum)) {
    return failRead({ type: QUORUM, message: QUORUM_MESSAGE });
  }
  return {
    error: null,
    value: {
      initiator: options.initiator,
      target: options.target,
      eligible: eligible.value,
      targetCanVote: targetCanVote.value,
      initiatorCountsAsYes: initiatorCountsAsYes.value,
      start,
      duration,
      end,
      threshold: options.threshold,
      quorum: options.quorum
    }
  };
}

function readEligible(options) {
  if (
    !Object.hasOwn(options, "eligible") ||
    !Array.isArray(options.eligible) ||
    options.eligible.length === 0
  ) {
    return failRead({ type: ELIGIBLE, message: "eligible must be a non-empty array" });
  }
  const seen = Object.create(null);
  const ids = [];
  for (const id of options.eligible) {
    if (!isId(id)) {
      return failRead({ type: ELIGIBLE, message: "player id must be a non-empty string" });
    }
    if (Object.hasOwn(seen, id)) {
      return failRead({ type: ELIGIBLE, message: "player ids must be unique" });
    }
    seen[id] = true;
    ids.push(id);
  }
  return { error: null, value: ids };
}

function readFlag(options, key, fallback, message) {
  if (!Object.hasOwn(options, key) || options[key] === undefined) {
    return { error: null, value: fallback };
  }
  if (typeof options[key] !== "boolean") {
    return failRead({ type: FLAG, message });
  }
  return { error: null, value: options[key] };
}

function readEvent(event) {
  if (!isObject(event)) {
    return failRead({ type: EVENT, message: "event must be an object" });
  }
  if (!Object.hasOwn(event, "type") || !knownType(event.type)) {
    return failRead({ type: EVENT, message: TYPE_MESSAGE });
  }
  if (!Object.hasOwn(event, "time")) {
    return failRead({ type: TIME, message: TIME_MESSAGE });
  }
  const time = readFinite(event.time);
  if (time === null) {
    return failRead({ type: TIME, message: TIME_MESSAGE });
  }
  if (event.type === TICK || event.type === TARGET_LEAVE) {
    return { error: null, value: { type: event.type, time } };
  }
  if (!Object.hasOwn(event, "voterId") || !isId(event.voterId)) {
    return failRead({ type: VOTER, message: VOTER_MESSAGE });
  }
  if (event.type === LEAVE) {
    return { error: null, value: { type: event.type, time, voterId: event.voterId } };
  }
  if (!Object.hasOwn(event, "choice") || (event.choice !== YES && event.choice !== NO)) {
    return failRead({ type: CHOICE, message: CHOICE_MESSAGE });
  }
  return {
    error: null,
    value: { type: event.type, time, voterId: event.voterId, choice: event.choice }
  };
}

function knownType(type) {
  return (
    type === CAST || type === CHANGE || type === LEAVE || type === TARGET_LEAVE || type === TICK
  );
}

function cast(vote, event) {
  if (!contains(vote.eligible, event.voterId)) {
    return failure({ type: INELIGIBLE, message: INELIGIBLE_MESSAGE }, vote);
  }
  if (contains(vote.yes, event.voterId) || contains(vote.no, event.voterId)) {
    return failure({ type: ALREADY_VOTED, message: ALREADY_MESSAGE }, vote);
  }
  const yesIds = event.choice === YES ? vote.yes.concat([event.voterId]) : vote.yes.slice();
  const noIds = event.choice === NO ? vote.no.concat([event.voterId]) : vote.no.slice();
  return resolveLists(vote, vote.eligible, yesIds, noIds, event.time, [
    { type: CAST, voterId: event.voterId, choice: event.choice, time: event.time }
  ]);
}

function change(vote, event) {
  if (!contains(vote.eligible, event.voterId)) {
    return failure({ type: INELIGIBLE, message: INELIGIBLE_MESSAGE }, vote);
  }
  const inYes = contains(vote.yes, event.voterId);
  const inNo = contains(vote.no, event.voterId);
  if (!inYes && !inNo) {
    return failure({ type: MISSING_VOTE, message: MISSING_MESSAGE }, vote);
  }
  if ((inYes && event.choice === YES) || (inNo && event.choice === NO)) {
    return failure({ type: SAME_CHOICE, message: SAME_MESSAGE }, vote);
  }
  const yesIds = removeId(vote.yes, event.voterId);
  const noIds = removeId(vote.no, event.voterId);
  if (event.choice === YES) {
    yesIds.push(event.voterId);
  } else {
    noIds.push(event.voterId);
  }
  return resolveLists(vote, vote.eligible, yesIds, noIds, event.time, [
    { type: CHANGED, voterId: event.voterId, choice: event.choice, time: event.time }
  ]);
}

function leave(vote, event) {
  if (event.voterId === vote.target) {
    return failure({ type: TARGET, message: TARGET_MESSAGE }, vote);
  }
  if (!contains(vote.eligible, event.voterId)) {
    return failure({ type: INELIGIBLE, message: INELIGIBLE_MESSAGE }, vote);
  }
  return resolveLists(
    vote,
    removeId(vote.eligible, event.voterId),
    removeId(vote.yes, event.voterId),
    removeId(vote.no, event.voterId),
    event.time,
    [{ type: LEFT, voterId: event.voterId, time: event.time }]
  );
}

function closeMoot(vote, time) {
  const state = assemble(
    vote,
    {
      eligible: vote.eligible.slice(),
      yes: vote.yes.slice(),
      no: vote.no.slice(),
      pending: vote.pending.slice()
    },
    vote.requiredYes,
    vote.requiredQuorum,
    MOOT,
    TARGET_LEFT,
    time
  );
  return finish(state, [{ type: RESOLVED, status: MOOT, reason: TARGET_LEFT, time }]);
}

function expire(vote, time) {
  const voted = vote.yes.length + vote.no.length;
  const reason = expiryReason(voted, vote.requiredQuorum);
  const state = assemble(
    vote,
    {
      eligible: vote.eligible.slice(),
      yes: vote.yes.slice(),
      no: vote.no.slice(),
      pending: vote.pending.slice()
    },
    vote.requiredYes,
    vote.requiredQuorum,
    FAILED,
    reason,
    time
  );
  return finish(state, [{ type: RESOLVED, status: FAILED, reason, time }]);
}

function resolveLists(spec, eligible, yesIds, noIds, time, events) {
  const lists = repartition(eligible, yesIds, noIds);
  const requiredYes = requiredCount(lists.eligible.length, spec.threshold);
  const requiredQuorum = requiredCount(lists.eligible.length, spec.quorum);
  if (requiredYes === null || requiredQuorum === null) {
    throw new Error("required count is not finite");
  }
  let status = OPEN;
  let reason = null;
  let resolvedAt = null;
  const recorded = events.slice();
  if (isPassing(lists.yes.length, requiredYes)) {
    status = PASSED;
    reason = THRESHOLD;
    resolvedAt = time;
    recorded.push({ type: RESOLVED, status: PASSED, reason: THRESHOLD, time });
  } else if (!isPossible(lists.yes.length, lists.pending.length, requiredYes)) {
    status = FAILED;
    reason = IMPOSSIBLE;
    resolvedAt = time;
    recorded.push({ type: RESOLVED, status: FAILED, reason: IMPOSSIBLE, time });
  }
  const state = assemble(spec, lists, requiredYes, requiredQuorum, status, reason, resolvedAt);
  return finish(state, recorded);
}

function repartition(eligible, yesIds, noIds) {
  const yesSet = toSet(yesIds);
  const noSet = toSet(noIds);
  const nextEligible = eligible.slice();
  const yes = [];
  const no = [];
  const pending = [];
  for (const id of nextEligible) {
    if (Object.hasOwn(yesSet, id)) {
      yes.push(id);
    } else if (Object.hasOwn(noSet, id)) {
      no.push(id);
    } else {
      pending.push(id);
    }
  }
  return { eligible: nextEligible, yes, no, pending };
}

function assemble(spec, lists, requiredYes, requiredQuorum, status, reason, resolvedAt) {
  return {
    status,
    reason,
    initiator: spec.initiator,
    target: spec.target,
    eligible: lists.eligible,
    yes: lists.yes,
    no: lists.no,
    pending: lists.pending,
    start: normalizeZero(spec.start),
    duration: normalizeZero(spec.duration),
    end: normalizeZero(spec.end),
    threshold: spec.threshold,
    quorum: spec.quorum,
    targetCanVote: spec.targetCanVote,
    initiatorCountsAsYes: spec.initiatorCountsAsYes,
    requiredYes,
    requiredQuorum,
    resolvedAt: resolvedAt === null ? null : normalizeZero(resolvedAt)
  };
}

function removeId(ids, id) {
  const next = [];
  for (const candidate of ids) {
    if (candidate !== id) {
      next.push(candidate);
    }
  }
  return next;
}

function finish(state, events) {
  const error = validateVote(state);
  if (error !== null) {
    throw new Error(error.message);
  }
  return success(state, events);
}

function unchanged(state) {
  return Object.freeze({
    ok: true,
    state,
    events: Object.freeze([])
  });
}

function success(state, events) {
  const frozenEvents = [];
  for (const event of events) {
    frozenEvents.push(Object.freeze({ ...event }));
  }
  return Object.freeze({
    ok: true,
    state: freezeVote(state),
    events: Object.freeze(frozenEvents)
  });
}

function failure(error, state) {
  const body = {
    ok: false,
    error: Object.freeze({ type: error.type, message: error.message })
  };
  if (state !== undefined) {
    body.state = state;
  }
  return Object.freeze(body);
}

function freezeVote(vote) {
  Object.freeze(vote.eligible);
  Object.freeze(vote.yes);
  Object.freeze(vote.no);
  Object.freeze(vote.pending);
  return Object.freeze(vote);
}

function failRead(error) {
  return { error, value: null };
}

function unitFraction(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 1;
}
