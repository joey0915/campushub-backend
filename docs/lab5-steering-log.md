# Lab 5 — Prompt Steering Log

Failure loops and wrong turns from the agent session (Claude Code, governed by
[AGENTS.md](../AGENTS.md)) that built the CampusHub React client in
[`client/`](../client): the typed API layer `client/src/api/campushubApi.ts`
and the `ResourceList`, `BookingForm`, and `UserReservations` components. Each
incident was caught by a tool result, a context rule, or the Part 3 audit.

## Data flow

```
ResourceList ──select──► App ──resource──► BookingForm ──createReservation──┐
     │                    ▲                     │ onBooked                  │
 useResources(type)       └── refreshKey ◄──────┘                           ▼
     │                                                         POST /reservations
     ▼                    UserReservations                        201 │ 409
GET /resources?type=      useUserReservations(userId, refreshKey)     ▼
                            ├─ GET /reservations/user/{userId}   Alert: "This resource is
                            └─ PATCH /reservations/{id}/cancel    already reserved for the
                                                                  selected time window…"
```

Components never import axios. Each hook owns `isLoading` and `error` and
aborts its load when the component unmounts. Every failure reaches the UI as
an `ApiError` carrying the contract's `ErrorResponse.code`.

## Incidents

### Incident 1: The context file forbade the whole lab

- **Initial Agent Output:** Before writing anything, the agent checked the lab
  against AGENTS.md. Three rules blocked it. §1 says this repository is the
  "backend REST API only — no frontend code, no UI frameworks". §2's allow-list
  has no React, Vite, or axios, and names `axios` as a package to propose
  first. §2 also bans `.jsx` and allows `.ts` only under `src/`.
- **Root Cause:** AGENTS.md was written for Labs 1–4, when the repository was
  backend-only. Lab 5 changes that scope.
- **Remediation Prompt:** AGENTS.md itself steered the agent: _"If a requested
  change cannot be made without violating a rule below, stop and say so"_ and
  _"propose it first … and wait for human approval"_. The agent asked the
  human to approve `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, and
  `axios` in a separate `client/package.json`, and to choose a styling
  approach. The human chose **Approve**, **CSS Modules**, and **branch + commit
  - PR**.
- **Resolution:** In the same change, AGENTS.md gained a client allow-list
  table and §3a "Frontend Boundaries", which records the lab's component,
  hooks, and styling rules. CLAUDE.md is unchanged because it says rules live
  only in AGENTS.md.

### Incident 2: The Vite template brought its own toolchain

- **Initial Agent Output:** `npm create vite@latest client -- --template
react-ts` (create-vite 9.3.1) scaffolded `typescript ~6.0.3`, `oxlint`,
  and tsconfigs that rely on TypeScript 6's implicit `strict`.
- **Root Cause:** The template targets a newer default stack than this repo.
  AGENTS.md pins `typescript@^5.9` because `typescript-eslint@8` supports only
  `<6.1.0`. oxlint has none of the type-aware rules (`no-floating-promises`,
  `no-unsafe-*`) that enforce §4.
- **Remediation Prompt:** _"Read before you write. Inspect the existing layer
  conventions and follow them rather than introducing a second pattern."_
  (§7.2)
- **Resolution:** The agent removed oxlint, pinned `typescript@~5.9.3`, and
  added `client/eslint.config.mjs`, which uses the root's
  `strictTypeChecked` rules. Both client tsconfigs now set `strict` and the
  root's extra flags (`noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, …) explicitly. The demo assets and
  `App.css` were deleted.

### Incident 3: Strict flags rejected the first API layer

- **Initial Agent Output:** The first `npm run typecheck` failed 4 times with
  `TS2379: … 'signal' are incompatible. Type 'AbortSignal | undefined' is not
assignable to type 'GenericAbortSignal'` on each
  `{ signal: options.signal }`. The first `npm run lint` then reported
  `` `FormEvent` is deprecated `` in `App.tsx` and `BookingForm.tsx`
  (React 19.3 types).
- **Root Cause:** Under `exactOptionalPropertyTypes`, an optional property
  must be absent, not `undefined`. React 19.3 renamed `FormEvent` to
  `SubmitEvent`.
- **Remediation Prompt:** _"Do not weaken any compiler flag to make code
  compile. Fix the code."_ (§4) The easy fixes were deleting the flag or
  adding `as AxiosRequestConfig`. The agent did neither.
- **Resolution:** The agent now passes the `RequestOptions` object straight
  through as the axios config and spreads it where params are added. It also
  switched to `SubmitEvent<HTMLFormElement>`. Typecheck and lint pass with 0
  errors. The same flag makes CSS-module classes `string | undefined`, so
  class names are joined with a typed `cx()` helper instead of template
  strings.

### Incident 4: MongoDB missing for the full-stack test

- **Initial Agent Output:** `which mongod` returned nothing. Without
  MongoDB, the Part 3 double-booking test could not run.
- **Root Cause:** Same as Lab 4 Incident 4: Homebrew cannot install MongoDB on
  this machine.
- **Remediation Prompt:** The agent asked whether to download MongoDB's
  official macOS arm64 tarball (8.0.17, about 80 MB) into the session
  scratchpad. The human chose **Download tarball**.
- **Resolution:** `mongod` ran on `127.0.0.1:27017` from the scratchpad, with
  no system change. `npm run seed` loaded 6 resources. `.claude/launch.json`
  starts the API (`:3000`) and the Vite client (`:5173`), and Vite proxies
  `/api`, so the backend needed no CORS change.

## Part 3 — State management & error handling audit

The agent ran each workflow in a browser against the live API and confirmed
the status codes in the network log.

| Scenario                                         | Network                       | UI result                                                                                                                       |
| ------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Submit with no resource / end before start       | no request sent               | Field errors; nothing dispatched                                                                                                |
| Filter by Lab                                    | `GET /resources?type=LAB` 200 | Only "Robotics Lab"                                                                                                             |
| Book Robotics Lab                                | `POST` 201, list `GET` 200    | Success alert; row appears as `PENDING`                                                                                         |
| **Same slot again (double booking)**             | **`POST` 409**                | **Alert: "This resource is already reserved for the selected time window. Choose another time or resource."** Button re-enabled |
| Cancel it                                        | `PATCH …/cancel` 200          | Row moves to "cancelled" history; re-booking the slot then gets 201                                                             |
| Cancel a reservation already cancelled elsewhere | `PATCH …/cancel` 409          | Alert: "… This reservation is already cancelled." (after fix 1)                                                                 |
| Backend stopped, page reloaded                   | Vite proxy 502                | Both panels: "The CampusHub API is unreachable — is the backend running?" + Retry (after fix 2)                                 |
| Backend restarted, Retry pressed                 | 200                           | Both panels recover                                                                                                             |

The audit found three defects, each fixed in this change:

1. **Silent cancel failure.** The first version stored cancel errors on the
   row that failed. After a 409 the hook refetches, the row moves into the
   collapsed "cancelled" history, and its error disappears with it. The user
   saw nothing. Cancel errors are now a list-level alert that names the
   resource and slot.
2. **Opaque proxy error.** While the API was down, the Vite proxy answered 502
   with no `ErrorResponse` body. The UI would have shown "The API answered 502
   without an error body." Gateway statuses (502/503/504) without a contract
   body now map to `NETWORK_ERROR`, the same as an unreachable API.
3. **Stale validation message.** "Select a resource from the directory
   first." stayed visible after a resource was picked. The message now shows
   only while it still applies.

Loading never hung on any path. Each hook clears `isLoading` on both success
and failure, and the submit and cancel buttons are disabled only while their
request is in flight. The `ERR_ABORTED` entries in the network log are React
StrictMode's development double-mount: the first effect's request is aborted
by design.
