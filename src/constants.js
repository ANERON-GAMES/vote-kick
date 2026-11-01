export const OPEN = "open";
export const PASSED = "passed";
export const FAILED = "failed";
export const MOOT = "moot";
export const STATUSES = Object.freeze([OPEN, PASSED, FAILED, MOOT]);

export const THRESHOLD = "threshold";
export const IMPOSSIBLE = "impossible";
export const QUORUM = "quorum";
export const SHORTFALL = "shortfall";
export const TARGET_LEFT = "target-left";
export const REASONS = Object.freeze([THRESHOLD, IMPOSSIBLE, QUORUM, SHORTFALL, TARGET_LEFT]);

export const YES = "yes";
export const NO = "no";
export const CHOICES = Object.freeze([YES, NO]);

export const CAST = "cast";
export const CHANGE = "change";
export const LEAVE = "leave";
export const TARGET_LEAVE = "target-leave";
export const TICK = "tick";
export const EVENTS = Object.freeze([CAST, CHANGE, LEAVE, TARGET_LEAVE, TICK]);

export const STARTED = "started";
export const CHANGED = "changed";
export const LEFT = "left";
export const RESOLVED = "resolved";
export const RECORDS = Object.freeze([STARTED, CAST, CHANGED, LEFT, RESOLVED]);

export const OPTIONS = "options";
export const INITIATOR = "initiator";
export const TARGET = "target";
export const DISTINCT = "distinct";
export const ELIGIBLE = "eligible";
export const TARGET_RULE = "target-rule";
export const INITIATOR_RULE = "initiator-rule";
export const START = "start";
export const DURATION = "duration";
export const END = "end";
export const FLAG = "flag";
export const VOTE = "vote";
export const EVENT = "event";
export const TIME = "time";
export const VOTER = "voter";
export const CHOICE = "choice";
export const CLOSED = "closed";
export const EARLY = "early";
export const ALREADY_VOTED = "already-voted";
export const MISSING_VOTE = "missing-vote";
export const SAME_CHOICE = "same-choice";
export const INELIGIBLE = "ineligible";
export const HISTORY = "history";
export const COOLDOWN = "cooldown";
export const ERROR_TYPES = Object.freeze([
  OPTIONS,
  INITIATOR,
  TARGET,
  DISTINCT,
  ELIGIBLE,
  TARGET_RULE,
  INITIATOR_RULE,
  START,
  DURATION,
  END,
  THRESHOLD,
  QUORUM,
  FLAG,
  VOTE,
  EVENT,
  TIME,
  VOTER,
  CHOICE,
  CLOSED,
  EARLY,
  ALREADY_VOTED,
  MISSING_VOTE,
  SAME_CHOICE,
  INELIGIBLE,
  HISTORY,
  COOLDOWN
]);
