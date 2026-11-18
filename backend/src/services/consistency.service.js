const { sequelize } = require("../config/database");

const ACTIVE = "('pending','confirmed')";

// Raw UPDATE results differ a little between drivers: accept a number or a { affectedRows } object
const affected = (meta) => (typeof meta === "number" ? meta : Number(meta?.affectedRows) || 0);

// buses.status ("available" / "assigned") is a cache of "does this bus have a pending/confirmed assignment?".
// This makes the cache true again (maintenance / inactive buses are never touched).
const reconcileBusStatuses = async () => {
  const [, markedAssigned] = await sequelize.query(
    `UPDATE buses SET status = 'assigned'
     WHERE status = 'available'
       AND id IN (SELECT bus_id FROM tour_assignments WHERE assignment_status IN ${ACTIVE})`
  );

  const [, released] = await sequelize.query(
    `UPDATE buses SET status = 'available'
     WHERE status = 'assigned'
       AND id NOT IN (SELECT bus_id FROM tour_assignments WHERE assignment_status IN ${ACTIVE})`
  );

  return { markedAssigned: affected(markedAssigned), released: affected(released) };
};

// Read-only integrity report: every list should be empty on a healthy database.
const findIntegrityProblems = async () => {
  const q = async (sql) => (await sequelize.query(sql))[0];

  return {
    busStatusShouldBeAssigned: await q(
      `SELECT id, registration_number FROM buses WHERE status = 'available'
       AND id IN (SELECT bus_id FROM tour_assignments WHERE assignment_status IN ${ACTIVE})`
    ),
    busStatusShouldBeAvailable: await q(
      `SELECT id, registration_number FROM buses WHERE status = 'assigned'
       AND id NOT IN (SELECT bus_id FROM tour_assignments WHERE assignment_status IN ${ACTIVE})`
    ),
    overlappingBusAssignments: await q(
      `SELECT a.id AS a_id, b.id AS b_id, a.bus_id FROM tour_assignments a
       JOIN tour_assignments b ON a.bus_id = b.bus_id AND a.id < b.id
       WHERE a.assignment_status IN ${ACTIVE} AND b.assignment_status IN ${ACTIVE}
         AND a.assigned_start_at < b.assigned_end_at AND b.assigned_start_at < a.assigned_end_at`
    ),
    overlappingDriverAssignments: await q(
      `SELECT a.id AS a_id, b.id AS b_id, a.driver_id FROM tour_assignments a
       JOIN tour_assignments b ON a.driver_id = b.driver_id AND a.id < b.id
       WHERE a.assignment_status IN ${ACTIVE} AND b.assignment_status IN ${ACTIVE}
         AND a.assigned_start_at < b.assigned_end_at AND b.assigned_start_at < a.assigned_end_at`
    ),
    assignmentOwnerMismatch: await q(
      `SELECT a.id, a.owner_id, b.owner_id AS bus_owner_id FROM tour_assignments a
       JOIN buses b ON b.id = a.bus_id WHERE a.owner_id <> b.owner_id`
    ),
    confirmedWithoutBothAccepts: await q(
      `SELECT id FROM tour_assignments WHERE assignment_status = 'confirmed'
       AND (owner_status <> 'accepted' OR driver_status <> 'accepted')`
    ),
    activeAssignmentsOnClosedTours: await q(
      `SELECT a.id, a.tour_id FROM tour_assignments a JOIN tours t ON t.id = a.tour_id
       WHERE a.assignment_status IN ${ACTIVE} AND t.status IN ('completed','cancelled')`
    ),
    driversWithoutActiveUser: await q(
      `SELECT d.id FROM drivers d JOIN users u ON u.id = d.user_id
       WHERE d.status = 'active' AND u.status <> 'active'`
    ),
    gpsOutsideOngoingTour: await q(
      `SELECT COUNT(*) AS points FROM gps_locations g
       JOIN tour_assignments a ON a.id = g.assignment_id JOIN tours t ON t.id = a.tour_id
       WHERE t.status = 'planned'`
    ).then((rows) => (Number(rows[0]?.points) ? rows : [])),
  };
};

module.exports = { reconcileBusStatuses, findIntegrityProblems };
