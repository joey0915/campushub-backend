# CampusHub — Backend API

Multi-tenant campus resource management system. Backend REST API built with
TypeScript, Express, and Mongoose.

CS 5500 semester project. Lab 1: context engineering & repository initialization.

## Agent context

All AI-agent behavior in this repository is governed by [AGENTS.md](AGENTS.md)
(the tool-neutral open standard). [CLAUDE.md](CLAUDE.md) simply imports it so
Claude Code, Cursor, and Copilot are all bound by the same rules. Read
`AGENTS.md` before contributing — human or agent.

## Requirements

- Node.js >= 20 (developed on v23.7.0)
- npm >= 10
- MongoDB running locally, or a connection string to a remote instance
  (optional for the health check — see below)

## Setup

```bash
npm install
cp .env.example .env
```

Then edit `.env` with your own values. `.env` is gitignored and must never be
committed.

## Scripts

| Command             | Purpose                                           |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Start the API with hot reload (nodemon + ts-node) |
| `npm run build`     | Compile TypeScript to `dist/`                     |
| `npm start`         | Run the compiled build                            |
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

## Architecture

Requests flow in one direction only. See [AGENTS.md §3](AGENTS.md) for the
enforced boundaries.

```
HTTP → routes → controllers → services → models → MongoDB
```

```
src/
├── app.ts                          # Express app assembly only
├── server.ts                       # Bootstrap: DB connect, listen, shutdown
├── config/
│   ├── env.ts                      # The only module that reads process.env
│   └── database.ts                 # Mongoose lifecycle + connection state
├── routes/
│   ├── index.ts                    # Mounts feature routers under /api/v1
│   └── health.routes.ts            # Wiring only
├── controllers/
│   └── health.controller.ts        # req/res + status codes, no DB access
├── services/
│   └── health.service.ts           # Business logic, no Express imports
├── models/                         # Mongoose schemas + interfaces only
├── middleware/
│   ├── not-found.middleware.ts     # Unmatched routes → typed 404
│   └── error-handler.middleware.ts # The single error formatter
├── types/                          # Shared interfaces
└── utils/
    ├── app-error.ts                # Typed domain errors
    └── async-handler.ts            # Promise rejection → error middleware
```
