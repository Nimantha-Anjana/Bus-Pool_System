
const express = require("express");
const router = express.Router();

const {
  login,
  refresh,
  logout,
} = require("../controllers/auth.controller");

const {
  authenticate,
} = require("../middleware/auth.middleware");

router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);

router.get("/me", authenticate, (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  });
});

module.exports = router;
