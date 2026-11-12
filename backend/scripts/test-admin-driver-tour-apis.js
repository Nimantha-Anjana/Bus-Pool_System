/**
 * End-to-end test for Member 02 (Driver & Tour Management) APIs.
 *
 * 1. npm run db:driver-tour      (once: driver_documents table + tour_stops.stop_type)
 * 2. npm run dev                 (server running)
 * 3. npm run test:admin-driver-tour
 *
 * Uses ADMIN_EMAIL / ADMIN_PASSWORD from backend/.env. Everything it creates is removed at the end.
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

const raw = async (method, path, body, { form, auth = true } = {}) => {
  const headers = {};
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  if (body && !form) headers["Content-Type"] = "application/json";

  return fetch(`${API}${path}`, {
    method,
    headers,
    body: form || (body ? JSON.stringify(body) : undefined),
  });
};

const call = async (method, path, body, options) => {
  const response = await raw(method, path, body, options);
  let json = null;
  try {
    json = await response.json();
  } catch (_) {}
  return { status: response.status, json };
};

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

const docForm = (buffer, mime, name) => {
  const form = new FormData();
  form.append("document", new Blob([buffer], { type: mime }), name);
  return form;
};

const isoIn = (days, hours = 0) => new Date(Date.now() + days * 86400000 + hours * 3600000).toISOString();
const dateIn = (days) => isoIn(days).slice(0, 10);

(async () => {
  const stamp = Date.now().toString().slice(-8);
  const password = "Driver1234";
  let driverId, driver2Id, tourId, tour2Id;

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

    check("drivers endpoint rejects missing token", (await call("GET", "/admin/drivers", null, { auth: false })).status === 401);
    check("tours endpoint rejects missing token", (await call("GET", "/admin/tours", null, { auth: false })).status === 401);

    // ------------------------------------------------------------ DRIVERS
    console.log("\nDriver validation");
    const base = {
      firstName: "Test", lastName: "Driver", email: `driver${stamp}@test.lk`, password,
      phone: "0771234567", nic: `${stamp}1V`.slice(0, 9) + "V", licenseNumber: `B${stamp}`,
      licenseExpiryDate: dateIn(400),
    };
    // 9 digits + V
    base.nic = `${stamp}1` + "V";

    check("bad NIC -> 400", (await call("POST", "/admin/drivers", { ...base, nic: "123" })).status === 400);
    check("bad license number -> 400", (await call("POST", "/admin/drivers", { ...base, licenseNumber: "x" })).status === 400);
    check("expired license -> 400", (await call("POST", "/admin/drivers", { ...base, licenseExpiryDate: dateIn(-5) })).status === 400);
    check("impossible date -> 400", (await call("POST", "/admin/drivers", { ...base, licenseExpiryDate: "2030-02-31" })).status === 400);
    check("weak password -> 400", (await call("POST", "/admin/drivers", { ...base, password: "abc" })).status === 400);
    check("missing name/email -> 400", (await call("POST", "/admin/drivers", { nic: base.nic, licenseNumber: base.licenseNumber, licenseExpiryDate: base.licenseExpiryDate })).status === 400);

    console.log("\nDriver CRUD + account");
    const created = await call("POST", "/admin/drivers", base);
    check("create driver + login account -> 201", created.status === 201, JSON.stringify(created.json));
    driverId = created.json?.data?.id;
    check("response has linked user (no password hash)", created.json?.data?.user?.email === base.email && !JSON.stringify(created.json).includes("passwordHash"));
    check("flags: licenseExpired false", created.json?.data?.licenseExpired === false);

    check("duplicate NIC -> 409", (await call("POST", "/admin/drivers", { ...base, email: `x${stamp}@test.lk`, licenseNumber: `B9${stamp}` })).status === 409);
    check("duplicate license -> 409", (await call("POST", "/admin/drivers", { ...base, email: `y${stamp}@test.lk`, nic: `${stamp}2V`.slice(0, 9) + "V" })).status === 409);
    check("duplicate email -> 409", (await call("POST", "/admin/drivers", { ...base, nic: `${stamp}3` + "V", licenseNumber: `B8${stamp}` })).status === 409);

    const driverLogin = await call("POST", "/auth/login", { email: base.email, password }, { auth: false });
    check("new driver can log in", driverLogin.status === 200, JSON.stringify(driverLogin.json));
    const driverToken = driverLogin.json?.data?.accessToken;

    const driverOnAdmin = await fetch(`${API}/admin/drivers`, { headers: { Authorization: `Bearer ${driverToken}` } });
    check("driver token cannot use admin API -> 403", driverOnAdmin.status === 403);

    check("get driver -> 200", (await call("GET", `/admin/drivers/${driverId}`)).status === 200);
    check("unknown driver -> 404", (await call("GET", "/admin/drivers/999999999")).status === 404);
    const list = await call("GET", `/admin/drivers?search=${stamp}`);
    check("search drivers", list.json?.data?.length === 1);

    const upd = await call("PUT", `/admin/drivers/${driverId}`, { address: "Colombo", firstName: "Renamed", emergencyContactPhone: "0712345678" });
    check("update driver -> 200", upd.status === 200 && upd.json?.data?.user?.firstName === "Renamed" && upd.json?.data?.address === "Colombo");
    check("status via PUT rejected -> 400", (await call("PUT", `/admin/drivers/${driverId}`, { status: "inactive" })).status === 400);

    console.log("\nLink an existing user");
    // second driver account created normally, then try linking its user to another profile
    const second = await call("POST", "/admin/drivers", {
      ...base, email: `driver2${stamp}@test.lk`, nic: `${stamp}4V`.slice(0, 9) + "V", licenseNumber: `C${stamp}`,
    });
    driver2Id = second.json?.data?.id;
    check("create second driver -> 201", second.status === 201, JSON.stringify(second.json));
    const linkTaken = await call("POST", "/admin/drivers", {
      userId: second.json?.data?.userId, nic: `${stamp}5` + "V", licenseNumber: `D${stamp}`, licenseExpiryDate: dateIn(300),
    });
    check("linking an already-linked user -> 409", linkTaken.status === 409);
    check("linking unknown user -> 404", (await call("POST", "/admin/drivers", {
      userId: 999999999, nic: `${stamp}6` + "V", licenseNumber: `E${stamp}`, licenseExpiryDate: dateIn(300),
    })).status === 404);

    console.log("\nDriver documents");
    const nicUp = await call("POST", `/admin/drivers/${driverId}/documents/nic`, null, { form: docForm(PNG, "image/png", "nic.png") });
    check("upload NIC image -> 201", nicUp.status === 201, JSON.stringify(nicUp.json));
    const licUp = await call("POST", `/admin/drivers/${driverId}/documents/license`, null, { form: docForm(PDF, "application/pdf", "lic.pdf") });
    check("upload license PDF -> 201", licUp.status === 201, JSON.stringify(licUp.json));

    const fake = await call("POST", `/admin/drivers/${driverId}/documents/nic`, null, { form: docForm(Buffer.from("not really a png at all"), "image/png", "fake.png") });
    check("fake image content rejected -> 400", fake.status === 400);
    const txt = await call("POST", `/admin/drivers/${driverId}/documents/nic`, null, { form: docForm(Buffer.from("hello"), "text/plain", "a.txt") });
    check("text file rejected -> 400", txt.status === 400);
    check("bad document type -> 400", (await call("POST", `/admin/drivers/${driverId}/documents/passport`, null, { form: docForm(PNG, "image/png", "p.png") })).status === 400);
    check("document for unknown driver -> 404", (await call("POST", "/admin/drivers/999999999/documents/nic", null, { form: docForm(PNG, "image/png", "p.png") })).status === 404);

    const docs = await call("GET", `/admin/drivers/${driverId}/documents`);
    check("2 documents listed", docs.json?.data?.length === 2);

    const file = await raw("GET", `/admin/drivers/${driverId}/documents/${nicUp.json?.data?.id}/file`);
    check("document download works with token", file.status === 200 && file.headers.get("content-type") === "image/png");
    const filePublic = await raw("GET", `/admin/drivers/${driverId}/documents/${nicUp.json?.data?.id}/file`, null, { auth: false });
    check("document download blocked without token -> 401", filePublic.status === 401);

    const replaced = await call("POST", `/admin/drivers/${driverId}/documents/nic`, null, { form: docForm(PNG, "image/png", "nic2.png") });
    check("re-upload replaces the NIC document", replaced.status === 201 && (await call("GET", `/admin/drivers/${driverId}/documents`)).json?.data?.length === 2);

    const delDoc = await call("DELETE", `/admin/drivers/${driverId}/documents/${licUp.json?.data?.id}`);
    check("delete document -> 200", delDoc.status === 200);

    console.log("\nDriver activate / deactivate");
    check("invalid status -> 400", (await call("PATCH", `/admin/drivers/${driverId}/status`, { status: "fired" })).status === 400);
    const deact = await call("PATCH", `/admin/drivers/${driverId}/status`, { status: "inactive" });
    check("deactivate -> 200", deact.status === 200 && deact.json?.data?.userStatus === "inactive");
    const blocked = await call("POST", "/auth/login", { email: base.email, password }, { auth: false });
    check("deactivated driver cannot log in", blocked.status !== 200, `status ${blocked.status}`);
    const oldToken = await fetch(`${API}/driver/profile`, { headers: { Authorization: `Bearer ${driverToken}` } });
    check("old driver token is invalidated", oldToken.status === 401 || oldToken.status === 403);
    const act = await call("PATCH", `/admin/drivers/${driverId}/status`, { status: "active" });
    check("activate -> 200", act.status === 200);
    check("driver can log in again", (await call("POST", "/auth/login", { email: base.email, password }, { auth: false })).status === 200);
    check("suspend -> 200", (await call("PATCH", `/admin/drivers/${driverId}/status`, { status: "suspended" })).status === 200);
    await call("PATCH", `/admin/drivers/${driverId}/status`, { status: "active" });

    // ------------------------------------------------------------ TOURS
    console.log("\nTour validation");
    const tourBody = {
      tourName: "Test Tour", tourType: "local", startLocation: "Colombo", destination: "Kandy",
      startAt: isoIn(10), endAt: isoIn(12), pickupAt: isoIn(10, -2), returnAt: isoIn(12, 2), passengerCount: 40,
    };

    check("missing fields -> 400", (await call("POST", "/admin/tours", { tourName: "x" })).status === 400);
    check("end before start -> 400", (await call("POST", "/admin/tours", { ...tourBody, endAt: isoIn(9) })).status === 400);
    check("start in the past -> 400", (await call("POST", "/admin/tours", { ...tourBody, startAt: isoIn(-1), endAt: isoIn(2) })).status === 400);
    check("pickup after start -> 400", (await call("POST", "/admin/tours", { ...tourBody, pickupAt: isoIn(11) })).status === 400);
    check("return before end -> 400", (await call("POST", "/admin/tours", { ...tourBody, returnAt: isoIn(11) })).status === 400);
    check("invalid date text -> 400", (await call("POST", "/admin/tours", { ...tourBody, startAt: "tomorrow" })).status === 400);
    check("passenger count 0 -> 400", (await call("POST", "/admin/tours", { ...tourBody, passengerCount: 0 })).status === 400);
    check("invalid tour type -> 400", (await call("POST", "/admin/tours", { ...tourBody, tourType: "space" })).status === 400);
    check("bad stop in create -> 400 (nothing saved)", (await call("POST", "/admin/tours", { ...tourBody, stops: [{ stopType: "pickup" }] })).status === 400);

    console.log("\nTour CRUD");
    const tour = await call("POST", "/admin/tours", {
      ...tourBody,
      stops: [
        { stopName: "Colombo Fort", stopType: "pickup", latitude: 6.9344, longitude: 79.8503, plannedArrivalAt: isoIn(10, -1) },
        { stopName: "Kandy City", stopType: "drop", locationAddress: "Kandy", plannedArrivalAt: isoIn(10, 5) },
      ],
    });
    check("create tour with stops -> 201", tour.status === 201, JSON.stringify(tour.json));
    tourId = tour.json?.data?.id;
    check("tour code auto-generated", /^TR-\d{8}-[0-9A-F]{4}$/.test(tour.json?.data?.tourCode || ""));
    check("new tour displayStatus = pending", tour.json?.data?.displayStatus === "pending" && tour.json?.data?.status === "planned");
    check("stops saved in order", tour.json?.data?.stops?.map((s) => s.stopOrder).join() === "1,2");

    const code = `T${stamp}`;
    const tour2 = await call("POST", "/admin/tours", { ...tourBody, tourCode: code });
    tour2Id = tour2.json?.data?.id;
    check("create tour with own code -> 201", tour2.status === 201 && tour2.json?.data?.tourCode === code);
    check("duplicate tour code -> 409", (await call("POST", "/admin/tours", { ...tourBody, tourCode: code })).status === 409);

    check("get tour -> 200", (await call("GET", `/admin/tours/${tourId}`)).status === 200);
    check("unknown tour -> 404", (await call("GET", "/admin/tours/999999999")).status === 404);
    check("filter status=pending", (await call("GET", "/admin/tours?status=pending")).json?.data?.some((t) => t.id === tourId));
    check("filter status=scheduled excludes it", !(await call("GET", "/admin/tours?status=scheduled")).json?.data?.some((t) => t.id === tourId));
    check("search tours by code", (await call("GET", `/admin/tours?search=${code}`)).json?.data?.length === 1);

    const updTour = await call("PUT", `/admin/tours/${tourId}`, { passengerCount: 45, destination: "Nuwara Eliya" });
    check("update tour -> 200", updTour.status === 200 && updTour.json?.data?.passengerCount === 45);
    check("update dates (valid) -> 200", (await call("PUT", `/admin/tours/${tourId}`, { startAt: isoIn(11), endAt: isoIn(13), pickupAt: null, returnAt: null })).status === 200);
    check("update dates (end before start) -> 400", (await call("PUT", `/admin/tours/${tourId}`, { endAt: isoIn(5) })).status === 400);
    check("status via PUT rejected -> 400", (await call("PUT", `/admin/tours/${tourId}`, { status: "completed" })).status === 400);

    console.log("\nTour stops");
    const stops0 = await call("GET", `/admin/tours/${tourId}/stops`);
    check("list stops", stops0.json?.data?.length === 2);

    const added = await call("POST", `/admin/tours/${tourId}/stops`, { stopName: "Peradeniya", stopType: "stop", stopOrder: 2 });
    check("add stop at position 2 -> 201", added.status === 201 && added.json?.data?.stopOrder === 2);
    const afterAdd = await call("GET", `/admin/tours/${tourId}/stops`);
    check("orders renumbered 1..3", afterAdd.json?.data?.map((s) => s.stopOrder).join() === "1,2,3" && afterAdd.json.data[2].stopName === "Kandy City");

    check("bad stop type -> 400", (await call("POST", `/admin/tours/${tourId}/stops`, { stopName: "X", stopType: "teleport" })).status === 400);
    check("lat without lng -> 400", (await call("POST", `/admin/tours/${tourId}/stops`, { stopName: "X", latitude: 6.9 })).status === 400);
    check("latitude out of range -> 400", (await call("POST", `/admin/tours/${tourId}/stops`, { stopName: "X", latitude: 123, longitude: 10 })).status === 400);
    check("arrival outside tour window -> 400", (await call("POST", `/admin/tours/${tourId}/stops`, { stopName: "X", plannedArrivalAt: isoIn(30) })).status === 400);

    const moved = await call("PUT", `/admin/tours/${tourId}/stops/${added.json?.data?.id}`, { stopOrder: 1, notes: "Tea break" });
    check("move stop to position 1", moved.status === 200 && moved.json?.data?.stopOrder === 1 && moved.json?.data?.notes === "Tea break");

    const delStop = await call("DELETE", `/admin/tours/${tourId}/stops/${added.json?.data?.id}`);
    check("delete stop -> 200", delStop.status === 200);
    check("orders renumbered after delete", (await call("GET", `/admin/tours/${tourId}/stops`)).json?.data?.map((s) => s.stopOrder).join() === "1,2");
    check("delete unknown stop -> 404", (await call("DELETE", `/admin/tours/${tourId}/stops/999999999`)).status === 404);

    const replaceStops = await call("PUT", `/admin/tours/${tourId}/stops`, {
      stops: [{ stopName: "A", stopType: "pickup" }, { stopName: "B", stopType: "stop" }, { stopName: "C", stopType: "drop" }],
    });
    check("replace all stops", replaceStops.status === 200 && replaceStops.json?.data?.length === 3);

    console.log("\nTour status");
    check("setting 'scheduled' by hand -> 400", (await call("PATCH", `/admin/tours/${tourId}/status`, { status: "scheduled" })).status === 400);
    check("pending -> completed not allowed -> 409", (await call("PATCH", `/admin/tours/${tourId}/status`, { status: "completed" })).status === 409);
    const ongoing = await call("PATCH", `/admin/tours/${tourId}/status`, { status: "ongoing" });
    check("start tour (ongoing) -> 200", ongoing.status === 200 && ongoing.json?.data?.status === "ongoing");
    check("ongoing tour cannot be deleted -> 409", (await call("DELETE", `/admin/tours/${tourId}`)).status === 409);
    check("ongoing tour dates locked -> 400", (await call("PUT", `/admin/tours/${tourId}`, { endAt: isoIn(20) })).status === 400);
    const done = await call("PATCH", `/admin/tours/${tourId}/status`, { status: "completed" });
    check("complete tour -> 200", done.status === 200 && done.json?.data?.status === "completed");
    check("completed tour cannot be edited -> 409", (await call("PUT", `/admin/tours/${tourId}`, { tourName: "Nope" })).status === 409);
    check("completed tour stops locked -> 409", (await call("POST", `/admin/tours/${tourId}/stops`, { stopName: "Late" })).status === 409);
    check("completed tour cannot be cancelled -> 409", (await call("PATCH", `/admin/tours/${tourId}/status`, { status: "cancelled" })).status === 409);

    const cancelled = await call("PATCH", `/admin/tours/${tour2Id}/status`, { status: "cancelled" });
    check("cancel pending tour -> 200", cancelled.status === 200 && cancelled.json?.data?.displayStatus === "cancelled");

    console.log("\nDelete");
    check("delete cancelled tour -> 200", (await call("DELETE", `/admin/tours/${tour2Id}`)).status === 200);
    tour2Id = null;
    check("completed tour cannot be deleted -> 409", (await call("DELETE", `/admin/tours/${tourId}`)).status === 409);

    check("delete driver -> 200", (await call("DELETE", `/admin/drivers/${driverId}`)).status === 200);
    check("deleted driver's login no longer works", (await call("POST", "/auth/login", { email: base.email, password }, { auth: false })).status === 401);
    driverId = null;
    check("delete second driver, keep account -> 200", (await call("DELETE", `/admin/drivers/${driver2Id}?keepAccount=true`)).status === 200);
    driver2Id = null;
    check("delete unknown driver -> 404", (await call("DELETE", "/admin/drivers/999999999")).status === 404);
  } catch (error) {
    failed++;
    console.log(`\n  ERROR  ${error.message}`);
  } finally {
    if (token) {
      if (tour2Id) await call("DELETE", `/admin/tours/${tour2Id}`).catch(() => {});
      if (driverId) await call("DELETE", `/admin/drivers/${driverId}`).catch(() => {});
      if (driver2Id) await call("DELETE", `/admin/drivers/${driver2Id}`).catch(() => {});
    }

    console.log(`\nResult: ${passed} passed, ${failed} failed`);
    console.log("(Completed tours and the kept test login account are left behind on purpose: completed tours cannot be deleted.)\n");
    process.exit(failed ? 1 : 0);
  }
})();
