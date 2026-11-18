# API endpoints

Generated from `src/docs/openapi.js` (`npm run docs:generate`). Live docs: `GET /api/docs`.

## Health

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/api/health` | Public | API and database health check |

## Auth

| Method | Path | Who | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Login (admin or driver). Returns an access token; sets the HTTP-only refresh cookie |
| POST | `/api/auth/refresh` | Public | Get a new access token using the refresh cookie (the refresh token rotates) |
| POST | `/api/auth/logout` | Public | Logout this device |
| POST | `/api/auth/logout-all` | Any logged-in user | Logout from all devices |
| POST | `/api/auth/change-password` | Any logged-in user | Change password (logs out all devices) |

## Admin dashboard

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/api/admin/dashboard` | Admin | Dashboard statistics |
| GET | `/api/admin/dashboard/buses` | Admin | Bus statistics |
| GET | `/api/admin/profile` | Admin | Logged-in admin profile |

## Bus owners

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/api/admin/bus-owners` | Admin | List bus owners |
| POST | `/api/admin/bus-owners` | Admin | Create bus owner |
| GET | `/api/admin/bus-owners/{id}` | Admin | Get bus owner |
| PUT | `/api/admin/bus-owners/{id}` | Admin | Update bus owner (cannot be deactivated while assignments are active) |
| DELETE | `/api/admin/bus-owners/{id}` | Admin | Delete bus owner (blocked while buses or assignments exist) |

## Buses

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/api/admin/buses` | Admin | List buses |
| POST | `/api/admin/buses` | Admin | Create bus |
| GET | `/api/admin/buses/{id}` | Admin | Get bus |
| PUT | `/api/admin/buses/{id}` | Admin | Update bus |
| DELETE | `/api/admin/buses/{id}` | Admin | Delete bus |
| PATCH | `/api/admin/buses/{id}/availability` | Admin | Set bus availability |
| GET | `/api/admin/buses/{id}/facilities` | Admin | List bus facilities |
| PUT | `/api/admin/buses/{id}/facilities` | Admin | Replace bus facilities |
| GET | `/api/admin/buses/{id}/images` | Admin | List bus images |
| POST | `/api/admin/buses/{id}/images` | Admin | Upload bus images (JPG/PNG/WEBP, content is verified) |
| PATCH | `/api/admin/buses/{id}/images/{imageId}/primary` | Admin | Set primary image |
| DELETE | `/api/admin/buses/{id}/images/{imageId}` | Admin | Delete image |

## Drivers

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/api/admin/drivers` | Admin | List drivers |
| POST | `/api/admin/drivers` | Admin | Create driver (new user account, or link an existing user with userId) |
| GET | `/api/admin/drivers/{id}` | Admin | Get driver |
| PUT | `/api/admin/drivers/{id}` | Admin | Update driver |
| DELETE | `/api/admin/drivers/{id}` | Admin | Delete driver |
| PATCH | `/api/admin/drivers/{id}/status` | Admin | Change driver status |
| GET | `/api/admin/drivers/{id}/documents` | Admin | List NIC / licence documents |
| POST | `/api/admin/drivers/{id}/documents/{type}` | Admin | Upload the NIC or licence scan (multipart field "document"; content is verified; replaces the previous one) |
| GET | `/api/admin/drivers/{id}/documents/{docId}/file` | Admin | Download a document (admin only) |
| DELETE | `/api/admin/drivers/{id}/documents/{docId}` | Admin | Delete a document |

## Tours

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/api/admin/tours` | Admin | List tours |
| POST | `/api/admin/tours` | Admin | Create tour (optionally with stops) |
| GET | `/api/admin/tours/{id}` | Admin | Get tour with stops and assignments |
| PUT | `/api/admin/tours/{id}` | Admin | Update tour |
| DELETE | `/api/admin/tours/{id}` | Admin | Delete tour |
| PATCH | `/api/admin/tours/{id}/status` | Admin | Change tour status (planned → ongoing → completed, or cancelled) |

## Tour stops

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/api/admin/tours/{id}/stops` | Admin | List stops |
| PUT | `/api/admin/tours/{id}/stops` | Admin | Replace all stops |
| POST | `/api/admin/tours/{id}/stops` | Admin | Add a stop |
| PUT | `/api/admin/tours/{id}/stops/{stopId}` | Admin | Update a stop |
| DELETE | `/api/admin/tours/{id}/stops/{stopId}` | Admin | Delete a stop |

## Assignments

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/api/admin/assignments/availability` | Admin | Which buses and drivers are free for a tour / time window |
| GET | `/api/admin/assignments` | Admin | List assignments |
| POST | `/api/admin/assignments` | Admin | Assign bus + driver to a tour (overlaps are rejected; e-mails are sent) |
| GET | `/api/admin/assignments/{id}` | Admin | Get assignment |
| PUT | `/api/admin/assignments/{id}` | Admin | Change bus / driver / window (re-assign after a rejection), or cancel with assignmentStatus=cancelled |
| DELETE | `/api/admin/assignments/{id}` | Admin | Delete assignment |
| POST | `/api/admin/assignments/{id}/resend` | Admin | Issue new response links and resend the e-mails |

## GPS

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/api/admin/gps/live` | Admin | Latest position of every bus that is on a tour right now (for the map) |
| GET | `/api/admin/buses/{id}/location` | Admin | Latest known location of a bus |
| GET | `/api/admin/buses/{id}/gps-history` | Admin | GPS history of a bus |
| GET | `/api/driver/gps/config` | Driver | Can I send GPS now, and how often? |
| POST | `/api/driver/gps` | Driver | Send one point, or { points: [...] } up to 100 (own confirmed assignment, tour ongoing). Single points faster than the minimum interval get 429 + Retry-After |

## Logs

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/api/admin/activity-logs` | Admin | Activity (audit) log |
| GET | `/api/admin/email-logs` | Admin | E-mail delivery log |

## Driver

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/api/driver/dashboard` | Driver | Driver dashboard |
| GET | `/api/driver/profile` | Driver | Driver profile |
| GET | `/api/driver/assignments` | Driver | My assignments |
| GET | `/api/driver/assignments/{id}` | Driver | One of my assignments |
| POST | `/api/driver/assignments/{id}/accept` | Driver | Accept an assignment |
| POST | `/api/driver/assignments/{id}/reject` | Driver | Reject an assignment |

## Notifications

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/api/notifications` | Any logged-in user | My notifications (history) |
| GET | `/api/notifications/unread-count` | Any logged-in user | Unread count |
| PATCH | `/api/notifications/read-all` | Any logged-in user | Mark all as read |
| PATCH | `/api/notifications/{id}/read` | Any logged-in user | Mark one as read |
| DELETE | `/api/notifications/{id}` | Any logged-in user | Delete a notification |

## Assignment links

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/api/assignment-actions/{token}` | Public | Preview an assignment from an e-mailed single-use token (does not use the token) |
| GET | `/api/assignment-actions/{token}/page` | Public | HTML page opened from the e-mail |
| POST | `/api/assignment-actions/respond` | Public | Accept / reject with the token (JSON) |
| POST | `/api/assignment-actions/respond-form` | Public | Accept / reject from the HTML page (form post) |
