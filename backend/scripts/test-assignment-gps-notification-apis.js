/**
 * End-to-end test for Member 03 (Assignments, GPS, Notifications, Activity logs).
 *
 *   1. npm run dev                      (NODE_ENV=development, SMTP_HOST empty -> e-mails are only previewed,
 *                                        and the owner accept/reject links come back as "devActionLinks")
 *   2. npm run test:assignments
 *
 * Needs ADMIN_EMAIL / ADMIN_PASSWORD from backend/.env.
 * It creates its own owner, buses, drivers and tours. Completed tours / assignments with history cannot be
 * deleted, so a few test records stay behind (their names start with "TEST").
 */
require("dotenv").config();

const BASE = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
const API = `${BASE}/api`;

let passed = 0;
let failed = 0;

const check = (name, condition, extra = "") => {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name} ${extra}`);
  }
};

const request = async (method, path, { token, body, text = false } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  const response = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const raw = await response.text();
  let json = null;
  if (!text) {
    try {
      json = JSON.parse(raw);
    } catch (_) {}
  }
  return { status: response.status, json, raw, headers: response.headers };
};

const isoIn = (days, hours = 0) => new Date(Date.now() + days * 86400000 + hours * 3600000).toISOString();
const dateIn = (days) => isoIn(days).slice(0, 10);
const tokenFromLink = (link) => decodeURIComponent(link.split("/api/assignment-actions/")[1].split("/page")[0]);

(async () => {
  const stamp = Date.now().toString().slice(-7);
  const password = "Driver1234";
  let admin, d1, d2; // tokens

  try {
    console.log(`\nTesting ${API}\n`);

    // ------------------------------------------------------------------ setup
    console.log("Setup (owner, buses, drivers, tours)");
    const login = await request("POST", "/auth/login", {
      body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
    });
    admin = login.json?.data?.accessToken;
    check("admin login", login.status === 200 && !!admin, JSON.stringify(login.json));
    if (!admin) throw new Error("Cannot continue without an admin token.");

    const owner = await request("POST", "/admin/bus-owners", {
      token: admin,
      body: { ownerName: `TEST Owner ${stamp}`, phone: "0771234567", email: `testowner${stamp}@test.lk` },
    });
    const ownerId = owner.json?.data?.id;
    check("create owner", owner.status === 201, JSON.stringify(owner.json));

    const makeBus = async (suffix, seats = 45) =>
      (await request("POST", "/admin/buses", {
        token: admin,
        body: { ownerId, registrationNumber: `TST-${stamp}${suffix}`, busType: "Luxury", seatingCapacity: seats, airConditioned: true },
      })).json?.data?.id;

    const busA = await makeBus("A");
    const busB = await makeBus("B");
    const busC = await makeBus("C", 20);
    check("create 3 buses", !!busA && !!busB && !!busC);

    const makeDriver = async (n) => {
      const r = await request("POST", "/admin/drivers", {
        token: admin,
        body: {
          firstName: "Test", lastName: `Driver${n}`, email: `testdriver${n}${stamp}@test.lk`, password,
          phone: "0771234567", nic: `${stamp}${n}0`.slice(0, 9).padEnd(9, "0") + "V", licenseNumber: `LC${stamp}${n}`,
          licenseExpiryDate: dateIn(500),
        },
      });
      return r.json?.data;
    };
    const driver1 = await makeDriver(1);
    const driver2 = await makeDriver(2);
    check("create 2 drivers", !!driver1?.id && !!driver2?.id, JSON.stringify(driver1));

    const login1 = await request("POST", "/auth/login", { body: { email: `testdriver1${stamp}@test.lk`, password } });
    const login2 = await request("POST", "/auth/login", { body: { email: `testdriver2${stamp}@test.lk`, password } });
    d1 = login1.json?.data?.accessToken;
    d2 = login2.json?.data?.accessToken;
    check("driver logins", !!d1 && !!d2);

    const makeTour = async (name, startDays, endDays, passengers = 40) =>
      (await request("POST", "/admin/tours", {
        token: admin,
        body: {
          tourName: `TEST ${name} ${stamp}`, tourType: "local", startLocation: "Colombo", destination: "Galle",
          startAt: isoIn(startDays), endAt: isoIn(endDays), passengerCount: passengers,
        },
      })).json?.data?.id;

    const tour1 = await makeTour("One", 10, 12);
    const tour2 = await makeTour("Two (overlaps One)", 10, 12);
    const tour3 = await makeTour("Three (later)", 20, 21);
    const tourBig = await makeTour("Big", 30, 31, 200);
    check("create 4 tours", !!tour1 && !!tour2 && !!tour3 && !!tourBig);

    // ------------------------------------------------------------------ validation + availability
    console.log("\nAssignment validation + availability");
    check("assignments need admin token -> 401", (await request("GET", "/admin/assignments")).status === 401);
    check("driver token cannot use admin assignments -> 403", (await request("GET", "/admin/assignments", { token: d1 })).status === 403);
    check("missing ids -> 400", (await request("POST", "/admin/assignments", { token: admin, body: { tourId: tour1 } })).status === 400);
    check("unknown tour -> 404", (await request("POST", "/admin/assignments", { token: admin, body: { tourId: 999999999, busId: busA, driverId: driver1.id } })).status === 404);
    check("unknown bus -> 404", (await request("POST", "/admin/assignments", { token: admin, body: { tourId: tour1, busId: 999999999, driverId: driver1.id } })).status === 404);
    check("unknown driver -> 404", (await request("POST", "/admin/assignments", { token: admin, body: { tourId: tour1, busId: busA, driverId: 999999999 } })).status === 404);
    check("end before start -> 400", (await request("POST", "/admin/assignments", { token: admin, body: { tourId: tour1, busId: busA, driverId: driver1.id, assignedStartAt: isoIn(12), assignedEndAt: isoIn(10) } })).status === 400);
    check("invalid date text -> 400", (await request("POST", "/admin/assignments", { token: admin, body: { tourId: tour1, busId: busA, driverId: driver1.id, assignedStartAt: "soon" } })).status === 400);

    await request("PATCH", `/admin/buses/${busC}/availability`, { token: admin, body: { status: "maintenance" } });
    check("bus in maintenance -> 409", (await request("POST", "/admin/assignments", { token: admin, body: { tourId: tour1, busId: busC, driverId: driver1.id } })).status === 409);
    await request("PATCH", `/admin/buses/${busC}/availability`, { token: admin, body: { status: "available" } });

    const avail0 = await request("GET", `/admin/assignments/availability?tourId=${tour1}`, { token: admin });
    check("availability lists free buses and drivers", avail0.status === 200 &&
      avail0.json?.data?.availableBuses?.some((b) => b.id === busA) && avail0.json?.data?.availableDrivers?.some((d) => d.id === driver1.id), JSON.stringify(avail0.json));
    check("availability needs tourId or from/to -> 400", (await request("GET", "/admin/assignments/availability", { token: admin })).status === 400);

    // ------------------------------------------------------------------ create + conflicts
    console.log("\nCreate assignment + overlap prevention");
    const a1 = await request("POST", "/admin/assignments", { token: admin, body: { tourId: tour1, busId: busA, driverId: driver1.id } });
    check("create assignment (tour 1, bus A, driver 1) -> 201", a1.status === 201, JSON.stringify(a1.json));
    const a1Id = a1.json?.data?.id;
    check("starts pending / pending / pending", a1.json?.data?.assignmentStatus === "pending" && a1.json?.data?.ownerStatus === "pending" && a1.json?.data?.driverStatus === "pending");
    check("owner taken from the bus", a1.json?.data?.owner?.id === ownerId);
    check("2 e-mails processed (owner + driver)", a1.json?.emails?.length === 2, JSON.stringify(a1.json?.emails));
    const links = a1.json?.devActionLinks;
    if (!links?.owner) throw new Error("No devActionLinks returned. Run the server with NODE_ENV=development and an empty SMTP_HOST.");
    check("no token / hash leaks in the response", !JSON.stringify(a1.json).includes("tokenHash"));

    const busStatus = await request("GET", `/admin/buses/${busA}`, { token: admin });
    check("bus A is now 'assigned'", busStatus.json?.data?.status === "assigned");

    check("same bus, overlapping time -> 409", (await request("POST", "/admin/assignments", { token: admin, body: { tourId: tour2, busId: busA, driverId: driver2.id } })).status === 409);
    check("same driver, overlapping time -> 409", (await request("POST", "/admin/assignments", { token: admin, body: { tourId: tour2, busId: busB, driverId: driver1.id } })).status === 409);

    const avail1 = await request("GET", `/admin/assignments/availability?tourId=${tour2}`, { token: admin });
    check("busy bus/driver disappear from availability", !avail1.json?.data?.availableBuses?.some((b) => b.id === busA) && !avail1.json?.data?.availableDrivers?.some((d) => d.id === driver1.id));

    const a2 = await request("POST", "/admin/assignments", { token: admin, body: { tourId: tour2, busId: busB, driverId: driver2.id } });
    check("free bus + free driver -> 201", a2.status === 201, JSON.stringify(a2.json));
    const a2Id = a2.json?.data?.id;

    // touching periods do not overlap (end of one = start of another)
    const touch = await request("POST", "/admin/assignments", { token: admin, body: { tourId: tour3, busId: busA, driverId: driver1.id, assignedStartAt: isoIn(12), assignedEndAt: isoIn(13) } });
    check("back-to-back periods are allowed", touch.status === 201, JSON.stringify(touch.json));
    if (touch.json?.data?.id) await request("DELETE", `/admin/assignments/${touch.json.data.id}`, { token: admin });

    const big = await request("POST", "/admin/assignments", { token: admin, body: { tourId: tourBig, busId: busC, driverId: driver1.id } });
    check("small bus for a big tour -> 201 with capacity warning", big.status === 201 && big.json?.warnings?.length === 1, JSON.stringify(big.json));
    if (big.json?.data?.id) await request("DELETE", `/admin/assignments/${big.json.data.id}`, { token: admin });

    // ------------------------------------------------------------------ notifications
    console.log("\nNotifications");
    const n1 = await request("GET", "/notifications", { token: d1 });
    check("driver got an in-app notification", n1.status === 200 && n1.json?.data?.some((n) => n.notificationType === "assignment_created" && Number(n.relatedId) === a1Id), JSON.stringify(n1.json));
    const unread1 = await request("GET", "/notifications/unread-count", { token: d1 });
    check("unread-count >= 1", unread1.json?.data?.unreadCount >= 1);
    const notificationId = n1.json?.data?.find((n) => Number(n.relatedId) === a1Id)?.id;
    check("other user cannot read it (404)", (await request("PATCH", `/notifications/${notificationId}/read`, { token: d2 })).status === 404);
    check("other user cannot delete it (404)", (await request("DELETE", `/notifications/${notificationId}`, { token: admin })).status === 404);
    const read = await request("PATCH", `/notifications/${notificationId}/read`, { token: d1 });
    check("mark as read", read.status === 200 && read.json?.data?.isRead === true);
    const unread2 = await request("GET", "/notifications/unread-count", { token: d1 });
    check("unread-count went down", unread2.json?.data?.unreadCount === unread1.json?.data?.unreadCount - 1);
    check("unread filter works", (await request("GET", "/notifications?unread=true", { token: d1 })).json?.data?.every((n) => n.isRead === false));
    check("read-all -> 200", (await request("PATCH", "/notifications/read-all", { token: d1 })).status === 200);
    check("delete notification -> 200", (await request("DELETE", `/notifications/${notificationId}`, { token: d1 })).status === 200);
    check("deleted notification gone -> 404", (await request("DELETE", `/notifications/${notificationId}`, { token: d1 })).status === 404);
    check("notifications need a token -> 401", (await request("GET", "/notifications")).status === 401);

    // ------------------------------------------------------------------ driver responses
    console.log("\nDriver accept / reject");
    const mine = await request("GET", "/driver/assignments", { token: d1 });
    check("driver sees own assignment", mine.json?.data?.some((a) => a.id === a1Id) && !mine.json?.data?.some((a) => a.id === a2Id));
    check("driver cannot see another driver's assignment (404)", (await request("GET", `/driver/assignments/${a1Id}`, { token: d2 })).status === 404);
    check("driver cannot answer another driver's assignment (404)", (await request("POST", `/driver/assignments/${a1Id}/accept`, { token: d2 })).status === 404);
    check("reject without reason -> 400", (await request("POST", `/driver/assignments/${a1Id}/reject`, { token: d1 })).status === 400);

    const accept = await request("POST", `/driver/assignments/${a1Id}/accept`, { token: d1 });
    check("driver accepts -> 200, still pending (owner has not answered)", accept.status === 200 && accept.json?.data?.assignmentStatus === "pending" && accept.json?.data?.driverStatus === "accepted", JSON.stringify(accept.json));
    check("accepting twice -> 409", (await request("POST", `/driver/assignments/${a1Id}/accept`, { token: d1 })).status === 409);

    // ------------------------------------------------------------------ owner token flow
    console.log("\nSecure action tokens (owner link)");
    const ownerToken = tokenFromLink(links.owner);
    const page = await request("GET", `/assignment-actions/${encodeURIComponent(ownerToken)}/page`, { text: true });
    check("e-mail link shows an HTML page", page.status === 200 && page.headers.get("content-type")?.includes("text/html") && page.raw.includes("Accept"));
    check("page does not leak the driver's e-mail/phone", !page.raw.includes(`testdriver1${stamp}@test.lk`));
    const preview = await request("GET", `/assignment-actions/${encodeURIComponent(ownerToken)}`);
    check("token preview works and does not use the token up", preview.status === 200 && preview.json?.data?.party === "owner");
    check("garbage token -> 400", (await request("GET", "/assignment-actions/not-a-real-token-at-all-123456")).status === 400);
    check("bad response value -> 400", (await request("POST", "/assignment-actions/respond", { body: { token: ownerToken, response: "maybe" } })).status === 400);
    check("owner reject without reason -> 400 (token stays usable)", (await request("POST", "/assignment-actions/respond", { body: { token: ownerToken, response: "rejected" } })).status === 400);

    const ownerAccept = await request("POST", "/assignment-actions/respond", { body: { token: ownerToken, response: "accepted" } });
    check("owner accepts via token -> 200", ownerAccept.status === 200 && ownerAccept.json?.data?.assignmentStatus === "confirmed", JSON.stringify(ownerAccept.json));
    check("token cannot be used twice (410)", (await request("POST", "/assignment-actions/respond", { body: { token: ownerToken, response: "accepted" } })).status === 410);
    check("used token page shows an error (410)", (await request("GET", `/assignment-actions/${encodeURIComponent(ownerToken)}/page`, { text: true })).status === 410);

    const detail1 = await request("GET", `/admin/assignments/${a1Id}`, { token: admin });
    check("assignment is confirmed", detail1.json?.data?.assignmentStatus === "confirmed" && !!detail1.json?.data?.confirmedAt);
    check("both responses recorded", detail1.json?.data?.responses?.length === 2);
    check("e-mails are logged", detail1.json?.data?.emailLogs?.length >= 2 && detail1.json.data.emailLogs.every((l) => ["sent", "failed"].includes(l.deliveryStatus)));
    check("tokens are marked used, hashes hidden", detail1.json?.data?.actionTokens?.every((t) => t.usedAt) && !JSON.stringify(detail1.json).includes("tokenHash"));
    check("tour shows as 'scheduled'", (await request("GET", `/admin/tours/${tour1}`, { token: admin })).json?.data?.displayStatus === "scheduled");

    // rejection path
    console.log("\nRejection path");
    const ownerToken2 = tokenFromLink(a2.json.devActionLinks.owner);
    const rej = await request("POST", "/assignment-actions/respond", { body: { token: ownerToken2, response: "rejected", reason: "Bus is needed elsewhere" } });
    check("owner rejects with a reason -> 200", rej.status === 200 && rej.json?.data?.assignmentStatus === "rejected", JSON.stringify(rej.json));
    check("driver can no longer answer a rejected assignment (409)", (await request("POST", `/driver/assignments/${a2Id}/accept`, { token: d2 })).status === 409);
    check("bus B released after rejection", (await request("GET", `/admin/buses/${busB}`, { token: admin })).json?.data?.status === "available");
    const adminNotes = await request("GET", "/notifications?limit=50", { token: admin });
    check("admin was notified about the answers", adminNotes.json?.data?.some((n) => n.notificationType === "assignment_rejected") && adminNotes.json?.data?.some((n) => n.notificationType === "assignment_confirmed"));

    // ------------------------------------------------------------------ edit / cancel / delete
    console.log("\nEdit, cancel, delete");
    const a3 = await request("POST", "/admin/assignments", { token: admin, body: { tourId: tour3, busId: busA, driverId: driver1.id } });
    check("create assignment for tour 3 -> 201", a3.status === 201, JSON.stringify(a3.json));
    const a3Id = a3.json?.data?.id;

    check("empty edit -> 400", (await request("PUT", `/admin/assignments/${a3Id}`, { token: admin, body: {} })).status === 400);
    check("same values -> 200 'nothing to update'", (await request("PUT", `/admin/assignments/${a3Id}`, { token: admin, body: { driverId: driver1.id } })).json?.message?.startsWith("Nothing to update"));

    const changed = await request("PUT", `/admin/assignments/${a3Id}`, { token: admin, body: { driverId: driver2.id } });
    check("change driver -> 200, answers reset", changed.status === 200 && changed.json?.data?.driver?.id === driver2.id && changed.json?.data?.driverStatus === "pending" && changed.json?.data?.assignmentStatus === "pending", JSON.stringify(changed.json));
    check("old token links stopped working", (await request("GET", `/assignment-actions/${encodeURIComponent(tokenFromLink(a3.json.devActionLinks.owner))}`)).status === 410);
    check("new link works", (await request("GET", `/assignment-actions/${encodeURIComponent(tokenFromLink(changed.json.devActionLinks.owner))}`)).status === 200);
    const oldDriverNotes = await request("GET", "/notifications?limit=50", { token: d1 });
    check("replaced driver was told", oldDriverNotes.json?.data?.some((n) => n.title === "Assignment removed" && Number(n.relatedId) === a3Id));

    const resend = await request("POST", `/admin/assignments/${a3Id}/resend`, { token: admin });
    check("resend links -> 200", resend.status === 200 && resend.json?.emails?.length === 2, JSON.stringify(resend.json));
    check("older links invalid after resend", (await request("GET", `/assignment-actions/${encodeURIComponent(tokenFromLink(changed.json.devActionLinks.owner))}`)).status === 410);

    check("set a status other than cancelled -> 400", (await request("PUT", `/admin/assignments/${a3Id}`, { token: admin, body: { assignmentStatus: "confirmed" } })).status === 400);
    const cancelled = await request("PUT", `/admin/assignments/${a3Id}`, { token: admin, body: { assignmentStatus: "cancelled" } });
    check("cancel assignment -> 200", cancelled.status === 200 && cancelled.json?.data?.assignmentStatus === "cancelled" && !!cancelled.json?.data?.cancelledAt);
    check("cancelled assignment cannot be edited (409)", (await request("PUT", `/admin/assignments/${a3Id}`, { token: admin, body: { busId: busB } })).status === 409);
    check("resend on cancelled (409)", (await request("POST", `/admin/assignments/${a3Id}/resend`, { token: admin })).status === 409);
    check("delete cancelled assignment -> 200", (await request("DELETE", `/admin/assignments/${a3Id}`, { token: admin })).status === 200);
    check("deleted assignment -> 404", (await request("GET", `/admin/assignments/${a3Id}`, { token: admin })).status === 404);
    check("confirmed assignment cannot be deleted (409)", (await request("DELETE", `/admin/assignments/${a1Id}`, { token: admin })).status === 409);
    check("list + filters work", (await request("GET", `/admin/assignments?status=confirmed&tourId=${tour1}`, { token: admin })).json?.data?.length === 1);

    // ------------------------------------------------------------------ GPS
    console.log("\nGPS tracking");
    const point = { assignmentId: a1Id, latitude: 6.9271, longitude: 79.8612, accuracy: 8.5, speed: 12.4, heading: 90 };
    check("GPS before the tour is ongoing -> 409", (await request("POST", "/driver/gps", { token: d1, body: point })).status === 409);

    const started = await request("PATCH", `/admin/tours/${tour1}/status`, { token: admin, body: { status: "ongoing" } });
    check("admin starts the tour", started.status === 200 && started.json?.data?.status === "ongoing" && !started.json?.warning);
    check("cannot edit assignment of an ongoing tour (409)", (await request("PUT", `/admin/assignments/${a1Id}`, { token: admin, body: { busId: busB } })).status === 409);

    check("GPS without a token -> 401", (await request("POST", "/driver/gps", { body: point })).status === 401);
    check("GPS from the wrong driver -> 409", (await request("POST", "/driver/gps", { token: d2, body: { latitude: 6.9, longitude: 79.8 } })).status === 409);
    check("GPS for someone else's assignment -> 404", (await request("POST", "/driver/gps", { token: d2, body: point })).status === 404);
    check("latitude out of range -> 400", (await request("POST", "/driver/gps", { token: d1, body: { ...point, latitude: 123 } })).status === 400);
    check("missing longitude -> 400", (await request("POST", "/driver/gps", { token: d1, body: { latitude: 6.9 } })).status === 400);
    check("negative speed -> 400", (await request("POST", "/driver/gps", { token: d1, body: { ...point, speed: -5 } })).status === 400);
    check("future timestamp -> 400", (await request("POST", "/driver/gps", { token: d1, body: { ...point, recordedAt: isoIn(1) } })).status === 400);

    const saved = await request("POST", "/driver/gps", { token: d1, body: { ...point, recordedAt: new Date(Date.now() - 60000).toISOString() } });
    check("save a GPS point -> 201", saved.status === 201 && saved.json?.data?.saved === 1, JSON.stringify(saved.json));
    const noId = await request("POST", "/driver/gps", { token: d1, body: { latitude: 6.93, longitude: 79.87 } });
    check("assignmentId is optional (auto-detected) -> 201", noId.status === 201, JSON.stringify(noId.json));
    const batch = await request("POST", "/driver/gps", {
      token: d1,
      body: { points: [1, 2, 3].map((i) => ({ latitude: 6.94 + i / 1000, longitude: 79.88, recordedAt: new Date(Date.now() - (30 - i) * 1000).toISOString() })) },
    });
    check("batch of 3 points -> 201", batch.status === 201 && batch.json?.data?.saved === 3, JSON.stringify(batch.json));
    check("too many points -> 400", (await request("POST", "/driver/gps", { token: d1, body: { points: Array.from({ length: 101 }, () => ({ latitude: 6.9, longitude: 79.8 })) } })).status === 400);

    const location = await request("GET", `/admin/buses/${busA}/location`, { token: admin });
    // latest = the point without recordedAt (stamped "now"), latitude 6.93
    check("latest location -> 200", location.status === 200 && location.json?.data?.location?.latitude === 6.93, JSON.stringify(location.json));
    check("location is live + shows tour and driver", location.json?.data?.isLive === true && !!location.json?.data?.tour?.tourCode && !!location.json?.data?.driver?.name);
    const none = await request("GET", `/admin/buses/${busC}/location`, { token: admin });
    check("bus without GPS -> 200 with location null", none.status === 200 && none.json?.data?.location === null);
    check("unknown bus -> 404", (await request("GET", "/admin/buses/999999999/location", { token: admin })).status === 404);
    check("driver cannot read bus locations (403)", (await request("GET", `/admin/buses/${busA}/location`, { token: d1 })).status === 403);

    const history = await request("GET", `/admin/buses/${busA}/gps-history`, { token: admin });
    check("GPS history has all 5 points, oldest first", history.status === 200 && history.json?.data?.count === 5 &&
      new Date(history.json.data.points[0].recordedAt) <= new Date(history.json.data.points[4].recordedAt), JSON.stringify(history.json?.data?.count));
    check("history limit works", (await request("GET", `/admin/buses/${busA}/gps-history?limit=2`, { token: admin })).json?.data?.count === 2);
    check("history order=desc", (await request("GET", `/admin/buses/${busA}/gps-history?order=desc&limit=1`, { token: admin })).json?.data?.points?.[0]?.latitude === 6.93);
    check("history from-filter", (await request("GET", `/admin/buses/${busA}/gps-history?from=${encodeURIComponent(isoIn(1))}`, { token: admin })).json?.data?.count === 0);
    check("history bad date -> 400", (await request("GET", `/admin/buses/${busA}/gps-history?from=yesterday`, { token: admin })).status === 400);
    check("history of another bus is empty", (await request("GET", `/admin/buses/${busB}/gps-history`, { token: admin })).json?.data?.count === 0);
    check("assignment with GPS history cannot be deleted (409)", (await request("DELETE", `/admin/assignments/${a1Id}`, { token: admin })).status === 409);

    // finish the tour: assignment completes, bus is released
    const done = await request("PATCH", `/admin/tours/${tour1}/status`, { token: admin, body: { status: "completed" } });
    check("complete the tour", done.status === 200);
    check("assignment became completed", (await request("GET", `/admin/assignments/${a1Id}`, { token: admin })).json?.data?.assignmentStatus === "completed");
    check("bus A released", (await request("GET", `/admin/buses/${busA}`, { token: admin })).json?.data?.status === "available");
    check("GPS no longer accepted after the tour (409)", (await request("POST", "/driver/gps", { token: d1, body: point })).status === 409);

    // cancelling a tour cancels its pending assignment (tour 2: rejected assignment stays rejected)
    check("delete rejected assignment -> 200", (await request("DELETE", `/admin/assignments/${a2Id}`, { token: admin })).status === 200);

    // ------------------------------------------------------------------ activity logs
    console.log("\nActivity logs");
    const logs = await request("GET", "/admin/activity-logs?action=assignments&limit=100", { token: admin });
    check("activity logs -> 200", logs.status === 200 && Array.isArray(logs.json?.data), JSON.stringify(logs.json));
    check("assignment create/update/delete are logged", ["assignments.create", "assignments.update", "assignments.delete"].every((a) => logs.json?.data?.some((l) => l.action === a)));
    check("log has user, entity and IP", logs.json?.data?.[0]?.user?.email && logs.json?.data?.[0]?.entityType === "assignments" && "ipAddress" in logs.json.data[0]);
    check("no request bodies / secrets in logs", !JSON.stringify(logs.json).includes(password));
    const respLogs = await request("GET", "/admin/activity-logs?action=assignment.&limit=100", { token: admin });
    check("accept / reject responses are logged", respLogs.json?.data?.some((l) => l.action === "assignment.driver.accepted") && respLogs.json?.data?.some((l) => l.action === "assignment.owner.accepted") && respLogs.json?.data?.some((l) => l.action === "assignment.owner.rejected"));
    check("logins are logged", (await request("GET", "/admin/activity-logs?action=auth.login", { token: admin })).json?.data?.length >= 1);
    check("driver cannot read activity logs (403)", (await request("GET", "/admin/activity-logs", { token: d1 })).status === 403);
    check("pagination info", logs.json?.pagination?.page === 1);
  } catch (error) {
    failed++;
    console.log(`\n  ERROR  ${error.message}`);
  } finally {
    console.log(`\nResult: ${passed} passed, ${failed} failed`);
    console.log('(Records named "TEST ..." stay in the database: completed tours and assignments with history cannot be deleted.)\n');
    process.exit(failed ? 1 : 0);
  }
})();
