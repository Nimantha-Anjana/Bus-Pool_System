const { loadDetail } = require("./assignment.service");
const { createNotification, notifyAdmins } = require("./notification.service");
const { logActivity } = require("./activity.service");

// After someone answered an assignment: tell the admins (and the driver when the owner answered),
// and write the activity log. Never throws.
const announceResponse = async ({ assignmentId, party, response, reason, req, actorUserId }) => {
  try {
    const detail = await loadDetail(assignmentId);
    if (!detail) return;

    const driverName = `${detail.driver.user.firstName} ${detail.driver.user.lastName}`;
    const who = party === "driver" ? `Driver ${driverName}` : `Bus owner ${detail.owner.ownerName}`;
    const tourRef = `${detail.tour.tourCode} (${detail.tour.tourName})`;
    const related = { relatedType: "assignment", relatedId: detail.id };

    await notifyAdmins({
      title: `Assignment ${response}`,
      message: `${who} ${response} tour ${tourRef}.${response === "rejected" && reason ? ` Reason: ${reason}` : ""}`,
      type: `assignment_${response}`,
      ...related,
    });

    if (detail.assignmentStatus === "confirmed") {
      await notifyAdmins({
        title: "Assignment confirmed",
        message: `Tour ${tourRef} is now confirmed: both the bus owner and the driver accepted.`,
        type: "assignment_confirmed",
        ...related,
      });
      await createNotification({
        userId: detail.driver.user.id,
        title: "Assignment confirmed",
        message: `Your assignment for tour ${tourRef} is now confirmed.`,
        type: "assignment_confirmed",
        ...related,
      });
    } else if (party === "owner") {
      await createNotification({
        userId: detail.driver.user.id,
        title: `Bus owner ${response} the assignment`,
        message: `The bus owner ${response} the assignment for tour ${tourRef}.`,
        type: `assignment_${response}`,
        ...related,
      });
    }

    await logActivity({
      req,
      userId: actorUserId ?? null,
      action: `assignment.${party}.${response}`,
      entityType: "assignments",
      entityId: detail.id,
      description: `${who} ${response} the assignment for tour ${detail.tour.tourCode}.${reason ? ` Reason: ${reason}` : ""}`,
    });
  } catch (error) {
    console.error("Announcing assignment response failed:", error.message);
  }
};

module.exports = { announceResponse };
