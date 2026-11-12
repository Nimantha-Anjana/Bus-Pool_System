const express = require("express");
const router = express.Router();

const { createRateLimiter } = require("../middleware/rate-limit.middleware");
const {
  previewAction,
  respondJson,
  showPage,
  respondForm,
} = require("../controllers/assignment-action.controller");

// Public (no login) but rate limited: the single-use e-mail token is the credential
router.use(createRateLimiter({ windowMs: 60 * 1000, max: 30 }));

router.post("/respond", respondJson);
router.post("/respond-form", respondForm);
router.get("/:token/page", showPage);
router.get("/:token", previewAction);

module.exports = router;
