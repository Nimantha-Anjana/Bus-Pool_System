const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const { BusOwner, Bus, Driver, Tour, TourAssignment } = require("../models");

// Turn [{ status: 'x', count: '3' }] into { x: 3 } with every expected key present
const toCountMap = (rows, keys) => {
  const map = Object.fromEntries(keys.map((key) => [key, 0]));
  rows.forEach((row) => {
    map[row.status] = Number(row.count);
  });
  return map;
};

const groupByStatus = (Model) =>
  Model.findAll({
    attributes: ["status", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
    group: ["status"],
    raw: true,
  });

// GET /api/admin/dashboard
const getDashboard = async (req, res, next) => {
  try {
    const [
      ownersByStatus,
      busesByStatus,
      airConditionedBuses,
      busesWithoutImages,
      totalSeats,
      driversByStatus,
      toursByStatus,
      assignmentRows,
      topOwners,
      recentBuses,
    ] = await Promise.all([
      groupByStatus(BusOwner),
      groupByStatus(Bus),
      Bus.count({ where: { airConditioned: true } }),
      sequelize.query(
        `SELECT COUNT(*) AS count FROM buses b
         WHERE NOT EXISTS (SELECT 1 FROM bus_images i WHERE i.bus_id = b.id)`,
        { type: QueryTypes.SELECT }
      ),
      Bus.sum("seatingCapacity", { where: { status: "available" } }),
      groupByStatus(Driver),
      groupByStatus(Tour),
      TourAssignment.findAll({
        attributes: [
          ["assignment_status", "status"],
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        ],
        group: ["assignment_status"],
        raw: true,
      }),
      sequelize.query(
        `SELECT o.id, o.owner_name AS ownerName, COUNT(b.id) AS busCount
         FROM bus_owners o
         LEFT JOIN buses b ON b.owner_id = o.id
         GROUP BY o.id, o.owner_name
         ORDER BY busCount DESC, o.owner_name ASC
         LIMIT 5`,
        { type: QueryTypes.SELECT }
      ),
      Bus.findAll({
        attributes: ["id", "registrationNumber", "busName", "busType", "status", "createdAt"],
        include: [{ model: BusOwner, as: "owner", attributes: ["id", "ownerName"] }],
        order: [["createdAt", "DESC"]],
        limit: 5,
      }),
    ]);

    const owners = toCountMap(ownersByStatus, ["active", "inactive"]);
    const buses = toCountMap(busesByStatus, ["available", "assigned", "maintenance", "inactive"]);
    const drivers = toCountMap(driversByStatus, ["active", "inactive", "suspended"]);
    const tours = toCountMap(toursByStatus, ["planned", "ongoing", "completed", "cancelled"]);
    const assignments = toCountMap(assignmentRows, [
      "pending",
      "confirmed",
      "rejected",
      "cancelled",
      "completed",
    ]);

    const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

    return res.status(200).json({
      success: true,
      message: "Admin dashboard retrieved successfully.",
      data: {
        user: req.user,
        dashboard: "admin",
        summary: {
          totalBusOwners: sum(owners),
          totalBuses: sum(buses),
          availableBuses: buses.available,
          unavailableBuses: sum(buses) - buses.available,
          totalDrivers: sum(drivers),
          totalTours: sum(tours),
          pendingAssignments: assignments.pending,
        },
        busOwners: { ...owners, total: sum(owners) },
        buses: {
          ...buses,
          total: sum(buses),
          airConditioned: airConditionedBuses,
          nonAirConditioned: sum(buses) - airConditionedBuses,
          withoutImages: Number(busesWithoutImages[0]?.count || 0),
          availableSeats: Number(totalSeats || 0),
        },
        drivers: { ...drivers, total: sum(drivers) },
        tours: { ...tours, total: sum(tours) },
        assignments: { ...assignments, total: sum(assignments) },
        topOwnersByBuses: topOwners.map((row) => ({
          id: row.id,
          ownerName: row.ownerName,
          busCount: Number(row.busCount),
        })),
        recentBuses,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/dashboard/buses  (lighter endpoint: bus stats only)
const getBusStats = async (req, res, next) => {
  try {
    const [byStatus, byType] = await Promise.all([
      groupByStatus(Bus),
      Bus.findAll({
        attributes: ["busType", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
        group: ["busType"],
        raw: true,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Bus statistics retrieved successfully.",
      data: {
        byStatus: toCountMap(byStatus, ["available", "assigned", "maintenance", "inactive"]),
        byType: byType.map((row) => ({ busType: row.busType, count: Number(row.count) })),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboard, getBusStats };
