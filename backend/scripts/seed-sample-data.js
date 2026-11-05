
require("dotenv").config();

const bcrypt = require("bcryptjs");
const { sequelize } = require("../src/config/database");

const {
  Role,
  User,
  BusOwner,
  Driver,
  Bus,
  Tour,
  TourAssignment,
} = require("../src/models");

const seedSampleData = async () => {
  const transaction = await sequelize.transaction();

  try {
    // Do not run sample seeders in production
    if (process.env.NODE_ENV === "production") {
      throw new Error("Sample seeder is disabled in production.");
    }

    console.log("Starting sample data seeding...");

    // 1. Find Admin account
    const adminRole = await Role.findOne({
      where: { name: "Admin" },
      transaction,
    });

    if (!adminRole) {
      throw new Error("Admin role not found.");
    }

    const admin = await User.findOne({
      where: {
        email: process.env.ADMIN_EMAIL,
        roleId: adminRole.id,
      },
      transaction,
    });

    if (!admin) {
      throw new Error("Admin account not found. Seed the admin first.");
    }

    // 2. Find or create Driver role
    const [driverRole] = await Role.findOrCreate({
      where: { name: "Driver" },
      defaults: {
        name: "Driver",
        description: "Bus driver account",
      },
      transaction,
    });

    // 3. Create sample Bus Owner
    const [owner] = await BusOwner.findOrCreate({
      where: {
        email: "demo.owner@example.test",
      },
      defaults: {
        ownerName: "Demo Bus Owner",
        phone: "0700000001",
        email: "demo.owner@example.test",
        address: "Demo Address, Sri Lanka",
        status: "active",
        notes: "Development sample record",
      },
      transaction,
    });

    // 4. Create sample Driver User
    const driverPasswordHash = await bcrypt.hash(
      "DemoDriverPassword123!",
      12
    );

    const [driverUser] = await User.findOrCreate({
      where: {
        email: "demo.driver@example.test",
      },
      defaults: {
        roleId: driverRole.id,
        firstName: "Demo",
        lastName: "Driver",
        email: "demo.driver@example.test",
        passwordHash: driverPasswordHash,
        phone: "0700000002",
        status: "active",
      },
      transaction,
    });

    if (Number(driverUser.roleId) !== Number(driverRole.id)) {
      throw new Error("Demo driver email belongs to another role.");
    }

    // 5. Create Driver profile
    const [driver] = await Driver.findOrCreate({
      where: {
        userId: driverUser.id,
      },
      defaults: {
        userId: driverUser.id,
        nic: "DEMO-DRIVER-NIC-001",
        licenseNumber: "DEMO-LICENSE-001",
        licenseExpiryDate: "2035-12-31",
        address: "Demo Driver Address, Sri Lanka",
        emergencyContactName: "Demo Emergency Contact",
        emergencyContactPhone: "0700000003",
        status: "active",
      },
      transaction,
    });

    // 6. Create sample Bus
    const [bus] = await Bus.findOrCreate({
      where: {
        registrationNumber: "DEMO-BUS-REL-001",
      },
      defaults: {
        ownerId: owner.id,
        registrationNumber: "DEMO-BUS-REL-001",
        busName: "Demo Luxury Bus",
        busType: "Luxury",
        seatingCapacity: 45,
        airConditioned: true,
        facilities: ["AC", "WiFi", "USB Charging"],
        description: "Development sample bus",
        status: "available",
      },
      transaction,
    });

    // Ensure the bus belongs to the expected owner
    if (Number(bus.ownerId) !== Number(owner.id)) {
      throw new Error("Sample bus is linked to a different owner.");
    }

    // 7. Create sample Tour
    const startAt = new Date();
    startAt.setDate(startAt.getDate() + 30);
    startAt.setHours(8, 0, 0, 0);

    const endAt = new Date(startAt);
    endAt.setDate(endAt.getDate() + 2);
    endAt.setHours(18, 0, 0, 0);

    const [tour] = await Tour.findOrCreate({
      where: {
        tourCode: "DEMO-TOUR-REL-001",
      },
      defaults: {
        tourCode: "DEMO-TOUR-REL-001",
        tourName: "Demo Sri Lanka Tour",
        tourType: "local",
        description: "Development sample tour",
        startLocation: "Colombo",
        destination: "Kandy",
        startAt,
        endAt,
        pickupAt: startAt,
        returnAt: endAt,
        passengerCount: 30,
        status: "planned",
        specialNotes: "Development sample record",
        createdBy: admin.id,
      },
      transaction,
    });

    // 8. Create Tour Assignment
    const [assignment] = await TourAssignment.findOrCreate({
      where: {
        tourId: tour.id,
        busId: bus.id,
        driverId: driver.id,
      },
      defaults: {
        tourId: tour.id,
        busId: bus.id,
        driverId: driver.id,
        ownerId: owner.id,
        assignedStartAt: tour.startAt,
        assignedEndAt: tour.endAt,
        ownerStatus: "pending",
        driverStatus: "pending",
        assignmentStatus: "pending",
        assignedBy: admin.id,
      },
      transaction,
    });

    if (Number(assignment.ownerId) !== Number(owner.id)) {
      throw new Error("Assignment owner does not match bus owner.");
    }

    await transaction.commit();

    console.log("\nSample data created successfully!");
    console.log("-----------------------------------");
    console.log(`Owner ID: ${owner.id}`);
    console.log(`Bus ID: ${bus.id}`);
    console.log(`Driver User ID: ${driverUser.id}`);
    console.log(`Driver ID: ${driver.id}`);
    console.log(`Tour ID: ${tour.id}`);
    console.log(`Assignment ID: ${assignment.id}`);
    console.log("-----------------------------------");
    console.log("All sample records are linked.");
  } catch (error) {
    await transaction.rollback();

    console.error("\nSample data seeding failed:");
    console.error(error.message);

    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

seedSampleData();
