# @aneron/vote-kick

Lobby vote-kick state machine with a threshold, a quorum, and cooldown rules.

## Purpose

`@aneron/vote-kick` tracks one vote to remove a player from a lobby or a match. The caller names the initiator, the target, the eligible voters, the start time, the duration, the pass threshold, and the minimum quorum. Players then cast yes or no, change a vote, or leave. The target leaving ends the vote as moot. A tick, or any other event at or after the end, resolves an open vote.

The vote passes as soon as the yes count reaches the threshold of the current eligible set. That pass does not wait for the quorum. The vote fails as soon as the voters who have not answered can no longer supply enough yes votes. On expiry the same threshold is already missed, because an open vote is short of it. Expiry applies the quorum: too few ballots fails for quorum, and enough ballots with too few yes votes fails for shortfall.

The caller passes the time in. Reading a vote does not move it. The package does not read a clock, start a timer, draw a random number, or open a socket. It has no runtime dependencies. Invalid input returns a typed error and does not throw.

## Install

The package is an ES module. It needs Node.js 20 or newer. It has no runtime dependencies. The package name is `@aneron/vote-kick`. It is not published to the npm registry.

Clone this repository and run the tests:

```bash
git clone https://github.com/ANERON-GAMES/vote-kick.git
cd vote-kick
npm install
npm test
```

`npm test` runs `node --test`. `npm run lint` runs ESLint. `npm run format:check` runs Prettier.

Install it as a dependency from the git repository:

```bash
npm install github:ANERON-GAMES/vote-kick
```

```js
import { applyVote, createVote, voteCooldown } from "@aneron/vote-kick";
```

Code in this repository imports the same entry point with `./src/index.js`.

## Usage

Time values below are numbers in one unit chosen by the caller. The module does not treat them as milliseconds.

Five eligible voters, a threshold of `0.6`, and a quorum of `0.8` need `3` yes votes and `4` ballots at expiry. The initiator's opening yes does not pass. The third yes passes, even though only three ballots exist and the quorum is four. Yes ids follow eligible order, not the order of the ballots.

```js
import { applyVote, createVote, voteCooldown } from "@aneron/vote-kick";

const created = createVote({
  initiator: "player-a",
  target: "player-z",
  eligible: ["player-a", "player-b", "player-c", "player-d", "player-e"],
  start: 1000,
  duration: 500,
  threshold: 0.6,
  quorum: 0.8
});

const second = applyVote(created.state, {
  type: "cast",
  voterId: "player-c",
  choice: "yes",
  time: 1100
});
const third = applyVote(second.state, {
  type: "cast",
  voterId: "player-b",
  choice: "yes",
  time: 1200
});
```

`created.ok` is `true`. `created.state.status` is `"open"`. `created.state.reason` is `null`. `created.state.resolvedAt` is `null`. `created.state.requiredYes` is `3`. `created.state.requiredQuorum` is `4`. `created.state.end` is `1500`. `created.state.targetCanVote` is `false`. `created.state.initiatorCountsAsYes` is `true`. `created.state.yes` is `["player-a"]`. `created.state.no` is `[]`. `created.state.pending` is `["player-b", "player-c", "player-d", "player-e"]`.

`second.state.status` is `"open"`. `second.state.yes` is `["player-a", "player-c"]`. `second.state.pending` is `["player-b", "player-d", "player-e"]`.

`third.ok` is `true`. `third.state.status` is `"passed"`. `third.state.reason` is `"threshold"`. `third.state.resolvedAt` is `1200`. `third.state.yes` is `["player-a", "player-b", "player-c"]`. `third.state.no` is `[]`. `third.state.pending` is `["player-d", "player-e"]`. `second.state.status` is still `"open"`.

`third.events` is the cast from `player-b`, then a resolved record with status `"passed"`, reason `"threshold"`, and time `1200`.

Three no votes on the same roster make a pass impossible on the third no. The threshold is `0.6`, so three yes votes are required. One yes and one pending voter are not enough.

```js
const losing = createVote({
  initiator: "player-a",
  target: "player-z",
  eligible: ["player-a", "player-b", "player-c", "player-d", "player-e"],
  start: 0,
  duration: 100,
  threshold: 0.6,
  quorum: 0.2
});
const firstNo = applyVote(losing.state, {
  type: "cast",
  voterId: "player-b",
  choice: "no",
  time: 10
});
const secondNo = applyVote(firstNo.state, {
  type: "cast",
  voterId: "player-e",
  choice: "no",
  time: 20
});
const thirdNo = applyVote(secondNo.state, {
  type: "cast",
  voterId: "player-c",
  choice: "no",
  time: 30
});
```

`losing.state.requiredYes` is `3`. `losing.state.requiredQuorum` is `1`. `secondNo.state.status` is `"open"`. `thirdNo.state.status` is `"failed"`. `thirdNo.state.reason` is `"impossible"`. `thirdNo.state.resolvedAt` is `30`. `thirdNo.state.yes` is `["player-a"]`. `thirdNo.state.no` is `["player-b", "player-c", "player-e"]`. `thirdNo.state.pending` is `["player-d"]`.

A tick at the end fails for quorum when fewer than `requiredQuorum` ballots were cast. The lists do not move. Players who have not voted stay pending.

```js
const voted = applyVote(created.state, {
  type: "cast",
  voterId: "player-b",
  choice: "no",
  time: 1100
});
const expired = applyVote(voted.state, { type: "tick", time: 1500 });
```

`voted.state.status` is `"open"`. `expired.state.status` is `"failed"`. `expired.state.reason` is `"quorum"`. `expired.state.resolvedAt` is `1500`. `expired.state.yes` is `["player-a"]`. `expired.state.no` is `["player-b"]`. `expired.state.pending` is `["player-c", "player-d", "player-e"]`.

A quorum of `0.4` on five voters needs `2` ballots. Two yes votes and two no votes meet that quorum and stay short of three yes votes. The tick fails for shortfall.

```js
const room = createVote({
  initiator: "player-a",
  target: "player-z",
  eligible: ["player-a", "player-b", "player-c", "player-d", "player-e"],
  start: 0,
  duration: 100,
  threshold: 0.6,
  quorum: 0.4
});
const yes = applyVote(room.state, { type: "cast", voterId: "player-b", choice: "yes", time: 10 });
const no = applyVote(yes.state, { type: "cast", voterId: "player-c", choice: "no", time: 20 });
const another = applyVote(no.state, { type: "cast", voterId: "player-d", choice: "no", time: 30 });
const timed = applyVote(another.state, { type: "tick", time: 100 });
```

`room.state.requiredYes` is `3`. `room.state.requiredQuorum` is `2`. `another.state.status` is `"open"`. `timed.state.status` is `"failed"`. `timed.state.reason` is `"shortfall"`. `timed.state.resolvedAt` is `100`. `timed.state.yes` is `["player-a", "player-b"]`. `timed.state.no` is `["player-c", "player-d"]`. `timed.state.pending` is `["player-e"]`.

A threshold of `0.4` on two voters needs one yes vote. The initiator's opening yes passes at `start`. The quorum is `1`, so expiry would have required both ballots, and expiry is not reached.

```js
const quick = createVote({
  initiator: "player-a",
  target: "player-z",
  eligible: ["player-a", "player-b"],
  start: 0,
  duration: 30,
  threshold: 0.4,
  quorum: 1
});
```

`quick.state.status` is `"passed"`. `quick.state.reason` is `"threshold"`. `quick.state.resolvedAt` is `0`. `quick.state.requiredYes` is `1`. `quick.state.requiredQuorum` is `2`. `quick.state.yes` is `["player-a"]`. `quick.state.pending` is `["player-b"]`.

A leave drops the required yes count with the eligible set. Three voters at `0.4` need `2` yes votes. After one pending voter leaves, two voters need `1` yes vote, and the initiator's yes passes.

```js
const small = createVote({
  initiator: "player-a",
  target: "player-z",
  eligible: ["player-a", "player-b", "player-c"],
  start: 0,
  duration: 50,
  threshold: 0.4,
  quorum: 0.4
});
const shrunk = applyVote(small.state, { type: "leave", voterId: "player-b", time: 15 });
```

`small.state.requiredYes` is `2`. `small.state.status` is `"open"`. `shrunk.state.status` is `"passed"`. `shrunk.state.reason` is `"threshold"`. `shrunk.state.resolvedAt` is `15`. `shrunk.state.requiredYes` is `1`. `shrunk.state.eligible` is `["player-a", "player-c"]`. `shrunk.state.yes` is `["player-a"]`. `shrunk.state.pending` is `["player-c"]`.

The target leaving before the end ends the vote as moot. The eligible list stays as it was.

```js
const moot = applyVote(room.state, { type: "target-leave", time: 40 });
```

`moot.state.status` is `"moot"`. `moot.state.reason` is `"target-left"`. `moot.state.resolvedAt` is `40`. `moot.state.eligible` is `["player-a", "player-b", "player-c", "player-d", "player-e"]`. `moot.state.yes` is `["player-a"]`. `room.state.status` is still `"open"`.

A tick at `start` changes nothing and returns the same state. A cast at `end` does not record the ballot. It resolves the open vote. A cast after a pass is refused and returns the same state.

```js
const waiting = applyVote(created.state, { type: "tick", time: 1000 });
const late = applyVote(created.state, {
  type: "cast",
  voterId: "player-b",
  choice: "yes",
  time: 1500
});
const closed = applyVote(third.state, {
  type: "cast",
  voterId: "player-d",
  choice: "yes",
  time: 1300
});
```

`waiting.ok` is `true`. `waiting.state` is `created.state`. `waiting.events` is `[]`. `late.state.status` is `"failed"`. `late.state.reason` is `"quorum"`. `late.state.resolvedAt` is `1500`. `late.state.yes` is `["player-a"]`. `late.state.pending` is `["player-b", "player-c", "player-d", "player-e"]`. `closed.ok` is `false`. `closed.error.type` is `"closed"`. `closed.error.message` is `"vote is closed"`. `closed.state` is `third.state`.

`voteCooldown` reads past results. It does not start a vote. A passed vote at time `1200` and a failed vote at time `30` use the durations below. The initiator is ready at `1500`. The target is ready at `1200`. The pair is ready at the later of those times.

```js
const window = voteCooldown({
  initiator: "player-a",
  target: "player-z",
  history: [third.state, thirdNo.state],
  initiatorCooldown: { passed: 300, failed: 120, moot: 0 },
  targetCooldown: { passed: 0, failed: 240, moot: 0 }
});
```

`window.ok` is `true`. `window.cooldown.initiatorReadyAt` is `1500`. `window.cooldown.targetReadyAt` is `1200`. `window.cooldown.readyAt` is `1500`.

## API

`createVote`, `applyVote`, and `voteCooldown` are deterministic. They do not read the clock, the network, or the filesystem. They do not mutate their arguments. A call that changes a vote returns a new state. A call that refuses the event, and a tick inside the window, return the same state reference.

`start`, `duration`, `end`, `time`, `resolvedAt`, and cooldown times share one unit. The module does not convert milliseconds, ticks, or seconds. Comparison is ordinary IEEE-754 with no epsilon. `time >= end` means the vote has expired. `time === end` has expired. `time === start` is inside the window. A negative time is allowed. `-0` is stored as `0` on values this module writes, and `-0` compares equal to `0`.

The module does not require `time` to increase from one call to the next. A later call may pass an earlier finite time. The call is outside the window only when that time is below `start` or at or above `end`.

A success result is frozen.

| Field    | Type    | Meaning                                                    |
| -------- | ------- | ---------------------------------------------------------- |
| `ok`     | boolean | `true`.                                                    |
| `state`  | object  | The next vote, or the same reference when nothing changes. |
| `events` | array   | Records written by this call. Empty when nothing changes.  |

An error result is frozen. `error` is frozen. `events` is omitted. `state` is omitted when the vote itself is invalid, and when `createVote` or `voteCooldown` rejects its options. `applyVote` includes `state` when the vote is valid and the event is refused. That `state` is the same reference.

| Field   | Type    | Meaning                                           |
| ------- | ------- | ------------------------------------------------- |
| `ok`    | boolean | `false`.                                          |
| `error` | object  | `{ type, message }`. `type` is a stable code.     |
| `state` | object  | Present only for a refused event on a valid vote. |

`voteCooldown` success has `ok` and `cooldown`. It has no `state` and no `events`.

### Constants

| Export         | Value              | Meaning                                                                       |
| -------------- | ------------------ | ----------------------------------------------------------------------------- |
| `OPEN`         | `"open"`           | Status. The vote can still take ballots.                                      |
| `PASSED`       | `"passed"`         | Status. The yes count reached the threshold before the end.                   |
| `FAILED`       | `"failed"`         | Status. The vote cannot pass, or the clock expired.                           |
| `MOOT`         | `"moot"`           | Status. The target left before the end.                                       |
| `STATUSES`     | four strings       | Frozen list: `open`, `passed`, `failed`, `moot`.                              |
| `THRESHOLD`    | `"threshold"`      | Pass reason. Also the error code for a bad threshold number.                  |
| `IMPOSSIBLE`   | `"impossible"`     | Fail reason. The remaining voters cannot reach the yes count.                 |
| `QUORUM`       | `"quorum"`         | Fail reason. Also the error code for a bad quorum number.                     |
| `SHORTFALL`    | `"shortfall"`      | Fail reason. Expiry with enough ballots and too few yes votes.                |
| `TARGET_LEFT`  | `"target-left"`    | Moot reason.                                                                  |
| `REASONS`      | five strings       | Frozen list: `threshold`, `impossible`, `quorum`, `shortfall`, `target-left`. |
| `YES`          | `"yes"`            | Choice.                                                                       |
| `NO`           | `"no"`             | Choice.                                                                       |
| `CHOICES`      | `["yes", "no"]`    | Frozen choice list.                                                           |
| `CAST`         | `"cast"`           | Input event and recorded event.                                               |
| `CHANGE`       | `"change"`         | Input event.                                                                  |
| `LEAVE`        | `"leave"`          | Input event.                                                                  |
| `TARGET_LEAVE` | `"target-leave"`   | Input event.                                                                  |
| `TICK`         | `"tick"`           | Input event.                                                                  |
| `EVENTS`       | five strings       | Frozen input list: `cast`, `change`, `leave`, `target-leave`, `tick`.         |
| `STARTED`      | `"started"`        | Recorded event.                                                               |
| `CHANGED`      | `"changed"`        | Recorded event.                                                               |
| `LEFT`         | `"left"`           | Recorded event.                                                               |
| `RESOLVED`     | `"resolved"`       | Recorded event.                                                               |
| `RECORDS`      | five strings       | Frozen record list: `started`, `cast`, `changed`, `left`, `resolved`.         |
| `ERROR_TYPES`  | twenty-six strings | Frozen error-code list, in the order documented under Errors.                 |

The other exports are the error codes in `ERROR_TYPES`: `options`, `initiator`, `target`, `distinct`, `eligible`, `target-rule`, `initiator-rule`, `start`, `duration`, `end`, `threshold`, `quorum`, `flag`, `vote`, `event`, `time`, `voter`, `choice`, `closed`, `early`, `already-voted`, `missing-vote`, `same-choice`, `ineligible`, `history`, and `cooldown`. `THRESHOLD` and `QUORUM` are both reasons and error codes. `TARGET` is the error code for a bad target id and for a leave event that names the target.

### Vote

The object in `state`.

| Field                  | Type             | Meaning                                                             |
| ---------------------- | ---------------- | ------------------------------------------------------------------- |
| `status`               | string           | `OPEN`, `PASSED`, `FAILED`, or `MOOT`.                              |
| `reason`               | string or `null` | `null` while open. A reason after resolution.                       |
| `initiator`            | string           | Player who started the vote.                                        |
| `target`               | string           | Player the vote would remove.                                       |
| `eligible`             | array            | Current voters, in the order passed to `createVote`, minus leavers. |
| `yes`                  | array            | Eligible ids who voted yes, in eligible order.                      |
| `no`                   | array            | Eligible ids who voted no, in eligible order.                       |
| `pending`              | array            | Eligible ids who have not voted, in eligible order.                 |
| `start`                | number           | Finite start. A written vote stores `-0` as `0`.                    |
| `duration`             | number           | Finite duration greater than `0`.                                   |
| `end`                  | number           | `start + duration`, and greater than `start`.                       |
| `threshold`            | number           | Pass fraction in `(0, 1]`.                                          |
| `quorum`               | number           | Minimum ballot fraction in `(0, 1]`.                                |
| `targetCanVote`        | boolean          | Whether the target is an eligible voter.                            |
| `initiatorCountsAsYes` | boolean          | Whether creation recorded a yes for the initiator.                  |
| `requiredYes`          | number           | Yes votes needed to pass.                                           |
| `requiredQuorum`       | number           | Ballots needed to avoid a quorum failure at expiry.                 |
| `resolvedAt`           | number or `null` | `null` while open. Otherwise the `time` of the resolving call.      |

`yes`, `no`, and `pending` partition `eligible`. Each id is in exactly one list. Each list follows eligible order.

`requiredYes` is `Math.ceil(eligible.length * threshold)` when `eligible` is not empty. `requiredQuorum` uses `quorum` the same way. An empty eligible set stores both required counts as `1`, which an empty tally cannot meet.

An open vote has `reason === null`, `resolvedAt === null`, at least one eligible voter, `yes.length < requiredYes`, and `yes.length + pending.length >= requiredYes`.

A passed vote has reason `threshold`, `start <= resolvedAt < end`, at least one eligible voter, and `yes.length >= requiredYes`. The quorum may be unmet. One yes can pass a two-voter vote when the threshold ceiling is `1`.

An impossible failure has reason `impossible`, `start <= resolvedAt < end`, and `yes.length + pending.length < requiredYes`.

A quorum failure has reason `quorum`, `resolvedAt >= end`, at least one eligible voter, `yes.length < requiredYes`, `yes.length + pending.length >= requiredYes`, and `yes.length + no.length < requiredQuorum`.

A shortfall failure has reason `shortfall`, `resolvedAt >= end`, at least one eligible voter, `yes.length < requiredYes`, `yes.length + pending.length >= requiredYes`, and `yes.length + no.length >= requiredQuorum`.

A moot vote has reason `target-left`, `start <= resolvedAt < end`, and the same count shape as an open vote.

Returned votes are frozen. The four id arrays are frozen. Do not mutate them. A new vote copies those arrays. It does not share them with the previous vote.

`createVote` does not look at a clock. A start that is already behind the caller's own clock stays `OPEN` until `applyVote` is called with a `time` at or after `end`, or with a ballot that resolves it earlier.

### `createVote(options)`

Return a new vote, or an error.

| Argument  | Type   | Role                                                                        |
| --------- | ------ | --------------------------------------------------------------------------- |
| `options` | object | Required. `null`, an array, a missing value, and any other non-object fail. |

| Field                  | Type    | Role                                                                                             |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| `initiator`            | string  | Required. A non-empty string.                                                                    |
| `target`               | string  | Required. A non-empty string, different from `initiator`.                                        |
| `eligible`             | array   | Required. A non-empty array of unique non-empty strings. Order is the eligible order.            |
| `targetCanVote`        | boolean | Optional. Omitted or `undefined` means `false`. The target is eligible only when this is `true`. |
| `initiatorCountsAsYes` | boolean | Optional. Omitted or `undefined` means `true`. The initiator must then be eligible.              |
| `start`                | number  | Required. A finite number. `-0` is stored as `0`.                                                |
| `duration`             | number  | Required. A finite number greater than `0`.                                                      |
| `threshold`            | number  | Required. A finite number greater than `0` and less than or equal to `1`.                        |
| `quorum`               | number  | Required. A finite number greater than `0` and less than or equal to `1`.                        |

`eligible` is copied. Later edits to the caller's array do not change the vote. `"__proto__"`, `"constructor"`, and `"toString"` are valid ids. Ids are not trimmed and are not case-folded. `"player-a"` and `"player-A"` are different players. A string of one space is a valid id.

Unknown fields on `options` are ignored.

`end` is `start + duration`. The sum must be finite and greater than `start`. `1e20 + 1` is not greater than `1e20` in IEEE-754, and that pair is rejected. The stored `end` is that sum. `0.1 + 0.2` is stored as `0.30000000000000004`.

The required counts use IEEE-754 multiplication and `Math.ceil`. Examples:

| Eligible | Fraction | Product        | Required |
| -------- | -------- | -------------- | -------- |
| `2`      | `0.1`    | `0.2`          | `1`      |
| `3`      | `0.5`    | `1.5`          | `2`      |
| `4`      | `0.5`    | `2`            | `2`      |
| `4`      | `0.75`   | `3`            | `3`      |
| `5`      | `0.6`    | `3`            | `3`      |
| `7`      | `0.3`    | `7 * 0.3`      | `3`      |
| `10`     | `1 / 3`  | `10 * (1 / 3)` | `4`      |

`ceil(7 * 0.3)` is `3`. `ceil(10 * (1 / 3))` is `4`. A fraction of `1` requires every current voter.

When `initiatorCountsAsYes` is `true`, the opening state includes that yes and the events include a cast at `start`. If that yes meets `requiredYes`, the vote is created already passed, with `resolvedAt` equal to `start`. When the flag is `false`, the initiator starts pending if they are eligible, and the only opening event is `started`.

Fields are read in this order: `initiator`, `target`, the distinct pair, `eligible`, `targetCanVote`, `initiatorCountsAsYes`, the target-membership rule, the initiator-membership rule, `start`, `duration`, the sum, `threshold`, `quorum`. The first failure returns. It does not throw.

| `error.type`     | Message                                                                        |
| ---------------- | ------------------------------------------------------------------------------ |
| `options`        | `options must be an object`                                                    |
| `initiator`      | `initiator must be a non-empty string`                                         |
| `target`         | `target must be a non-empty string`                                            |
| `distinct`       | `initiator and target must be different players`                               |
| `eligible`       | `eligible must be a non-empty array`                                           |
| `eligible`       | `player id must be a non-empty string`                                         |
| `eligible`       | `player ids must be unique`                                                    |
| `flag`           | `targetCanVote must be a boolean`                                              |
| `flag`           | `initiatorCountsAsYes must be a boolean`                                       |
| `target-rule`    | `target must be eligible when the target can vote`                             |
| `target-rule`    | `target must not be eligible when the target cannot vote`                      |
| `initiator-rule` | `initiator must be eligible when the initiator counts as yes`                  |
| `start`          | `start must be a finite number`                                                |
| `duration`       | `duration must be a finite number greater than 0`                              |
| `end`            | `end must be a finite number greater than start`                               |
| `threshold`      | `threshold must be a finite number greater than 0 and less than or equal to 1` |
| `quorum`         | `quorum must be a finite number greater than 0 and less than or equal to 1`    |

### `applyVote(vote, event)`

Apply one event, or refuse it.

| Argument | Type   | Role                                                                                                     |
| -------- | ------ | -------------------------------------------------------------------------------------------------------- |
| `vote`   | object | A vote. A value returned by this module passes. A hand-built object passes when it meets the invariants. |
| `event`  | object | One input event. Unknown fields are ignored.                                                             |

| `type`           | Fields                                           |
| ---------------- | ------------------------------------------------ |
| `"cast"`         | `voterId`, `choice` of `"yes"` or `"no"`, `time` |
| `"change"`       | `voterId`, `choice`, `time`                      |
| `"leave"`        | `voterId`, `time`                                |
| `"target-leave"` | `time`                                           |
| `"tick"`         | `time`                                           |

The checks run in this order. The first match wins.

1. The vote is validated. A bad vote returns `error.type` `"vote"` and no `state`.
2. The event is validated. A bad event returns an error and the same vote.
3. `status` is not `OPEN`. The error is `closed`. This wins over an early time, an expired time, an unknown voter, and a duplicate.
4. `time < start`. The error is `early`. The ballot is not recorded.
5. `time >= end`. The call resolves the vote. The ballot, the leave, and the target leave are not recorded. A cast at the end does not add that voter.
6. `tick` returns the same vote and an empty event list.
7. `target-leave` sets status `moot`, reason `target-left`, and `resolvedAt` to `time`. The tally is copied and not changed.
8. `leave` of the target returns `target`, whether or not the target is eligible. The caller sends `target-leave` for that player.
9. `cast` or `change` or `leave` of an id outside `eligible` returns `ineligible`.
10. `cast` of a voter already in `yes` or `no` returns `already-voted`.
11. `change` of a voter still pending returns `missing-vote`.
12. `change` to the choice they already hold returns `same-choice`.
13. The tally is updated in eligible order, then the pass and impossible tests run.

A `cast` appends that choice. A `change` moves the voter from one choice to the other. A `leave` removes the voter from `eligible` and from the tally, then recomputes `requiredYes` and `requiredQuorum` from the new length. The initiator flag stays as it was when that initiator leaves. Their yes is removed with them.

After the tally change:

1. `yes.length >= requiredYes`. The status is `passed`, the reason is `threshold`, and `resolvedAt` is `time`.
2. `yes.length + pending.length < requiredYes`. The status is `failed`, the reason is `impossible`, and `resolvedAt` is `time`.
3. Otherwise the status stays `open`.

Expiry uses the counts already on the vote:

1. `yes.length + no.length < requiredQuorum`. The reason is `quorum`.
2. Otherwise the reason is `shortfall`.

Both expiry results have status `failed` and `resolvedAt` equal to the event time. Pending ids stay pending.

Event fields are read in this order: object, `type`, `time`, `voterId`, `choice`. `tick` and `target-leave` stop after `time`. `leave` stops after `voterId`.

| `error.type`    | Message                                                         |
| --------------- | --------------------------------------------------------------- |
| `event`         | `event must be an object`                                       |
| `event`         | `event type must be cast, change, leave, target-leave, or tick` |
| `time`          | `time must be a finite number`                                  |
| `voter`         | `voter id must be a non-empty string`                           |
| `choice`        | `choice must be yes or no`                                      |
| `closed`        | `vote is closed`                                                |
| `early`         | `time is before the start`                                      |
| `ineligible`    | `voter must be eligible`                                        |
| `already-voted` | `voter has already cast a vote`                                 |
| `missing-vote`  | `voter has not cast a vote`                                     |
| `same-choice`   | `choice must change`                                            |
| `target`        | `target leaves with a target-leave event`                       |

### Records

Each object in `events` is frozen. The array is frozen.

| `type`     | Fields                      | When                                                       |
| ---------- | --------------------------- | ---------------------------------------------------------- |
| `started`  | `time`                      | `createVote`, at `start`.                                  |
| `cast`     | `voterId`, `choice`, `time` | A new yes or no, including the opening yes.                |
| `changed`  | `voterId`, `choice`, `time` | A vote moved to the other choice. `choice` is the new one. |
| `left`     | `voterId`, `time`           | An eligible voter left.                                    |
| `resolved` | `status`, `reason`, `time`  | The call passed, failed, or ended moot.                    |

A resolving ballot emits the action record, then `resolved`. Expiry and target leave emit only `resolved`. Creation emits `started`, then `cast` when the initiator counts as yes, then `resolved` when that yes passes.

### Errors on a malformed vote

`applyVote` validates the vote before the event. A vote returned by this module passes, including one rebuilt with `JSON.parse(JSON.stringify(vote))`. A hand-built object that breaks the shape returns `error.type` `"vote"`. The first failure wins, in the order below. The message is the whole text.

| Message                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vote must be an object`                                                                                                                                                                                       |
| `vote fields must be status, reason, initiator, target, eligible, yes, no, pending, start, duration, end, threshold, quorum, targetCanVote, initiatorCountsAsYes, requiredYes, requiredQuorum, and resolvedAt` |
| `status must be open, passed, failed, or moot`                                                                                                                                                                 |
| `initiator must be a non-empty string`                                                                                                                                                                         |
| `target must be a non-empty string`                                                                                                                                                                            |
| `initiator and target must be different players`                                                                                                                                                               |
| `eligible must be an array`                                                                                                                                                                                    |
| `player id must be a non-empty string`                                                                                                                                                                         |
| `player ids must be unique`                                                                                                                                                                                    |
| `yes must be an array`                                                                                                                                                                                         |
| `yes must contain player ids`                                                                                                                                                                                  |
| `no must be an array`                                                                                                                                                                                          |
| `no must contain player ids`                                                                                                                                                                                   |
| `pending must be an array`                                                                                                                                                                                     |
| `pending must contain player ids`                                                                                                                                                                              |
| `player lists must partition eligible in eligible order`                                                                                                                                                       |
| `targetCanVote must be a boolean`                                                                                                                                                                              |
| `initiatorCountsAsYes must be a boolean`                                                                                                                                                                       |
| `target must be eligible when the target can vote`                                                                                                                                                             |
| `target must not be eligible when the target cannot vote`                                                                                                                                                      |
| `start must be a finite number`                                                                                                                                                                                |
| `duration must be a finite number greater than 0`                                                                                                                                                              |
| `end must be a finite number greater than start`                                                                                                                                                               |
| `end must equal start plus duration`                                                                                                                                                                           |
| `threshold must be a finite number greater than 0 and less than or equal to 1`                                                                                                                                 |
| `quorum must be a finite number greater than 0 and less than or equal to 1`                                                                                                                                    |
| `requiredYes must match the eligible count and the threshold`                                                                                                                                                  |
| `requiredQuorum must match the eligible count and the quorum`                                                                                                                                                  |
| `reason must be null while the vote is open`                                                                                                                                                                   |
| `resolvedAt must be null while the vote is open`                                                                                                                                                               |
| `an open vote must have eligible voters`                                                                                                                                                                       |
| `an open vote must be short of the required yes votes`                                                                                                                                                         |
| `an open vote must still be able to pass`                                                                                                                                                                      |
| `reason must be threshold when the vote passed`                                                                                                                                                                |
| `resolvedAt must be a finite number`                                                                                                                                                                           |
| `a passed vote must resolve at or after the start`                                                                                                                                                             |
| `a passed vote must resolve before the end`                                                                                                                                                                    |
| `a passed vote must have eligible voters`                                                                                                                                                                      |
| `a passed vote must meet the required yes votes`                                                                                                                                                               |
| `reason must be impossible, quorum, or shortfall when the vote failed`                                                                                                                                         |
| `an impossible failure must resolve at or after the start`                                                                                                                                                     |
| `an impossible failure must resolve before the end`                                                                                                                                                            |
| `an impossible failure must make passing impossible`                                                                                                                                                           |
| `a quorum failure must resolve at or after the end`                                                                                                                                                            |
| `a shortfall failure must resolve at or after the end`                                                                                                                                                         |
| `a quorum failure must have eligible voters`                                                                                                                                                                   |
| `a shortfall failure must have eligible voters`                                                                                                                                                                |
| `a quorum failure must be short of the required yes votes`                                                                                                                                                     |
| `a shortfall failure must be short of the required yes votes`                                                                                                                                                  |
| `a quorum failure must still have been able to pass`                                                                                                                                                           |
| `a shortfall failure must still have been able to pass`                                                                                                                                                        |
| `a quorum failure must be short of the quorum`                                                                                                                                                                 |
| `a shortfall failure must meet the quorum`                                                                                                                                                                     |
| `reason must be target-left when the vote is moot`                                                                                                                                                             |
| `a moot vote must resolve at or after the start`                                                                                                                                                               |
| `a moot vote must resolve before the end`                                                                                                                                                                      |
| `a moot vote must have eligible voters`                                                                                                                                                                        |
| `a moot vote must be short of the required yes votes`                                                                                                                                                          |
| `a moot vote must still have been able to pass`                                                                                                                                                                |

`resolvedAt must be a finite number` is shared by passed, failed, and moot votes. It is reported after the reason check for that status.

### `voteCooldown(options)`

Report when an initiator may start another vote and when a target may be named again.

| Field               | Type   | Role                                                                                         |
| ------------------- | ------ | -------------------------------------------------------------------------------------------- |
| `initiator`         | string | Required. The player who would start the next vote.                                          |
| `target`            | string | Required. The player who would be named. Different from `initiator`.                         |
| `history`           | array  | Required. Past results. Empty is allowed. A resolved vote from this module is a valid entry. |
| `initiatorCooldown` | object | Required. Durations `{ passed, failed, moot }`.                                              |
| `targetCooldown`    | object | Required. Durations `{ passed, failed, moot }`.                                              |

Each history entry is read for `initiator`, `target`, `status`, and `resolvedAt`. Other fields are ignored. `status` is `"passed"`, `"failed"`, or `"moot"`. `resolvedAt` is a finite number. Unknown fields on `options` and on a duration object are ignored.

A duration is a finite number greater than or equal to `0`. `-0` is stored as `0` in the arithmetic. The ready time for one entry is `resolvedAt + duration` for that status. The sum must be finite.

`initiatorReadyAt` is the latest ready time among history entries whose `initiator` is the prospective initiator. `targetReadyAt` is the latest ready time among entries whose `target` is the prospective target. A player who was a target is not blocked from initiating by that entry. A player who initiated is not blocked from being a target by that entry. Entries that match neither role are ignored. One entry can match both roles when it is the same pair.

`readyAt` is the later of `initiatorReadyAt` and `targetReadyAt`. Each of the three is `null` when no entry contributed. A caller may start when `readyAt` is `null`, or when their clock is greater than or equal to `readyAt`. This function does not take that clock.

Fields are read in this order: `initiator`, `target`, the distinct pair, `history` in array order, `initiatorCooldown` as `passed`, then `failed`, then `moot`, then `targetCooldown` in the same status order, then the sums in history order, initiator side before target side. The first failure returns.

| `error.type` | Message                                                                       |
| ------------ | ----------------------------------------------------------------------------- |
| `options`    | `options must be an object`                                                   |
| `initiator`  | `initiator must be a non-empty string`                                        |
| `target`     | `target must be a non-empty string`                                           |
| `distinct`   | `initiator and target must be different players`                              |
| `history`    | `history must be an array`                                                    |
| `history`    | `history entry must be an object`                                             |
| `history`    | `history initiator must be a non-empty string`                                |
| `history`    | `history target must be a non-empty string`                                   |
| `history`    | `history initiator and target must be different players`                      |
| `history`    | `history status must be passed, failed, or moot`                              |
| `history`    | `history resolvedAt must be a finite number`                                  |
| `cooldown`   | `initiatorCooldown must be an object`                                         |
| `cooldown`   | `initiatorCooldown.passed must be a finite number greater than or equal to 0` |
| `cooldown`   | `initiatorCooldown.failed must be a finite number greater than or equal to 0` |
| `cooldown`   | `initiatorCooldown.moot must be a finite number greater than or equal to 0`   |
| `cooldown`   | `targetCooldown must be an object`                                            |
| `cooldown`   | `targetCooldown.passed must be a finite number greater than or equal to 0`    |
| `cooldown`   | `targetCooldown.failed must be a finite number greater than or equal to 0`    |
| `cooldown`   | `targetCooldown.moot must be a finite number greater than or equal to 0`      |
| `end`        | `ready time must be a finite number`                                          |

The returned `cooldown` object is frozen.

| Field              | Type             | Meaning                                        |
| ------------------ | ---------------- | ---------------------------------------------- |
| `initiatorReadyAt` | number or `null` | Earliest time this initiator may start a vote. |
| `targetReadyAt`    | number or `null` | Earliest time this target may be named.        |
| `readyAt`          | number or `null` | Later of the two. `null` when both are `null`. |

## Design

The vote is a value. `createVote` freezes the starting value. `applyVote` either returns that same value or returns a new frozen value. The previous value stays in the state it had. A caller can keep every step. Two calls with the same vote and the same event are deep-equal. They are not the same object when the call records a change.

There is no clock inside the module, so a stored vote cannot know that time has passed until the caller passes `time`. `tick` is that observation when nobody is voting. Every other event uses the same comparison, so a late ballot cannot land ahead of the end. The time test is before the eligible test. At `time >= end` an unknown id is `quorum` or `shortfall`, and the new decision is not written. At `time < start` the error is `early`, including for an unknown id. A resolved vote stays on the reason it already has. `closed` is tested before the clock, so a later tick does not rewrite a pass, a failure, or a moot vote.

The pass test is `yes.length >= requiredYes`. It does not read the quorum. A low threshold can pass on the initiator's opening yes while `requiredQuorum` is still larger than the ballots cast. Callers that want more than that opening yes choose a threshold whose ceiling is higher, or they set `initiatorCountsAsYes` to `false`.

The impossible test is `yes.length + pending.length < requiredYes`. Pending voters are counted as able to vote yes. No votes are not. The test runs after every cast, change, and leave, using the required count for the eligible set after that event. A leave can pass the vote when the ceiling falls to the yes votes that remain. A leave can fail it when the ceiling stays above the yes votes still available. Removing the last eligible voter leaves an empty set, required counts of `1`, and an impossible failure.

Expiry does not pass. An open vote is already short of `requiredYes`, so the threshold cannot succeed at `end`. The quorum chooses the failure reason. Fewer ballots than `requiredQuorum` is `quorum`, even when the yes count is also short. Enough ballots and a short yes count is `shortfall`. Quorum is a fraction of the current eligible set, not a fixed head count. It is recomputed when someone leaves. It is not a reason the vote can fail before the end, because the voters still pending can still cast.

`targetCanVote` defaults to `false`, and the target is then forbidden in `eligible`. Set it to `true` and include the target to let them cast. Their leave is still `target-leave`. A `leave` event whose id is the target is refused, so a tally removal is not confused with the match ending. `initiatorCountsAsYes` defaults to `true`. It records one yes at `start`. It does not lock that vote. The initiator may change it, and may leave.

Reports use eligible order so the arrays depend on the set of ids, not on which ballot arrived first. `"player-b"` then `"player-a"` is stored as `["player-a", "player-b"]` when `"player-a"` stands before `"player-b"` in `eligible`. The same rule applies to `no` and `pending`.

Ids are taken as exact strings and stored in arrays. They are not used as property names on the vote, so `"__proto__"`, `"constructor"`, and `"toString"` are ordinary ids.

A vote passed back in is accepted by its shape, not by a private brand. It must have exactly the fields this module writes, and those fields must already satisfy the open, passed, failed, or moot invariants. An extra field is an error, not a silent skip. That is stricter than `createVote`, which ignores unknown option fields.

Returned arrays are copies. Editing the array that was passed to `createVote`, or editing the event object after `applyVote` returns, does not change a vote this module already returned. `JSON.parse(JSON.stringify(vote))` is a valid vote. The module does not keep a timestamp per ballot. `resolvedAt` is the time of the resolving call. `start` and `end` are the window.

`voteCooldown` does not inspect ballots. It reads the status and `resolvedAt` of finished votes. Passed, failed, and moot durations are separate for the initiator and for the target. The next vote is allowed at the later restriction. `null` means that role has no restriction in the history that was passed.

This module does not assign ids, open sockets, read the clock, schedule timers, or draw random numbers. The caller chooses the roster, the window, the fractions, the cooldowns, and the time of each call.

## License

Released under the MIT License. The full text is in [LICENSE](LICENSE).
