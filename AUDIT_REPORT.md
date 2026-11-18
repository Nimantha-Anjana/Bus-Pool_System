# Backend audit report

Scope: `backend/` of Bus-Pool_System, checked against the "Part 01 - Backend Complete Checking Checklist" and the
phpMyAdmin dump `bus_pool_system.sql`. The frontend was not audited.

**How it was checked:** every backend file was read; model columns were compared with the SQL dump by script; all `.js`
files pass `node --check`; the changed pure logic (error mapping, pagination, date parsing, GPS validation, body type
validation) was run against stubs. **Not done:** running the server, hitting MySQL or Postman tests, because no database
and no `npm install` were available in the review environment. Please run the Postman checklist (section 8/9) once on your machine.

## Fixed (all in this zip)

| # | Severity | Problem | Fix |
|---|----------|---------|-----|
| 1 | Critical | The DB dump has no `users.token_version`, `tour_stops.stop_type`, `driver_documents`, `bus_images`, `bus_facilities`. Login (`token_version`) and tours/stops/drivers/bus images fail on a database built from the dump. | `npm run db:migrate` (`scripts/migrate-schema.js`) and `sql/001_sync_schema.sql`; both are safe to re-run. |
| 2 | Critical | `tour.controller.js` `updateTourStatus`: `assignmentStatus: next` passed the Express `next` function, so completing or cancelling a tour with assignments crashed (500). | Uses the computed status, sets `completedAt` / `cancelledAt`, revokes still-open e-mail links, locks the tour row; starting a tour now sets `startedAt`. |
| 3 | High | Updating a tour stop that already had `plannedArrivalAt` always returned 400 (a `Date` was rejected by `parseDateTime`). | `parseDateTime` accepts valid `Date` values. |
| 4 | High | GPS `latitude: null` / `""` / `true` was saved as 0,0 (`Number(null) === 0`). | Strict numeric check for lat/lng and optional fields. |
| 5 | High | No brute-force protection on `/auth/login` and `/auth/refresh`. | Rate limiters (10 login / 30 refresh per minute per IP). Login also spends the same time for unknown e-mails (no user enumeration by timing). |
| 6 | Medium | Bus image upload trusted the client MIME type (driver documents already checked file signatures). | Real file signature check (JPG/PNG/WEBP) before saving. |
| 7 | Medium | Error handler returned 500 for duplicate rows, FK conflicts, bad JSON, DB outage. | Mapped to 409 / 409 / 400 / 503; 5xx errors are logged also in production. |
| 8 | Medium | Auth middleware answered 401 even when the database was down. | Only token errors give 401; other errors go to the central handler. |
| 9 | Medium | A non-text value (e.g. `"description": 5`) in a text field crashed with 500 (`.trim` on a number). | `validateBodyTypes` returns 400 for admin and driver routes. |
| 10 | Medium | Bus owner could be set inactive while having pending/confirmed assignments. | 409 like the driver rule. |
| 11 | Medium | No pagination on list endpoints. | Opt-in `?page=&limit=` (max 100) for owners, buses, drivers, tours, assignments; without it responses are unchanged. |
| 12 | Low | Change-password only checked length. | Same rule as driver passwords (8-72, letter + number). |
| 13 | Low | Hard-coded timezone in the auth middleware; Morgan only in development; JSON limit 10 MB; refresh tokens never purged; no handler for unhandled errors; no `trust proxy` option. | Uses `APP_TIMEZONE`; `combined` access log outside development; 1 MB JSON limit; purge job (every 6 h); process error handlers; `TRUST_PROXY` env. |

## Checked and fine

Folder structure, naming and module wiring; Helmet, CORS (single origin + credentials), health endpoint, graceful
shutdown; JWT (issuer/audience, `tokenVersion`), refresh token rotation with SHA-256 hashes, HTTP-only cookie scoped to
`/api/auth`, logout / logout-all / change-password invalidating sessions; role separation (`/api/admin` = Admin only,
`/api/driver` = Driver only); all 15 models match the dump columns (except item 1); FKs and delete protection for owners,
buses, drivers, tours; overlap prevention with row locks; single-use hashed e-mail tokens with expiry, revocation and atomic
use; GPS only for the driver's own confirmed assignment on an ongoing tour; driver NIC/licence files kept outside the public folder;
activity log middleware does not log request bodies; all queries use Sequelize parameters (no raw string SQL with user input).

## Phase 2-10 additions

Database: numbered migrations (`schema_migrations`), 8 indexes, bus-status reconcile, integrity checker, backup/restore scripts.
API: sorting + pagination, OpenAPI spec + Swagger UI, e-mail log endpoint. Security: production config validation, CORS allow-list,
cookie SameSite/domain options, rate limits. Business logic: 48 h reminders, retry of failed e-mails, expired-link flagging.
GPS: min-interval throttle, live buses, Google Maps links, retention. Performance: indexes, slow-request log, health metrics.
Tests: 19 unit tests (stubbed, no DB). Deployment: pm2, Nginx, backup cron, smoke test, `docs/DEPLOYMENT.md`.

**Not verified here (no database/network):** real server start, migrations on a live DB, paged queries, live-GPS SQL, background jobs,
`npm run test:e2e`, Postman, real e-mail delivery, HTTPS/deploy. Run these before release.

## Still recommended (not changed)

1. `backend/.env` was inside the zip with real-looking secrets and a DB password. It is **not** included in the fixed zip; rotate those secrets if the original zip was shared.
2. The root README used to show the admin password; use a strong one and change it after first login. `seed-sample-data.js` creates a demo driver with a fixed password: development only.
3. E-mails are still sent inside the request (failed ones are retried by a job) (up to ~2 x 10 s per recipient if SMTP hangs). A queue would be better for production.
4. Refresh-token reuse detection (revoke the whole session family when an already used token is presented) was left out on purpose: parallel refresh calls from the frontend could log users out. Add it once the frontend serialises refreshes.
5. GPS retention is handled by the clean-up job (`GPS_RETENTION_DAYS`); check the value fits your needs.
6. Unit tests exist but integration tests against a real DB are still missing beyond the `scripts/test-*.js` API scripts.
7. Overlap prevention is enforced by the application (row locks); the database itself has no constraint for it.
