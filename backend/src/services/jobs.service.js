// Background jobs. They run inside the API process (no extra infrastructure).
// Set RUN_JOBS=false on every instance except one if you ever run more than one copy of the API.
const { Op } = require("sequelize");
const environment = require("../config/environment");
const { sequelize } = require("../config/database");
const { RefreshToken, AssignmentActionToken, EmailLog, TourAssignment, Tour, GpsLocation, Notification } = require("../models");
const { loadDetail, issueTokens } = require("./assignment.service");
const { sendAssignmentEmails, buildAssignmentEmail, deliver, getParties } = require("./email.service");
const { createNotification, notifyAdmins } = require("./notification.service");
const { reconcileBusStatuses } = require("./consistency.service");

const HOUR = 60 * 60 * 1000;
const MAX_EMAIL_ATTEMPTS = 6; // total delivery attempts (including the first ones) before we give up
const MAX_REMINDER_FAILURES = 3;
const LINK_KINDS = new Set(["assignment_request", "assignment_updated"]);

// ---- 1. Reminder e-mail N hours (default 48) before the tour starts ------------------------------------
// pending assignments get a FRESH response link; confirmed ones a plain reminder (no link).
const sendReminders = async () => {
  const now = new Date();
  const until = new Date(now.getTime() + environment.reminderHoursBefore * HOUR);

  const due = await TourAssignment.findAll({
    where: {
      assignmentStatus: { [Op.in]: ["pending", "confirmed"] },
      assignedStartAt: { [Op.gt]: now, [Op.lte]: until },
      // not touched in the last 2 hours: avoids a reminder right after the request / update e-mail
      updatedAt: { [Op.lt]: new Date(now.getTime() - 2 * HOUR) },
    },
    include: [{ model: Tour, as: "tour", where: { status: "planned" }, attributes: ["id"] }],
    attributes: ["id"],
  });

  for (const row of due) {
    try {
      const sent = await EmailLog.count({ where: { assignmentId: row.id, emailType: "assignment_reminder", deliveryStatus: "sent" } });
      const failed = await EmailLog.count({ where: { assignmentId: row.id, emailType: "assignment_reminder", deliveryStatus: "failed" } });
      if (sent > 0 || failed >= MAX_REMINDER_FAILURES) continue;

      const detail = await loadDetail(row.id);
      if (!detail) continue;

      const pending = detail.assignmentStatus === "pending";
      const tokens = pending ? await issueTokens(detail, detail.owner, detail.driver) : {};
      const parties = getParties(detail);

      // a confirmed assignment needs no link; a pending one only for the side that has not answered yet
      const recipients = [parties.owner, parties.driver].filter((party) =>
        pending ? detail[`${party.type}Status`] === "pending" : true
      );

      await sendAssignmentEmails({ kind: "assignment_reminder", detail, recipients, tokens });

      await createNotification({
        userId: detail.driver.user.id,
        title: "Tour starts soon",
        message: `Tour ${detail.tour.tourCode} starts within ${environment.reminderHoursBefore} hours.`,
        type: "assignment_reminder",
        relatedType: "assignment",
        relatedId: detail.id,
      });
    } catch (error) {
      console.error(`Reminder for assignment ${row.id} failed:`, error.message);
    }
  }
};

// ---- 2. Retry failed e-mails ---------------------------------------------------------------------------
// E-mails WITHOUT a personal link are rebuilt and re-sent. Emails with a one-time link cannot be re-sent
// (the raw token is never stored): the admins get a notification to use "resend" instead.
const retryFailedEmails = async () => {
  const failed = await EmailLog.findAll({
    where: {
      deliveryStatus: "failed",
      createdAt: { [Op.gt]: new Date(Date.now() - 24 * HOUR) },
      assignmentId: { [Op.ne]: null },
    },
    limit: 50,
    order: [["id", "ASC"]],
  });

  for (const log of failed) {
    try {
      if (log.attempts >= MAX_EMAIL_ATTEMPTS) continue;

      const detail = await loadDetail(log.assignmentId);
      if (!detail) continue;

      const needsLink =
        LINK_KINDS.has(log.emailType) ||
        (log.emailType === "assignment_reminder" && detail.assignmentStatus === "pending");

      if (needsLink) {
        const already = await Notification.count({
          where: { relatedType: "email_log", relatedId: log.id },
        });
        if (!already && ["pending", "confirmed"].includes(detail.assignmentStatus)) {
          await notifyAdmins({
            title: "E-mail could not be delivered",
            message: `The "${log.emailType}" e-mail to ${log.recipientEmail} for tour ${detail.tour.tourCode} failed. Use "resend e-mails" on the assignment.`,
            type: "email_failed",
            relatedType: "email_log",
            relatedId: log.id,
          });
        }
        continue;
      }

      const recipient = Object.values(getParties(detail)).find((party) => party.email === log.recipientEmail);
      if (!recipient) continue;

      const content = buildAssignmentEmail({ kind: log.emailType, detail, recipient, link: null });
      await deliver(log, { to: log.recipientEmail, ...content });
    } catch (error) {
      console.error(`Retry of e-mail ${log.id} failed:`, error.message);
    }
  }
};

// ---- 3. Tell the admins when the response links of an assignment have all expired -----------------------
const flagExpiredResponseLinks = async () => {
  const [rows] = await sequelize.query(
    `SELECT a.id, t.tour_code AS tourCode
     FROM tour_assignments a JOIN tours t ON t.id = a.tour_id
     WHERE a.assignment_status = 'pending' AND t.status = 'planned'
       AND (a.owner_status = 'pending' OR a.driver_status = 'pending')
       AND EXISTS (SELECT 1 FROM assignment_action_tokens k WHERE k.assignment_id = a.id)
       AND NOT EXISTS (SELECT 1 FROM assignment_action_tokens k WHERE k.assignment_id = a.id
                       AND k.used_at IS NULL AND k.revoked_at IS NULL AND k.expires_at > :now)
       AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.related_type = 'assignment' AND n.related_id = a.id
                       AND n.notification_type = 'assignment_link_expired'
                       AND n.created_at > (SELECT MAX(k.created_at) FROM assignment_action_tokens k WHERE k.assignment_id = a.id))
     LIMIT 100`,
    { replacements: { now: new Date() } }
  );

  for (const row of rows) {
    await notifyAdmins({
      title: "Response link expired",
      message: `The response links for tour ${row.tourCode} expired before everyone answered. Use "resend e-mails" to send new links.`,
      type: "assignment_link_expired",
      relatedType: "assignment",
      relatedId: row.id,
    });
  }
};

// ---- 4. Housekeeping ----------------------------------------------------------------------------------
const cleanUp = async () => {
  const day = new Date(Date.now() - 24 * HOUR);
  const month = new Date(Date.now() - 30 * 24 * HOUR);

  const refresh = await RefreshToken.destroy({
    where: { [Op.or]: [{ expiresAt: { [Op.lt]: day } }, { revokedAt: { [Op.lt]: day } }] },
  });
  const action = await AssignmentActionToken.destroy({
    where: { [Op.or]: [{ expiresAt: { [Op.lt]: month } }, { usedAt: { [Op.lt]: month } }, { revokedAt: { [Op.lt]: month } }] },
  });

  let gps = 0;
  if (environment.gps.retentionDays > 0) {
    const cutoff = new Date(Date.now() - environment.gps.retentionDays * 24 * HOUR);
    const [old] = await sequelize.query(
      `SELECT g.id FROM gps_locations g
       JOIN tour_assignments a ON a.id = g.assignment_id JOIN tours t ON t.id = a.tour_id
       WHERE t.status IN ('completed','cancelled') AND g.received_at < :cutoff LIMIT 5000`,
      { replacements: { cutoff } }
    );
    if (old.length) gps = await GpsLocation.destroy({ where: { id: { [Op.in]: old.map((r) => r.id) } } });
  }

  const buses = await reconcileBusStatuses();

  if (refresh || action || gps || buses.markedAssigned || buses.released)
    console.log(`Clean-up: ${refresh} refresh token(s), ${action} action token(s), ${gps} GPS point(s); bus status fixes: ${buses.markedAssigned + buses.released}.`);
};

// ---- Scheduler ----------------------------------------------------------------------------------------
const running = new Set();

const every = (name, intervalMs, fn, firstDelayMs) => {
  const run = async () => {
    if (running.has(name)) return; // never let a slow run overlap itself
    running.add(name);
    try {
      await fn();
    } catch (error) {
      console.error(`Job "${name}" failed:`, error.message);
    } finally {
      running.delete(name);
    }
  };

  setTimeout(run, firstDelayMs).unref();
  setInterval(run, intervalMs).unref();
};

const startJobs = () => {
  if (!environment.runJobs) {
    console.log("Background jobs are disabled (RUN_JOBS=false).");
    return;
  }

  every("reminders", 15 * 60 * 1000, sendReminders, 30 * 1000);
  every("email-retry", 10 * 60 * 1000, retryFailedEmails, 60 * 1000);
  every("expired-links", 30 * 60 * 1000, flagExpiredResponseLinks, 90 * 1000);
  every("clean-up", 6 * HOUR, cleanUp, 15 * 1000);
  console.log("Background jobs started (reminders, e-mail retry, expired links, clean-up).");
};

module.exports = { startJobs, sendReminders, retryFailedEmails, flagExpiredResponseLinks, cleanUp };
