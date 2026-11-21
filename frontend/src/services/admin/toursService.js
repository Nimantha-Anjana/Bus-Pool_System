import { api, USE_MOCK, unwrap } from "./http";
import { mockTourApi } from "./mockDriverTour";
import { paginate, wait } from "./mockStore";

// Endpoints: backend/docs/API_ENDPOINTS.md -> "Tours" and "Tour stops"
// status filter values: pending | scheduled | ongoing | completed | cancelled

const dayStart = (d) => new Date(`${d}T00:00:00`).toISOString();
const dayEnd = (d) => new Date(`${d}T23:59:59`).toISOString();

export async function listTours({ page = 1, limit = 10, search = "", status = "", tourType = "", from = "", to = "" } = {}) {
  if (USE_MOCK) {
    await wait();
    return paginate(mockTourApi.list({ search, status, tourType, from, to }), { page, limit });
  }
  const body = unwrap(await api.get("/admin/tours", {
    params: {
      page, limit, sort: "startAt", order: "desc",
      search: search || undefined, status: status || undefined, tourType: tourType || undefined,
      from: from ? dayStart(from) : undefined, to: to ? dayEnd(to) : undefined,
    },
  }));
  return { items: body.data, pagination: body.pagination };
}

// Tour with stops + assignments (assignments only carry id / status / busId / driverId)
export async function getTour(id) {
  if (USE_MOCK) { await wait(200); return mockTourApi.get(id); }
  return unwrap(await api.get(`/admin/tours/${id}`)).data;
}

// payload: { tourName, tourCode?, tourType, description, startLocation, destination, startAt, endAt,
//            pickupAt?, returnAt?, passengerCount, specialNotes, stops: [{ stopName, stopType, locationAddress,
//            latitude, longitude, plannedArrivalAt, notes }] }   (stop order = array order)
export async function createTour(payload) {
  if (USE_MOCK) { await wait(); return mockTourApi.create(payload); }
  return unwrap(await api.post("/admin/tours", payload)).data;
}

export async function updateTour(id, payload) {
  if (USE_MOCK) { await wait(); return mockTourApi.update(id, payload); }
  return unwrap(await api.put(`/admin/tours/${id}`, payload)).data;
}

export async function deleteTour(id) {
  if (USE_MOCK) { await wait(); return mockTourApi.remove(id); }
  await api.delete(`/admin/tours/${id}`);
}

// status: "ongoing" | "completed" | "cancelled"  (pending / scheduled are automatic)
export async function setTourStatus(id, status) {
  if (USE_MOCK) { await wait(250); return mockTourApi.setStatus(id, status); } // may include `warning`
  const body = unwrap(await api.patch(`/admin/tours/${id}/status`, { status }));
  return { ...body.data, warning: body.warning }; // warning: e.g. started without a confirmed bus
}
