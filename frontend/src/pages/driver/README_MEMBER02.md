# Member 02 – Driver & Tour Management

Driver Management, Tour Management (admin side), Driver Dashboard and Driver Portal.

## 1. One-time hook-up (App.jsx is shared, so the team lead adds these lines)

```jsx
// top of App.jsx
import { memberTwoAdminRoutes } from "./pages/admin/memberTwoAdminRoutes";
import { driverPortalRoutes, driverLoginRoute } from "./pages/driver/driverRoutes";

// 1) inside <Route path="/admin" element={<AdminLayout />}>, ABOVE its  <Route path="*" ... />
{memberTwoAdminRoutes}

// 2) inside <Route path="/driver" element={<DriverLayout />}>, ABOVE its  <Route path="*" ... />
{driverPortalRoutes}

// 3) top level, next to the other routes (outside the layouts: the login page has no sidebar)
{driverLoginRoute}
```

| URL | Page |
|---|---|
| /admin/drivers | Driver list – search, status + licence-expiry filters, activate / deactivate, delete |
| /admin/drivers/new, /admin/drivers/:id/edit | Add / edit driver (NIC, licence, expiry, emergency contact, optional documents) |
| /admin/drivers/:id | Driver profile – NIC details, licence + expiry status, documents upload / view / delete, status |
| /admin/tours | Tour list – search, status / type / date filters |
| /admin/tours/new, /admin/tours/:id/edit | Create / edit tour – local / foreign, dates, start / destination, multiple pickup / stop / drop locations |
| /admin/tours/:id | Tour details – route timeline, assignments, start / complete / cancel |
| /driver/login | Driver login (outside the layout) |
| /driver/dashboard | Assigned, pending, upcoming, completed, current tour, recent notifications |
| /driver/tours, /driver/tours/:id | My tours (tabs + search), tour details (`:id` = assignment id) |
| /driver/requests | Accept / reject (reject needs a reason, like the API) |
| /driver/tracking | GPS sharing controls |
| /driver/profile | Profile, change password, logout |

## 2. Mock data vs real API
Same switch as Member 01 (`src/services/admin/http.js`): no `src/api/client.js`, or `VITE_USE_MOCK=true` -> in-memory mock data
(`services/admin/mockDriverTour.js`, same rules as the backend). Demo driver login: `driver@buspool.lk` / `Driver123`.
Pages only call `services/admin/driversService.js`, `toursService.js` and `services/driver/*`, so nothing changes in the pages when the API goes live.

`services/driver/session.js` expects `src/api/client.js` to export `setAccessToken` (as in `FRONTEND_INTEGRATION.md` section 2).
After a page reload it calls `POST /auth/refresh` then `GET /driver/profile` to restore the session.

## 3. Files (no forbidden shared file was edited)
* `pages/admin/{drivers,tours}/`, `pages/admin/memberTwoAdminRoutes.jsx`
* `pages/driver/` (portal pages, `useGpsSharing.js`, `driverRoutes.jsx`, `driver-portal.css`, classes start with `dp-`)
* `layouts/DriverLayout.jsx` – rewritten (login guard, badges, logout, mobile logout). It is not on the "do not touch" list and `App.jsx` already uses it.
* `pages/driver/DriverDashboard.jsx` – replaced the placeholder.
* `components/driver-tour/` – shared pieces (`dt-` classes); reuses Member 01's `components/admin-ui` kit.
* `services/admin/{driversService,toursService,mockDriverTour}.js`, `services/driver/{session,portalService}.js`

## 4. Backend gaps / things to discuss (backend not changed)
1. `GET /api/driver/profile` returns only the logged-in user, not NIC / licence. The profile page shows those sections only when a `driver` object is returned.
2. There is no driver dashboard stats endpoint: counts are derived from `GET /api/driver/assignments` (`classify()` in `portalService.js`).
3. `GET /api/admin/tours/:id` returns assignments with ids only, so the tour page shows driver names via `GET /admin/drivers` and "Bus #id".
4. Driver documents are private: they are opened as Blob URLs with the bearer token.
5. Browser GPS only works while the page is open (and on HTTPS); the page keeps the screen awake and buffers offline points.
6. Not run against the real API or built with Vite here (no dependencies / network in the sandbox): please run `npm install && npm run dev` once.
