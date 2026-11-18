import { api, USE_MOCK, unwrap } from "./http";
import { mockOwnerApi, paginate, wait } from "./mockStore";

// Every function returns plain data so the pages never care whether it is mock or real.

export async function listOwners({ page = 1, limit = 10, search = "", status = "" } = {}) {
  if (USE_MOCK) {
    await wait();
    return paginate(mockOwnerApi.list({ search, status }), { page, limit });
  }
  const body = unwrap(await api.get("/admin/bus-owners", {
    params: { page, limit, search: search || undefined, status: status || undefined },
  }));
  return { items: body.data, pagination: body.pagination };
}

// Small helper for dropdowns (all owners, no paging)
export async function listAllOwners() {
  if (USE_MOCK) {
    await wait(150);
    return mockOwnerApi.list();
  }
  return unwrap(await api.get("/admin/bus-owners")).data;
}

export async function getOwner(id) {
  if (USE_MOCK) { await wait(200); return mockOwnerApi.get(id); }
  return unwrap(await api.get(`/admin/bus-owners/${id}`)).data;
}

export async function createOwner(payload) {
  if (USE_MOCK) { await wait(); return mockOwnerApi.create(payload); }
  return unwrap(await api.post("/admin/bus-owners", payload)).data;
}

export async function updateOwner(id, payload) {
  if (USE_MOCK) { await wait(); return mockOwnerApi.update(id, payload); }
  return unwrap(await api.put(`/admin/bus-owners/${id}`, payload)).data;
}

export async function deleteOwner(id) {
  if (USE_MOCK) { await wait(); return mockOwnerApi.remove(id); }
  await api.delete(`/admin/bus-owners/${id}`);
}
