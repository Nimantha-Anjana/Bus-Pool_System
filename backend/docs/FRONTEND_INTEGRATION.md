# Frontend integration guide

Base URL: `VITE_API_URL` (e.g. `http://localhost:5000`). Every endpoint is listed in `API_ENDPOINTS.md`;
the interactive version (with request bodies) is `GET /api/docs` while the API runs in development.

## 1. Response and error format

```json
{ "success": true,  "message": "Buses retrieved successfully.", "data": [], "pagination": { "page": 1, "limit": 20, "total": 50, "totalPages": 3 } }
{ "success": false, "message": "Registration number already exists." }
```

| Status | Meaning | What the UI should do |
|---|---|---|
| 400 | invalid input / invalid ID | show `message` next to the form |
| 401 | missing / expired access token | try ONE refresh (section 2), then go to the login page |
| 403 | wrong role, or account suspended | show "not allowed" |
| 404 | record not found | show "not found" |
| 409 | duplicate, overlap, record still in use, wrong state | show `message` (it says what conflicts) |
| 413 | payload / file too large | show `message` |
| 429 | too many requests / failed logins / GPS too frequent | wait `Retry-After` seconds |
| 500 / 503 | server / database problem | generic "try again later" |

## 2. Authentication and refresh tokens

* `POST /api/auth/login` `{ email, password }` returns `data.accessToken` (15 min) and sets an **HTTP-only refresh cookie**
  (path `/api/auth`, 7 days). Keep the access token **in memory** (a React context / variable), not in localStorage.
* Send `Authorization: Bearer <accessToken>` on every request.
* Every request that talks to the API from the browser must use `withCredentials: true` (the cookie is cross-origin in development).
* The cookie is `SameSite=Lax`, which works when the site and the API share a registrable domain (`app.example.lk` + `api.example.lk`).
  If they are on different domains (for example a `vercel.app` frontend and a `onrender.com` API) set `COOKIE_SAMESITE=none` in the backend `.env` (HTTPS required).
* When a request returns **401**: call `POST /api/auth/refresh` once (the cookie is sent automatically). It returns a new access token
  and **rotates** the refresh token. If refresh also returns 401, the session is over: clear state and redirect to login.
* **Serialise refreshes**: if several requests fail at once, they must wait for the same refresh call (see the interceptor below),
  otherwise the second call uses an already rotated token.
* Logout: `POST /api/auth/logout` (this device) or `POST /api/auth/logout-all`. Changing the password logs out everywhere.
* After a page reload there is no access token in memory: call `/api/auth/refresh` first, then continue.

```js
// src/api/client.js
import axios from "axios";

const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL}/api`, withCredentials: true });
let accessToken = null;
let refreshing = null; // the one refresh call everybody waits for

export const setAccessToken = (token) => { accessToken = token; };

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthCall = original?.url?.startsWith("/auth/");
    if (error.response?.status !== 401 || original._retried || isAuthCall) throw error;

    original._retried = true;
    refreshing ||= api.post("/auth/refresh").finally(() => { refreshing = null; });

    try {
      const { data } = await refreshing;
      accessToken = data.data.accessToken;
      original.headers.Authorization = `Bearer ${accessToken}`;
      return api(original);
    } catch (refreshError) {
      accessToken = null;
      window.location.assign("/login");
      throw refreshError;
    }
  }
);

export default api;
```

## 3. Lists: pagination, search, filters, sorting

All admin lists accept `?page=1&limit=20` (max 100), `?sort=<field>&order=asc|desc` and their own filters
(`search`, `status`, ...). Allowed `sort` values per endpoint are in the Swagger UI. Without `page`/`limit`
the old behaviour (everything in one array) is kept. `activity-logs`, `email-logs` and `notifications` always paginate.

## 4. Image / document upload

* Bus images: `POST /api/admin/buses/:id/images`, `multipart/form-data`, field **`images`** (several files), JPG/PNG/WEBP.
* Driver NIC / licence: `POST /api/admin/drivers/:id/documents/nic|license`, field **`document`**, JPG/PNG/PDF.
* Do NOT set `Content-Type` yourself with `FormData` (the browser adds the boundary). Check size on the client first
  (limit: 5 MB per file, at most 5 images per request; the server explains violations in the 400 message).
* Bus images are public files at the returned `imageUrl`. Driver documents are private: fetch them with the bearer token
  (`GET /api/admin/drivers/:id/documents/:docId/file`, use `responseType: "blob"`), never as a plain `<img src>`.

## 5. GPS

**Driver (browser or mobile app)**

1. `GET /api/driver/gps/config` -> `{ canSend, minIntervalSeconds, recommendedIntervalSeconds }`. Start tracking only when `canSend` is true
   (confirmed assignment and the admin has started the tour); stop when it becomes false or a send returns 409.
2. `navigator.geolocation.watchPosition(...)`, then `POST /api/driver/gps` `{ latitude, longitude, accuracy, speed, heading }`
   at most every `recommendedIntervalSeconds`. A faster single point gets **429** with `Retry-After`.
3. Offline? Buffer the points (with `recordedAt`) and send them later as `{ points: [ ... up to 100 ] }`.
4. Handle `GeolocationPositionError`: `1` PERMISSION_DENIED (explain how to enable location), `2` POSITION_UNAVAILABLE and `3` TIMEOUT (keep trying).

**Admin map (Google Maps)**

* `GET /api/admin/gps/live` -> one row per bus that is on a tour (`location`, `isLive`, `driver`, `tour`). Poll it every 10-15 s.
* `GET /api/admin/buses/:id/location` (latest) and `/gps-history?from=&to=` (route line).
* Every point has `googleMapsUrl`. For the map use the Google Maps JavaScript API with `VITE_GOOGLE_MAPS_API_KEY`
  (restrict that key to your domain in the Google Cloud console).

## 6. Public e-mail links

Owners answer from the e-mail: `GET /api/assignment-actions/:token/page` is a ready-made HTML page served by the API
(no frontend work needed). Drivers can also answer inside the app: `POST /api/driver/assignments/:id/accept|reject`.

## 7. Frontend environment

`frontend/.env` (see `frontend/.env.example`):

```
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_MAPS_API_KEY=
```

Backend `.env`: `FRONTEND_URL` must contain the exact origin of the frontend (scheme + host + port, no trailing slash;
several origins separated by commas), otherwise the browser blocks the calls (CORS).
