# CampusHub — Client

React + TypeScript + Vite single-page app for the CampusHub reservation API
(Lab 5). It browses campus resources, books time slots, and manages a
student's reservations. Rules for this package are in
[AGENTS.md §3a](../AGENTS.md).

## Run it

The client needs the API running (see the [root README](../README.md)):

```bash
# terminal 1, repository root: MongoDB running, then
npm run seed && npm run dev

# terminal 2
cd client
npm install
cp .env.example .env
npm run dev   # http://localhost:5173
```

The Vite dev server proxies `/api` to `CAMPUSHUB_API_ORIGIN`, so the browser
sees a single origin and the API needs no CORS setup.

## Scripts

| Command             | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Vite dev server with the `/api` proxy    |
| `npm run build`     | Type-check, then build to `client/dist/` |
| `npm run typecheck` | `tsc -b` over app and Vite config        |
| `npm run lint`      | ESLint with the root's type-aware rules  |
| `npm run preview`   | Serve the production build locally       |

## Layout

```
src/
├── api/campushubApi.ts         # Typed client: one function per contract operation
├── types/campushub.ts          # Mirror of docs/openapi.yaml schemas
├── config/env.ts               # The only reader of import.meta.env
├── hooks/
│   ├── useResources.ts         # GET /resources?type= with loading/error/abort
│   └── useUserReservations.ts  # GET /reservations/user/{id} + cancel workflow
├── components/
│   ├── ResourceList.tsx        # Resource cards + ROOM/EQUIPMENT/LAB filter
│   ├── ResourceCard.tsx
│   ├── BookingForm.tsx         # Start/end inputs, client validation, 409 alert
│   ├── UserReservations.tsx    # Active bookings, cancel, cancelled history
│   └── Alert.tsx               # Error/success banner
└── utils/                      # Dates, form validation, error text, cx()
```

## API layer

`campushubApi.ts` implements the four operations the lab names, against
`docs/openapi.yaml`:

| Function                           | Operation                         |
| ---------------------------------- | --------------------------------- |
| `fetchResources(type?)`            | `GET /resources`                  |
| `createReservation(payload)`       | `POST /reservations`              |
| `fetchUserReservations(userId)`    | `GET /reservations/user/{userId}` |
| `cancelReservation(reservationId)` | `PATCH /reservations/{id}/cancel` |

Response bodies are checked with type guards instead of being cast. Every
failure throws `ApiError { status, code, message }`, where `code` is the
contract's `ErrorResponse.code`, or `NETWORK_ERROR` when the API is
unreachable. `utils/error-messages.ts` turns codes into alert text, e.g.
`DOUBLE_BOOKING` → "This resource is already reserved for the selected time
window."

Until authentication exists, the student is chosen in the header (default
`user-456`). The client never sends a tenant.
