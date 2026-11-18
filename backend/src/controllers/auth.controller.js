
const {
  User,
  Role,
  Driver,
  RefreshToken,
} = require("../models");

const { sequelize } = require("../config/database");
const environment = require("../config/environment");
const bcrypt = require("bcryptjs");
const { logActivity } = require("../services/activity.service");
const { isStrongPassword } = require("../utils/validators");

const {
  generateAccessToken,
  createRefreshJwt,
  hashToken,
  getDurationMs,
  verifyRefreshToken,
} = require("../utils/token.utils");

const REFRESH_COOKIE_NAME = "bus_pool_refresh";

// Failed-login throttle per e-mail (on top of the per-IP rate limit): 5 failures / 15 minutes -> locked for the rest of the window
const MAX_FAILED_LOGINS = 5;
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const failedLogins = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of failedLogins) if (entry.resetAt <= now) failedLogins.delete(key);
}, 60 * 1000).unref();

const loginLockedFor = (email) => {
  const entry = failedLogins.get(email);
  if (!entry || entry.resetAt <= Date.now() || entry.count < MAX_FAILED_LOGINS) return 0;
  return Math.ceil((entry.resetAt - Date.now()) / 1000);
};

const recordFailedLogin = (email) => {
  const now = Date.now();
  const entry = failedLogins.get(email);
  if (!entry || entry.resetAt <= now) failedLogins.set(email, { count: 1, resetAt: now + FAILED_LOGIN_WINDOW_MS });
  else entry.count += 1;
};

// Hash of a random string, only used to equalise login timing for unknown e-mails
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("not-a-real-password", 12);

// SameSite=None is only accepted by browsers together with Secure
const cookieSecure = () => environment.nodeEnv === "production" || environment.cookie.sameSite === "none";

const cookieOptions = () => ({
  httpOnly: true,
  secure: cookieSecure(),
  sameSite: environment.cookie.sameSite,
  domain: environment.cookie.domain,
  path: "/api/auth",
  maxAge: getDurationMs(environment.jwt.refreshExpiresIn),
});

const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE_NAME, token, cookieOptions());
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: environment.cookie.sameSite,
    domain: environment.cookie.domain,
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

const createSession = async (user, res, transaction) => {
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
    const { email, password } = req.body || {};

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

    const emailKey = email.trim().toLowerCase();

    const lockedFor = loginLockedFor(emailKey);
    if (lockedFor > 0) {
      res.setHeader("Retry-After", lockedFor);
      return res.status(429).json({
        success: false,
        message: "Too many failed login attempts. Please try again later.",
      });
    }

    const user = await User.findOne({
      where: {
        email: emailKey,
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

    if (!user) {
      // Spend the same time as a real check so response time does not reveal which e-mails exist
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      recordFailedLogin(emailKey);

      await logActivity({
        req,
        action: "auth.login_failed",
        entityType: "users",
        description: `Failed login for unknown account ${emailKey.slice(0, 120)}.`,
      });

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
      recordFailedLogin(emailKey);

      await logActivity({
        req,
        userId: user.id,
        action: "auth.login_failed",
        entityType: "users",
        entityId: user.id,
        description: "Failed login: wrong password.",
      });

      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    failedLogins.delete(emailKey);

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

      const accessToken = await createSession(
        user,
        res,
        transaction
      );

      await transaction.commit();

      await logActivity({
        req,
        userId: user.id,
        action: "auth.login",
        entityType: "users",
        entityId: user.id,
        description: `${user.role.name} logged in.`,
      });

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
      if (!transaction.finished) {
        await transaction.rollback();
      }

      clearRefreshCookie(res);
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/refresh
const refresh = async (req, res, next) => {
  let transaction;

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

    if (
      decoded.type !== "refresh" ||
      !decoded.sub ||
      !Number.isInteger(decoded.tokenVersion)
    ) {
      clearRefreshCookie(res);

      return res.status(401).json({
        success: false,
        message: "Invalid refresh token.",
      });
    }

    transaction = await sequelize.transaction();

    const storedToken = await RefreshToken.findOne({
      where: {
        userId: decoded.sub,
        tokenHash: hashToken(oldToken),
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

    // Reject refresh tokens created before a session reset.
    if (decoded.tokenVersion !== user.tokenVersion) {
      await storedToken.update(
        { revokedAt: new Date() },
        { transaction }
      );

      await transaction.commit();
      clearRefreshCookie(res);

      return res.status(401).json({
        success: false,
        message: "Your session has expired. Please login again.",
      });
    }

    // Rotate refresh token.
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
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    next(error);
  }
};

// POST /api/auth/logout
const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (refreshToken) {
      const stored = await RefreshToken.findOne({
        where: { tokenHash: hashToken(refreshToken), revokedAt: null },
        attributes: ["userId"],
      });
      if (stored) {
        await logActivity({
          req,
          userId: stored.userId,
          action: "auth.logout",
          entityType: "users",
          entityId: stored.userId,
          description: "User logged out.",
        });
      }

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

// POST /api/auth/logout-all
const logoutAllDevices = async (req, res, next) => {
  let transaction;

  try {
    transaction = await sequelize.transaction();

    const user = await User.findByPk(req.user.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!user || user.status !== "active") {
      await transaction.rollback();

      return res.status(401).json({
        success: false,
        message: "User account is unavailable.",
      });
    }

    // Incrementing this invalidates every existing access and refresh token.
    await user.increment("tokenVersion", {
      by: 1,
      transaction,
    });

    await RefreshToken.update(
      { revokedAt: new Date() },
      {
        where: {
          userId: user.id,
          revokedAt: null,
        },
        transaction,
      }
    );

    await transaction.commit();

    await logActivity({
      req,
      action: "auth.logout_all",
      entityType: "users",
      entityId: user.id,
      description: "User logged out from all devices.",
    });

    clearRefreshCookie(res);

    return res.status(200).json({
      success: true,
      message: "Successfully logged out from all devices. Please login again.",
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    next(error);
  }
};

// POST /api/auth/change-password
const changePassword = async (req, res, next) => {
  let transaction;

  try {
    const {
      currentPassword,
      newPassword,
      confirmPassword,
    } = req.body || {};

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      typeof confirmPassword !== "string" ||
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "All password fields are required.",
      });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be 8-72 characters and contain at least one letter and one number.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password do not match.",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password.",
      });
    }

    transaction = await sequelize.transaction();

    const user = await User.findByPk(req.user.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!user || user.status !== "active") {
      await transaction.rollback();

      return res.status(401).json({
        success: false,
        message: "User account is unavailable.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );

    if (!passwordMatches) {
      await transaction.rollback();

      return res.status(401).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await user.update(
      {
        passwordHash: newPasswordHash,
        tokenVersion: user.tokenVersion + 1,
      },
      { transaction }
    );

    await RefreshToken.update(
      { revokedAt: new Date() },
      {
        where: {
          userId: user.id,
          revokedAt: null,
        },
        transaction,
      }
    );

    await transaction.commit();

    await logActivity({
      req,
      action: "auth.password_change",
      entityType: "users",
      entityId: user.id,
      description: "User changed their password.",
    });

    clearRefreshCookie(res);

    return res.status(200).json({
      success: true,
      message: "Password changed successfully. Please login again.",
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    next(error);
  }
};

module.exports = {
  login,
  refresh,
  logout,
  logoutAllDevices,
  changePassword,
};
