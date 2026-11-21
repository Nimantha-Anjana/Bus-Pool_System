import { api, USE_MOCK, unwrap } from "./http";
import { mockDriverApi } from "./mockDriverTour";
import { paginate, wait } from "./mockStore";

// Every function returns plain data so the pages never care whether it is mock or real.
// Endpoints: backend/docs/API_ENDPOINTS.md -> "Drivers"

export async function listDrivers({ page = 1, limit = 10, search = "", status = "", licenseExpiry = "" } = {}) {
  if (USE_MOCK) {
    await wait();
    return paginate(mockDriverApi.list({ search, status, licenseExpiry }), { page, limit });
  }
  const body = unwrap(await api.get("/admin/drivers", {
    params: { page, limit, search: search || undefined, status: status || undefined, licenseExpiry: licenseExpiry || undefined },
  }));
  return { items: body.data, pagination: body.pagination };
}

// Small helper for dropdowns / name lookups (all drivers, no paging)
export async function listAllDrivers() {
  if (USE_MOCK) { await wait(150); return mockDriverApi.list(); }
  return unwrap(await api.get("/admin/drivers")).data;
}

export async function getDriver(id) {
  if (USE_MOCK) { await wait(200); return mockDriverApi.get(id); }
  return unwrap(await api.get(`/admin/drivers/${id}`)).data;
}

// payload: { firstName, lastName, email, password, phone, nic, licenseNumber, licenseExpiryDate, address, emergencyContactName, emergencyContactPhone, status }
export async function createDriver(payload) {
  if (USE_MOCK) { await wait(); return mockDriverApi.create(payload); }
  return unwrap(await api.post("/admin/drivers", payload)).data;
}

// `password` in the payload = admin password reset (logs the driver out everywhere)
export async function updateDriver(id, payload) {
  if (USE_MOCK) { await wait(); return mockDriverApi.update(id, payload); }
  return unwrap(await api.put(`/admin/drivers/${id}`, payload)).data;
}

export async function deleteDriver(id) {
  if (USE_MOCK) { await wait(); return mockDriverApi.remove(id); }
  await api.delete(`/admin/drivers/${id}`);
}

// status: "active" | "inactive" | "suspended"
export async function setDriverStatus(id, status) {
  if (USE_MOCK) { await wait(250); return mockDriverApi.setStatus(id, status); }
  return unwrap(await api.patch(`/admin/drivers/${id}/status`, { status })).data;
}

/* ---------- NIC / licence documents (JPG, PNG, PDF - max 5 MB) ---------- */
// type: "nic" | "license"   (uploading again replaces the previous file)
export async function uploadDriverDocument(id, type, file) {
  if (USE_MOCK) { await wait(500); return mockDriverApi.uploadDocument(id, type, file); }
  const form = new FormData();
  form.append("document", file); // do NOT set Content-Type yourself
  return unwrap(await api.post(`/admin/drivers/${id}/documents/${type}`, form)).data;
}

export async function deleteDriverDocument(id, docId) {
  if (USE_MOCK) { await wait(300); return mockDriverApi.removeDocument(id, docId); }
  await api.delete(`/admin/drivers/${id}/documents/${docId}`);
}

// Documents are private: they need the bearer token, so fetch as a Blob (never a plain <img src>)
export async function fetchDriverDocumentBlob(id, docId) {
  if (USE_MOCK) { await wait(200); return mockDriverApi.documentFile(docId); }
  const response = await api.get(`/admin/drivers/${id}/documents/${docId}/file`, { responseType: "blob" });
  return response.data;
}
