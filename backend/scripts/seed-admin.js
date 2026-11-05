
require("dotenv").config();

const bcrypt = require("bcryptjs");
const { Role, User } = require("../src/models");

const seedAdmin = async () => {
  try {
    const {
      ADMIN_FIRST_NAME,
      ADMIN_LAST_NAME,
      ADMIN_EMAIL,
      ADMIN_PASSWORD,
      ADMIN_PHONE,
    } = process.env;

    // Validate environment variables
    if (
      !ADMIN_FIRST_NAME ||
      !ADMIN_LAST_NAME ||
      !ADMIN_EMAIL ||
      !ADMIN_PASSWORD
    ) {
      throw new Error(
        "Missing admin environment variables. Check backend/.env"
      );
    }

    if (ADMIN_PASSWORD.length < 12) {
      throw new Error(
        "Admin password must contain at least 12 characters."
      );
    }

    const sequelize = User.sequelize;

    await sequelize.authenticate();

    console.log("Database connected.");

    // Find or create Admin role
    const [adminRole, roleCreated] = await Role.findOrCreate({
      where: { name: "Admin" },
      defaults: {
        name: "Admin",
        description: "Full system administrator",
      },
    });

    console.log(
      roleCreated ? "Admin role created." : "Admin role already exists."
    );

    // Check whether the admin email already exists
    const existingUser = await User.findOne({
      where: { email: ADMIN_EMAIL },
    });

    if (existingUser) {
      if (existingUser.roleId !== adminRole.id) {
        throw new Error(
          "This email already belongs to a different user role."
        );
      }

      console.log("Admin account already exists.");
      console.log("No duplicate account was created.");
      return;
    }

    // Hash password before saving
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

    // Create initial admin account
    const admin = await User.create({
      roleId: adminRole.id,
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
      email: ADMIN_EMAIL,
      passwordHash,
      phone: ADMIN_PHONE || null,
      status: "active",
    });

    console.log("\nAdmin account created successfully!");
    console.log("--------------------------------");
    console.log(`Admin ID: ${admin.id}`);
    console.log(`Email: ${admin.email}`);
    console.log(`Role: ${adminRole.name}`);
    console.log(`Status: ${admin.status}`);
    console.log("--------------------------------");
    console.log("Password was securely hashed.");
  } catch (error) {
    console.error("\nAdmin seeding failed:");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    if (User.sequelize) {
      await User.sequelize.close();
    }
  }
};

seedAdmin();
