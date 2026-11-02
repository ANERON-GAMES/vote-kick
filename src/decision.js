import { QUORUM, SHORTFALL } from "./constants.js";

export function requiredCount(eligibleCount, fraction) {
  if (eligibleCount === 0) {
    return 1;
  }
  const value = Math.ceil(eligibleCount * fraction);
  if (!Number.isFinite(value) || value < 1 || value > eligibleCount) {
    return null;
  }
  return value;
}

export function isPassing(yesCount, requiredYes) {
  return yesCount >= requiredYes;
}

export function isPossible(yesCount, pendingCount, requiredYes) {
  return yesCount + pendingCount >= requiredYes;
}

export function expiryReason(voted, requiredQuorum) {
  if (voted < requiredQuorum) {
    return QUORUM;
  }
  return SHORTFALL;
}

export function addedEnd(start, duration) {
  const sum = start + duration;
  if (!Number.isFinite(sum) || !(sum > start)) {
    return null;
  }
  if (sum === 0) {
    return 0;
  }
  return sum;
}
