import mongoose from "mongoose";
import { config } from "../config.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence in depth (on top of SameSite=strict cookies):
 *  - state-changing requests must carry a custom header, which browsers will not
 *    send cross-origin without a CORS preflight that we reject;
 *  - if an Origin header is present it must be one of our allowed origins.
 */
export function csrfGuard(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.get("X-Requested-With") !== "XMLHttpRequest") {
    return res.status(403).json({ error: "Forbidden" });
  }
  const origin = req.get("Origin");
  if (origin && !config.clientOrigins.includes(origin)) {
    return res.status(403).json({ error: "Forbidden origin" });
  }
  next();
}

/** Rejects requests whose :id param is not a valid ObjectId. */
export function validateObjectId(param = "id") {
  return (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params[param])) {
      return res.status(400).json({ error: "Invalid id" });
    }
    next();
  };
}

export function notFound(req, res) {
  res.status(404).json({ error: "Not found" });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Payload too large" });
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Malformed JSON" });
  console.error("[error]", err);
  // Never leak stack traces / internals to the client.
  res.status(err.status || 500).json({ error: err.expose ? err.message : "Something went wrong" });
}

