
const { User, Role, Driver } = require("../models");
const { verifyAccessToken } = require("../utils/token.utils");

const authenticate = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required.",
      });
    }

    const token = authorization.split(" ")[1];

    const decoded = verifyAccessToken(token);

    if (!decoded.sub || !decoded.role) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    const user = await User.findByPk(decoded.sub, {
      attributes: {
        exclude: ["passwordHash"],
      },
      include: [
        {
          model: Role,
          as: "role",
          attributes: ["id", "name"],
        },
        {
          model: Driver,
          as: "driver",
          required: false,
        },
      ],
    });

    if (!user || user.status !== "active") {
      return res.status(401).json({
        success: false,
        message: "User account is inactive or unavailable.",
      });
    }

    if (user.role?.name !== decoded.role) {
      return res.status(401).json({
        success: false,
        message: "User permissions have changed. Please login again.",
      });
    }

    if (!["Admin", "Driver"].includes(user.role.name)) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    if (user.role.name === "Driver") {
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Colombo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      if (
        !user.driver ||
        user.driver.status !== "active" ||
        user.driver.licenseExpiryDate < today
      ) {
        return res.status(403).json({
          success: false,
          message: "Driver profile is inactive or license has expired.",
        });
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.name,
      driverId: user.driver?.id || null,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired access token.",
    });
  }
};

module.exports = {
  authenticate,
};
