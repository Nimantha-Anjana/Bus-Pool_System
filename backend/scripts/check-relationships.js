
const { sequelize } = require("../src/config/database");

const {
  BusOwner,
  Driver,
  User,
  Tour,
  TourAssignment,
  Bus,
} = require("../src/models");

const checkRelationships = async () => {
  try {
    await sequelize.authenticate();

    console.log("Database connected.");
    console.log("\nChecking relationships...\n");

    // Test 1: Owner -> Buses
    const owner = await BusOwner.findOne({
      where: { email: "demo.owner@example.test" },
      include: [
        {
          model: Bus,
          as: "buses",
        },
      ],
    });

    if (!owner || owner.buses.length === 0) {
      throw new Error("Owner -> Buses relationship failed.");
    }

    console.log("PASSED: BusOwner -> Buses");

    // Test 2: User -> Driver
    const driverUser = await User.findOne({
      where: { email: "demo.driver@example.test" },
      include: [
        {
          model: Driver,
          as: "driver",
        },
      ],
    });

    if (!driverUser || !driverUser.driver) {
      throw new Error("User -> Driver relationship failed.");
    }

    console.log("PASSED: User -> Driver");

    // Test 3: Driver -> User
    const driver = await Driver.findOne({
      where: { userId: driverUser.id },
      include: [
        {
          model: User,
          as: "user",
        },
      ],
    });

    if (!driver || !driver.user) {
      throw new Error("Driver -> User relationship failed.");
    }

    console.log("PASSED: Driver -> User");

    // Test 4: Tour -> Assignments -> Bus, Driver and Owner
    const tour = await Tour.findOne({
      where: { tourCode: "DEMO-TOUR-REL-001" },
      include: [
        {
          model: TourAssignment,
          as: "assignments",
          include: [
            {
              model: Bus,
              as: "bus",
            },
            {
              model: Driver,
              as: "driver",
            },
            {
              model: BusOwner,
              as: "owner",
            },
          ],
        },
      ],
    });

    if (!tour || tour.assignments.length === 0) {
      throw new Error("Tour -> Assignments relationship failed.");
    }

    const assignment = tour.assignments[0];

    if (!assignment.bus || !assignment.driver || !assignment.owner) {
      throw new Error("Assignment associations are incomplete.");
    }

    if (
      Number(assignment.owner.id) !==
      Number(assignment.bus.ownerId)
    ) {
      throw new Error("Assignment owner does not match bus owner.");
    }

    console.log("PASSED: Tour -> Assignments");
    console.log("PASSED: Assignment -> Bus");
    console.log("PASSED: Assignment -> Driver");
    console.log("PASSED: Assignment -> Owner");
    console.log("PASSED: Bus Owner consistency");

    console.log("\nAll relationship tests passed!");
  } catch (error) {
    console.error("\nRelationship test failed:");
    console.error(error.message);

    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

checkRelationships();
