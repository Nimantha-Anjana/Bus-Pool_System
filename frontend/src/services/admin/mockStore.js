// In-memory fake backend with the same rules as the real one (duplicates, delete protection, ...).
import { mockOwners, mockBuses } from "./mockData";

const state = {
  owners: structuredClone(mockOwners),
  buses: structuredClone(mockBuses),
  nextOwnerId: 100,
  nextBusId: 100,
  nextImageId: 1,
};

export const wait = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));

export const fail = (status, message) => {
  const error = new Error(message);
  error.response = { status, data: { success: false, message } };
  return error;
};

const clone = (value) => structuredClone(value);

export function paginate(rows, { page = 1, limit = 10 } = {}) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  return { items: clone(rows.slice(start, start + limit)), pagination: { page, limit, total, totalPages } };
}

const includes = (value, term) => String(value ?? "").toLowerCase().includes(term);

// ---------- owners ----------
export const mockOwnerApi = {
  list({ search = "", status = "" } = {}) {
    const term = search.trim().toLowerCase();
    return state.owners
      .filter((o) => !status || o.status === status)
      .filter((o) => !term || [o.ownerName, o.email, o.phone, o.nic].some((v) => includes(v, term)))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  get(id) {
    const owner = state.owners.find((o) => o.id === Number(id));
    if (!owner) throw fail(404, "Bus owner not found.");
    return clone(owner);
  },
  create(payload) {
    this.assertUnique(payload);
    const owner = {
      id: state.nextOwnerId++, ...payload,
      email: payload.email.trim().toLowerCase(),
      nic: payload.nic ? payload.nic.toUpperCase() : null,
      businessRegistrationNo: payload.businessRegistrationNo || null,
      status: payload.status || "active", createdAt: new Date().toISOString(),
    };
    state.owners.push(owner);
    return clone(owner);
  },
  update(id, payload) {
    const owner = state.owners.find((o) => o.id === Number(id));
    if (!owner) throw fail(404, "Bus owner not found.");
    this.assertUnique(payload, owner.id);
    if (payload.status === "inactive" && state.buses.some((b) => b.ownerId === owner.id && b.status === "assigned"))
      throw fail(409, "Cannot deactivate this owner while their buses have active assignments.");
    Object.assign(owner, payload, { email: payload.email?.trim().toLowerCase() ?? owner.email });
    return clone(owner);
  },
  remove(id) {
    const owner = state.owners.find((o) => o.id === Number(id));
    if (!owner) throw fail(404, "Bus owner not found.");
    const count = state.buses.filter((b) => b.ownerId === owner.id).length;
    if (count > 0)
      throw fail(409, `Cannot delete this bus owner because ${count} bus(es) are assigned to this owner. Remove or reassign the buses first, or set the owner status to inactive.`);
    state.owners = state.owners.filter((o) => o.id !== owner.id);
  },
  assertUnique({ email, nic, businessRegistrationNo }, excludeId) {
    const others = state.owners.filter((o) => o.id !== excludeId);
    if (email && others.some((o) => o.email === email.trim().toLowerCase())) throw fail(409, "A bus owner with this email already exists.");
    if (nic && others.some((o) => o.nic === nic.toUpperCase())) throw fail(409, "A bus owner with this NIC already exists.");
    if (businessRegistrationNo && others.some((o) => o.businessRegistrationNo === businessRegistrationNo))
      throw fail(409, "A bus owner with this business registration number already exists.");
  },
};

// ---------- buses ----------
const withOwner = (bus) => {
  const owner = state.owners.find((o) => o.id === bus.ownerId);
  return {
    ...bus,
    isAvailable: bus.status === "available",
    imageUrl: bus.images.find((i) => i.isPrimary)?.imageUrl || bus.images[0]?.imageUrl || null,
    owner: owner ? { id: owner.id, ownerName: owner.ownerName, phone: owner.phone, email: owner.email, status: owner.status } : null,
  };
};

export const mockBusApi = {
  list({ search = "", status = "", ownerId = "", airConditioned = "" } = {}) {
    const term = search.trim().toLowerCase();
    return state.buses
      .filter((b) => !status || (status === "unavailable" ? b.status !== "available" : b.status === status))
      .filter((b) => !ownerId || b.ownerId === Number(ownerId))
      .filter((b) => airConditioned === "" || b.airConditioned === (airConditioned === "true"))
      .filter((b) => !term || [b.registrationNumber, b.busName, b.busType].some((v) => includes(v, term)))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((b) => clone(withOwner(b)));
  },
  get(id) {
    const bus = state.buses.find((b) => b.id === Number(id));
    if (!bus) throw fail(404, "Bus not found.");
    return clone(withOwner(bus));
  },
  create(payload) {
    const registrationNumber = payload.registrationNumber.trim().toUpperCase();
    if (state.buses.some((b) => b.registrationNumber === registrationNumber)) throw fail(409, "A bus with this registration number already exists.");
    const owner = state.owners.find((o) => o.id === Number(payload.ownerId));
    if (!owner) throw fail(404, "Bus owner not found.");
    if (owner.status !== "active") throw fail(409, "Cannot add a bus to an inactive bus owner.");
    const bus = {
      id: state.nextBusId++, ...payload, ownerId: owner.id, registrationNumber,
      facilities: payload.facilities || [], images: [], status: payload.status || "available",
      createdAt: new Date().toISOString(),
    };
    state.buses.push(bus);
    return clone(withOwner(bus));
  },
  update(id, payload) {
    const bus = state.buses.find((b) => b.id === Number(id));
    if (!bus) throw fail(404, "Bus not found.");
    if (payload.registrationNumber) {
      const reg = payload.registrationNumber.trim().toUpperCase();
      if (state.buses.some((b) => b.id !== bus.id && b.registrationNumber === reg)) throw fail(409, "A bus with this registration number already exists.");
      payload.registrationNumber = reg;
    }
    if (payload.ownerId && Number(payload.ownerId) !== bus.ownerId) {
      const owner = state.owners.find((o) => o.id === Number(payload.ownerId));
      if (!owner) throw fail(404, "Bus owner not found.");
      if (owner.status !== "active") throw fail(409, "Cannot assign a bus to an inactive bus owner.");
      if (bus.status === "assigned") throw fail(409, "Cannot change the owner of a bus that has an active assignment.");
      payload.ownerId = owner.id;
    }
    if (payload.status === "assigned") delete payload.status;
    Object.assign(bus, payload);
    return clone(withOwner(bus));
  },
  remove(id) {
    const bus = state.buses.find((b) => b.id === Number(id));
    if (!bus) throw fail(404, "Bus not found.");
    if (bus.status === "assigned") throw fail(409, "Cannot delete a bus that has active tour assignments.");
    state.buses = state.buses.filter((b) => b.id !== bus.id);
  },
  setAvailability(id, status) {
    const bus = state.buses.find((b) => b.id === Number(id));
    if (!bus) throw fail(404, "Bus not found.");
    if (bus.status === "assigned") throw fail(409, "This bus has an active assignment, so its availability cannot be changed.");
    bus.status = status;
    return clone(withOwner(bus));
  },
  addImages(id, files) {
    const bus = state.buses.find((b) => b.id === Number(id));
    if (!bus) throw fail(404, "Bus not found.");
    files.forEach((file) => {
      bus.images.push({ id: state.nextImageId++, imageUrl: URL.createObjectURL(file), isPrimary: bus.images.length === 0, originalName: file.name });
    });
    return clone(withOwner(bus)).images;
  },
  setPrimary(id, imageId) {
    const bus = state.buses.find((b) => b.id === Number(id));
    bus.images.forEach((i) => { i.isPrimary = i.id === Number(imageId); });
  },
  removeImage(id, imageId) {
    const bus = state.buses.find((b) => b.id === Number(id));
    bus.images = bus.images.filter((i) => i.id !== Number(imageId));
    if (bus.images.length && !bus.images.some((i) => i.isPrimary)) bus.images[0].isPrimary = true;
  },
  stats() {
    const by = (key, value) => state.buses.filter((b) => b[key] === value).length;
    const buses = {
      available: by("status", "available"), assigned: by("status", "assigned"),
      maintenance: by("status", "maintenance"), inactive: by("status", "inactive"), total: state.buses.length,
    };
    return { buses, owners: { total: state.owners.length, active: state.owners.filter((o) => o.status === "active").length } };
  },
};
