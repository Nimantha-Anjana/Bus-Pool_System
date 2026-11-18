// Extra indexes for the queries the reminder jobs, lists and dashboards run most often.
const INDEXES = [
  ["tour_assignments", "idx_assignment_status_start", ["assignment_status", "assigned_start_at"]],
  ["tour_assignments", "idx_assignment_tour_status", ["tour_id", "assignment_status"]],
  ["tours", "idx_tours_status_start", ["status", "start_at"]],
  ["email_logs", "idx_email_assignment_type", ["assignment_id", "email_type", "delivery_status"]],
  ["assignment_action_tokens", "idx_action_tokens_lookup", ["assignment_id", "used_at", "revoked_at"]],
  ["refresh_tokens", "idx_refresh_user_revoked", ["user_id", "revoked_at"]],
  ["notifications", "idx_notifications_related", ["related_type", "related_id"]],
  ["activity_logs", "idx_activity_action", ["action"]],
];

module.exports = {
  name: "002_indexes",
  async up(sequelize) {
    for (const [table, name, columns] of INDEXES) {
      const [existing] = await sequelize.query(`SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`, {
        replacements: [name],
      });
      if (existing.length) continue;

      await sequelize.query(`CREATE INDEX \`${name}\` ON \`${table}\` (${columns.map((c) => `\`${c}\``).join(", ")})`);
      console.log(`  index ${name} created on ${table}.`);
    }
  },
};
