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

## Useful notes

* List endpoints accept optional `?page=1&limit=20` (max 100) and then return `pagination` info; without them they return everything, as before.
* Behind a reverse proxy set `TRUST_PROXY=1` in `.env`.
* See `AUDIT_REPORT.md` for what was checked and fixed.
