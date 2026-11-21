// Small helpers shared by the Driver / Tour pages (Member 02).

const pad = (n) => String(n).padStart(2, "0");

/* ---------- dates ---------- */
// ISO string -> value for <input type="datetime-local">
export const toLocalInput = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
// <input type="datetime-local"> value -> ISO string (what the API expects)
export const fromLocalInput = (value) => (value ? new Date(value).toISOString() : null);

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const daysUntil = (dateOnly) =>
  Math.round((new Date(`${dateOnly}T00:00:00`) - new Date(`${todayISO()}T00:00:00`)) / 86400000);

export const formatTime = (value) =>
  value ? new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—";

export const formatRange = (start, end) => {
  if (!start || !end) return "—";
  const fmt = (v) => new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return fmt(start) === fmt(end) ? fmt(start) : `${fmt(start)} → ${fmt(end)}`;
};

/* ---------- licence ---------- */
export const EXPIRING_SOON_DAYS = 30;

// -> { key: "expired" | "expiring" | "valid", label, color, days }
export const licenseState = (expiryDate) => {
  if (!expiryDate) return { key: "unknown", label: "Unknown", color: "gray", days: null };
  const days = daysUntil(expiryDate);
  if (days < 0) return { key: "expired", label: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`, color: "red", days };
  if (days <= EXPIRING_SOON_DAYS) return { key: "expiring", label: days === 0 ? "Expires today" : `Expires in ${days} day${days === 1 ? "" : "s"}`, color: "orange", days };
  return { key: "valid", label: "Valid", color: "green", days };
};

/* ---------- Sri Lankan NIC -> birth date + gender (informational only) ---------- */
export const parseNic = (nic) => {
  const value = String(nic || "").trim().toUpperCase();
  let year; let days;
  if (/^\d{9}[VX]$/.test(value)) { year = 1900 + Number(value.slice(0, 2)); days = Number(value.slice(2, 5)); }
  else if (/^\d{12}$/.test(value)) { year = Number(value.slice(0, 4)); days = Number(value.slice(4, 7)); }
  else return null;

  const gender = days > 500 ? "Female" : "Male";
  if (days > 500) days -= 500;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  if (!leap && days > 59) days -= 1; // NIC numbering always counts 29 Feb
  if (days < 1 || days > 366) return null;
  const date = new Date(year, 0, days);
  if (date.getFullYear() !== year) return null;
  return { gender, birthDate: `${year}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` };
};

/* ---------- files ---------- */
export const MAX_FILE_MB = 5;
export const DOC_TYPES = ["image/jpeg", "image/png", "application/pdf"];

export const formatFileSize = (bytes = 0) =>
  bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export const validateDocument = (file) => {
  if (!file) return "";
  if (!DOC_TYPES.includes(file.type)) return "Only JPG, PNG or PDF files are allowed.";
  if (file.size > MAX_FILE_MB * 1024 * 1024) return `File is too large (max ${MAX_FILE_MB} MB).`;
  return "";
};

/* ---------- misc ---------- */
export const fullName = (user) => [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "—";

export const mapsLink = (lat, lng, label) =>
  lat != null && lng != null
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : label ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}` : null;

export const STOP_TYPE_LABEL = { pickup: "Pickup", stop: "Stop", drop: "Drop-off" };

// Same rules as backend/src/utils/validators.js
export const LICENSE_REGEX = /^[A-Za-z0-9-]{6,20}$/;
export const isStrongPassword = (v = "") => v.length >= 8 && v.length <= 72 && /[A-Za-z]/.test(v) && /\d/.test(v);
