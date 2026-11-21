// Driver Portal session: who is logged in, login / logout / restore.
// Access token lives in memory only (see backend/docs/FRONTEND_INTEGRATION.md section 2).
// Mock mode keeps just the demo user in sessionStorage so a page refresh does not log you out.
import { useSyncExternalStore } from "react";
import { api, USE_MOCK, unwrap } from "../admin/http";
import { mockPortalApi } from "../admin/mockDriverTour";
import { wait } from "../admin/mockStore";

// src/api/client.js (shared, owned by the team lead) is expected to export setAccessToken - see the docs.
const clientModules = import.meta.glob("/src/api/client.js", { eager: true });
const setAccessToken = clientModules["/src/api/client.js"]?.setAccessToken ?? (() => {});

const MOCK_KEY = "bp_driver_mock_session";
const listeners = new Set();
let snapshot = { user: null, status: "idle" }; // status: idle | loading | ready

const publish = (next) => {
  snapshot = next;
  listeners.forEach((l) => l());
};

export function useDriverSession() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => snapshot
  );
}

export const getSession = () => snapshot;

// Called once when the portal opens (or the page is reloaded)
export async function restoreSession() {
  if (snapshot.status !== "idle") return;
  publish({ user: null, status: "loading" });

  if (USE_MOCK) {
    let user = null;
    try { user = JSON.parse(sessionStorage.getItem(MOCK_KEY) || "null"); } catch { user = null; }
    publish({ user, status: "ready" });
    return;
  }

  try {
    const refreshed = unwrap(await api.post("/auth/refresh")).data; // uses the HTTP-only refresh cookie
    setAccessToken(refreshed.accessToken);
    const profile = unwrap(await api.get("/driver/profile")).data.user;
    publish({ user: profile, status: "ready" });
  } catch {
    setAccessToken(null);
    publish({ user: null, status: "ready" });
  }
}

export async function loginDriver(email, password) {
  if (USE_MOCK) {
    await wait(500);
    const user = mockPortalApi.login(email, password);
    sessionStorage.setItem(MOCK_KEY, JSON.stringify(user));
    publish({ user, status: "ready" });
    return user;
  }

  const data = unwrap(await api.post("/auth/login", { email: email.trim(), password })).data;
  if (data.user?.role !== "Driver") {
    await api.post("/auth/logout").catch(() => {}); // clear the refresh cookie of the wrong role
    const error = new Error("This portal is for drivers only. Admins please use the admin panel.");
    error.response = { status: 403, data: { message: error.message } };
    throw error;
  }
  setAccessToken(data.accessToken);
  publish({ user: data.user, status: "ready" });
  return data.user;
}

export async function logoutDriver() {
  try {
    if (USE_MOCK) await wait(200);
    else await api.post("/auth/logout");
  } catch {
    // ignore: the local session is cleared either way
  }
  clearSession();
}

// Also used after "change password" (the backend signs the user out everywhere)
export function clearSession() {
  sessionStorage.removeItem(MOCK_KEY);
  setAccessToken(null);
  publish({ user: null, status: "ready" });
}
