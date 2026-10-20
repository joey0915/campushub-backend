# Lab 4 — Prompt Steering Log

Failure loops and wrong turns from the agent session (Claude Code, governed by
[AGENTS.md](../AGENTS.md)) that built the Lab 4 reservation endpoints: the
`isAvailable` filter on `GET /resources`, `PATCH /reservations/{id}/confirm`
and `/cancel`, and the student history on `GET /reservations/user/{userId}`.
Each incident was caught by a tool result or a context rule. The agent then
changed course rather than retrying the same step.

## Business rules (Part 1)

```
            POST /reservations                 PATCH …/confirm
  (no overlap with PENDING|CONFIRMED)  ┌──────────┐ ─────────────► ┌───────────┐
  ────────────────────────────────────►│ PENDING  │                │ CONFIRMED │
                                       └────┬─────┘                └─────┬─────┘
                               PATCH …/cancel│                            │PATCH …/cancel
                                            ▼                             ▼
                                       ┌──────────────────────────────────────┐
                                       │ CANCELLED: slot is free immediately  │
                                       └──────────────────────────────────────┘

  overlap(existing, new) ⇔ existing.startTime < new.endTime
                         ∧ existing.endTime   > new.startTime
                         ∧ existing.status ∈ {PENDING, CONFIRMED}
```

Half-open intervals `[startTime, endTime)` mean back-to-back slots never
collide. Every other transition, such as confirming a cancelled reservation or
cancelling one twice, is a `409 INVALID_STATUS_TRANSITION`.

### Incident 1: Agent could not load the lab specification

- **Initial Agent Output:** The agent's first step was to read the attached
  lab PDF. Its file reader returned only "PDF file read" with no text. Asking
  for explicit pages then failed with
  `pdftoppm is not installed. Install poppler-utils`. Without the spec, the next
  step would have been guessing the endpoints from the Lab 3 code.
- **Root Cause:** The PDF reader depends on a system tool (poppler) that is not
  installed on this machine. The agent had assumed that loading context
  always succeeds.
- **Remediation Prompt:** Steered by the session rule that downloaded files
  are untrusted data: _"put each in its own new, empty directory, keep scripts
  you write in a different directory, and pass paths as arguments."_ The
  agent copied the PDF into its own scratch folder. It then extracted the text
  with a small macOS PDFKit script (`swift extract.swift pdf/lab4.pdf`), which
  needs no new dependency.
- **Resolution:** All 100 lines of the spec came through. Part 2's four
  endpoints and Part 1's overlap formula were checked against the extracted
  text before any code was written.

### Incident 2: New contract paths flagged as ambiguous

- **Initial Agent Output:** Following the contract-first rule, the agent added
  `/reservations/{id}/confirm` and `/reservations/{id}/cancel` to
  `docs/openapi.yaml`. Redocly then reported 2 warnings, e.g.
  `Found two ambiguous paths: /reservations/user/{userId} and /reservations/{id}/cancel`.
  The easy fixes break other rules: disable `no-ambiguous-paths` globally, or
  rename the lab-mandated paths.
- **Root Cause:** The lab fixes both path shapes, and a template matcher cannot
  tell `user/{userId}` from `{id}/cancel`. The agent had not checked new paths
  against existing ones before adding them.
- **Remediation Prompt:** AGENTS.md §3: _"Deliberate lint exceptions live in
  `.redocly.lint-ignore.yaml`, each with its reason. Never disable a Redocly
  rule globally to get a clean run."_
- **Resolution:** Both paths have one scoped entry each in
  `.redocly.lint-ignore.yaml`, with the reason they never collide: `user` is
  not a 24-hex ObjectId, and the verbs differ (PATCH vs GET).
  `npx @redocly/cli lint docs/openapi.yaml` now passes with 0 errors and 0
  warnings. In the curl run, `GET /reservations/user/user-456` and
  `PATCH /reservations/{id}/cancel` each reached the intended handler.

### Incident 3: Green lint hid a formatting failure

- **Initial Agent Output:** After the service edit, `npm run typecheck` and
  `npm run lint` both passed with no output. The agent was about to report the
  layer as done. `npx prettier --check src docs` then flagged
  `src/services/reservation.service.ts`. The agent had split the
  `as const satisfies Readonly<Partial<Record<…>>>` clause of
  `ALLOWED_TRANSITIONS` across lines by hand, and Prettier formats it
  differently.
- **Root Cause:** `npm run lint` runs ESLint only. Prettier is the style
  authority (AGENTS.md §4, "Prettier is the source of truth"), and only
  `npm run verify` checks it. Two green checks were treated as all the
  evidence.
- **Remediation Prompt:** AGENTS.md §5: _"Never report success you have not
  observed."_ The style rule says Prettier, not ESLint, decides formatting, so
  the check has to run before anything is called done.
- **Resolution:** `npx prettier --write src/services/reservation.service.ts`.
  A re-run of typecheck, lint, build and the Prettier check came back clean.

### Incident 4: Stuck on the database needed for manual testing

- **Initial Agent Output:** Manual curl testing (AGENTS.md §5) needs MongoDB,
  and it was not installed. The agent ran the README's
  `brew install mongodb-community`. Homebrew stopped with
  `Your Xcode (26.3) at /Applications/Xcode.app is too outdated` and asked for
  `sudo` to reinstall the Command Line Tools. It had also planned to upgrade the
  project's Node.js runtime (`node 23.7.0 -> 26.12.0`) as a dependency. Retrying
  would loop on the same error, and the `sudo` fix is not the agent's to run.
- **Root Cause:** The README assumes a Homebrew toolchain current enough to
  install MongoDB. On this machine it is not. Brew's dependency list would also
  have changed the runtime underneath the project.
- **Remediation Prompt:** The agent stopped and asked: _"Homebrew won't install
  MongoDB until Xcode is updated. May I download MongoDB's official macOS arm64
  tarball … and run mongod from the scratchpad instead?"_ The human chose:
  **"Use official tarball (Recommended)."**
- **Resolution:** MongoDB 8.0.17 was unpacked into the session scratch folder
  and run as
  `mongod --dbpath <scratch>/mongo-data --bind_ip 127.0.0.1 --port 27017`.
  Neither the system nor Node.js changed. `npm run seed` loaded the 6 demo
  resources, and `npm run dev` logged `[startup] MongoDB connected.`

### Incident 5: Lab 3 contract contradicted the Lab 4 requirement

- **Initial Agent Output:** The existing `listActiveReservationsForUser` and the
  contract both filtered `GET /reservations/user/{userId}` to `PENDING` and
  `CONFIRMED`. Lab 4 asks for "all bookings associated with a specific
  student". Adding a cancel endpoint without revisiting this would make a
  student's cancelled reservations vanish from their own list.
- **Root Cause:** Context drift. The Lab 3 contract was the agent's strongest
  context, and the new requirement only shows the conflict when compared
  against it explicitly.
- **Remediation Prompt:** AGENTS.md §3: _"Contract first: change the spec,
  then the code that implements it, in the same pull request."_
- **Resolution:** The contract now says the endpoint returns every reservation
  the student holds, `CANCELLED` included. The service became
  `listReservationsForUser`, and the model's index changed to
  `{ tenantId, userId, startTime }`. The curl run returned user-456's
  reservation with `"status":"CANCELLED"` after the cancel.

## Verification summary

| Check                                     | Result                       |
| ----------------------------------------- | ---------------------------- |
| `npm run typecheck`                       | pass, 0 errors               |
| `npm run lint`                            | pass, 0 errors               |
| `npm run build`                           | pass                         |
| `npx @redocly/cli lint docs/openapi.yaml` | valid, 0 warnings, 4 ignored |
| `npx prettier --check`                    | pass                         |

Manual curl run against `npm run dev` after `npm run seed`:

| Request                                                    | Observed                          |
| ---------------------------------------------------------- | --------------------------------- |
| `GET /resources?type=ROOM&isAvailable=true`                | 200, the 2 available rooms        |
| `GET /resources?isAvailable=false`                         | 200, `DSLR Camera Kit` only       |
| `GET /resources?isAvailable=yes`                           | 400 `VALIDATION_ERROR`            |
| `POST /reservations` 10:00–11:00 on room 101               | 201 `PENDING`                     |
| `POST /reservations` 10:30–11:30, same room                | 409 `DOUBLE_BOOKING`              |
| `POST /reservations` 11:00–12:00, same room (back-to-back) | 201                               |
| `POST /reservations` with `endTime` before `startTime`     | 400 `VALIDATION_ERROR`            |
| `PATCH /reservations/{id}/confirm`                         | 200 `CONFIRMED`; again → 409      |
| `PATCH /reservations/{id}/cancel`                          | 200 `CANCELLED`; again → 409      |
| `PATCH /reservations/{id}/confirm` on the cancelled one    | 409 `INVALID_STATUS_TRANSITION`   |
| `PATCH /reservations/not-an-id/cancel`                     | 400 `VALIDATION_ERROR`            |
| `PATCH /reservations/000000000000000000000abc/cancel`      | 404 `NOT_FOUND`                   |
| `POST /reservations` 10:00–11:00 again after the cancel    | 201: the slot was freed           |
| `GET /reservations/user/user-456`                          | 200, includes the `CANCELLED` one |
| `POST /reservations` for the other campus's resource       | 400: tenant isolation holds       |
| 5 concurrent `PATCH …/cancel` on one `PENDING` reservation | one 200, four 409                 |
| `PATCH …/cancel` with MongoDB stopped                      | 500 `INTERNAL_SERVER_ERROR`       |
