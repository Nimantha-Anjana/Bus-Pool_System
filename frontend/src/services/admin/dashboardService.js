import { api, USE_MOCK, unwrap } from "./http";
import { mockDashboard, mockTours, mockActivities } from "./mockData";
import { mockBusApi, wait } from "./mockStore";

// GET /api/admin/dashboard
export async function getDashboard() {
  if (USE_MOCK) {
    await wait();
    const live = mockBusApi.stats();
    return {
      ...mockDashboard,
      summary: {
        ...mockDashboard.summary,
        totalBuses: live.buses.total,
        availableBuses: live.buses.available,
        unavailableBuses: live.buses.total - live.buses.available,
        totalBusOwners: live.owners.total,
      },
      buses: { ...mockDashboard.buses, ...live.buses },
    };
  }
  return unwrap(await api.get("/admin/dashboard")).data;
}

// Upcoming = planned tours (GET /api/admin/tours?status=planned)
export async function getUpcomingTours(limit = 5) {
  if (USE_MOCK) { await wait(200); return mockTours.slice(0, limit); }
  const body = unwrap(await api.get("/admin/tours", { params: { status: "planned", page: 1, limit, sort: "startAt", order: "asc" } }));
  return body.data;
}

// GET /api/admin/activity-logs
export async function getRecentActivities(limit = 6) {
  if (USE_MOCK) { await wait(200); return mockActivities.slice(0, limit); }
  return unwrap(await api.get("/admin/activity-logs", { params: { page: 1, limit } })).data;
}
