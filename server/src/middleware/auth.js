import jwt from "jsonwebtoken";
import { config, isAdminEmail } from "../config.js";
import { User } from "../models/User.js";

const JWT_OPTS = { issuer: "terplink-api", audience: "terplink-web" };

export function issueSession(res, user) {
  const token = jwt.sign({ sub: user._id.toString(), v: user.tokenVersion }, config.jwtSecret, {
    ...JWT_OPTS,
    algorithm: "HS256",
    expiresIn: config.sessionTtlSeconds,
  });
  res.cookie(config.sessionCookie, token, sessionCookieOptions());
  return token;
}

export function clearSession(res) {
  const { maxAge, ...opts } = sessionCookieOptions();
  res.clearCookie(config.sessionCookie, opts);
}

function sessionCookieOptions() {
  return {
    httpOnly: true, // not readable from JavaScript (XSS can't steal it)
    secure: config.isProd, // HTTPS only in production
    sameSite: config.isProd ? "none" : "lax", // allows cross-origin Vercel client -> Vercel server over HTTPS
    partitioned: config.isProd,
    path: "/",
    maxAge: config.sessionTtlSeconds * 1000,
  };
}

function extractToken(req) {
  const cookieToken = req.cookies?.[config.sessionCookie];
  if (cookieToken) return cookieToken;
  const authHeader = req.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return null;
}

/** Requires a valid session; attaches req.user (a Mongoose document). */
export async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: "Not signed in" });

    const payload = jwt.verify(token, config.jwtSecret, { ...JWT_OPTS, algorithms: ["HS256"] });
    const user = await User.findById(payload.sub);
    if (!user || user.tokenVersion !== payload.v) {
      clearSession(res);
      return res.status(401).json({ error: "Session expired" });
    }
    if (isAdminEmail(user.email) && user.role !== "admin") {
      user.role = "admin";
      await user.save();
    }
    req.user = user;
    next();
  } catch {
    clearSession(res);
    return res.status(401).json({ error: "Session expired" });
  }
}

/** Restricts access to the App Admin (jahnavi5@umd.edu). */
export function requireAdmin(req, res, next) {
  if (!req.user || (req.user.role !== "admin" && !isAdminEmail(req.user.email))) {
    return res.status(403).json({
      error: `Admin access required (${config.primaryAdminEmail}).`,
    });
  }
  next();
}
