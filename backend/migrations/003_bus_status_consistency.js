// One-off repair: make buses.status agree with the tour assignments (see services/consistency.service.js)
const { reconcileBusStatuses } = require("../src/services/consistency.service");

module.exports = {
  name: "003_bus_status_consistency",
  async up() {
    const result = await reconcileBusStatuses();
    console.log(`  buses set to assigned: ${result.markedAssigned}, released: ${result.released}`);
  },
};
