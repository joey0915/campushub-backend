# Lab 7 — Dynamic Test Generation & Edge-Case Prediction Log

What one agent session (Claude Code, governed by [AGENTS.md](../AGENTS.md))
built for Lab 7: a Jest + Supertest suite on an in-memory MongoDB, adversarial
edge-case and fuzz tests, and a coverage gate. The tests found one real defect,
a double-booking race, which was then fixed in its own commit.

## Part 1: Test environment

| File                          | Role                                                                   |
| ----------------------------- | ---------------------------------------------------------------------- |
| `jest.config.ts`              | ts-jest preset, `__tests__/**/*.test.ts`, coverage gate (80% on all 4) |
| `src/test/global-setup.ts`    | Starts one `MongoMemoryServer`, exports its URI as `MONGODB_URI`       |
| `src/test/setup.ts`           | Per test file: own database, emptied after each test, dropped at end   |
| `src/test/global-teardown.ts` | Stops the server                                                       |
| `src/test/fixtures.ts`        | Seeds resources and reservations through the models                    |
| `src/test/contract-guards.ts` | Narrows Supertest's `any` body to the contract types (no casts)        |
| `tsconfig.build.json`         | `npm run build` excludes tests, so nothing test-only reaches `dist/`   |

Dependencies: `jest`, `ts-jest`, `@types/jest`, `supertest`, `@types/supertest`,
and `mongodb-memory-server`, as root `devDependencies`. The lab requires them
and the user approved the install, so they are now in the AGENTS.md §2 table.

### Incident 1: the in-memory database refused every connection

The first `npm test` run timed out in every `beforeAll`. A probe showed
`MongoServerSelectionError: Missing required sub-document 'driver' in the
client metadata document` under Jest only; the same connection worked from plain
Node. Running both installed drivers side by side under Jest isolated it.
`mongodb@7.5.0` (mongodb-memory-server's copy) connected, and `mongodb@7.6.0`
(Mongoose's) failed. So did 7.8.0, which a trial Mongoose upgrade pulled in.
That upgrade was reverted. Driver 7.6 and later loads `os` through a dynamic
`import()`, which Jest's CommonJS sandbox rejects, so the handshake goes out
empty (upstream NODE-7832).

Fix: `connectDatabase` now passes `runtimeAdapters: { os }`. It is the same
value in production, and it keeps one connection path for the app and the
tests. Pinning the driver to 7.5 was rejected because it would downgrade
production to make tests pass. A test-only `mongoose.connect` was also
rejected, because then the tests would not exercise the real connection code.
A standalone ts-node check showed the patched `connectDatabase` still
connecting outside Jest.

### Incident 2: `process.env` outside `env.ts`

`env.ts` reads `MONGODB_URI` at import time, so the harness has to set it before
any worker loads the app. AGENTS.md §4 forbade that. The rule now names the
single exception, `src/test/global-setup.ts`, instead of the harness breaking it
silently. dotenv never overrides a variable that is already set, so a
developer's `.env` cannot point the tests at a real database.

## Part 2: Service tests — `src/services/__tests__/`

`reservation.service.test.ts` runs against the in-memory server rather than
mocks, so the overlap query is tested as MongoDB actually evaluates it.

- **Happy paths:** reserving a freshly created resource, which comes back
  `PENDING` without `tenantId`. Back-to-back slots, the same window on another
  resource, a slot freed by cancellation, confirming, and cancelling from
  `PENDING` and `CONFIRMED`.
- **Exact and 1 ms boundaries:** an exact start/end match, a 1 ms overlap at
  either end, enclosed, enclosing, and 1 ms-long windows each return 409
  `DOUBLE_BOOKING`. Touching ends and a 1 ms gap are accepted, which confirms
  the half-open interval.
- **Negative ranges:** an end before the start, a zero length, or an end 1 ms
  before the start is refused by the schema validator even when it reaches the
  service directly (defense in depth behind the controller's 400).
- **Missing resources:** an unknown `resourceId`, or another tenant's resource,
  gives `ValidationError` and nothing is persisted.
- **Tenant isolation:** another tenant's reservations neither block a slot nor
  appear in a user's list. A transition on another tenant's id is a 404 and
  changes nothing.
- **Concurrency:** two simultaneous confirms leave exactly one winner, and a
  cancel racing a confirm always ends `CANCELLED`. Both hold because
  `transitionStatus` is a single atomic update.

`resource.service.test.ts` and `health.service.test.ts` cover tenant scoping,
the out-of-enum `type` short circuit, and the `degraded` health branch.

### Finding: concurrent identical bookings double-book

Five simultaneous identical `createReservation` calls produced 2–5 reservations
for the same slot in each of 10 probe rounds. The overlap check and the insert
were two queries, so concurrent requests could all pass the check. The test
`accepts exactly one of five simultaneous identical requests` first pinned the
correct behaviour as `it.failing`, in the test commit.

**Fix (separate `fix(reservation)` commit).** Each resource now carries an
internal `bookingVersion` counter, which is never serialized. A booking:

1. reads the resource and its version;
2. checks for an overlap;
3. inserts the reservation;
4. advances the version only if it still holds the value read in step 1.

The loser of that compare-and-set deletes its own insert and retries. Because
the insert comes before the version bump, any booking that reads the new
version already sees the winner in its overlap check. So exactly one of several
concurrent bookings of a slot commits. Bookings of non-overlapping slots retry
and still succeed. Retries are capped at 25 rounds; running out means the
resource is under sustained contention, which becomes a 500 because the
contract has no 409 code for it.

Rejected alternatives:

- A MongoDB transaction needs a replica set, but local development (README)
  runs a standalone `mongod`.
- Insert-then-recheck without a counter can make both racers delete
  themselves, so neither booking succeeds.

`it.failing` became a normal `it`. New tests cover:

- six simultaneous non-overlapping bookings of one resource all committing;
- a resource stored before the counter existed;
- running out of retries, which leaves no reservation behind;
- five simultaneous HTTP POSTs giving one 201 and four 409s.

The suite ran five times in a row with no failures. Against `npm run dev` on a
standalone `mongod`, five parallel `curl` POSTs returned one `201` and four
`409 DOUBLE_BOOKING`, and the user's listing held a single reservation.

## Part 3: HTTP integration — `src/routes/__tests__/`

- `reservation.routes.test.ts` covers the following:
  - `POST /reservations`: 201 with the stored body, 409 for an exact match, a
    1 ms overlap, or an enclosing window, and 201 for a back-to-back slot.
  - 400 for each missing field and 13 malformed date-times (Feb 30, no offset,
    hour 24, epoch ms, `{ $gt: '' }`, …).
  - 400 for negative ranges (including offsets that invert the order in UTC),
    a client-sent `id`, `status`, or `tenantId`, non-object, truncated, or
    `__proto__` bodies, and an unknown resource.
  - A 500 that leaks no internals.
  - `GET /resources` with every filter combination, plus 400s for empty,
    repeated, or non-literal values.
  - The user listing, including an undecodable `%E0%A4%A`, confirm and cancel
    (200, 404, 409, and 400), and an unmatched route.
- `reservation.fuzz.test.ts` sends 150 seeded mutations of a valid payload,
  mixing hostile values, dropped fields, and injected read-only fields. Every
  response must be 201, 400, or 409 with a contract-shaped body, never a 500,
  and the run has to reach all three outcomes. The PRNG seed is fixed, so a
  failing case can be reproduced.
- `health.routes.test.ts` checks `GET /health` against the connected database.

## Coverage (`npx jest --coverage`)

```
File                        | % Stmts | % Branch | % Funcs | % Lines
All files                   |     100 |      100 |     100 |     100
 controllers                |     100 |      100 |     100 |     100
 services                   |     100 |      100 |     100 |     100
Tests: 115 passed, 115 total (6 suites)
```

The first coverage run reached 100% statements but 97.9% branches; only
`health.service.ts`'s `degraded` branch was missing. `health.service.test.ts`
was added for that branch. The threshold is enforced in `jest.config.ts`, so a
regression below 80% fails the run.

## Known noise

- Node 23 prints `ExperimentalWarning: Type Stripping` while Jest loads
  `jest.config.ts`. It is harmless and comes from Node's native TypeScript
  loading.
- dotenv 18 logs `injected env (n) from .env` when `env.ts` loads.
