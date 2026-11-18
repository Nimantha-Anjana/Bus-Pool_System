# Database

The schema is owned by the backend:

* `backend/migrations/` - ordered migrations, applied with `npm run db:migrate` (list with `npm run db:status`)
* `backend/npm run db:check` - integrity report (overlapping assignments, bus status, orphans); `-- --fix` repairs the bus status cache
* `backend/npm run db:backup` / `db:restore` - compressed backups (see `backend/docs/DEPLOYMENT.md`)
* `backend/sql/` - the same changes as plain SQL for phpMyAdmin

Do not commit database dumps: they contain password hashes and personal data.
