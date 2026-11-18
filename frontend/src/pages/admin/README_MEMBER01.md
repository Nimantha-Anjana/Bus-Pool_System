# Member 01 – Admin Dashboard, Bus Owners, Buses, Admin Profile

## 1. One-time hook-up (App.jsx is a shared file, so the team lead adds these 2 lines)

```jsx
// top of App.jsx
import { memberOneRoutes } from "./pages/admin/adminRoutes";

// inside <Route path="/admin" element={<AdminLayout />}>, ABOVE the existing <Route path="*" ... /> line
{memberOneRoutes}
```

| URL | Page |
|---|---|
| /admin/dashboard | Dashboard (already routed; `AdminDashboard.jsx` was replaced) |
| /admin/owners, /admin/owners/:id | Owner list (add / edit / delete in modals, search, filter), owner details |
| /admin/buses, /admin/buses/new, /admin/buses/:id, /admin/buses/:id/edit | Bus list, add / edit, details |
| /admin/settings (also /admin/profile) | Admin profile + change password |

## 2. Mock data vs real API
`src/services/admin/http.js` picks the data source:
* `src/api/client.js` exists  -> real API (shape from backend/docs/FRONTEND_INTEGRATION.md)
* `src/api/client.js` missing, or `VITE_USE_MOCK=true` -> in-memory mock data (same rules as the backend: duplicates, delete protection, ...)

Pages only call `src/services/admin/*Service.js`, so no page code changes when the API goes live.

## 3. Folders (nothing shared was edited)
* `src/pages/admin/{dashboard,owners,buses,profile}/` – pages
* `src/components/admin-ui/` – reusable Button, DataTable, Modal, ConfirmDialog, FormField, Pagination, FilterBar, StatusBadge, Alert, toasts, `admin-ui.css` (every class starts with `bp-`)
* `src/services/admin/` – API calls + mock data

## 4. Things to discuss with the team (backend is not changed)
1. **`PUT /api/admin/profile` does not exist.** Edit Profile is built, but saving will show a clear "not available yet" message until the backend adds it.
2. **`src/api/client.js` is not in the zip** (only described in FRONTEND_INTEGRATION.md) – pages run on mock data until it is added.
3. The dashboard "Assigned Buses" uses `buses.assigned`, "Upcoming Tours" uses planned tours (`/admin/tours?status=planned`), "Recent Activities" uses `/admin/activity-logs`.
4. Owner list has no bus-count column because `GET /admin/bus-owners` does not return one; the owner details page lists the owner's buses instead.
