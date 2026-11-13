import { Router } from "express";
import rateLimit from "express-rate-limit";
import { OAuth2Client } from "google-auth-library";
import { config, isAdminEmail } from "../config.js";
import { User } from "../models/User.js";
import { Event } from "../models/Event.js";
import { clearSession, issueSession, requireAuth } from "../middleware/auth.js";

const router = Router();
const googleClient = new OAuth2Client(config.googleClientId);

// Strict limiter for sign-in attempts.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Please try again in a few minutes." },
});

/** True for "umd.edu" and any subdomain such as "terpmail.umd.edu". */
export function isAllowedEmail(email, domain = config.allowedEmailDomain) {
  if (typeof email !== "string") return false;
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 1) return false;
  const local = trimmed.slice(0, at);
  const host = trimmed.slice(at + 1);
  if (!/^[a-z0-9._+-]+$/.test(local)) return false;
  return host === domain || host.endsWith(`.${domain}`);
}

router.get("/config", (req, res) => {
  res.json({
    googleClientId: config.googleClientId || null,
    allowedDomain: config.allowedEmailDomain,
    adminEmail: config.primaryAdminEmail,
  });
});

router.post("/google", loginLimiter, async (req, res, next) => {
  try {
    if (!config.googleClientId) {
      return res.status(503).json({ error: "Google sign-in is not configured on the server." });
    }
    const credential = req.body?.credential;
    if (typeof credential !== "string" || credential.length < 100 || credential.length > 4096) {
      return res.status(400).json({ error: "Missing Google credential." });
    }

    // Verifies the signature, expiry, issuer and that the token was minted for OUR client ID.
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: config.googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ error: "Google sign-in could not be verified. Please try again." });
    }

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      return res.status(401).json({ error: "Your Google email address is not verified." });
    }
    if (!isAllowedEmail(payload.email)) {
      return res.status(403).json({
        error: `Access restricted: only University of Maryland (@${config.allowedEmailDomain} or @terpmail.${config.allowedEmailDomain}) Google accounts can sign in.`,
      });
    }

    const existing = await User.findOne({ googleId: payload.sub });
    let defaultSaved = [];
    if (!existing) {
      const defaultEvent = await Event.findOne({ title: "Terps After Dark: Live" }).select("_id");
      if (defaultEvent) defaultSaved = [defaultEvent._id];
    }

    const normalizedEmail = payload.email.trim().toLowerCase();
    const fallbackName = normalizedEmail.split("@")[0];
    const fullName = (payload.name || fallbackName).trim().slice(0, 120);
    const role = isAdminEmail(normalizedEmail) ? "admin" : existing?.role === "admin" ? "admin" : "student";
    const update = {
      email: normalizedEmail,
      name: fullName,
      givenName: (payload.given_name || fullName.split(/\s+/)[0]).slice(0, 60),
      familyName: (payload.family_name || "").slice(0, 60),
      picture: payload.picture || null,
      role,
      lastLoginAt: new Date(),
    };

    const user = await User.findOneAndUpdate(
      { googleId: payload.sub },
      {
        $set: update,
        $setOnInsert: { googleId: payload.sub, savedEvents: defaultSaved },
      },
      { new: true, upsert: true, runValidators: true },
    );

    const token = issueSession(res, user);
    res.json({ user: user.toClient(), token });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user.toClient() });
});

router.post("/logout", (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

// Signs the user out on every device by invalidating all issued sessions.
router.post("/logout-all", requireAuth, async (req, res, next) => {
  try {
    req.user.tokenVersion += 1;
    await req.user.save();
    clearSession(res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
