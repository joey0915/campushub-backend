# CampusHub — Backend API

Multi-tenant campus resource management system. Backend REST API built with
TypeScript, Express, and Mongoose.

CS 5500 semester project. Lab 1: context engineering & repository initialization.
Lab 2: executable specifications & OpenAPI contract design. Lab 3: architecture
scaffolding & boundary enforcement.

## Agent context

All AI-agent behavior in this repository is governed by [AGENTS.md](AGENTS.md)
(the tool-neutral open standard). [CLAUDE.md](CLAUDE.md) simply imports it so
Claude Code, Cursor, and Copilot are all bound by the same rules. Read
`AGENTS.md` before contributing — human or agent.

## Requirements

- Node.js >= 20 (developed on v23.7.0)
- npm >= 10
- MongoDB running locally, or a connection string to a remote instance. The
  reservation API stores everything in it; only the health check works
  without it.

## Setup

```bash
npm install
cp .env.example .env
```

Then edit `.env` with your own values. `.env` is gitignored and must never be
committed.

Start MongoDB and load the demo data before testing (macOS with Homebrew shown;
any MongoDB reachable at `MONGODB_URI` works):

```bash
brew tap mongodb/brew && brew install mongodb-community
brew services start mongodb-community
npm run seed
```

`npm run seed` resets the configured tenant to the demo catalogue below and
deletes its reservations, so run it again for a clean test run.

## Scripts

| Command             | Purpose                                           |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Start the API with hot reload (nodemon + ts-node) |
| `npm run build`     | Compile TypeScript to `dist/`                     |
| `npm start`         | Run the compiled build                            |
| `npm run seed`      | Reset MongoDB to the demo catalogue               |
| `npm run typecheck` | Type-check with no emit                           |
| `npm run lint`      | ESLint, including type-aware rules                |
| `npm run format`    | Apply Prettier                                    |
| `npm run verify`    | typecheck + lint + format check (run before a PR) |

## Health check

```bash
npm run dev
# in another terminal:
curl -i http://localhost:3000/api/v1/health
```

```json
{
  "status": "ok",
  "service": "campushub-backend",
  "apiVersion": "v1",
  "environment": "development",
  "uptimeSeconds": 11,
  "timestamp": "2026-09-22T03:02:40.431Z",
  "dependencies": { "database": "connected" }
}
```

This is a **liveness** check: a reachable process always answers `200`. If
MongoDB is unreachable, `status` is `"degraded"` and `dependencies.database`
reports `"disconnected"` instead of the request failing. In development the API
also boots without MongoDB so routes that do not touch the database stay
testable; in production a failed database connection aborts startup.

## Reservation API

The API is contract-first: [docs/openapi.yaml](docs/openapi.yaml) (OpenAPI
3.0.3) was written before the code and is the authoritative contract.
[src/types/reservation.ts](src/types/reservation.ts) mirrors its schemas and
[src/routes/reservation.routes.ts](src/routes/reservation.routes.ts) wires its
operations under `/api/v1`.

| Operation                                | Success | Errors   |
| ---------------------------------------- | ------- | -------- |
| `GET /resources` (optional `?type=ROOM`) | 200     | 400      |
| `POST /reservations`                     | 201     | 400, 409 |
| `GET /reservations/user/{userId}`        | 200     | 400      |

Lint the contract (Redocly runs through `npx`; it is not a project
dependency):

```bash
npx @redocly/cli lint docs/openapi.yaml
```

Behavior the contract pins down:

- **Storage** is MongoDB, through the Mongoose models in `src/models/`. IDs are
  ObjectIds; `npm run seed` loads fixed ones, e.g. `000000000000000000000101`
  (Study Room 302) and `000000000000000000000201` (3D Printer A).
- **Time** values are ISO 8601 date-times with an explicit offset (`Z` or
  `±HH:MM`), returned in UTC. `endTime` must be later than `startTime`.
- **Conflicts** use half-open intervals: a slot that overlaps an active
  (`PENDING` or `CONFIRMED`) reservation of the same resource is a `409`
  `DOUBLE_BOOKING`, while back-to-back slots are fine. New reservations start
  `PENDING`.
- **Validation** failures are a `400` `VALIDATION_ERROR`: missing or malformed
  fields, read-only `id`/`status`, unknown properties, a `resourceId` that
  matches no resource, or an empty `?type=`. An unknown type such as
  `?type=STUDY_ROOM` matches nothing and returns `[]`.
- **Tenancy:** until authentication exists, every request is scoped to
  `DEFAULT_TENANT_ID`; clients can never choose the tenant.

Try it with `npm run dev` running:

```bash
curl -i http://localhost:3000/api/v1/resources
curl -i "http://localhost:3000/api/v1/resources?type=ROOM"
curl -i -X POST http://localhost:3000/api/v1/reservations \
  -H 'Content-Type: application/json' \
  -d '{"resourceId":"000000000000000000000101","userId":"user-456","startTime":"2026-10-01T10:00:00Z","endTime":"2026-10-01T11:00:00Z"}'
curl -i http://localhost:3000/api/v1/reservations/user/user-456
```

The first `POST` answers `201`:

```json
{
  "id": "6ac472da99227caf4851129f",
  "resourceId": "000000000000000000000101",
  "userId": "user-456",
  "startTime": "2026-10-01T10:00:00.000Z",
  "endTime": "2026-10-01T11:00:00.000Z",
  "status": "PENDING"
}
```

Sending it again answers `409` with the lab's `ErrorResponse`, a `code` and a
`message`:

```json
{
  "code": "DOUBLE_BOOKING",
  "message": "Resource is already reserved for this time slot."
}
```

### Contract audit (Lab 2 Part 3)

- **Route paths match the spec exactly.** `reservation.routes.ts` declares
  `/resources`, `/reservations`, and `/reservations/user/:userId`, mounted
  under `/api/v1`, the contract's server URL.
- **Status codes are typed per operation.** `ListResourcesResponses`,
  `CreateReservationResponses`, and `ListUserReservationsResponses` map every
  status the contract declares to its body type, and each controller's
  `Response` is typed with its success entry (`200` or `201`). `400` and `409`
  are thrown as `ValidationError` and `ConflictError`; anything unexpected
  becomes the central handler's `500`. `POST /reservations` uses exactly the
  lab's `201`, `400`, `409`, and `500`.
- **Request fields match the schema.** The body accepts exactly `resourceId`,
  `userId`, `startTime`, and `endTime`; the read-only `id` and `status` and
  any unknown property are rejected with `400`.

## Architecture

Requests flow in one direction only. See [AGENTS.md §3](AGENTS.md) for the
enforced boundaries.

```
HTTP → routes → controllers → services → models → MongoDB
```

```
docs/
└── openapi.yaml                    # The API contract (source of truth)
src/
├── app.ts                          # Routers + middleware; DB connection shell
├── server.ts                       # Bootstrap: await DB, listen, shutdown
├── config/
│   ├── env.ts                      # The only module that reads process.env
│   └── database.ts                 # Mongoose lifecycle + connection state
├── routes/
│   ├── index.ts                    # Mounts feature routers under /api/v1
│   ├── health.routes.ts            # Wiring only
│   └── reservation.routes.ts       # Wiring for every contract operation
├── controllers/
│   ├── health.controller.ts        # req/res + status codes, no DB access
│   ├── resource.controller.ts      # Query validation → 200
│   └── reservation.controller.ts   # Body/param validation → 201 / 200
├── services/
│   ├── health.service.ts           # Business logic, no Express imports
│   ├── resource.service.ts         # Catalogue queries via ResourceModel
│   └── reservation.service.ts      # Double-booking rule via ReservationModel
├── models/                         # Mongoose schemas + interfaces only
│   ├── Resource.model.ts
│   ├── Reservation.model.ts        # resourceId: ObjectId ref → Resource
│   └── User.model.ts
├── scripts/
│   └── seed.ts                     # npm run seed: demo catalogue
├── middleware/
│   ├── not-found.middleware.ts     # Unmatched routes → typed 404
│   └── error-handler.middleware.ts # The single error formatter
├── types/
│   ├── reservation.ts              # Mirror of the contract's schemas
│   ├── error.types.ts              # ErrorResponse body
│   └── health.types.ts
└── utils/
    ├── app-error.ts                # Typed domain errors
    ├── async-handler.ts            # Promise rejection → error middleware
    └── validation.ts               # JSON-object and ISO 8601 guards
```
