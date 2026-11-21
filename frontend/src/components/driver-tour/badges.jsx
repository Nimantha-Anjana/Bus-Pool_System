import { licenseState } from "./utils";
import "./driver-tour.css";

const TOUR_COLORS = { pending: "orange", scheduled: "blue", ongoing: "purple", completed: "green", cancelled: "red", planned: "orange" };
const ASSIGN_COLORS = { pending: "orange", confirmed: "green", completed: "green", rejected: "red", cancelled: "gray", accepted: "green" };
const cap = (s) => String(s || "unknown").replace(/^./, (c) => c.toUpperCase());

// Uses displayStatus (pending / scheduled / ongoing / completed / cancelled) from the API
export function TourStatusBadge({ status }) {
  return <span className={`bp-badge ${TOUR_COLORS[status] || "gray"}`}>{cap(status)}</span>;
}

export function AssignmentBadge({ status }) {
  return <span className={`bp-badge ${ASSIGN_COLORS[status] || "gray"}`}>{cap(status)}</span>;
}

export function TourTypeBadge({ type }) {
  return <span className={`dt-type ${type}`}>{type === "foreign" ? "Foreign" : "Local"}</span>;
}

export function LicenseBadge({ expiryDate, showDays = true }) {
  const state = licenseState(expiryDate);
  return <span className={`bp-badge ${state.color}`}>{showDays ? state.label : cap(state.key)}</span>;
}
