const { Notification, User, Role } = require("../models");

// In-app notifications. Like activity logs, a failure here must not break the main action.
const createNotification = async ({
  userId,
  title,
  message,
  type,
  relatedType = null,
  relatedId = null,
  transaction,
}) => {
  if (!userId) return null;

  try {
    return await Notification.create(
      {
        userId,
        title: String(title).slice(0, 200),
        message,
        notificationType: String(type).slice(0, 50),
        relatedType,
        relatedId,
      },
      { transaction }
    );
  } catch (error) {
    console.error("Notification failed:", error.message);
    return null;
  }
};

const notifyAdmins = async (payload) => {
  try {
    const admins = await User.findAll({
      where: { status: "active" },
      attributes: ["id"],
      include: [{ model: Role, as: "role", where: { name: "Admin" }, attributes: [] }],
    });

    await Promise.all(admins.map((admin) => createNotification({ ...payload, userId: admin.id })));
  } catch (error) {
    console.error("Admin notification failed:", error.message);
  }
};

module.exports = { createNotification, notifyAdmins };
