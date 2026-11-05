
const {
  User,
  Role,
  Driver,
  RefreshToken,
} = require("../models");

const { sequelize } = require("../config/database");
const environment = require("../config/environment");

const {
  generateAccessToken,
  createRefreshJwt,
  hashToken,
  getDurationMs,
  verifyRefreshToken,
} = require("../utils/token.utils");

const bcrypt = require("bcryptjs");

const REFRESH_COOKIE_NAME = "bus_pool_refresh";

const cookieOptions = () => ({
  httpOnly: true,
  secure: environment.nodeEnv === "production",
  sameSite: "lax",
  path: "/api/auth",
  maxAge: getDurationMs(environment.jwt.refreshExpiresIn),
});

const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE_NAME, token, cookieOptions());
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: environment.nodeEnv === "production",
    sameSite: "lax",
    path: "/api/auth",
  });
};

const getColomboDate = () => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: environment.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
};

const loadUser = async (userId, transaction = null) => {
  return User.findByPk(userId, {
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
    transaction,
  });
};

const validateAccount = (user) => {
  if (!user || user.status !== "active") {
    return "Account is inactive or unavailable.";
  }

  if (!user.role || !["Admin", "Driver"].includes(user.role.name)) {
    return "You are not authorized to access this system.";
  }

  if (user.role.name === "Driver") {
    if (!user.driver || user.driver.status !== "active") {
      return "Driver profile is inactive or unavailable.";
    }

    if (user.driver.licenseExpiryDate < getColomboDate()) {
      return "Your driving license has expired. Please contact the administrator.";
    }
  }

  return null;
};

const createSession = async (user, res, transaction = null) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = createRefreshJwt(user);

  await RefreshToken.create(
    {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(
        Date.now() + getDurationMs(environment.jwt.refreshExpiresIn)
      ),
    },
    { transaction }
  );

  setRefreshCookie(res, refreshToken);

  return accessToken;
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      where: { email: normalizedEmail },
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

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const accountError = validateAccount(user);

    if (accountError) {
      return res.status(403).json({
        success: false,
        message: accountError,
      });
    }

    const transaction = await sequelize.transaction();

    try {
      await user.update(
        { lastLoginAt: new Date() },
        { transaction }
      );

      const accessToken = await createSession(user, res, transaction);

      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: "Login successful.",
        data: {
          accessToken,
          tokenType: "Bearer",
          expiresIn: environment.jwt.accessExpiresIn,
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            role: user.role.name,
          },
        },
      });
    } catch (error) {
      await transaction.rollback();
      clearRefreshCookie(res);
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/refresh
const refresh = async (req, res, next) => {
  try {
    const oldToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!oldToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is missing. Please login again.",
      });
    }

    let decoded;

    try {
      decoded = verifyRefreshToken(oldToken);
    } catch {
      clearRefreshCookie(res);

      return res.status(401).json({
        success: false,
        message: "Refresh token is invalid or expired.",
      });
    }

    if (decoded.type !== "refresh") {
      clearRefreshCookie(res);

      return res.status(401).json({
        success: false,
        message: "Invalid refresh token.",
      });
    }

    const transaction = await sequelize.transaction();

    try {
      const oldTokenHash = hashToken(oldToken);

      const storedToken = await RefreshToken.findOne({
        where: {
          userId: decoded.sub,
          tokenHash: oldTokenHash,
          revokedAt: null,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (
        !storedToken ||
        new Date(storedToken.expiresAt).getTime() <= Date.now()
      ) {
        await transaction.rollback();
        clearRefreshCookie(res);

        return res.status(401).json({
          success: false,
          message: "Refresh token is invalid or expired.",
        });
      }

      const user = await loadUser(decoded.sub, transaction);
      const accountError = validateAccount(user);

      if (accountError) {
        await storedToken.update(
          { revokedAt: new Date() },
          { transaction }
        );

        await transaction.commit();
        clearRefreshCookie(res);

        return res.status(403).json({
          success: false,
          message: accountError,
        });
      }

      await storedToken.update(
        { revokedAt: new Date() },
        { transaction }
      );

      const accessToken = generateAccessToken(user);
      const newRefreshToken = createRefreshJwt(user);

      await RefreshToken.create(
        {
          userId: user.id,
          tokenHash: hashToken(newRefreshToken),
          expiresAt: new Date(
            Date.now() + getDurationMs(environment.jwt.refreshExpiresIn)
          ),
        },
        { transaction }
      );

      await transaction.commit();

      setRefreshCookie(res, newRefreshToken);

      return res.status(200).json({
        success: true,
        message: "Token refreshed successfully.",
        data: {
          accessToken,
          tokenType: "Bearer",
          expiresIn: environment.jwt.accessExpiresIn,
        },
      });
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/logout
const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (refreshToken) {
      await RefreshToken.update(
        { revokedAt: new Date() },
        {
          where: {
            tokenHash: hashToken(refreshToken),
            revokedAt: null,
          },
        }
      );
    }

    clearRefreshCookie(res);

    return res.status(200).json({
      success: true,
      message: "Logout successful.",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  refresh,
  logout,
};
