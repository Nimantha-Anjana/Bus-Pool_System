const environment = require("../config/environment");

// Today's date (YYYY-MM-DD) in the system timezone (Asia/Colombo by default)
const getToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: environment.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

// Any Date -> YYYY-MM-DD in the system timezone
const toDateOnly = (date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: environment.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

// Strict YYYY-MM-DD check (rejects 2026-02-31 etc.)
const isValidDateOnly = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
  );
};

const addDays = (dateOnly, days) => {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

// ISO date-time string -> Date, or null when missing/invalid
const parseDateTime = (value) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

module.exports = { toDateOnly, getToday, isValidDateOnly, addDays, parseDateTime };
