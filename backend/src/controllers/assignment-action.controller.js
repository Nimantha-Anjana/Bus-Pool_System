const { withTransaction } = require("../utils/transaction.util");
const { sendError } = require("../utils/validators");
const { escapeHtml, formatDateTime } = require("../services/email.service");
const {
  loadDetail,
  findUsableToken,
  processResponse,
} = require("../services/assignment.service");
const { announceResponse } = require("../services/assignment-events.service");

const MIN_REASON = 3;
const MAX_REASON = 1000;

// Public endpoints used by the links in the assignment e-mails. No login: the single-use token IS the credential.

// Validate input, burn the token and record the answer
const answerWithToken = async ({ token, response, reason, req }) => {
  if (!["accepted", "rejected"].includes(response)) {
    const error = new Error('The response must be "accepted" or "rejected".');
    error.statusCode = 400;
    throw error;
  }

  const cleanReason = typeof reason === "string" ? reason.trim() : "";

  if (response === "rejected" && (cleanReason.length < MIN_REASON || cleanReason.length > MAX_REASON)) {
    const error = new Error(`Please give a reason for rejecting (${MIN_REASON}-${MAX_REASON} characters).`);
    error.statusCode = 400;
    throw error;
  }
  if (cleanReason.length > MAX_REASON) {
    const error = new Error(`The note must be ${MAX_REASON} characters or fewer.`);
    error.statusCode = 400;
    throw error;
  }

  const row = await findUsableToken(token);

  const assignment = await withTransaction((transaction) =>
    processResponse({
      assignmentId: row.assignmentId,
      party: row.responderType,
      responderId: row.responderId,
      response,
      reason: cleanReason || null,
      tokenId: row.id,
      req,
      transaction,
    })
  );

  await announceResponse({
    assignmentId: assignment.id,
    party: row.responderType,
    response,
    reason: cleanReason,
    req,
    actorUserId: null,
  });

  return { assignment, party: row.responderType };
};

// What the recipient needs to see (no contact details of the other party)
const summarize = (detail, party) => ({
  party,
  tour: {
    tourCode: detail.tour.tourCode,
    tourName: detail.tour.tourName,
    route: `${detail.tour.startLocation} → ${detail.tour.destination}`,
    passengerCount: detail.tour.passengerCount,
  },
  bus: {
    registrationNumber: detail.bus.registrationNumber,
    busName: detail.bus.busName,
  },
  ...(party === "owner"
    ? { driverName: `${detail.driver.user.firstName} ${detail.driver.user.lastName}` }
    : {}),
  assignedStartAt: detail.assignedStartAt,
  assignedEndAt: detail.assignedEndAt,
});

// GET /api/assignment-actions/:token   (preview only, does NOT use the token up)
const previewAction = async (req, res, next) => {
  try {
    const row = await findUsableToken(req.params.token);
    const detail = await loadDetail(row.assignmentId);

    if (!detail || detail.assignmentStatus !== "pending")
      return sendError(res, 410, "This assignment is no longer waiting for a response.");

    res.setHeader("Cache-Control", "no-store");

    return res.status(200).json({
      success: true,
      message: "Link is valid.",
      data: { ...summarize(detail, row.responderType), expiresAt: row.expiresAt },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/assignment-actions/respond   body: { token, response: "accepted"|"rejected", reason? }
const respondJson = async (req, res, next) => {
  try {
    const { token, response, reason } = req.body || {};
    const { assignment, party } = await answerWithToken({ token, response, reason, req });

    return res.status(200).json({
      success: true,
      message: response === "accepted" ? "Thank you, you accepted the assignment." : "Thank you, you rejected the assignment.",
      data: {
        party,
        assignmentStatus: assignment.assignmentStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ---- Simple server-rendered page, so the e-mail link works without any frontend ----------------

const shell = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body{font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:24px;color:#111}
.card{max-width:520px;margin:0 auto;background:#fff;border-radius:10px;padding:24px;box-shadow:0 1px 4px rgba(0,0,0,.12)}
table{border-collapse:collapse;margin:12px 0}td{padding:4px 12px 4px 0;vertical-align:top}td:first-child{color:#555}
textarea{width:100%;box-sizing:border-box;min-height:80px;margin:6px 0 14px;padding:8px;font:inherit}
button{padding:10px 18px;border:0;border-radius:6px;color:#fff;font-size:15px;cursor:pointer;margin-right:8px}
.ok{background:#15803d}.no{background:#b91c1c}.muted{color:#555;font-size:13px}
</style></head><body><div class="card">${body}</div></body></html>`;

const sendPage = (res, status, title, body) => {
  res.status(status);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(shell(title, body));
};

// GET /api/assignment-actions/:token/page
const showPage = async (req, res, next) => {
  try {
    let row;
    try {
      row = await findUsableToken(req.params.token);
    } catch (error) {
      if (error.statusCode) {
        return sendPage(res, error.statusCode, "Link problem", `<h2>Link problem</h2><p>${escapeHtml(error.message)}</p><p class="muted">If you still need to respond, ask the administrator to send a new link.</p>`);
      }
      throw error;
    }

    const detail = await loadDetail(row.assignmentId);
    if (!detail || detail.assignmentStatus !== "pending")
      return sendPage(res, 410, "No response needed", "<h2>No response needed</h2><p>This assignment is no longer waiting for a response.</p>");

    const info = summarize(detail, row.responderType);
    const rows = [
      ["Tour", `${info.tour.tourName} (${info.tour.tourCode})`],
      ["Route", info.tour.route],
      ["From", formatDateTime(info.assignedStartAt)],
      ["Until", formatDateTime(info.assignedEndAt)],
      ["Bus", info.bus.registrationNumber],
      ["Passengers", info.tour.passengerCount],
      ...(info.driverName ? [["Driver", info.driverName]] : []),
    ]
      .map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td><strong>${escapeHtml(value)}</strong></td></tr>`)
      .join("");

    return sendPage(
      res,
      200,
      "Tour assignment",
      `<h2>Tour assignment</h2>
       <table>${rows}</table>
       <form method="post" action="/api/assignment-actions/respond-form">
         <input type="hidden" name="token" value="${escapeHtml(req.params.token)}">
         <label for="reason">Reason (required if you reject)</label>
         <textarea id="reason" name="reason" maxlength="${MAX_REASON}"></textarea>
         <button class="ok" type="submit" name="response" value="accepted">Accept</button>
         <button class="no" type="submit" name="response" value="rejected">Reject</button>
       </form>
       <p class="muted">This link works once and expires on ${escapeHtml(formatDateTime(row.expiresAt))}.</p>`
    );
  } catch (error) {
    next(error);
  }
};

// POST /api/assignment-actions/respond-form   (urlencoded, posted by the page above)
const respondForm = async (req, res, next) => {
  try {
    const { token, response, reason } = req.body || {};

    try {
      const { assignment } = await answerWithToken({ token, response, reason, req });

      const message =
        response === "accepted"
          ? assignment.assignmentStatus === "confirmed"
            ? "You accepted the assignment. Everyone has accepted, so it is now confirmed."
            : "You accepted the assignment. We are waiting for the other party."
          : "You rejected the assignment. The administrator has been notified.";

      return sendPage(res, 200, "Thank you", `<h2>Thank you</h2><p>${escapeHtml(message)}</p>`);
    } catch (error) {
      if (error.statusCode && error.statusCode < 500) {
        return sendPage(res, error.statusCode, "Could not save your response", `<h2>Could not save your response</h2><p>${escapeHtml(error.message)}</p>${error.statusCode === 400 && token ? `<p><a href="/api/assignment-actions/${encodeURIComponent(token)}/page">Go back</a></p>` : ""}`);
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

module.exports = { previewAction, respondJson, showPage, respondForm };
