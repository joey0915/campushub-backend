# Lab 6 — Refactoring & Context Optimization Log

What one agent session (Claude Code, governed by [AGENTS.md](../AGENTS.md))
did to the CampusHub code from Labs 1–5: it shrank the agent's context, audited
the code for AI-generated bloat, and refactored the duplicates into shared
modules. The behaviour did not change: every 400/404/500 body is
byte-identical, and every check in AGENTS.md §5 passes.

## Part 1: Token context & ignore optimization

### Context file pruning

`CLAUDE.md` only imports `AGENTS.md`, so that is where the pruning happened
(388 lines; 18.9 KB before):

| Change                                                                    | Why                                                                                         |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Removed §8 "Quick Reference — Common Violations" (12-row table)           | Every row restated a rule from §3–§4, so the agent read each rule twice.                    |
| Dropped `axios` from the §2 "propose it first" examples                   | Stale since Lab 5: `axios` is approved for `client/`. The rule contradicted the allow-list. |
| Merged the two comment-density bullets in §4                              | Two bullets said the same thing.                                                            |
| Replaced "update the server mirror and this one together" (§3, §3a)       | Obsolete: `shared/contract.ts` is now the single declaration.                               |
| Added `errorHandler.ts` to the course-mandated naming exceptions          | Lab 6 fixes this filename, and it breaks the kebab-case rule (see Incident 1).              |
| Added a §4 "keep files small" rule and a new §8 "Context Hygiene" section | These keep the bloat from coming back and point agents at `.ignore`.                        |

### Ignore files

- **`.ignore`** is read by ripgrep (`rg`), `fd`, and `ag`. Plain `grep -r`
  and `find` do not read it, so AGENTS.md §8 tells agents to search with `rg`
  (see Incident 3). It hides `node_modules/`, `dist/`, `build/`, `coverage/`,
  `*.map`, `*.tsbuildinfo`, `*.log`/`logs/`, both `package-lock.json` files,
  the `docs/lab*-steering-log.md` history, `docs/diagrams/`, and
  `client/public/`.
- **`.cursorignore`** holds the same patterns for Cursor, which does not read
  `.ignore`.
- **`.claude/settings.json`** turns that into a hard limit for Claude Code:
  `permissions.deny` blocks `Read` of `.env`, `node_modules/`, `dist/`, and the
  lockfiles. This session hit that rule itself. An `ls dist` used to check the
  build output was refused, so the build had to be checked through `npm run
build` instead.

### Verification

What the agent's search tools can see, measured before and after the change.
Pass `--no-ignore-dot` to rg to reproduce the "before" numbers:

| Measure                         | Before   | After            |
| ------------------------------- | -------- | ---------------- |
| Searchable files                | 79       | 74               |
| Searchable bytes                | 473.6 KB | 157.1 KB (−67%)  |
| `rg tenantId` output            | 7.8 KB   | 3.7 KB (−53%)    |
| `rg tenantId` files outside src | 3 logs   | only `AGENTS.md` |

The query `rg 'useUserReservations|useReservations'` shows the risk this
removes. Before, it also matched `docs/lab5-steering-log.md`, which still uses
the hook's old name. An agent that read that log could "fix" code against an
identifier that no longer exists. After the change, every match is a live
source file or the client README.

#### Agent query

The lab asks for a real agent query, so one was run twice. Both runs used the
same Explore subagent on the same model (Haiku) and the same prompt: "Where is
`DOUBLE_BOOKING` produced on the server, and how does the client turn it into
the user's message? Start with `rg -l DOUBLE_BOOKING`." The only difference
was whether `.ignore` was present.

| Measure                               | Without `.ignore`                                  | With `.ignore` |
| ------------------------------------- | -------------------------------------------------- | -------------- |
| Files the first search returned       | 11                                                 | 8              |
| Historical or generated files in them | 3 (`lab4`/`lab6` logs, 57 KB sequence-diagram SVG) | 0              |
| Subagent tokens                       | 36,100                                             | 34,534 (−4%)   |
| Tool calls                            | 6                                                  | 6              |
| Answer correct                        | yes                                                | yes            |

The total token count barely moves. About 30k of every subagent run is fixed
overhead: a run that made almost no tool calls still used 30,341 tokens.
Taking that as the floor, the query-specific part fell from about 5.8k to
about 4.2k tokens, roughly −27%. That figure is an estimate. The clearer
result is the search output: with `.ignore`, every file it returned is source
code, the contract, or a live README.

## Part 2: Bloat & redundancy audit

| #   | Finding                                                                                                                                                                                                                                         | Kind                 | Action                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------- |
| A1  | The contract schemas were declared twice, in `src/types/reservation.ts` and `client/src/types/campushub.ts` (~60 lines each), under different names (`IDENTIFIER_PATTERN`/`USER_ID_PATTERN`, `CreateReservationRequest`/`CreateReservationDTO`) | Redundant interfaces | Moved into `shared/contract.ts`        |
| A2  | `ErrorResponseBody` (`src/types/error.types.ts`) was aliased as `ErrorResponse` in `reservation.ts`: one shape, two names                                                                                                                       | Redundant interfaces | One `ErrorResponse`; file deleted      |
| A3  | `ACTIVE_STATUSES` (server service) duplicated `ACTIVE_RESERVATION_STATUSES` (client types)                                                                                                                                                      | Duplicate logic      | Moved to the shared contract           |
| A4  | `isResourceType` was written twice (server service, client API), with different signatures; so was `isReservationStatus`                                                                                                                        | Duplicate logic      | Moved to the shared contract           |
| A5  | `readIdentifier`, `readObjectId`, and `readDateTime` in `reservation.controller.ts` were the same 10 lines, three times                                                                                                                         | Duplicate handlers   | One `readField(source, field, format)` |
| A6  | The error middleware logged a second "returning generic 500" line in development, right after the line that already logged the error                                                                                                            | Verbose output       | Removed                                |
| A7  | `ServiceUnavailableError` and `ERROR_CODES`/`ErrorCode` were never used                                                                                                                                                                         | Dead code            | Removed                                |
| A8  | `BookingForm.tsx` was 169 lines: five `useState` calls, an inline `createReservation` call, and a `submit()` plus `.catch` that set the same error twice                                                                                        | Verbose component    | Moved into `useReservations`           |
| A9  | `App` kept a `reservationsVersion` counter, and `BookingForm` and `UserReservations` passed it through `onBooked`/`refreshKey`, only so the list would reload after a booking                                                                   | Coupled state        | Gone, because one hook owns both       |
| A10 | `UserReservations` sent cancel failures to `console.error`, the pattern §3a forbids (the path never ran, but it was still there)                                                                                                                | Swallowed error      | Removed; the hook stores the error     |
| A11 | `handleStartChange` and `handleEndChange` were the same handler for two fields                                                                                                                                                                  | Duplicate handlers   | One `handleSlotChange(field)`          |

What the audit checked and left alone:

- **Inline try/catch in controllers:** there was none to remove. The Lab 3
  `asyncHandler` plus a single error middleware already sends every rejection
  to one place.
- **Repeated axios error parsing in components:** none either. `toApiError` in
  `campushubApi.ts` and `describeApiError` already hold that logic in one
  place.
- **Other components over 150 lines:** none. `useResources` and
  `useReservations` still share an abort-and-reload effect. A generic query
  hook was rejected because two copies don't justify a new abstraction
  (AGENTS.md §7.1).

## Part 3: Guided agent refactoring

### 1. Backend global error handler

**Prompt:** _"Remove inline try/catch from `src/controllers/` and centralize
error handling in `src/middleware/errorHandler.ts`."_

The middleware moved from `error-handler.middleware.ts` to `errorHandler.ts`.
It is still registered last in `app.ts` and is still the only place that
formats errors. It now uses the shared `ErrorResponse` type, and it no longer
logs a 500 twice (A6). The controllers already had no try/catch. Their three
copies of a field reader became one `readField` that takes a `FieldFormat`
(A5), and the wording of each 400 message is unchanged.

### 2. Frontend custom hook

**Prompt:** _"Extract reservation fetching and state out of `BookingForm.tsx`
and `UserReservations.tsx` into `useReservations.ts`."_

The handout names `src/hooks/useReservations.ts`. This repository keeps the
React app under `client/`, so the hook lives at
`client/src/hooks/useReservations.ts`, beside the other client hooks. It
replaces `useUserReservations.ts`. `App`
calls it once per student and hands each component the part it uses:

```
App ── useReservations(userId) ─┬─ CreateReservationState ─► BookingForm
                                │     create() → POST /reservations → reload
                                └─ ReservationListState ───► UserReservations
                                      GET /reservations/user/{id}, cancel()
```

`create` and `cancel` return `void` and handle their own rejection with
`.then(ok, fail)`, the same pattern `useResources` uses. That means components
no longer hold any promise. `BookingForm` went from 169 to 136 lines and now
keeps only form state: the slot inputs and field errors.

### 3. Shared interface library

**Prompt:** _"Consolidate duplicate TypeScript interfaces into one shared
declaration layer across the full-stack boundary."_

`shared/contract.ts` has no imports, so it compiles under both tsconfigs.
`src/types/reservation.ts` re-exports it and adds the per-operation types that
only the server needs. `client/src/types/campushub.ts` is now a single
`export *` line (6 lines, down from 65). The filenames the course fixes stay
in place, and their importers did not change. Build wiring: the root
`tsconfig.json` has `rootDir: "."` and includes `shared/`, so the build output
moved to `dist/src/` and `main`/`start` were updated. `nodemon` and `eslint`
cover `shared/`, and `client/tsconfig.app.json` includes `../shared`.

## Incidents

### Incident 1: The lab's filename broke the naming rule

- **Initial agent output:** The agent was about to create
  `src/middleware/errorHandler.ts` next to the existing
  `error-handler.middleware.ts`. That would have left two error middlewares,
  which §4 forbids ("Exactly one central error-handling middleware").
- **Root cause:** The lab requires a camelCase filename, but AGENTS.md §3
  requires `kebab-case` `<entity>.<layer>.ts`.
- **Remediation:** As §7.4 requires, the agent raised the conflict instead of
  quietly picking one side. It renamed the existing file with `git mv`, so
  there is still exactly one middleware. It then added `errorHandler.ts` to
  the course-mandated exceptions in §3, the same way
  `src/types/reservation.ts` was handled in Labs 2–3.

### Incident 2: The new deny rule blocked the agent's own check

- **Initial agent output:** `rm -rf dist && npm run build && ls dist dist/src`
  was refused by the permission layer.
- **Root cause:** The new `Read(./dist/**)` deny rule worked as intended and
  also covered the agent's own check of the build output.
- **Remediation:** The agent left the rule in place and checked the build
  through `npm run build`'s exit status. This confirms that the Part 1 rules
  are enforced, not just written down.

### Incident 3: `.ignore` did nothing for the first agent query

- **Initial agent output:** The first pair of agent runs (follow-up PR)
  returned the same 11 files with and without `.ignore`, at 36,875 and 35,545
  tokens. The lab logs and the diagram were still in the results.
- **Root cause:** In this setup subagents have no dedicated Grep tool; they
  search through Bash, and the prompt had not said which command to use.
  Plain `grep -r` does not read `.ignore`, so the file had no effect. The
  original log and AGENTS.md had claimed that `.ignore` "applies to Claude
  Code's Grep and Glob". That was never verified, and in this setup it was
  wrong.
- **Remediation:** The wording in `.ignore`, AGENTS.md §8, and this log was
  corrected. §8 now says to search with `rg` or `fd`, never `grep -r` or
  `find`. The comparison was rerun with both runs told to use `rg` (results
  above).

## Verification

- `npm run typecheck`, `npm run lint` (`eslint src shared`), `npm run build`:
  zero errors.
- `client/`: `npm run typecheck`, `npm run lint`, `npm run build`: zero
  errors.
- `npx @redocly/cli lint docs/openapi.yaml`: valid, with 4 problems explicitly
  ignored, as before.
- `npx prettier --check .`: clean.
- curl against `npm run dev`:
  - `POST /reservations` returned the same 400 messages as before for a bad
    ObjectId, a bad userId, `2026-02-30`, a missing field, a read-only `id`,
    and malformed JSON.
  - A bad `:id` returned 400, `?isAvailable=maybe` returned 400, and an
    unknown route returned 404.
  - A DB-backed route with no database returned 500 `INTERNAL_SERVER_ERROR`,
    logged once.
- Browser (`npm run dev` in `client/`): the page renders through the `shared/`
  import. With no database, both panels show the "unreachable" alert instead
  of hanging, and Reserve with no resource shows the field error.
- **Not verified:** a successful booking, the 409 `DOUBLE_BOOKING` alert, and
  cancel. All three need MongoDB, which is not installed on this machine.
