import { api, USE_MOCK, unwrap } from "./http";
import { mockBusApi, paginate, wait } from "./mockStore";

export async function listBuses({ page = 1, limit = 10, search = "", status = "", ownerId = "", airConditioned = "" } = {}) {
  if (USE_MOCK) {
    await wait();
    return paginate(mockBusApi.list({ search, status, ownerId, airConditioned }), { page, limit });
  }
  const body = unwrap(await api.get("/admin/buses", {
    params: {
      page, limit,
      search: search || undefined, status: status || undefined,
      ownerId: ownerId || undefined, airConditioned: airConditioned || undefined,
    },
  }));
  return { items: body.data, pagination: body.pagination };
}

export async function listBusesByOwner(ownerId) {
  if (USE_MOCK) { await wait(200); return mockBusApi.list({ ownerId }); }
  return unwrap(await api.get("/admin/buses", { params: { ownerId } })).data;
}

export async function getBus(id) {
  if (USE_MOCK) { await wait(200); return mockBusApi.get(id); }
  return unwrap(await api.get(`/admin/buses/${id}`)).data;
}

// payload: { ownerId, registrationNumber, busName, busType, seatingCapacity, airConditioned, description, status, facilities[] }
export async function createBus(payload) {
  if (USE_MOCK) { await wait(); return mockBusApi.create(payload); }
  return unwrap(await api.post("/admin/buses", payload)).data;
}

export async function updateBus(id, payload) {
  if (USE_MOCK) { await wait(); return mockBusApi.update(id, { ...payload }); }
  return unwrap(await api.put(`/admin/buses/${id}`, payload)).data;
}

export async function deleteBus(id) {
  if (USE_MOCK) { await wait(); return mockBusApi.remove(id); }
  await api.delete(`/admin/buses/${id}`);
}

// status: "available" | "maintenance" | "inactive"
export async function setBusAvailability(id, status) {
  if (USE_MOCK) { await wait(250); return mockBusApi.setAvailability(id, status); }
  return unwrap(await api.patch(`/admin/buses/${id}/availability`, { status })).data;
}

// Images: multipart field "images", JPG/PNG/WEBP, max 5 MB each, max 5 per request
export async function uploadBusImages(id, files) {
  if (USE_MOCK) { await wait(); return mockBusApi.addImages(id, files); }
  const form = new FormData();
  files.forEach((file) => form.append("images", file));
  // do NOT set Content-Type - the browser adds the multipart boundary
  return unwrap(await api.post(`/admin/buses/${id}/images`, form)).data;
}

export async function setPrimaryBusImage(id, imageId) {
  if (USE_MOCK) { await wait(150); return mockBusApi.setPrimary(id, imageId); }
  await api.patch(`/admin/buses/${id}/images/${imageId}/primary`);
}

export async function deleteBusImage(id, imageId) {
  if (USE_MOCK) { await wait(150); return mockBusApi.removeImage(id, imageId); }
  await api.delete(`/admin/buses/${id}/images/${imageId}`);
}
