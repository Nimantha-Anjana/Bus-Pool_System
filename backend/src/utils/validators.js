const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_REGEX = /^\+?[0-9][0-9\s-]{8,14}$/;
// Sri Lankan NIC: old (9 digits + V/X) or new (12 digits)
const NIC_REGEX = /^(\d{9}[VvXx]|\d{12})$/;

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const isValidEmail = (value) =>
  typeof value === "string" && EMAIL_REGEX.test(value.trim());

const isValidPhone = (value) =>
  typeof value === "string" && PHONE_REGEX.test(value.trim());

const isValidNic = (value) =>
  typeof value === "string" && NIC_REGEX.test(value.trim());

// Licence numbers vary by issue year (e.g. B1234567); accept 6-20 letters/digits/hyphens
const LICENSE_REGEX = /^[A-Za-z0-9-]{6,20}$/;
const isValidLicenseNumber = (value) =>
  typeof value === "string" && LICENSE_REGEX.test(value.trim());

// 8+ characters with at least one letter and one digit
const isStrongPassword = (value) =>
  typeof value === "string" &&
  value.length >= 8 &&
  value.length <= 72 &&
  /[A-Za-z]/.test(value) &&
  /\d/.test(value);

const parseId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const sendError = (res, status, message, errors) =>
  res.status(status).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
  });

module.exports = {
  isNonEmptyString,
  isValidEmail,
  isValidPhone,
  isValidNic,
  isValidLicenseNumber,
  isStrongPassword,
  parseId,
  sendError,
};
