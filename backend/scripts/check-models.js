const { sequelize } = require("../src/config/database");
const models = require("../src/models");

const checkModels = async () => {
  let hasErrors = false;

  try {
    await sequelize.authenticate();

    console.log("\nDatabase connection successful.\n");
    console.log("Checking Sequelize models...\n");

    for (const [modelName, Model] of Object.entries(models)) {
      const tableName = Model.getTableName();

      try {
        const columns = await sequelize
          .getQueryInterface()
          .describeTable(tableName);

        const missingColumns = Object.values(Model.rawAttributes)
          .map((attribute) => attribute.field || attribute.fieldName)
          .filter((columnName) => !columns[columnName]);

        if (missingColumns.length > 0) {
          hasErrors = true;

          console.log(`FAILED: ${modelName}`);
          console.log("Missing columns:", missingColumns.join(", "));
        } else {
          console.log(`PASSED: ${modelName} -> ${tableName}`);
        }
      } catch (error) {
        hasErrors = true;
        console.log(`FAILED: ${modelName}`);
        console.log(error.message);
      }
    }

    console.log("\nChecking model relationships...\n");

    for (const [modelName, Model] of Object.entries(models)) {
      const associations = Object.keys(Model.associations);

      console.log(
        `${modelName}: ${associations.length} relationship(s)`
      );
    }

    if (hasErrors) {
      console.log("\nSome models need corrections.");
      process.exitCode = 1;
    } else {
      console.log("\nAll models and table columns passed!");
    }
  } catch (error) {
    console.error("Model checking failed:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

checkModels();