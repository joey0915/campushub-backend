# AGENTS.md — CampusHub

Governing context for **any** AI coding agent operating in this repository
(Claude Code, Cursor, Copilot, Codex, Aider, Gemini CLI, …).

These rules are **binding constraints, not suggestions**. If a requested change
cannot be made without violating a rule below, **stop and say so** instead of
producing non-compliant code. Never silently relax a rule.

---

## 1. Project Context

**CampusHub** is a multi-tenant campus resource management system (rooms, labs,
equipment, and event bookings across multiple campus tenants). This repository
holds two packages:

- **`src/`** — the backend REST API (§3–§4).
- **`client/`** — the React single-page client that consumes it (§3a). It has
  its own `package.json`; no UI code or UI dependency ever enters `src/` or the
  root `package.json`.

Every tenant-scoped resource is isolated by a `tenantId`. Assume multi-tenancy
in every schema and query you write: a query that can read across tenants is a
bug, not a feature.

---

## 2. Tech Stack & Libraries

### Authorized (allow-list — nothing else)

| Purpose        | Package                                                 |
| -------------- | ------------------------------------------------------- |
| Language       | `typescript` (5.x line — see note)                      |
| Runtime        | Node.js (LTS), `@types/node`                            |
| HTTP framework | `express`, `@types/express`                             |
| Database / ODM | `mongoose`                                              |
| Config         | `dotenv`                                                |
| Dev execution  | `ts-node`, `nodemon`                                    |
| Lint / format  | `eslint`, `@eslint/js`, `typescript-eslint`, `prettier` |
| Contract lint  | `@redocly/cli` via `npx` only, never installed          |

Additionally, in `client/package.json` only (approved for Lab 5):

| Purpose        | Package                                                                  |
| -------------- | ------------------------------------------------------------------------ |
| UI library     | `react`, `react-dom`, `@types/react`, `@types/react-dom`                 |
| Build / dev    | `vite`, `@vitejs/plugin-react`                                           |
| HTTP client    | `axios`                                                                  |
| Language, lint | `typescript`, `@types/node`, `eslint`, `@eslint/js`, `typescript-eslint` |

Styling is CSS Modules, built into Vite — no Tailwind, CSS-in-JS, or component
library without approval.

> **TypeScript version pin:** stay on `typescript@^5.9`. `typescript-eslint@8`
> declares a peer range of `>=4.8.4 <6.1.0`, so TypeScript 7 breaks the
> type-aware lint rules that enforce §4. Do not bump the major version until
> `typescript-eslint` supports it. The pin applies to `client/` too, even when
> a scaffolding template ships a newer TypeScript.

### Hard prohibitions

- **No `.js`, `.mjs`, `.cjs`, or `.jsx` source files.** All application source
  is `.ts` under `src/` or `.ts`/`.tsx` under `client/src/`. Compiled
  JavaScript belongs in `dist/` (or `client/dist/`) and is never committed. The
  only exception is tooling config that its own tool requires in that format
  (`eslint.config.mjs`, `client/eslint.config.mjs`); never add application
  logic there.
- **Do not install or import any package not in the tables above.** If a task
  seems to need a new dependency (e.g. `zod`, `jsonwebtoken`, `helmet`,
  `winston`, `lodash`, `axios`, `jest`), **propose it first** with a one-line
  justification and wait for human approval. Then add it to that table in the
  same commit.
- **No alternate frameworks or ORMs** — no Nest, Fastify, Koa, Prisma,
  TypeORM, Sequelize, or the raw `mongodb` driver. Mongoose is the only
  database access layer.
- **No global installs** and no edits to `package-lock.json` by hand.
- **Do not commit** `.env`, `node_modules/`, or `dist/` — at the root or in
  `client/`.

---

## 3. Architectural Boundaries (strict 3-tier + models)

Requests flow in exactly one direction. **Never skip a layer, never reverse
the arrows.**

```
HTTP → routes → controllers → services → models → MongoDB
```

```
src/
├── app.ts                # App assembly (middleware + router mounting) + DB connection shell
├── server.ts             # Process bootstrap: awaits the DB connection, listens, shuts down
├── config/               # Typed configuration and DB connection setup
├── routes/               # Route definitions + middleware mapping ONLY
├── controllers/          # Request/response handling + HTTP status codes
├── services/             # Pure business logic
├── models/               # Mongoose schemas + their interfaces ONLY
├── middleware/           # Cross-cutting Express middleware (errors, auth, …)
├── scripts/              # One-off CLI jobs, e.g. `npm run seed`
├── types/                # Shared interfaces, DTOs, and type declarations
└── utils/                # Small, pure, framework-agnostic helpers
```

### `routes/` — wiring only

- Declares paths, HTTP verbs, and the middleware chain; delegates to a
  controller method.
- **Forbidden:** business logic, validation bodies, database calls, inline
  arrow-function handlers containing logic, direct `res.json(...)` payload
  construction.

### `controllers/` — the HTTP boundary

- Reads `req` (params/query/body/headers), calls **exactly one service**
  method, maps the result to a status code and response body.
- Owns HTTP semantics: `200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`,
  `500`.
- **Forbidden:** any Mongoose call (`Model.find()`, `Model.create()`,
  aggregations), business rules, cross-entity orchestration.

### `services/` — business logic

- Pure business logic and orchestration, and **all database interaction**
  through the Mongoose models. Accepts and returns plain typed objects/DTOs.
  Every query filters on `tenantId`.
- **Forbidden:** touching `req`, `res`, or `next`; importing from `express`;
  knowing about HTTP status codes. A service must be callable from a CLI job or
  a test with no HTTP server present.
- Signals failure by throwing a typed domain error (see §4), never by
  returning `res.status(...)`.

### `models/` — persistence shape

- Mongoose `Schema` definitions, their exported TypeScript interfaces, and the
  compiled model. Indexes and schema-level validators are allowed here.
- **Forbidden:** business rules, HTTP concerns, service imports.

### API contract — `docs/openapi.yaml`

- `docs/openapi.yaml` (OpenAPI 3.0) is the **authoritative contract** for the
  HTTP API. Paths, verbs, parameters, request and response bodies, status
  codes, and error codes in `src/` must match it exactly. Never add, rename, or
  remove an endpoint or field in code alone.
- **Contract first:** change the spec, then the code that implements it, in the
  same pull request.
- Deliberate lint exceptions live in `.redocly.lint-ignore.yaml`, each with its
  reason. Never disable a Redocly rule globally to get a clean run.
- `src/types/reservation.ts` mirrors the contract's schemas and operations
  one-to-one, and `src/routes/reservation.routes.ts` wires every operation in
  it, including `GET /resources`. These two filenames and the PascalCase model
  files (`src/models/Resource.model.ts`, `Reservation.model.ts`,
  `User.model.ts`) are fixed by the course (Labs 2–3), so they are the
  exceptions to the naming rule below.

### Naming conventions

- Files: `<entity>.<layer>.ts` → `booking.routes.ts`, `booking.controller.ts`,
  `booking.service.ts`, `booking.types.ts`; models are `Booking.model.ts`.
- Directories and files: `kebab-case`. Types/interfaces/classes:
  `PascalCase`. Variables and functions: `camelCase`. Constants:
  `UPPER_SNAKE_CASE`.
- Do **not** prefix interfaces with `I`. Use `Booking`, not `IBooking`.
- One primary export concern per file.

---

## 3a. Frontend Boundaries (`client/`)

The client is a React + Vite single-page app. Data flows in one direction:

```
component → hook → src/api/campushubApi.ts → (Vite proxy) → /api/v1
```

```
client/src/
├── main.tsx / App.tsx    # Mounting and page composition only
├── api/campushubApi.ts   # The ONLY module that imports axios or knows URLs
├── components/           # Functional components + their .module.css
├── hooks/                # Data-loading and workflow state (useX.ts)
├── config/env.ts         # The ONLY reader of import.meta.env
├── types/campushub.ts    # Mirror of docs/openapi.yaml schemas
└── utils/                # Pure helpers (dates, validation, error text)
```

- **Component architecture:** functional components only, each with an
  explicit exported `<Name>Props` interface and an explicit `ReactElement`
  return type. No class components.
- **State management:** standard hooks (`useState`, `useEffect`,
  `useCallback`) or custom hooks in `hooks/`. **No API calls inside JSX** or in
  render bodies: components call a hook, or a named handler that calls one
  `campushubApi` function. No global store library without approval.
- **Contract:** `campushubApi.ts` exposes one typed function per contract
  operation, returns `types/campushub.ts` types, narrows response bodies with
  type guards instead of casting, and throws `ApiError` (HTTP status + the
  contract's `ErrorResponse.code`) on every failure. A contract change updates
  the server mirror (`src/types/reservation.ts`) and this one together.
- **Async UI state:** every async workflow exposes explicit `isLoading` (or
  `isSubmitting`) and `error` state, clears the loading flag on success and
  failure alike, and aborts in-flight loads (not mutations) on unmount.
  Errors are rendered as an alert keyed off `ErrorResponse.code` (e.g.
  `DOUBLE_BOOKING` → "This resource is already reserved for the selected time
  window"), never parsed from message text, never only logged.
- **Validation:** validate form input on the client before dispatching, but
  treat the server as the authority — overlaps can only be detected there.
- **Tenancy:** the client never sends a `tenantId`; the server resolves it.
- **Styling:** CSS Modules (`Component.module.css` next to `Component.tsx`),
  sharing the design tokens declared in `client/src/index.css`. No inline
  `style` objects except for computed values.
- **Naming exceptions:** components are `PascalCase.tsx`, hooks are
  `useCamelCase.ts`, and `api/campushubApi.ts` keeps the course-mandated name
  (Lab 5). Other client files follow the `kebab-case` rule above.
- The §4 typing, async, and style rules apply unchanged; `client/tsconfig.*`
  carry the same strict flags as the root.

---

## 4. Coding Standards & Safety

### Typing

- **`any` is forbidden** — including `as any`, `any[]`, `Record<string, any>`,
  and `@ts-ignore` / `@ts-expect-error` used to hide it. Use `unknown` plus a
  narrowing type guard when the shape is genuinely unknown.
- **Every function has an explicit return type annotation.** No reliance on
  inference at module boundaries.
- **Every exported function parameter is explicitly typed.** No implicit `any`
  parameters.
- All request bodies, query shapes, service inputs, service outputs, and
  Mongoose documents get a named **`interface`** (prefer `interface` over
  `type` for object shapes; use `type` for unions and mapped types).
- Prefer `readonly` for data that must not be mutated, and `as const` for
  literal maps.
- Non-null assertions (`!`) are forbidden. Narrow with an explicit check and
  throw a clear error instead.
- `tsconfig.json` runs `strict: true` plus `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitReturns`, `noUnusedLocals`, and
  `noUnusedParameters`. **Do not weaken any compiler flag to make code
  compile.** Fix the code.

### Async & error handling

- **No unhandled promises.** Every promise is `await`ed, returned, or given an
  explicit `.catch`. Never call an async function for its side effects without
  handling rejection.
- Async Express handlers must be wrapped by `asyncHandler` (see
  `src/utils/async-handler.ts`) so rejections reach the central error
  middleware. **No bare `async (req, res) => {}` route handlers.**
- Exactly **one** central error-handling middleware, registered last in
  `app.ts`. Controllers pass errors to it (via `asyncHandler` or
  `next(error)`); they do not format error responses themselves.
- Domain failures are thrown as typed errors extending `AppError` with an HTTP
  status attached, so the error middleware can map them without string
  matching.
- `catch` blocks receive `unknown` (per `useUnknownInCatchVariables`) and must
  narrow before use. Never swallow an error — rethrow, wrap, or log it.
- No `process.exit()` outside `server.ts` bootstrap/shutdown.

### Safety & multi-tenancy

- Read environment variables **only** through the typed config module
  (`src/config/env.ts`). `process.env` is not referenced anywhere else.
- Never hard-code secrets, connection strings, tokens, or ports in source.
- Never log secrets, tokens, or full request bodies.
- Every tenant-scoped query filters on `tenantId`. Never trust a `tenantId`
  taken straight from a request body.
- Until authentication exists, controllers scope every request to
  `env.defaultTenantId` (`DEFAULT_TENANT_ID`). Replace it with the
  authenticated caller's tenant — never with a header, query, or body value.
- Validate and narrow all external input at the controller boundary before it
  reaches a service.

### Style

- 2-space indentation, single quotes, semicolons, trailing commas, 100-column
  soft limit (Prettier is the source of truth).
- Use ES module `import`/`export` syntax only — no `require()`.
- Comments explain **why**, not **what**. No commented-out code, no
  decorative banners, no TODOs without an owner.
- Do not add a comment to every line. Match the density of surrounding code.

---

## 5. Testing & Verification

- Before claiming a task is done, run and report the real output of:
  - `npm run typecheck` — must pass with zero errors.
  - `npm run lint` — must pass with zero errors.
  - `npm run build` — must succeed.
  - `npx @redocly/cli lint docs/openapi.yaml` — must pass with zero errors.
- If you changed `client/`, also run from `client/`: `npm run typecheck`,
  `npm run lint`, and `npm run build` — all must pass with zero errors.
- If you changed a route, also verify it with `curl` against a running
  `npm run dev` and paste the actual response. The API needs MongoDB at
  `MONGODB_URI`: start it, then run `npm run seed` to reset the demo data.
- If you changed a UI workflow, exercise it in a browser against the running
  API (`npm run dev` at the root and in `client/`), including its error path:
  a double booking must show the 409 alert, and a stopped API must show an
  "unreachable" alert rather than a hanging spinner.
- **Never report success you have not observed.** If a command fails, show the
  failure.

---

## 6. Git & Commit Formatting

- Conventional Commits: `type(scope): subject` in the imperative mood, ≤ 72
  characters, no trailing period.
  Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `build`.
  Example: `feat(health): add GET /api/v1/health endpoint`
- Commit body (wrapped at 72 columns) must state:
  1. **What** was built or changed.
  2. **Why** — the motivating requirement.
  3. **Which AGENTS.md rules shaped the implementation**, and any rule that
     forced you to reject an easier approach.
- One logical change per commit. Never mix a refactor with a feature.
- Never commit secrets or generated output (see `.gitignore`).
- Do not run `git commit`, `git push`, `git reset --hard`, or force-push
  **unless explicitly asked**. Never commit directly to `main` for feature
  work — branch as `feat/<slug>` or `fix/<slug>`.

### PR / diff description template

```
## What
<one paragraph: what this change does>

## Why
<the requirement or bug being addressed>

## Context rules applied
- <AGENTS.md rule> → <how it shaped the code>

## Verification
- npm run typecheck: <result>
- npm run lint: <result>
- Manual: <curl command + observed response>
```

---

## 7. Agent Working Agreement

1. **Smallest change that satisfies the request.** Do not refactor unrelated
   code, rename things, reformat untouched files, or add speculative
   abstractions, features, or config.
2. **Read before you write.** Inspect the existing layer conventions and
   follow them rather than introducing a second pattern.
3. **Ask, don't assume,** when a requirement is genuinely ambiguous _and_ the
   readings lead to materially different code. Otherwise pick the conventional
   option and state the assumption.
4. **Surface rule conflicts explicitly.** If the request requires breaking a
   rule here, say which rule and why, and propose a compliant alternative.
5. **No placeholder or stub deliverables** — no `throw new Error('not
implemented')` in code presented as finished.
6. **This file is the source of truth and a living document.** When the human
   approves a new dependency, pattern, or convention, update this file in the
   same commit that introduces it.

---

## 8. Quick Reference — Common Violations

| ❌ Violation                                 | ✅ Compliant                                        |
| -------------------------------------------- | --------------------------------------------------- |
| `Model.find()` in a controller               | Controller → service → model                        |
| `(req, res) => { /* logic */ }` in a route   | Route → `controller.method`                         |
| `catch (err: any)`                           | `catch (error: unknown)` + narrowing                |
| `function f(x) { ... }`                      | `function f(x: string): Promise<Result> { ... }`    |
| `process.env.PORT` in `app.ts`               | `env.port` from `src/config/env.ts`                 |
| `async (req, res) => {}` route handler       | `asyncHandler(controller.method)`                   |
| `res.status(500).json({ error })` in service | `throw new AppError(...)`; error middleware maps it |
| Adding `zod` unprompted                      | Propose it, get approval, then add + document       |
| Loosening `strict` to fix an error           | Fix the type, keep the flag                         |
| `axios.get(...)` inside a component          | Component → hook → `campushubApi` function          |
| Spinner with no `error` state                | `isLoading` + `error`, both cleared on every path   |
| `catch { console.error(e) }` in a hook       | Store the message and render an `<Alert>`           |
