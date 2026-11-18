import { api, USE_MOCK, unwrap } from "./http";
import { mockProfile } from "./mockData";
import { fail, wait } from "./mockStore";

let mockCurrent = { ...mockProfile };

// GET /api/admin/profile  ->  data.user
export async function getProfile() {
  if (USE_MOCK) { await wait(200); return { ...mockCurrent }; }
  return unwrap(await api.get("/admin/profile")).data.user;
}

// NOTE: the backend has no "update profile" endpoint yet (only GET /admin/profile).
// This calls PUT /admin/profile - agree the endpoint with the team before enabling it.
export async function updateProfile(payload) {
  if (USE_MOCK) { await wait(); mockCurrent = { ...mockCurrent, ...payload }; return { ...mockCurrent }; }
  try {
    return unwrap(await api.put("/admin/profile", payload)).data.user;
  } catch (error) {
    if ([404, 405].includes(error?.response?.status)) {
      throw new Error("Profile update is not available on the backend yet. Please ask the team to add PUT /api/admin/profile.");
    }
    throw error;
  }
}

// POST /api/auth/change-password  (backend logs the user out everywhere afterwards)
export async function changePassword({ currentPassword, newPassword, confirmPassword }) {
  if (USE_MOCK) {
    await wait();
    if (currentPassword === "wrong") throw fail(400, "Current password is incorrect.");
    return;
  }
  await api.post("/auth/change-password", { currentPassword, newPassword, confirmPassword });
}
