/**
 * End-to-end test for Member 01 (Admin & Bus Management) APIs.
 *
 * 1. Start the server:         npm run dev
 * 2. In another terminal:      npm run test:admin-bus
 *
 * Uses ADMIN_EMAIL / ADMIN_PASSWORD from backend/.env (same as seed:admin).
 * Everything it creates is deleted at the end.
 */
require("dotenv").config();

const BASE = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
const API = `${BASE}/api`;

let passed = 0;
let failed = 0;
let token = null;

const check = (name, condition, extra = "") => {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name} ${extra}`);
  }
};

const call = async (method, path, body, { form } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !form) headers["Content-Type"] = "application/json";

  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: form || (body ? JSON.stringify(body) : undefined),
  });

  let json = null;
  try {
    json = await response.json();
  } catch (_) {}

  return { status: response.status, json };
};

// 1x1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const imageForm = (count = 1, mime = "image/png", name = "bus.png") => {
  const form = new FormData();
  for (let i = 0; i < count; i++) form.append("images", new Blob([PNG], { type: mime }), name);
  return form;
};

(async () => {
  const stamp = Date.now().toString().slice(-8);
  let ownerId, owner2Id, busId, imageIds = [];

  try {
    console.log(`\nTesting ${API}\n`);

    console.log("Auth");
    const login = await call("POST", "/auth/login", {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });
    token = login.json?.data?.accessToken;
    check("admin login", login.status === 200 && !!token, JSON.stringify(login.json));
    if (!token) throw new Error("Cannot continue without a token.");

    const noAuth = await fetch(`${API}/admin/buses`);
    check("buses endpoint rejects missing token (401)", noAuth.status === 401);

    console.log("\nBus Owner: validation + duplicates");
    const badOwner = await call("POST", "/admin/bus-owners", {
      ownerName: "X", phone: "abc", email: "not-an-email",
    });
    check("invalid owner payload -> 400", badOwner.status === 400);

    const badNic = await call("POST", "/admin/bus-owners", {
      ownerName: "T", phone: "0771234567", email: `t${stamp}@test.lk`, nic: "123",
    });
    check("invalid NIC -> 400", badNic.status === 400);

    const owner = await call("POST", "/admin/bus-owners", {
      ownerName: "Test Owner", phone: "0771234567", email: `owner${stamp}@test.lk`,
      nic: `${stamp}1V`.slice(-10).padStart(10, "9").slice(0, 9) + "V",
    });
    check("create owner -> 201", owner.status === 201, JSON.stringify(owner.json));
    ownerId = owner.json?.data?.id;
    const ownerNic = owner.json?.data?.nic;

    const dupEmail = await call("POST", "/admin/bus-owners", {
      ownerName: "Dup", phone: "0771234567", email: `OWNER${stamp}@test.lk`,
    });
    check("duplicate email (case-insensitive) -> 409", dupEmail.status === 409);

    const dupNic = await call("POST", "/admin/bus-owners", {
      ownerName: "Dup", phone: "0771234567", email: `other${stamp}@test.lk`, nic: ownerNic,
    });
    check("duplicate NIC -> 409", dupNic.status === 409);

    const owner2 = await call("POST", "/admin/bus-owners", {
      ownerName: "Second Owner", phone: "0779876543", email: `owner2${stamp}@test.lk`,
    });
    owner2Id = owner2.json?.data?.id;
    check("create second owner -> 201", owner2.status === 201);

    const updDup = await call("PUT", `/admin/bus-owners/${owner2Id}`, { email: `owner${stamp}@test.lk` });
    check("update to existing email -> 409", updDup.status === 409);

    const upd = await call("PUT", `/admin/bus-owners/${ownerId}`, { phone: "0711111111" });
    check("update owner -> 200", upd.status === 200 && upd.json?.data?.phone === "0711111111");

    check("get owner -> 200", (await call("GET", `/admin/bus-owners/${ownerId}`)).status === 200);
    check("get unknown owner -> 404", (await call("GET", "/admin/bus-owners/999999999")).status === 404);
    check("list owners -> 200", (await call("GET", "/admin/bus-owners")).status === 200);

    console.log("\nBus CRUD");
    const badBus = await call("POST", "/admin/buses", { ownerId, busType: "Luxury" });
    check("bus without registration/seats -> 400", badBus.status === 400);

    const noOwnerBus = await call("POST", "/admin/buses", {
      ownerId: 999999999, registrationNumber: `NB-${stamp}`, busType: "Luxury", seatingCapacity: 40,
    });
    check("bus with unknown owner -> 404", noOwnerBus.status === 404);

    const bus = await call("POST", "/admin/buses", {
      ownerId, registrationNumber: `nb-${stamp}`, busName: "Test Bus", busType: "Luxury",
      seatingCapacity: 45, airConditioned: true, facilities: ["Wi-Fi", "USB Charging", "wi-fi"],
    });
    check("create bus -> 201", bus.status === 201, JSON.stringify(bus.json));
    busId = bus.json?.data?.id;
    check("registration normalised to uppercase", bus.json?.data?.registrationNumber === `NB-${stamp}`);
    check("facilities de-duplicated", bus.json?.data?.facilities?.length === 2);
    check("new bus is available", bus.json?.data?.isAvailable === true);

    const dupBus = await call("POST", "/admin/buses", {
      ownerId, registrationNumber: `NB-${stamp}`, busType: "Luxury", seatingCapacity: 40,
    });
    check("duplicate registration -> 409", dupBus.status === 409);

    check("get bus -> 200", (await call("GET", `/admin/buses/${busId}`)).status === 200);
    check("list buses -> 200", (await call("GET", "/admin/buses")).status === 200);
    const filtered = await call("GET", `/admin/buses?ownerId=${ownerId}&search=Test`);
    check("filter buses by owner + search", filtered.json?.data?.length === 1);

    const updBus = await call("PUT", `/admin/buses/${busId}`, { seatingCapacity: 50, busName: "Renamed Bus" });
    check("update bus -> 200", updBus.status === 200 && updBus.json?.data?.seatingCapacity === 50);

    const badSeats = await call("PUT", `/admin/buses/${busId}`, { seatingCapacity: 0 });
    check("seating capacity 0 -> 400", badSeats.status === 400);

    const setAssigned = await call("PUT", `/admin/buses/${busId}`, { status: "assigned" });
    check("cannot manually set status 'assigned' -> 400", setAssigned.status === 400);

    console.log("\nBus-Owner relationship");
    const reassign = await call("PUT", `/admin/buses/${busId}`, { ownerId: owner2Id });
    check("reassign bus to another owner -> 200", reassign.status === 200 && reassign.json?.data?.owner?.id === owner2Id);
    const reassignBack = await call("PUT", `/admin/buses/${busId}`, { ownerId });
    check("reassign back to first owner", reassignBack.json?.data?.owner?.id === ownerId);

    console.log("\nAssigned bus -> owner delete protection");
    const delOwnerWithBus = await call("DELETE", `/admin/bus-owners/${ownerId}`);
    check("delete owner that owns a bus -> 409", delOwnerWithBus.status === 409);

    console.log("\nBus availability");
    const unavail = await call("PATCH", `/admin/buses/${busId}/availability`, { isAvailable: false });
    check("set unavailable", unavail.status === 200 && unavail.json?.data?.isAvailable === false);
    const avail = await call("PATCH", `/admin/buses/${busId}/availability`, { status: "available" });
    check("set available", avail.status === 200 && avail.json?.data?.isAvailable === true);
    const maint = await call("PATCH", `/admin/buses/${busId}/availability`, { status: "maintenance" });
    check("set maintenance", maint.status === 200 && maint.json?.data?.status === "maintenance");
    const badAvail = await call("PATCH", `/admin/buses/${busId}/availability`, { status: "flying" });
    check("invalid availability -> 400", badAvail.status === 400);
    await call("PATCH", `/admin/buses/${busId}/availability`, { isAvailable: true });

    console.log("\nBus facilities");
    const fac = await call("PUT", `/admin/buses/${busId}/facilities`, {
      facilities: ["AC", "Wi-Fi", "TV", "Reclining Seats"], airConditioned: true,
    });
    check("replace facilities -> 200", fac.status === 200 && fac.json?.data?.facilities?.length === 4);
    const facGet = await call("GET", `/admin/buses/${busId}/facilities`);
    check("get facilities", facGet.json?.data?.facilities?.includes("Reclining Seats"));
    const facBad = await call("PUT", `/admin/buses/${busId}/facilities`, { facilities: "AC" });
    check("facilities must be an array -> 400", facBad.status === 400);
    const facClear = await call("PUT", `/admin/buses/${busId}/facilities`, { facilities: [] });
    check("clear facilities", facClear.status === 200 && facClear.json?.data?.facilities?.length === 0);

    console.log("\nBus images");
    const up = await call("POST", `/admin/buses/${busId}/images`, null, { form: imageForm(2) });
    check("upload 2 images -> 201", up.status === 201, JSON.stringify(up.json));
    imageIds = (up.json?.data || []).map((i) => i.id);
    check("first image is primary", up.json?.data?.[0]?.isPrimary === true && up.json?.data?.[1]?.isPrimary === false);

    if (up.json?.data?.[0]?.imageUrl) {
      const file = await fetch(`${BASE}${up.json.data[0].imageUrl}`);
      check("uploaded image is served", file.status === 200);
    }

    const badType = await call("POST", `/admin/buses/${busId}/images`, null, {
      form: imageForm(1, "text/plain", "x.txt"),
    });
    check("non-image upload rejected -> 400", badType.status === 400);

    const noFile = await call("POST", `/admin/buses/${busId}/images`, null, { form: new FormData() });
    check("upload without file -> 400", noFile.status === 400);

    const unknownBusUp = await call("POST", "/admin/buses/999999999/images", null, { form: imageForm(1) });
    check("upload to unknown bus -> 404", unknownBusUp.status === 404);

    const primary = await call("PATCH", `/admin/buses/${busId}/images/${imageIds[1]}/primary`);
    check("set primary image", primary.status === 200);
    const withImage = await call("GET", `/admin/buses/${busId}`);
    check("bus.imageUrl follows primary image", withImage.json?.data?.imageUrl === up.json?.data?.[1]?.imageUrl);

    const delImg = await call("DELETE", `/admin/buses/${busId}/images/${imageIds[1]}`);
    check("delete primary image -> 200", delImg.status === 200);
    const afterDel = await call("GET", `/admin/buses/${busId}/images`);
    check("another image promoted to primary", afterDel.json?.data?.length === 1 && afterDel.json.data[0].isPrimary === true);

    console.log("\nDashboard");
    const dash = await call("GET", "/admin/dashboard");
    check("dashboard -> 200", dash.status === 200, JSON.stringify(dash.json));
    check("dashboard has summary + bus stats", !!dash.json?.data?.summary && typeof dash.json?.data?.buses?.total === "number");
    check("dashboard bus total >= 1", dash.json?.data?.buses?.total >= 1);
    check("bus stats endpoint -> 200", (await call("GET", "/admin/dashboard/buses")).status === 200);

    console.log("\nCleanup + delete");
    const delBus = await call("DELETE", `/admin/buses/${busId}`);
    check("delete bus -> 200", delBus.status === 200);
    check("bus gone -> 404", (await call("GET", `/admin/buses/${busId}`)).status === 404);
    busId = null;

    const delOwner = await call("DELETE", `/admin/bus-owners/${ownerId}`);
    check("delete owner without buses -> 200", delOwner.status === 200);
    ownerId = null;
    check("delete unknown owner -> 404", (await call("DELETE", "/admin/bus-owners/999999999")).status === 404);
  } catch (error) {
    failed++;
    console.log(`\n  ERROR  ${error.message}`);
  } finally {
    // best-effort cleanup if the run stopped early
    if (token) {
      if (busId) await call("DELETE", `/admin/buses/${busId}`).catch(() => {});
      if (ownerId) await call("DELETE", `/admin/bus-owners/${ownerId}`).catch(() => {});
      if (owner2Id) await call("DELETE", `/admin/bus-owners/${owner2Id}`).catch(() => {});
    }

    console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
    process.exit(failed ? 1 : 0);
  }
})();
