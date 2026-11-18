# Bus-Pool_System

Backend (Node.js + Express + Sequelize + MySQL/MariaDB) and frontend (React + Vite).

## Backend quick start

```bash
cd backend
cp .env.example .env        # fill in DB + JWT secrets (32+ characters each)
npm install
npm run db:migrate          # brings an older database up to date (safe to re-run)
npm run seed:admin          # creates the admin from ADMIN_* values in .env
npm run dev                 # http://localhost:5000/api/health
```

If you start from the phpMyAdmin dump `bus_pool_system.sql`, run `npm run db:migrate` (or `backend/sql/001_sync_schema.sql`)
once: the dump has no `users.token_version`, `tour_stops.stop_type`, `driver_documents`, `bus_images` or `bus_facilities`.

Change the admin password after the first login (`POST /api/auth/change-password`) and never commit `.env`.

## Scripts (backend)

| Command | Purpose |
|---|---|
| `npm run db:migrate` / `db:status` | Apply / list numbered migrations (idempotent) |
| `npm run db:check` (`-- --fix`) | Data integrity report (bus status, overlaps, orphans) |
| `npm run db:backup` / `db:restore` | mysqldump backup with retention / restore (`--yes`) |
| `npm test` | Unit tests (no database needed) |
| `npm run test:e2e` | API scripts against a running server + TEST database |
| `npm run docs:generate` | Regenerate `docs/openapi.json` + `docs/API_ENDPOINTS.md` |
| `npm run smoke` | Post-deploy checks (`SMOKE_API_URL=...`) |

## Docs

* `backend/docs/API_ENDPOINTS.md`, `openapi.json`, Swagger UI at `/api/docs` (dev)
* `backend/docs/FRONTEND_INTEGRATION.md` - auth/refresh flow, errors, uploads, GPS, Google Maps
* `backend/docs/DEPLOYMENT.md` - production checklist (HTTPS, pm2, backups, monitoring)

## Useful notes


* List endpoints accept optional `?page=1&limit=20` (max 100) and then return `pagination` info; without them they return everything, as before.
* GPS: drivers send points at most every `GPS_MIN_INTERVAL_SECONDS`; see `GET /api/driver/gps/config`. Admin live view: `GET /api/admin/gps/live`.
* Background jobs (reminders, e-mail retry, clean-up) run inside the API process; `RUN_JOBS=false` disables them.
* Behind a reverse proxy set `TRUST_PROXY=1` in `.env`.
* See `AUDIT_REPORT.md` for what was checked and fixed.
