import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const isProd = process.env.NODE_ENV === "production";

function fail(message) {
  console.error(`\n[config] ${message}\n`);
  process.exit(1);
}

const jwtSecret = process.env.JWT_SECRET || "";
if (jwtSecret.length < 32) {
  fail("JWT_SECRET must be set and at least 32 characters long (see server/.env.example).");
}

const googleClientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
if (!googleClientId) {
  if (isProd) fail("GOOGLE_CLIENT_ID is required in production.");
  console.warn("[config] GOOGLE_CLIENT_ID is not set - Google sign-in will be unavailable.");
}

const mongoUri = (process.env.MONGODB_URI || "").trim();
if (isProd && !mongoUri) fail("MONGODB_URI is required in production.");

const defaultAdmins = ["jahnavi5@umd.edu", "jahnavi5@terpmail.umd.edu"];
const envAdmins = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const adminEmails = Object.freeze(Array.from(new Set([...defaultAdmins, ...envAdmins])));

export function isAdminEmail(email) {
  if (typeof email !== "string") return false;
  return adminEmails.includes(email.trim().toLowerCase());
}

export const config = Object.freeze({
  isProd,
  port: Number(process.env.PORT) || 5000,
  mongoUri,
  mongoDbName: (process.env.MONGODB_DB || "terplink").trim(),
  jwtSecret,
  googleClientId,
  adminEmails,
  primaryAdminEmail: "jahnavi5@umd.edu",
  clientOrigins: (process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean),
  allowedEmailDomain: (process.env.ALLOWED_EMAIL_DOMAIN || "umd.edu").trim().toLowerCase(),
  trustProxy:
    process.env.TRUST_PROXY !== undefined
      ? Number(process.env.TRUST_PROXY) || 0
      : process.env.VERCEL || isProd
        ? 1
        : 0,
  sessionCookie: isProd ? "__Host-tl_session" : "tl_session",
  sessionTtlSeconds: 60 * 60 * 24 * 7, // 7 days
});
