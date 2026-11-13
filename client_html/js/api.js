// Thin fetch wrapper for TerpLink Vanilla JS client.
// Session lives in an httpOnly cookie (with an in-memory + sessionStorage Bearer
// fallback for browsers that block cross-origin cookies between separate deployments).
// The X-Requested-With custom header is required by the server's CSRF guard.

const DEFAULT_PROD_API = "https://terplink-backend.vercel.app";
const isLocalhost =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

const metaUrl = document.querySelector('meta[name="terplink-api-url"]')?.getAttribute("content") || "";
const configuredUrl = String(window.TERPLINK_API_URL ?? metaUrl ?? "").trim();
const rawBase = (configuredUrl || (isLocalhost ? "" : DEFAULT_PROD_API)).replace(/\/+$/, "");
const API_BASE = rawBase.endsWith("/api") ? rawBase.slice(0, -4) : rawBase;

const TOKEN_STORAGE_KEY = "tl_session_token";
let memoryToken = null;
try {
  memoryToken = sessionStorage.getItem(TOKEN_STORAGE_KEY) || null;
} catch {
  /* sessionStorage unavailable */
}

export function setSessionToken(token) {
  memoryToken = token || null;
  try {
    if (memoryToken) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, memoryToken);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    /* ignore storage errors */
  }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(method, url, body) {
  const res = await fetch(`${API_BASE}/api${url}`, {
    method,
    credentials: API_BASE ? "include" : "same-origin",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      ...(memoryToken ? { Authorization: `Bearer ${memoryToken}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data;
}

export const api = {
  get: (url) => request("GET", url),
  post: (url, body = {}) => request("POST", url, body),
  put: (url, body = {}) => request("PUT", url, body),
  del: (url) => request("DELETE", url),
};
