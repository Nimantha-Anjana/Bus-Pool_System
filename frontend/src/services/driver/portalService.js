import { api, USE_MOCK, unwrap } from "../admin/http";
import { mockPortalApi } from "../admin/mockDriverTour";
import { fail, wait } from "../admin/mockStore";
import { getSession } from "./session";

// Everything the Driver Portal needs. Endpoints: backend/docs/API_ENDPOINTS.md -> "Driver", "GPS", "Notifications"

/* ---------- classification (the API has no stats endpoint, so we derive them) ---------- */
// request   = waiting for MY answer          awaiting = I accepted, waiting for the bus owner
// upcoming  = confirmed, tour not started    current  = confirmed, tour ongoing
// completed = finished                       closed   = rejected / cancelled
export const classify = (a) => {
  if (a.assignmentStatus === "completed") return "completed";
  if (["rejected", "cancelled"].includes(a.assignmentStatus)) return "closed";
  if (a.assignmentStatus === "confirmed") return a.tour?.status === "ongoing" ? "current" : "upcoming";
  if (a.assignmentStatus === "pending") return a.driverStatus === "pending" ? "request" : "awaiting";
  return "closed";
};

/* ---------- assignments (= "my tours") ---------- */
export async function getMyAssignments(status = "") {
  if (USE_MOCK) { await wait(); return mockPortalApi.assignments({ status }); }
  return unwrap(await api.get("/driver/assignments", { params: { status: status || undefined } })).data;
}

export async function getMyAssignment(id) {
  if (USE_MOCK) { await wait(200); return mockPortalApi.assignment(id); }
  return unwrap(await api.get(`/driver/assignments/${id}`)).data;
}

// response: "accepted" | "rejected"   (rejecting needs a reason of 3-1000 characters)
export async function respondToAssignment(id, response, reason = "") {
  if (USE_MOCK) { await wait(400); return mockPortalApi.respond(id, response, reason); }
  const action = response === "accepted" ? "accept" : "reject";
  return unwrap(await api.post(`/driver/assignments/${id}/${action}`, reason ? { reason } : {})).data;
}

/* ---------- notifications ---------- */
export async function getNotifications({ page = 1, limit = 5 } = {}) {
  if (USE_MOCK) { await wait(150); return mockPortalApi.notifications({ page, limit }); }
  const body = unwrap(await api.get("/notifications", { params: { page, limit } }));
  return { items: body.data, pagination: body.pagination };
}

export async function getUnreadCount() {
  if (USE_MOCK) return mockPortalApi.unreadCount();
  return unwrap(await api.get("/notifications/unread-count")).data.unreadCount;
}

export async function markNotificationRead(id) {
  if (USE_MOCK) return mockPortalApi.markRead(id);
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead() {
  if (USE_MOCK) return mockPortalApi.markAllRead();
  await api.patch("/notifications/read-all");
}

/* ---------- dashboard ---------- */
export async function getDriverOverview() {
  const [assignments, notes, unread, gps] = await Promise.all([
    getMyAssignments(), getNotifications({ page: 1, limit: 5 }), getUnreadCount(), getGpsConfig().catch(() => null),
  ]);
  const groups = { request: [], awaiting: [], upcoming: [], current: [], completed: [], closed: [] };
  assignments.forEach((a) => groups[classify(a)].push(a));
  const byStart = (x, y) => new Date(x.assignedStartAt) - new Date(y.assignedStartAt);
  groups.upcoming.sort(byStart); groups.request.sort(byStart); groups.awaiting.sort(byStart);
  return {
    counts: {
      assigned: assignments.length - groups.closed.length,
      pending: groups.request.length,
      upcoming: groups.upcoming.length + groups.awaiting.length,
      completed: groups.completed.length,
    },
    groups, currentTour: groups.current[0] || null,
    notifications: notes.items, unread, gps,
  };
}

/* ---------- GPS ---------- */
// -> { canSend, assignments, minIntervalSeconds, recommendedIntervalSeconds, maxPointsPerRequest }
export async function getGpsConfig() {
  if (USE_MOCK) { await wait(150); return mockPortalApi.gpsConfig(); }
  return unwrap(await api.get("/driver/gps/config")).data;
}

// points: [{ latitude, longitude, accuracy, speed, heading, recordedAt }]  (1 point = live, many = offline batch, max 100)
export async function sendGpsPoints(points, assignmentId) {
  if (USE_MOCK) { await wait(150); return mockPortalApi.saveGps(points); }
  const body = points.length === 1
    ? { ...points[0], assignmentId }
    : { points, assignmentId };
  return unwrap(await api.post("/driver/gps", body)).data;
}

/* ---------- profile / password ---------- */
// The real GET /api/driver/profile only returns the logged-in user (data.user). NIC / licence appear only if the
// backend adds them (see README_MEMBER02.md) - the page shows those sections only when `driver` is present.
export async function getMyProfile() {
  if (USE_MOCK) { await wait(200); return mockPortalApi.profile(getSession().user?.driverId); }
  const data = unwrap(await api.get("/driver/profile")).data;
  return { user: data.user, driver: data.driver || null };
}

// POST /api/auth/change-password (the backend then signs the user out on every device)
export async function changePassword({ currentPassword, newPassword, confirmPassword }) {
  if (USE_MOCK) {
    await wait(400);
    if (newPassword !== confirmPassword) throw fail(400, "New password and confirm password do not match.");
    return mockPortalApi.changePassword(currentPassword, newPassword);
  }
  await api.post("/auth/change-password", { currentPassword, newPassword, confirmPassword });
}
