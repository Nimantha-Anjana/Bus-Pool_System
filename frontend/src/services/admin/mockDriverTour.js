// In-memory fake backend for Drivers, Tours, Driver assignments, GPS and Notifications (Member 02).
// Same rules as the real API (duplicates, delete protection, status transitions, ...).
// Used automatically when src/api/client.js does not exist yet, or when VITE_USE_MOCK=true.
import { mockBuses } from "./mockData";
import { fail, paginate } from "./mockStore";

export const MOCK_DRIVER_ID = 1; // the driver who is "logged in" in the Driver Portal demo
export const MOCK_DRIVER_LOGIN = { email: "driver@buspool.lk", password: "Driver123" };

const clone = (v) => structuredClone(v);
const includes = (value, term) => String(value ?? "").toLowerCase().includes(term);
const pad = (n) => String(n).padStart(2, "0");

const atDay = (offset, hour = 8) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const dateOnly = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const todayStr = () => dateOnly(0);

/* ============================ drivers ============================ */
const driver = (id, first, last, nic, lic, expiryOffset, status, phone, city, doc = true) => ({
  id, userId: 200 + id, nic, licenseNumber: lic, licenseExpiryDate: dateOnly(expiryOffset),
  address: `${10 + id}, Main Street, ${city}`,
  emergencyContactName: `${last} (relative)`, emergencyContactPhone: `07${id % 10}1234567`,
  profileImage: null, status, createdAt: atDay(-120 + id, 9),
  user: {
    id: 200 + id, firstName: first, lastName: last, email: `${first.toLowerCase()}.${last.toLowerCase()}@buspool.lk`,
    phone, status, lastLoginAt: atDay(-id, 7),
  },
  documents: doc
    ? [{ id: id * 10 + 1, documentType: "nic", originalName: `${first.toLowerCase()}-nic.pdf`, mimeType: "application/pdf", fileSize: 210000, createdAt: atDay(-100, 10) }]
    : [],
});

const state = {
  drivers: [
    { ...driver(1, "Kamal", "Perera", "198512345678", "B1234567", 400, "active", "0771234567", "Negombo"),
      user: { id: 201, firstName: "Kamal", lastName: "Perera", email: MOCK_DRIVER_LOGIN.email, phone: "0771234567", status: "active", lastLoginAt: atDay(0, 6) } },
    driver(2, "Nimal", "Silva", "912345678V", "B2345678", 20, "active", "0712345678", "Colombo"),
    driver(3, "Sunil", "Fernando", "197845612345", "B3456789", -15, "inactive", "0723456789", "Kandy", false),
    driver(4, "Ruwan", "Jayasinghe", "883456789V", "B4567890", 700, "active", "0754567890", "Galle"),
    driver(5, "Chaminda", "Bandara", "199023456789", "B5678901", 200, "active", "0765678901", "Matara"),
    driver(6, "Lasantha", "Wickramasinghe", "761234567V", "B6789012", 25, "active", "0786789012", "Kurunegala"),
    driver(7, "Priyantha", "Gunawardena", "199534567890", "B7890123", 900, "suspended", "0707890123", "Jaffna", false),
    driver(8, "Dilan", "Rathnayake", "902345678V", "B8901234", 365, "active", "0778901234", "Ratnapura"),
    driver(9, "Asanka", "Herath", "198945678901", "B9012345", 60, "inactive", "0719012345", "Badulla"),
    driver(10, "Tharindu", "Madushanka", "200012345678", "B0123456", 500, "active", "0750123456", "Anuradhapura"),
  ],
  nextDriverId: 100,
  nextDocId: 1000,
  files: new Map(), // docId -> File (so "View" works in the demo)
};

/* ============================ tours ============================ */
const stop = (order, type, name, address, lat, lng, offsetDay, hour) => ({
  id: order, stopOrder: order, stopType: type, stopName: name, locationAddress: address,
  latitude: lat, longitude: lng, plannedArrivalAt: atDay(offsetDay, hour), notes: null,
});

const tour = (id, code, name, type, from, to, startOffset, days, passengers, status, stops, notes = "") => ({
  id, tourCode: code, tourName: name, tourType: type, description: `${name} - guided group tour.`,
  startLocation: from, destination: to, startAt: atDay(startOffset, 6), endAt: atDay(startOffset + days, 20),
  pickupAt: atDay(startOffset, 5), returnAt: null, passengerCount: passengers, status,
  specialNotes: notes, createdBy: 1, createdAt: atDay(startOffset - 30, 9),
  creator: { id: 1, firstName: "System", lastName: "Admin" },
  stops: stops.map((s, i) => ({ ...s, id: id * 100 + i + 1, tourId: id, stopOrder: i + 1 })),
});

state.tours = [
  tour(1, "TR-SOUTH-01", "Southern Coast Tour", "local", "Colombo Fort", "Galle", 10, 2, 40, "planned", [
    stop(1, "pickup", "Colombo Fort Railway Station", "Fort, Colombo 01", 6.9335, 79.8501, 10, 6),
    stop(2, "stop", "Bentota Beach Break", "Bentota", 6.4258, 79.9959, 10, 9),
    stop(3, "drop", "Galle Fort", "Galle Fort, Galle", 6.0267, 80.217, 10, 12),
  ], "Group of 40 passengers. Photo stop at Bentota."),
  tour(2, "TR-KANDY-02", "Kandy Cultural Tour", "local", "Negombo", "Kandy", 5, 1, 32, "planned", [
    stop(1, "pickup", "Negombo Bus Stand", "Negombo", 7.2083, 79.8358, 5, 6),
    stop(2, "stop", "Pinnawala Elephant Orphanage", "Pinnawala", 7.3009, 80.3869, 5, 9),
    stop(3, "drop", "Temple of the Tooth", "Kandy", 7.2936, 80.6413, 5, 13),
  ]),
  tour(3, "TR-JAFFNA-03", "Colombo - Jaffna Pilgrimage", "local", "Colombo", "Jaffna", -1, 3, 45, "ongoing", [
    stop(1, "pickup", "Colombo Pettah", "Pettah, Colombo 11", 6.9366, 79.8506, -1, 5),
    stop(2, "stop", "Anuradhapura Sacred City", "Anuradhapura", 8.3114, 80.4037, -1, 10),
    stop(3, "drop", "Nallur Kovil", "Jaffna", 9.6746, 80.0298, -1, 17),
  ], "Overnight stay arranged in Jaffna."),
  tour(4, "TR-AIRPORT-04", "Airport Transfer", "local", "Katunayake Airport", "Colombo", -10, 0, 25, "completed", [
    stop(1, "pickup", "Bandaranaike Airport", "Katunayake", 7.1802, 79.8841, -10, 6),
    stop(2, "drop", "Galle Face Hotel", "Colombo 03", 6.9242, 79.8456, -10, 8),
  ]),
  tour(5, "TR-ELLA-05", "Ella Hill Country Trip", "local", "Colombo", "Ella", -30, 3, 38, "completed", [
    stop(1, "pickup", "Colombo Fort", "Fort, Colombo 01", 6.9335, 79.8501, -30, 5),
    stop(2, "drop", "Ella Town", "Ella", 6.8667, 81.0466, -30, 15),
  ]),
  tour(6, "TR-INDIA-06", "Bodh Gaya Pilgrimage (India)", "foreign", "Colombo", "Bodh Gaya, India", 40, 8, 48, "planned", [
    stop(1, "pickup", "Colombo Fort", "Fort, Colombo 01", 6.9335, 79.8501, 40, 5),
    stop(2, "stop", "Chennai Port", "Chennai, India", 13.0827, 80.2707, 43, 10),
    stop(3, "drop", "Bodh Gaya", "Bihar, India", 24.6961, 84.9869, 47, 16),
  ], "Passports and visas required. Passengers travel by ferry."),
  tour(7, "TR-SIGIRIYA-07", "Sigiriya Day Trip", "local", "Colombo", "Sigiriya", -3, 0, 30, "cancelled", [
    stop(1, "pickup", "Colombo Fort", "Fort, Colombo 01", 6.9335, 79.8501, -3, 5),
    stop(2, "drop", "Sigiriya Rock", "Sigiriya", 7.957, 80.7603, -3, 10),
  ]),
  tour(8, "TR-NEGOMBO-08", "Negombo Beach Weekend", "local", "Colombo", "Negombo", 3, 1, 28, "planned", [
    stop(1, "pickup", "Colombo Pettah", "Pettah, Colombo 11", 6.9366, 79.8506, 3, 7),
    stop(2, "drop", "Negombo Beach Hotel", "Negombo", 7.2096, 79.8383, 3, 9),
  ]),
  tour(9, "TR-NUWARA-09", "Nuwara Eliya Trip", "local", "Colombo", "Nuwara Eliya", 20, 2, 36, "planned", [
    stop(1, "pickup", "Colombo Fort", "Fort, Colombo 01", 6.9335, 79.8501, 20, 5),
    stop(2, "stop", "Ramboda Falls", "Ramboda", 7.0, 80.7, 20, 10),
    stop(3, "drop", "Gregory Lake", "Nuwara Eliya", 6.9497, 80.7891, 20, 14),
  ]),
];
state.nextTourId = 100;

/* ============================ assignments ============================ */
const asg = (id, tourId, busId, driverId, ownerStatus, driverStatus, assignmentStatus, extra = {}) => {
  const t = state.tours.find((x) => x.id === tourId);
  return {
    id, tourId, busId, driverId, ownerId: 1, assignedStartAt: t.startAt, assignedEndAt: t.endAt,
    ownerStatus, driverStatus, assignmentStatus, rejectionReason: null, createdAt: atDay(-7, 9),
    confirmedAt: assignmentStatus === "confirmed" || assignmentStatus === "completed" ? atDay(-6, 9) : null,
    startedAt: null, completedAt: null, ...extra,
  };
};

state.assignments = [
  asg(1, 1, 1, 1, "accepted", "pending", "pending"),
  asg(2, 2, 3, 1, "accepted", "accepted", "confirmed"),
  asg(3, 3, 6, 1, "accepted", "accepted", "confirmed", { startedAt: atDay(-1, 5) }),
  asg(4, 4, 7, 1, "accepted", "accepted", "completed", { completedAt: atDay(-10, 9) }),
  asg(5, 5, 9, 1, "accepted", "accepted", "completed", { completedAt: atDay(-27, 18) }),
  asg(6, 7, 5, 2, "accepted", "accepted", "cancelled", { cancelledAt: atDay(-3, 4) }),
  asg(7, 8, 3, 2, "pending", "pending", "pending"),
  asg(8, 9, 1, 1, "accepted", "pending", "pending"),
];
state.nextAssignmentId = 100;

/* ============================ notifications ============================ */
state.notifications = [
  { id: 1, title: "New tour request", message: "You have been assigned to “Nuwara Eliya Trip”. Please accept or reject.", notificationType: "assignment_created", relatedType: "assignment", relatedId: 8, isRead: false, createdAt: atDay(0, 9) },
  { id: 2, title: "New tour request", message: "You have been assigned to “Southern Coast Tour”. Please accept or reject.", notificationType: "assignment_created", relatedType: "assignment", relatedId: 1, isRead: false, createdAt: atDay(-1, 15) },
  { id: 3, title: "Tour started", message: "“Colombo - Jaffna Pilgrimage” is now ongoing. GPS sharing is enabled.", notificationType: "tour_started", relatedType: "assignment", relatedId: 3, isRead: false, createdAt: atDay(-1, 5) },
  { id: 4, title: "Assignment confirmed", message: "“Kandy Cultural Tour” is confirmed by the bus owner.", notificationType: "assignment_confirmed", relatedType: "assignment", relatedId: 2, isRead: true, createdAt: atDay(-5, 11) },
  { id: 5, title: "Tour completed", message: "“Airport Transfer” has been completed. Thank you!", notificationType: "tour_completed", relatedType: "assignment", relatedId: 4, isRead: true, createdAt: atDay(-10, 9) },
];
state.nextNotificationId = 100;

/* ============================ serializers ============================ */
const ACTIVE = ["pending", "confirmed"];

const serializeDriver = (d) => {
  const today = todayStr();
  const out = clone(d);
  const soon = dateOnly(30);
  out.licenseExpired = d.licenseExpiryDate < today;
  out.licenseExpiringSoon = d.licenseExpiryDate >= today && d.licenseExpiryDate <= soon;
  out.documents = out.documents.map((doc) => ({ ...doc, downloadUrl: `/api/admin/drivers/${d.id}/documents/${doc.id}/file` }));
  return out;
};

const serializeTour = (t) => {
  const assignments = state.assignments.filter((a) => a.tourId === t.id)
    .map((a) => ({ id: a.id, assignmentStatus: a.assignmentStatus, busId: a.busId, driverId: a.driverId }));
  const hasConfirmed = assignments.some((a) => a.assignmentStatus === "confirmed");
  let displayStatus = t.status;
  if (t.status === "planned") displayStatus = hasConfirmed ? "scheduled" : "pending";
  return {
    ...clone(t), assignments, displayStatus, hasConfirmedAssignment: hasConfirmed,
    assignmentCount: assignments.filter((a) => ACTIVE.includes(a.assignmentStatus)).length,
    stops: clone(t.stops).sort((a, b) => a.stopOrder - b.stopOrder),
  };
};

/* ============================ driver admin API ============================ */
const NIC_RE = /^(\d{9}[VvXx]|\d{12})$/;

const validateDriver = (body, { partial }) => {
  const has = (k) => body[k] !== undefined;
  if ((!partial || has("nic")) && !NIC_RE.test(body.nic || "")) throw fail(400, "NIC must be 9 digits followed by V/X, or 12 digits.");
  if ((!partial || has("licenseNumber")) && !/^[A-Za-z0-9-]{6,20}$/.test(body.licenseNumber || ""))
    throw fail(400, "License number must be 6-20 letters, digits or hyphens.");
  if (!partial || has("licenseExpiryDate")) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.licenseExpiryDate || "")) throw fail(400, "License expiry date must be a valid date (YYYY-MM-DD).");
    if (body.licenseExpiryDate < todayStr()) throw fail(400, "The driver's license has already expired.");
    if (body.licenseExpiryDate > dateOnly(15 * 366)) throw fail(400, "License expiry date is too far in the future.");
  }
};

const activeCount = (driverId) => state.assignments.filter((a) => a.driverId === driverId && ACTIVE.includes(a.assignmentStatus)).length;

export const mockDriverApi = {
  list({ search = "", status = "", licenseExpiry = "" } = {}) {
    const term = search.trim().toLowerCase();
    const today = todayStr(); const soon = dateOnly(30);
    return state.drivers
      .filter((d) => !status || d.status === status)
      .filter((d) => licenseExpiry !== "expired" || d.licenseExpiryDate < today)
      .filter((d) => licenseExpiry !== "expiring" || (d.licenseExpiryDate >= today && d.licenseExpiryDate <= soon))
      .filter((d) => !term || [d.nic, d.licenseNumber, d.user.firstName, d.user.lastName, d.user.email, d.user.phone].some((v) => includes(v, term)))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(serializeDriver);
  },
  get(id) {
    const d = state.drivers.find((x) => x.id === Number(id));
    if (!d) throw fail(404, "Driver not found.");
    return serializeDriver(d);
  },
  create(body) {
    validateDriver(body, { partial: false });
    if (!body.firstName?.trim() || !body.lastName?.trim()) throw fail(400, "First name and last name are required.");
    const nic = body.nic.trim().toUpperCase(); const lic = body.licenseNumber.trim().toUpperCase();
    const email = String(body.email || "").trim().toLowerCase();
    if (state.drivers.some((d) => d.nic === nic)) throw fail(409, "A driver with this NIC already exists.");
    if (state.drivers.some((d) => d.licenseNumber === lic)) throw fail(409, "A driver with this license number already exists.");
    if (state.drivers.some((d) => d.user.email === email)) throw fail(409, "A user with this email already exists.");
    const status = body.status || "active";
    const id = state.nextDriverId++;
    const d = {
      id, userId: 200 + id, nic, licenseNumber: lic, licenseExpiryDate: body.licenseExpiryDate,
      address: body.address?.trim() || null, emergencyContactName: body.emergencyContactName?.trim() || null,
      emergencyContactPhone: body.emergencyContactPhone?.trim() || null, profileImage: null, status,
      createdAt: new Date().toISOString(), documents: [],
      user: { id: 200 + id, firstName: body.firstName.trim(), lastName: body.lastName.trim(), email, phone: body.phone?.trim() || null, status, lastLoginAt: null },
    };
    state.drivers.push(d);
    return serializeDriver(d);
  },
  update(id, body) {
    const d = state.drivers.find((x) => x.id === Number(id));
    if (!d) throw fail(404, "Driver not found.");
    if (body.status !== undefined) throw fail(400, "Use PATCH /api/admin/drivers/:id/status to change the driver status.");
    validateDriver(body, { partial: true });
    if (body.nic !== undefined) {
      const nic = body.nic.trim().toUpperCase();
      if (state.drivers.some((x) => x.id !== d.id && x.nic === nic)) throw fail(409, "A driver with this NIC already exists.");
      d.nic = nic;
    }
    if (body.licenseNumber !== undefined) {
      const lic = body.licenseNumber.trim().toUpperCase();
      if (state.drivers.some((x) => x.id !== d.id && x.licenseNumber === lic)) throw fail(409, "A driver with this license number already exists.");
      d.licenseNumber = lic;
    }
    if (body.email !== undefined) {
      const email = body.email.trim().toLowerCase();
      if (state.drivers.some((x) => x.id !== d.id && x.user.email === email)) throw fail(409, "A user with this email already exists.");
      d.user.email = email;
    }
    ["licenseExpiryDate", "address", "emergencyContactName", "emergencyContactPhone"].forEach((k) => { if (body[k] !== undefined) d[k] = body[k]?.toString().trim() || null; });
    ["firstName", "lastName", "phone"].forEach((k) => { if (body[k] !== undefined) d.user[k] = body[k]?.toString().trim() || null; });
    return serializeDriver(d);
  },
  setStatus(id, status) {
    const d = state.drivers.find((x) => x.id === Number(id));
    if (!d) throw fail(404, "Driver not found.");
    if (!["active", "inactive", "suspended"].includes(status)) throw fail(400, "Status must be one of: active, inactive, suspended.");
    if (status === "active") {
      if (d.licenseExpiryDate < todayStr()) throw fail(409, "Cannot activate this driver because the license has expired. Update the license expiry date first.");
    } else if (d.status === "active" && activeCount(d.id) > 0) {
      throw fail(409, "Cannot deactivate a driver who has pending or confirmed tour assignments.");
    }
    d.status = status; d.user.status = status;
    return { id: d.id, status, userStatus: status };
  },
  remove(id) {
    const d = state.drivers.find((x) => x.id === Number(id));
    if (!d) throw fail(404, "Driver not found.");
    if (activeCount(d.id) > 0) throw fail(409, "Cannot delete this driver because pending or confirmed tour assignments exist.");
    if (state.assignments.some((a) => a.driverId === d.id))
      throw fail(409, "Cannot delete this driver because the driver appears in tour assignment history. Set the driver status to inactive instead.");
    state.drivers = state.drivers.filter((x) => x.id !== d.id);
  },
  uploadDocument(id, type, file) {
    const d = state.drivers.find((x) => x.id === Number(id));
    if (!d) throw fail(404, "Driver not found.");
    if (!["nic", "license"].includes(type)) throw fail(400, "Document type must be nic or license.");
    if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) throw fail(400, "Only JPG, PNG or PDF files are allowed.");
    if (file.size > 5 * 1024 * 1024) throw fail(413, "File is too large (max 5 MB).");
    d.documents = d.documents.filter((x) => x.documentType !== type); // replaces the previous one
    const doc = { id: state.nextDocId++, documentType: type, originalName: file.name, mimeType: file.type, fileSize: file.size, createdAt: new Date().toISOString() };
    d.documents.push(doc);
    state.files.set(doc.id, file);
    return serializeDriver(d).documents.find((x) => x.id === doc.id);
  },
  removeDocument(id, docId) {
    const d = state.drivers.find((x) => x.id === Number(id));
    if (!d) throw fail(404, "Driver not found.");
    if (!d.documents.some((x) => x.id === Number(docId))) throw fail(404, "Document not found.");
    d.documents = d.documents.filter((x) => x.id !== Number(docId));
    state.files.delete(Number(docId));
  },
  documentFile(docId) {
    return state.files.get(Number(docId)) || null; // seeded documents have no real file
  },
};

/* ============================ tour admin API ============================ */
const normalizeStops = (stops = [], bounds) => {
  if (stops.length > 50) throw fail(400, "A tour can have at most 50 stops.");
  return stops.map((s, i) => {
    const label = `Stop ${i + 1}`;
    if (!s.stopName?.trim()) throw fail(400, `${label}: stop name is required.`);
    const hasLat = s.latitude !== undefined && s.latitude !== null && s.latitude !== "";
    const hasLng = s.longitude !== undefined && s.longitude !== null && s.longitude !== "";
    if (hasLat !== hasLng) throw fail(400, `${label}: provide both latitude and longitude, or neither.`);
    if (hasLat && (Math.abs(Number(s.latitude)) > 90 || Math.abs(Number(s.longitude)) > 180)) throw fail(400, `${label}: coordinates are out of range.`);
    if (s.plannedArrivalAt) {
      const at = new Date(s.plannedArrivalAt);
      const earliest = new Date(bounds.pickupAt || bounds.startAt); const latest = new Date(bounds.returnAt || bounds.endAt);
      if (at < earliest || at > latest) throw fail(400, `${label}: planned arrival must fall within the tour time window.`);
    }
    return {
      stopOrder: i + 1, stopType: s.stopType || "stop", stopName: s.stopName.trim(),
      locationAddress: s.locationAddress?.trim() || null,
      latitude: hasLat ? Number(s.latitude) : null, longitude: hasLng ? Number(s.longitude) : null,
      plannedArrivalAt: s.plannedArrivalAt || null, notes: s.notes?.trim() || null,
    };
  });
};

const validateTourBody = (body, { partial }) => {
  const has = (k) => body[k] !== undefined;
  [["tourName", "Tour name"], ["startLocation", "Start location"], ["destination", "Destination"]].forEach(([k, label]) => {
    if ((!partial || has(k)) && !String(body[k] || "").trim()) throw fail(400, `${label} is required.`);
  });
  if (has("tourType") && !["local", "foreign"].includes(body.tourType)) throw fail(400, "Tour type must be one of: local, foreign.");
  if (!partial || has("passengerCount")) {
    const n = Number(body.passengerCount);
    if (!Number.isInteger(n) || n < 1 || n > 1000) throw fail(400, "Passenger count must be a whole number between 1 and 1000.");
  }
};

const validateDates = ({ startAt, endAt, pickupAt, returnAt }, checkFuture) => {
  if (!startAt || Number.isNaN(new Date(startAt).getTime())) throw fail(400, "A valid start date/time is required (ISO format).");
  if (!endAt || Number.isNaN(new Date(endAt).getTime())) throw fail(400, "A valid end date/time is required (ISO format).");
  const s = new Date(startAt); const e = new Date(endAt);
  if (checkFuture && s.getTime() <= Date.now()) throw fail(400, "Tour start must be in the future.");
  if (e <= s) throw fail(400, "Tour end must be after the tour start.");
  if (pickupAt && new Date(pickupAt) > s) throw fail(400, "Pickup time must be at or before the tour start.");
  if (returnAt && new Date(returnAt) < e) throw fail(400, "Return time must be at or after the tour end.");
};

const TRANSITIONS = { planned: ["ongoing", "cancelled"], ongoing: ["completed", "cancelled"], completed: [], cancelled: [] };

const releaseAssignments = (tourId, status) => {
  const now = new Date().toISOString();
  state.assignments.filter((a) => a.tourId === tourId && ACTIVE.includes(a.assignmentStatus)).forEach((a) => {
    if (status === "ongoing") { if (a.assignmentStatus === "confirmed") a.startedAt = now; return; }
    if (status === "completed" && a.assignmentStatus === "confirmed") { a.assignmentStatus = "completed"; a.completedAt = now; }
    else { a.assignmentStatus = "cancelled"; a.cancelledAt = now; }
  });
};

export const mockTourApi = {
  list({ search = "", status = "", tourType = "", from = "", to = "" } = {}) {
    const term = search.trim().toLowerCase();
    return state.tours.map(serializeTour)
      .filter((t) => !status || (status === "planned" ? t.status === "planned" : t.displayStatus === status))
      .filter((t) => !tourType || t.tourType === tourType)
      .filter((t) => !from || new Date(t.startAt) >= new Date(`${from}T00:00:00`))
      .filter((t) => !to || new Date(t.startAt) <= new Date(`${to}T23:59:59`))
      .filter((t) => !term || [t.tourCode, t.tourName, t.startLocation, t.destination].some((v) => includes(v, term)))
      .sort((a, b) => new Date(b.startAt) - new Date(a.startAt));
  },
  get(id) {
    const t = state.tours.find((x) => x.id === Number(id));
    if (!t) throw fail(404, "Tour not found.");
    return serializeTour(t);
  },
  create(body) {
    validateTourBody(body, { partial: false });
    validateDates(body, true);
    const stops = normalizeStops(body.stops || [], body);
    let code = body.tourCode?.trim().toUpperCase();
    if (code && state.tours.some((t) => t.tourCode === code)) throw fail(409, "A tour with this tour code already exists.");
    const id = state.nextTourId++;
    if (!code) code = `TR-${body.startAt.slice(0, 10).replace(/-/g, "")}-${id}`;
    const t = {
      id, tourCode: code, tourName: body.tourName.trim(), tourType: body.tourType || "local",
      description: body.description?.trim() || null, startLocation: body.startLocation.trim(), destination: body.destination.trim(),
      startAt: body.startAt, endAt: body.endAt, pickupAt: body.pickupAt || null, returnAt: body.returnAt || null,
      passengerCount: Number(body.passengerCount), status: "planned", specialNotes: body.specialNotes?.trim() || null,
      createdBy: 1, createdAt: new Date().toISOString(), creator: { id: 1, firstName: "System", lastName: "Admin" },
      stops: stops.map((s, i) => ({ ...s, id: id * 100 + i + 1, tourId: id })),
    };
    state.tours.push(t);
    return serializeTour(t);
  },
  update(id, body) {
    const t = state.tours.find((x) => x.id === Number(id));
    if (!t) throw fail(404, "Tour not found.");
    if (["completed", "cancelled"].includes(t.status)) throw fail(409, `A ${t.status} tour cannot be edited.`);
    if (body.status !== undefined) throw fail(400, "Use PATCH /api/admin/tours/:id/status to change the tour status.");
    validateTourBody(body, { partial: true });
    const datesChanged = ["startAt", "endAt", "pickupAt", "returnAt"].some((k) => body[k] !== undefined);
    const merged = {
      startAt: body.startAt ?? t.startAt, endAt: body.endAt ?? t.endAt,
      pickupAt: body.pickupAt !== undefined ? body.pickupAt || null : t.pickupAt,
      returnAt: body.returnAt !== undefined ? body.returnAt || null : t.returnAt,
    };
    if (datesChanged) {
      if (t.status === "ongoing") throw fail(400, "The dates of an ongoing tour cannot be changed.");
      validateDates(merged, body.startAt !== undefined);
      if (state.assignments.some((a) => a.tourId === t.id && ACTIVE.includes(a.assignmentStatus)))
        throw fail(409, "Cannot change the tour dates while buses or drivers are assigned. Cancel the assignments first.");
    }
    if (body.tourCode) {
      const code = body.tourCode.trim().toUpperCase();
      if (state.tours.some((x) => x.id !== t.id && x.tourCode === code)) throw fail(409, "A tour with this tour code already exists.");
      t.tourCode = code;
    }
    ["tourName", "startLocation", "destination", "tourType", "description", "specialNotes"].forEach((k) => {
      if (body[k] !== undefined) t[k] = typeof body[k] === "string" ? body[k].trim() || (k === "description" || k === "specialNotes" ? null : body[k]) : body[k];
    });
    if (body.passengerCount !== undefined) t.passengerCount = Number(body.passengerCount);
    if (datesChanged) Object.assign(t, merged);
    if (body.stops !== undefined) t.stops = normalizeStops(body.stops, merged).map((s, i) => ({ ...s, id: t.id * 100 + i + 1, tourId: t.id }));
    return serializeTour(t);
  },
  setStatus(id, status) {
    const t = state.tours.find((x) => x.id === Number(id));
    if (!t) throw fail(404, "Tour not found.");
    if (!["ongoing", "completed", "cancelled"].includes(status)) throw fail(400, "Status must be one of: ongoing, completed, cancelled.");
    if (!TRANSITIONS[t.status].includes(status)) throw fail(409, `A ${t.status} tour cannot be changed to ${status}.`);
    const hadConfirmed = state.assignments.some((a) => a.tourId === t.id && a.assignmentStatus === "confirmed");
    releaseAssignments(t.id, status);
    t.status = status;
    const out = serializeTour(t);
    if (status === "ongoing" && !hadConfirmed) out.warning = "This tour was started without a confirmed bus assignment.";
    return out;
  },
  remove(id) {
    const t = state.tours.find((x) => x.id === Number(id));
    if (!t) throw fail(404, "Tour not found.");
    if (["ongoing", "completed"].includes(t.status)) throw fail(409, `A ${t.status} tour cannot be deleted.${t.status === "ongoing" ? " Cancel it first." : ""}`);
    if (state.assignments.some((a) => a.tourId === t.id)) throw fail(409, "Cannot delete this tour because bus/driver assignments exist for it. Cancel the tour instead.");
    state.tours = state.tours.filter((x) => x.id !== t.id);
  },
};

/* ============================ driver portal API ============================ */
const busOf = (busId) => {
  const b = mockBuses.find((x) => x.id === busId);
  return b ? { id: b.id, registrationNumber: b.registrationNumber, busName: b.busName, busType: b.busType, seatingCapacity: b.seatingCapacity } : null;
};

const portalAssignment = (a) => {
  const t = state.tours.find((x) => x.id === a.tourId);
  return { ...clone(a), tour: { ...clone(t), stops: clone(t.stops).sort((x, y) => x.stopOrder - y.stopOrder) }, bus: busOf(a.busId) };
};

export const mockPortalApi = {
  login(email, password) {
    const d = state.drivers.find((x) => x.user.email === String(email).trim().toLowerCase());
    if (!d || password !== MOCK_DRIVER_LOGIN.password) throw fail(401, "Invalid email or password.");
    if (d.status !== "active") throw fail(403, "Your account is inactive. Please contact the administrator.");
    if (d.licenseExpiryDate < todayStr()) throw fail(403, "Driver profile is inactive or license has expired.");
    return { id: d.userId, driverId: d.id, firstName: d.user.firstName, lastName: d.user.lastName, email: d.user.email, phone: d.user.phone, role: "Driver" };
  },
  profile(driverId = MOCK_DRIVER_ID) {
    const d = state.drivers.find((x) => x.id === driverId);
    return { user: { id: d.userId, driverId: d.id, firstName: d.user.firstName, lastName: d.user.lastName, email: d.user.email, phone: d.user.phone, role: "Driver" },
      driver: { nic: d.nic, licenseNumber: d.licenseNumber, licenseExpiryDate: d.licenseExpiryDate, address: d.address, emergencyContactName: d.emergencyContactName, emergencyContactPhone: d.emergencyContactPhone, status: d.status } };
  },
  assignments({ status = "" } = {}) {
    return state.assignments.filter((a) => a.driverId === MOCK_DRIVER_ID && (!status || a.assignmentStatus === status))
      .sort((a, b) => new Date(b.assignedStartAt) - new Date(a.assignedStartAt)).map(portalAssignment);
  },
  assignment(id) {
    const a = state.assignments.find((x) => x.id === Number(id) && x.driverId === MOCK_DRIVER_ID);
    if (!a) throw fail(404, "Assignment not found.");
    return portalAssignment(a);
  },
  respond(id, response, reason) {
    const a = state.assignments.find((x) => x.id === Number(id) && x.driverId === MOCK_DRIVER_ID);
    if (!a) throw fail(404, "Assignment not found.");
    if (response === "rejected" && (reason || "").trim().length < 3) throw fail(400, "Please give a reason for rejecting (3-1000 characters).");
    if (a.assignmentStatus !== "pending" || a.driverStatus !== "pending") throw fail(409, "This assignment has already been answered or is no longer pending.");
    a.driverStatus = response;
    if (response === "rejected") { a.assignmentStatus = "rejected"; a.rejectionReason = reason.trim(); }
    else if (a.ownerStatus === "accepted") { a.assignmentStatus = "confirmed"; a.confirmedAt = new Date().toISOString(); }
    return { id: a.id, assignmentStatus: a.assignmentStatus, driverStatus: a.driverStatus, ownerStatus: a.ownerStatus };
  },
  gpsConfig() {
    const eligible = state.assignments.filter((a) => a.driverId === MOCK_DRIVER_ID && a.assignmentStatus === "confirmed"
      && state.tours.find((t) => t.id === a.tourId)?.status === "ongoing");
    return {
      canSend: eligible.length > 0,
      assignments: eligible.map((a) => ({ assignmentId: a.id, tourCode: state.tours.find((t) => t.id === a.tourId).tourCode })),
      minIntervalSeconds: 5, recommendedIntervalSeconds: 10, maxPointsPerRequest: 100,
    };
  },
  saveGps(points) {
    if (!this.gpsConfig().canSend) throw fail(409, "GPS is only accepted for a confirmed assignment whose tour is ongoing.");
    return { saved: points.length };
  },
  notifications({ page = 1, limit = 5 } = {}) {
    const rows = [...state.notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return paginate(rows, { page, limit });
  },
  unreadCount: () => state.notifications.filter((n) => !n.isRead).length,
  markRead(id) { const n = state.notifications.find((x) => x.id === Number(id)); if (n) n.isRead = true; },
  markAllRead() { state.notifications.forEach((n) => { n.isRead = true; }); },
  changePassword(current, next) {
    if (current === "wrong") throw fail(400, "Current password is incorrect.");
    MOCK_DRIVER_LOGIN.password = next;
  },
};
