import { createHash, randomBytes } from "node:crypto";
import { verifyPassword } from "../onboarding.js";
import {
  changePassword,
  createPasswordHash,
  requestPasswordReset,
  resetPassword,
  validatePasswordResetToken,
} from "../passwords.js";

export async function handleAuthRoutes(context) {
  const {
    req,
    res,
    pathname,
    db,
    sendJson,
    readBody,
    saveDb,
    authenticatedUser,
    rateLimiter,
    cookieMap,
    sessionCookie,
  } = context;

  if (req.method === "POST" && pathname === "/api/auth/login") {
    const limitResult = await rateLimiter.check(
      "login",
      req.socket.remoteAddress,
      {
        limit: 10,
        windowMs: 15 * 60 * 1000,
      },
    );
    if (!limitResult.allowed) {
      return sendJson(
        res,
        429,
        {
          error: "Too many sign-in attempts. Try again later.",
          code: "RATE_LIMITED",
        },
        { "retry-after": limitResult.retryAfterSeconds },
      );
    }
    const body = await readBody(req);
    const user = db.users.find(
      (item) =>
        item.email.toLowerCase() === String(body.email || "").toLowerCase(),
    );
    const allowDemoCredentials =
      process.env.NODE_ENV !== "production" &&
      process.env.ALLOW_DEMO_CREDENTIALS === "true";
    const validPassword =
      user &&
      (user.passwordHash
        ? verifyPassword(String(body.password || ""), user.passwordHash)
        : allowDemoCredentials && body.password === "Password@123");
    if (!user || user.status !== "active" || !validPassword) {
      return sendJson(res, 401, { error: "Invalid email or password." });
    }
    if (!user.passwordHash)
      user.passwordHash = createPasswordHash(String(body.password || ""));
    const sessionToken = randomBytes(32).toString("base64url");
    const now = new Date();
    db.sessions ||= [];
    db.sessions.push({
      id: `session-${Date.now()}`,
      userId: user.id,
      tokenDigest: createHash("sha256").update(sessionToken).digest("hex"),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString(),
      revokedAt: "",
    });
    await saveDb(db);
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return sendJson(
      res,
      200,
      { user: safeUser },
      { "set-cookie": sessionCookie(sessionToken) },
    );
  }

  if (req.method === "GET" && pathname === "/api/auth/session") {
    const user = authenticatedUser(req, db);
    if (!user)
      return sendJson(res, 401, {
        error: "Your session has expired. Sign in again.",
      });
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return sendJson(res, 200, { user: safeUser });
  }

  if (req.method === "POST" && pathname === "/api/auth/logout") {
    const cookies = cookieMap(req.headers.cookie);
    const rawToken = decodeURIComponent(cookies.booking_session || "");
    const digest = rawToken
      ? createHash("sha256").update(rawToken).digest("hex")
      : "";
    const session = (db.sessions || []).find(
      (item) => item.tokenDigest === digest,
    );
    if (session) {
      session.revokedAt = new Date().toISOString();
      await saveDb(db);
    }
    return sendJson(
      res,
      200,
      { ok: true },
      { "set-cookie": sessionCookie("", 0) },
    );
  }

  if (req.method === "POST" && pathname === "/api/auth/password/forgot") {
    const limitResult = await rateLimiter.check(
      "forgot-password",
      req.socket.remoteAddress,
      {
        limit: 5,
        windowMs: 15 * 60 * 1000,
      },
    );
    if (!limitResult.allowed) {
      return sendJson(
        res,
        429,
        { error: "Too many requests. Try again later.", code: "RATE_LIMITED" },
        { "retry-after": limitResult.retryAfterSeconds },
      );
    }
    const body = await readBody(req);
    await requestPasswordReset(
      db,
      body.email,
      process.env.APP_URL || "http://localhost:3000",
    );
    await saveDb(db);
    return sendJson(res, 202, {
      message:
        "If an active account matches that email, a password reset link has been sent.",
    });
  }

  if (
    req.method === "POST" &&
    pathname === "/api/auth/password/reset/validate"
  ) {
    const body = await readBody(req);
    const result = validatePasswordResetToken(db, body.token);
    return sendJson(
      res,
      result.valid ? 200 : 422,
      result.valid
        ? {
            valid: true,
            email: result.user.email,
            expiresAt: result.token.expiresAt,
          }
        : result,
    );
  }

  if (req.method === "POST" && pathname === "/api/auth/password/reset") {
    const body = await readBody(req);
    if (body.password !== body.confirmPassword) {
      return sendJson(res, 422, {
        valid: false,
        error: "Passwords do not match.",
      });
    }
    const result = resetPassword(db, body.token, body.password);
    if (result.valid) await saveDb(db);
    return sendJson(res, result.valid ? 200 : 422, result);
  }

  if (req.method === "POST" && pathname === "/api/auth/password/change") {
    const viewer = authenticatedUser(req, db);
    if (!viewer)
      return sendJson(res, 401, { error: "Authentication is required" });
    const body = await readBody(req);
    if (body.newPassword !== body.confirmPassword) {
      return sendJson(res, 422, {
        valid: false,
        error: "Passwords do not match.",
      });
    }
    const result = changePassword(
      db,
      viewer,
      body.currentPassword,
      body.newPassword,
    );
    if (result.valid) await saveDb(db);
    return sendJson(res, result.valid ? 200 : result.status || 422, result);
  }

  if (req.method === "PATCH" && pathname === "/api/profile") {
    const viewer = authenticatedUser(req, db);
    if (!viewer)
      return sendJson(res, 401, { error: "Authentication is required" });
    const body = await readBody(req);
    const avatarUrl = String(body.avatarUrl || "");
    if (
      avatarUrl &&
      !/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(avatarUrl)
    ) {
      return sendJson(res, 422, {
        error: "Choose a valid JPEG, PNG, or WebP image",
      });
    }
    if (Buffer.byteLength(avatarUrl, "utf8") > 1_400_000) {
      return sendJson(res, 413, { error: "Choose an image smaller than 1 MB" });
    }
    viewer.avatarUrl = avatarUrl;
    viewer.updatedAt = new Date().toISOString();
    await saveDb(db);
    const { passwordHash: _passwordHash, ...safeUser } = viewer;
    return sendJson(res, 200, { user: safeUser });
  }

  return null;
}
