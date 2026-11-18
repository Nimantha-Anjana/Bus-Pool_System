// Single place where the admin pages talk to the backend.
// Uses the shared axios instance (src/api/client.js) when it exists.
// If that file is not in the project yet (or VITE_USE_MOCK=true) the pages run on mock data.
const clientModules = import.meta.glob("/src/api/client.js", { eager: true });

export const api = clientModules["/src/api/client.js"]?.default ?? null;
export const USE_MOCK = !api || import.meta.env.VITE_USE_MOCK === "true";

const API_ORIGIN = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

// Bus images come back as "/uploads/..." - make them absolute for <img src>
export const assetUrl = (url) => {
  if (!url) return "";
  if (/^(https?:|blob:|data:)/.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
};

export const getErrorMessage = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  "Something went wrong. Please try again.";

// Backend envelope: { success, message, data, pagination }
export const unwrap = (response) => response.data;
