const nodemailer = require("nodemailer");
const environment = require("../config/environment");
const { EmailLog } = require("../models");

const MAX_ATTEMPTS = 2;

// Development without SMTP: nothing is delivered, the message is just previewed in the console.
const isDevPreview = () => !environment.email.host && environment.nodeEnv === "development";

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  transporter = isDevPreview()
    ? nodemailer.createTransport({ jsonTransport: true })
    : nodemailer.createTransport({
        host: environment.email.host,
        port: environment.email.port,
        secure: environment.email.secure,
        auth: environment.email.user
          ? { user: environment.email.user, pass: environment.email.pass }
          : undefined,
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
      });

  return transporter;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatDateTime = (date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: environment.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));

// Send one e-mail and keep a row in email_logs (pending -> sent | failed)
const sendEmail = async ({ assignmentId = null, to, type, subject, html, text }) => {
  const log = await EmailLog.create({
    assignmentId,
    recipientEmail: to,
    emailType: type,
    subject: subject.slice(0, 255),
    deliveryStatus: "pending",
    attempts: 0,
  });

  if (!environment.email.host && !isDevPreview()) {
    await log.update({
      deliveryStatus: "failed",
      errorMessage: "E-mail is not configured (SMTP_HOST is missing).",
    });
    return { status: "failed", logId: log.id, error: "E-mail is not configured." };
  }

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const info = await getTransporter().sendMail({
        from: environment.email.from,
        to,
        subject,
        html,
        text,
      });

      await log.update({
        deliveryStatus: "sent",
        attempts: attempt,
        providerMessageId: isDevPreview() ? "dev-preview" : String(info.messageId || "").slice(0, 255),
        sentAt: new Date(),
        errorMessage: null,
      });

      if (isDevPreview()) console.log(`[dev e-mail preview] to=${to} subject="${subject}"`);

      return { status: "sent", logId: log.id };
    } catch (error) {
      lastError = error;
      await log.update({ attempts: attempt });
    }
  }

  await log.update({
    deliveryStatus: "failed",
    errorMessage: String(lastError?.message || "Unknown e-mail error").slice(0, 1000),
  });

  return { status: "failed", logId: log.id, error: "E-mail delivery failed." };
};

// ---- Assignment e-mails -------------------------------------------------------------------

// `detail` = assignment loaded with tour, bus, owner and driver(+user)
const getParties = (detail) => ({
  owner: {
    type: "owner",
    email: detail.owner.email,
    name: detail.owner.ownerName,
  },
  driver: {
    type: "driver",
    email: detail.driver.user.email,
    name: `${detail.driver.user.firstName} ${detail.driver.user.lastName}`,
    userId: detail.driver.user.id,
  },
});

const detailRows = (detail, recipientType) => {
  const rows = [
    ["Tour", `${detail.tour.tourName} (${detail.tour.tourCode})`],
    ["Route", `${detail.tour.startLocation} → ${detail.tour.destination}`],
    ["From", formatDateTime(detail.assignedStartAt)],
    ["Until", formatDateTime(detail.assignedEndAt)],
    ["Bus", `${detail.bus.registrationNumber}${detail.bus.busName ? ` (${detail.bus.busName})` : ""}`],
    ["Passengers", detail.tour.passengerCount],
  ];

  if (recipientType === "owner") {
    rows.push(["Driver", `${detail.driver.user.firstName} ${detail.driver.user.lastName}`]);
  }

  return rows;
};

const buildAssignmentEmail = ({ kind, detail, recipient, link, expiresAt }) => {
  const rows = detailRows(detail, recipient.type);

  const intro = {
    assignment_request: "You have been assigned to a tour. Please review the details and respond.",
    assignment_updated:
      "An assignment you were part of has been changed. Your earlier response no longer applies, so please review the new details and respond again.",
    assignment_cancelled: "The assignment below has been cancelled. No further action is needed.",
  }[kind];

  const subject = {
    assignment_request: `Tour assignment: ${detail.tour.tourCode}`,
    assignment_updated: `Updated tour assignment: ${detail.tour.tourCode}`,
    assignment_cancelled: `Assignment cancelled: ${detail.tour.tourCode}`,
  }[kind];

  const tableHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#555">${escapeHtml(label)}</td><td style="padding:4px 0"><strong>${escapeHtml(value)}</strong></td></tr>`
    )
    .join("");

  const actionHtml = link
    ? `<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px">Review and respond</a></p>
       <p style="color:#555;font-size:13px">This personal link can be used once and expires on ${escapeHtml(formatDateTime(expiresAt))}. Do not forward it.</p>`
    : "";

  const html = `<div style="font-family:Arial,sans-serif;max-width:560px">
    <h2>Bus Pool System</h2>
    <p>Hello ${escapeHtml(recipient.name)},</p>
    <p>${escapeHtml(intro)}</p>
    <table style="border-collapse:collapse">${tableHtml}</table>
    ${actionHtml}
  </div>`;

  const text = [
    `Hello ${recipient.name},`,
    "",
    intro,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    ...(link ? ["", `Review and respond: ${link}`, `The link works once and expires on ${formatDateTime(expiresAt)}.`] : []),
  ].join("\n");

  return { subject, html, text };
};

const buildActionLink = (rawToken) =>
  `${environment.apiPublicUrl}/api/assignment-actions/${encodeURIComponent(rawToken)}/page`;

// Send an assignment e-mail to the given recipients.
// tokens: { owner: { raw, expiresAt }, driver: { raw, expiresAt } } (only for request/updated)
// Returns a per-recipient result list (+ the links in dev-preview mode so they can be tested).
const sendAssignmentEmails = async ({ kind, detail, recipients, tokens = {}, logAssignmentId }) => {
  const results = [];
  const devActionLinks = {};

  for (const recipient of recipients) {
    const token = tokens[recipient.type];
    const link = token ? buildActionLink(token.raw) : null;

    const content = buildAssignmentEmail({
      kind,
      detail,
      recipient,
      link,
      expiresAt: token?.expiresAt,
    });

    const result = await sendEmail({
      assignmentId: logAssignmentId === undefined ? detail.id : logAssignmentId,
      to: recipient.email,
      type: kind,
      ...content,
    });

    results.push({ recipient: recipient.type, email: recipient.email, status: result.status });
    if (link && isDevPreview()) devActionLinks[recipient.type] = link;
  }

  return { results, devActionLinks: isDevPreview() ? devActionLinks : undefined };
};

module.exports = {
  sendEmail,
  sendAssignmentEmails,
  getParties,
  buildActionLink,
  escapeHtml,
  formatDateTime,
  isDevPreview,
};
