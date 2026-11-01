import {
  COOLDOWN,
  DISTINCT,
  END,
  FAILED,
  HISTORY,
  INITIATOR,
  MOOT,
  OPTIONS,
  PASSED,
  TARGET
} from "./constants.js";
import { isId, isObject, normalizeZero, readFinite } from "./shape.js";

const DISTINCT_MESSAGE = "initiator and target must be different players";
const PASSED_STATUS = PASSED;
const FAILED_STATUS = FAILED;
const MOOT_STATUS = MOOT;

export function voteCooldown(options) {
  const read = readCooldown(options);
  if (read.error !== null) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({ type: read.error.type, message: read.error.message })
    });
  }
  let initiatorReadyAt = null;
  let targetReadyAt = null;
  for (const entry of read.history) {
    if (entry.initiator === read.initiator) {
      const at = readyAt(entry.resolvedAt, read.initiatorCooldown[entry.status]);
      if (at === null) {
        return readyError();
      }
      initiatorReadyAt = later(initiatorReadyAt, at);
    }
    if (entry.target === read.target) {
      const at = readyAt(entry.resolvedAt, read.targetCooldown[entry.status]);
      if (at === null) {
        return readyError();
      }
      targetReadyAt = later(targetReadyAt, at);
    }
  }
  return Object.freeze({
    ok: true,
    cooldown: Object.freeze({
      initiatorReadyAt,
      targetReadyAt,
      readyAt: later(initiatorReadyAt, targetReadyAt)
    })
  });
}

function readCooldown(options) {
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
  const history = readHistory(options);
  if (history.error !== null) {
    return history;
  }
  const initiatorCooldown = readDurations(options, "initiatorCooldown");
  if (initiatorCooldown.error !== null) {
    return initiatorCooldown;
  }
  const targetCooldown = readDurations(options, "targetCooldown");
  if (targetCooldown.error !== null) {
    return targetCooldown;
  }
  return {
    error: null,
    initiator: options.initiator,
    target: options.target,
    history: history.value,
    initiatorCooldown: initiatorCooldown.value,
    targetCooldown: targetCooldown.value
  };
}

function readHistory(options) {
  if (!Object.hasOwn(options, "history") || !Array.isArray(options.history)) {
    return failRead({ type: HISTORY, message: "history must be an array" });
  }
  const entries = [];
  for (const entry of options.history) {
    const read = readEntry(entry);
    if (read.error !== null) {
      return read;
    }
    entries.push(read.value);
  }
  return { error: null, value: entries };
}

function readEntry(entry) {
  if (!isObject(entry)) {
    return failRead({ type: HISTORY, message: "history entry must be an object" });
  }
  if (!Object.hasOwn(entry, "initiator") || !isId(entry.initiator)) {
    return failRead({ type: HISTORY, message: "history initiator must be a non-empty string" });
  }
  if (!Object.hasOwn(entry, "target") || !isId(entry.target)) {
    return failRead({ type: HISTORY, message: "history target must be a non-empty string" });
  }
  if (entry.initiator === entry.target) {
    return failRead({
      type: HISTORY,
      message: "history initiator and target must be different players"
    });
  }
  if (
    !Object.hasOwn(entry, "status") ||
    (entry.status !== PASSED_STATUS &&
      entry.status !== FAILED_STATUS &&
      entry.status !== MOOT_STATUS)
  ) {
    return failRead({ type: HISTORY, message: "history status must be passed, failed, or moot" });
  }
  if (!Object.hasOwn(entry, "resolvedAt")) {
    return failRead({ type: HISTORY, message: "history resolvedAt must be a finite number" });
  }
  const resolvedAt = readFinite(entry.resolvedAt);
  if (resolvedAt === null) {
    return failRead({ type: HISTORY, message: "history resolvedAt must be a finite number" });
  }
  return {
    error: null,
    value: {
      initiator: entry.initiator,
      target: entry.target,
      status: entry.status,
      resolvedAt
    }
  };
}

function readDurations(options, key) {
  if (!Object.hasOwn(options, key) || !isObject(options[key])) {
    return failRead({ type: COOLDOWN, message: key + " must be an object" });
  }
  const source = options[key];
  const passed = readDuration(source, key, "passed");
  if (passed.error !== null) {
    return passed;
  }
  const failed = readDuration(source, key, "failed");
  if (failed.error !== null) {
    return failed;
  }
  const moot = readDuration(source, key, "moot");
  if (moot.error !== null) {
    return moot;
  }
  return {
    error: null,
    value: {
      passed: passed.value,
      failed: failed.value,
      moot: moot.value
    }
  };
}

function readDuration(source, key, status) {
  if (!Object.hasOwn(source, status)) {
    return failRead({ type: COOLDOWN, message: durationMessage(key, status) });
  }
  const value = readFinite(source[status]);
  if (value === null || value < 0) {
    return failRead({ type: COOLDOWN, message: durationMessage(key, status) });
  }
  return { error: null, value };
}

function durationMessage(key, status) {
  return key + "." + status + " must be a finite number greater than or equal to 0";
}

function readyAt(resolvedAt, duration) {
  const sum = resolvedAt + duration;
  if (!Number.isFinite(sum)) {
    return null;
  }
  return normalizeZero(sum);
}

function later(left, right) {
  if (left === null) {
    return right;
  }
  if (right === null) {
    return left;
  }
  if (left > right) {
    return left;
  }
  return right;
}

function readyError() {
  return Object.freeze({
    ok: false,
    error: Object.freeze({ type: END, message: "ready time must be a finite number" })
  });
}

function failRead(error) {
  return { error };
}
