# Deployment guide (Phase 10)

Everything here is a checklist plus ready-made config. It was **written but not executed**: it needs a real server, a
domain and a MySQL instance, which were not available while the code was prepared.

## 1. Server prerequisites
* Linux VPS (Ubuntu 22.04+), Node 20+ (22 recommended), MySQL 8 / MariaDB 10.4+, Nginx, `mysqldump`, pm2 (`npm i -g pm2`).
* DNS: `api.example.lk` -> server IP (and the frontend domain wherever the frontend is hosted).

## 2. Database
```sql
CREATE DATABASE bus_pool_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'buspool'@'localhost' IDENTIFIED BY '<long random password>';
GRANT ALL PRIVILEGES ON bus_pool_system.* TO 'buspool'@'localhost';
```
Import `bus_pool_system.sql` if you have existing data, then `npm run db:migrate`. For a fresh database the
migrations create the missing tables/columns; check with `npm run db:status` and `npm run db:check`.
Do not expose port 3306 to the internet.

## 3. Application
```bash
git clone <repo> /srv/bus-pool && cd /srv/bus-pool/backend
npm ci --omit=dev
cp .env.production.example .env && nano .env     # every CHANGE_ME must be replaced
npm run db:migrate
npm run seed:admin                               # then change the admin password after first login
pm2 start ecosystem.config.js && pm2 save && pm2 startup
```
In production the server **refuses to start** with weak/placeholder secrets, an empty DB password, empty `SMTP_HOST`,
non-HTTPS `FRONTEND_URL`/`API_PUBLIC_URL`, etc. (see `src/config/environment.js`). Read the error list and fix `.env`.

Keep `ecosystem.config.js` at **1 instance**: background jobs (reminders, e-mail retry, clean-up) run inside the API
process. For several instances set `RUN_JOBS=true` on only one of them.

## 4. HTTPS and domain (Nginx + Let's Encrypt)
```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/bus-pool   # edit server_name
sudo ln -s /etc/nginx/sites-available/bus-pool /etc/nginx/sites-enabled/
sudo certbot --nginx -d api.example.lk
sudo nginx -t && sudo systemctl reload nginx
```
Set in `.env`: `TRUST_PROXY=1`, `COOKIE_SECURE=true`, `FRONTEND_URL=https://app.example.lk` (comma-separate several
origins). If the frontend and API are on different *sites*, set `COOKIE_SAMESITE=none` (requires HTTPS); on sibling
sub-domains of one site `lax` plus `COOKIE_DOMAIN=.example.lk` is enough.

## 5. Logs
* pm2 logs: `pm2 logs bus-pool-api`; rotate with `pm2 install pm2-logrotate`.
* Slow requests are logged as `SLOW REQUEST ...` (threshold `SLOW_REQUEST_MS`, default 1000).
* Access log (`combined`) goes to stdout in production.

## 6. Backups
```bash
npm run db:backup                    # gzip dump into backups/, old ones deleted after BACKUP_KEEP_DAYS
npm run db:restore -- <file> --yes   # restore (overwrites the database!)
```
Schedule with `deploy/backup-cron.example` (database + uploaded files). Copy the backups **off the server**, and do a
test restore into a scratch database at least once.

## 7. Monitoring
* Uptime monitor (UptimeRobot etc.) on `https://api.example.lk/api/health` (returns uptime and memory too).
* Set `ERROR_WEBHOOK_URL` (Slack/Discord/any JSON webhook) to receive 5xx / crash reports (rate limited to 1/min per message).
* Failed e-mails: `GET /api/admin/email-logs?status=failed`; links that could not be delivered raise an admin notification.

## 8. Post-deploy testing
```bash
SMOKE_API_URL=https://api.example.lk npm run smoke    # health, auth guard, CORS, security headers, 404/400 handling
npm test                                          # unit tests (no DB needed)
npm run test:e2e                                  # full API scripts; run against a TEST database only
```
Then check manually: login from the real frontend origin (cookie set + refresh works), an assignment e-mail arrives and its
Confirm/Reject link works, a driver can send GPS, the admin live map endpoint returns the point.
`/api/docs` (Swagger UI) is disabled in production unless `ENABLE_API_DOCS=true`.

## 9. Updating
`git pull && npm ci --omit=dev && npm run db:backup && npm run db:migrate && pm2 reload bus-pool-api && npm run smoke`
