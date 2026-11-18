// Text fields that the controllers call .trim() on. A client sending a number, array or object
// for one of them would otherwise crash the request with a 500; here it becomes a clear 400.
const TEXT_FIELDS = [
  "ownerName", "phone", "email", "address", "nic", "businessRegistrationNo", "notes",
  "registrationNumber", "busName", "busType", "description",
  "firstName", "lastName", "password", "licenseNumber", "licenseExpiryDate",
  "emergencyContactName", "emergencyContactPhone",
  "tourCode", "tourName", "startLocation", "destination", "specialNotes",
  "stopName", "stopType", "locationAddress", "reason",
];

const findBadField = (object) => {
  if (!object || typeof object !== "object" || Array.isArray(object)) return null;

  for (const key of TEXT_FIELDS) {
    const value = object[key];
    if (value !== undefined && value !== null && typeof value !== "string") return key;
  }

  return null;
};

const validateBodyTypes = (req, res, next) => {
  const body = req.body;
  if (!body || typeof body !== "object") return next();

  let bad = findBadField(body);

  if (!bad && Array.isArray(body.stops)) {
    for (const stop of body.stops) {
      bad = findBadField(stop);
      if (bad) break;
    }
  }

  if (bad) {
    return res.status(400).json({
      success: false,
      message: `"${bad}" must be a text value.`,
    });
  }

  next();
};

module.exports = { validateBodyTypes };
