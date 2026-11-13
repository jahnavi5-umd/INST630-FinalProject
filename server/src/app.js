import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import { config } from "./config.js";
import { requireAuth } from "./middleware/auth.js";
import { csrfGuard, errorHandler, notFound } from "./middleware/security.js";
import authRoutes from "./routes/auth.js";
import eventRoutes from "./routes/events.js";
import orgRoutes from "./routes/organizations.js";
import adminRoutes from "./routes/admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../../client/dist");

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", config.trustProxy);

  // ---- Security headers (CSP allows Google Identity Services + fonts + HTTPS event images) ----
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "script-src": ["'self'", "https://accounts.google.com/gsi/client"],
          "style-src": ["'self'", "'unsafe-inline'", "https://accounts.google.com/gsi/style", "https://fonts.googleapis.com"],
          "font-src": ["'self'", "https://fonts.gstatic.com"],
          "img-src": ["'self'", "data:", "https:"],
          "connect-src": ["'self'", "https://accounts.google.com/gsi/"],
          "frame-src": ["https://accounts.google.com/gsi/"],
          "object-src": ["'none'"],
          "base-uri": ["'self'"],
          "form-action": ["'self'"],
          "frame-ancestors": ["'none'"],
          "upgrade-insecure-requests": config.isProd ? [] : null,
        },
      },
      // Required so the Google sign-in popup can post the credential back.
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      strictTransportSecurity: config.isProd ? { maxAge: 63072000, includeSubDomains: true } : false,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    }),
  );

  app.use(
    cors({
      origin(origin, cb) {
        // Same-origin / non-browser requests have no Origin header.
        if (!origin || config.clientOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "X-Requested-With", "Authorization"],
      maxAge: 600,
    }),
  );

  app.use(express.json({ limit: "25kb" }));
  app.use(cookieParser());
  app.use(mongoSanitize()); // strips "$" and "." keys from body/query/params

  // ---- API ----
  const api = express.Router();
  api.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 600,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "Too many requests, slow down." },
    }),
  );
  api.use(csrfGuard);
  api.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  api.get("/health", (req, res) => res.json({ ok: true }));
  api.use("/auth", authRoutes);
  api.use("/events", requireAuth, eventRoutes);
  api.use("/organizations", requireAuth, orgRoutes);
  api.use("/admin", requireAuth, adminRoutes);
  api.use(notFound);
  app.use("/api", api);

  // ---- Serve the built React app in production (or API status when deployed standalone) ----
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false, maxAge: config.isProd ? "1h" : 0 }));
    app.get("*", (req, res) => res.sendFile(path.join(clientDist, "index.html")));
  } else {
    app.get("/", (req, res) => res.json({ ok: true, service: "terplink-api" }));
  }

  app.use(errorHandler);
  return app;
}
